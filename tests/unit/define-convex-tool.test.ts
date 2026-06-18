import { v } from 'convex/values'
import type { H3Event } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { definePermissionKey } from '../../src/runtime/auth'
import { serverConvexMutation, serverConvexQuery } from '../../src/runtime/convex/server/convex'
import { hashConfirmationToken } from '../../src/runtime/functions/confirmation-token'
import {
  defineOperation,
  defineOperationDescriptor,
  operationPreview,
  previewOf,
  projectOperationRef,
} from '../../src/runtime/functions/define-operation'
import { defineConvexToolInternal } from '../../src/runtime/mcp/define-convex-tool'
import { defineMcpApp } from '../../src/runtime/mcp/define-mcp-app'
import { ToolRateLimiter } from '../../src/runtime/mcp/rate-limiter'
import { unsafe } from '../../src/runtime/mcp/unsafe-permit'
import { defineArgs } from '../../src/runtime/schema'
import { createServerConvexCaller } from '../../src/runtime/server'
import { createObservationCapture } from '../../src/runtime/testing'

const { useEventMock } = vi.hoisted(() => ({
  useEventMock: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
  useEvent: useEventMock,
}))

vi.mock('../../src/runtime/convex/server/convex', () => ({
  serverConvexQuery: vi.fn(),
  serverConvexMutation: vi.fn(),
  serverConvexAction: vi.fn(),
  transportProof: {
    mcp: (input: Record<string, unknown>) => ({ transport: 'mcp', ...input }),
  },
  operationConfirmation: (input: { jti: string }) => ({
    mode: 'operation-confirmation',
    jti: input.jti,
  }),
  jtiRedemption: (input: { jti: string }) => ({ mode: 'jti-redemption', jti: input.jti }),
}))

function deletePostPreview(extra?: { version?: unknown }) {
  return operationPreview({
    summary: 'Delete post',
    confirm: { id: 'post-1' },
    ...(extra?.version === undefined ? {} : { version: extra.version }),
  })
}

function createEvent(auth?: { role?: string; userId?: string; workspaceId?: string }): H3Event {
  return {
    __is_event__: true,
    method: 'POST',
    path: '/mcp',
    headers: new Headers(),
    context: {
      ...(auth ? { mcpAuth: auth } : {}),
    },
    node: {
      req: {},
      res: {},
    },
  } as unknown as H3Event
}

const emptySchema = defineArgs({
  description: 'Test tool',
  args: {},
})

const scopedSchema = defineArgs({
  description: 'Scoped tool',
  args: {
    title: v.string(),
  },
})

const postOperationPermission = definePermissionKey('posts.manage')

async function allowPostOperationAccess() {
  return {
    [postOperationPermission.key]: true,
  }
}

let rateLimitStore: ToolRateLimiter

describe('defineConvexToolInternal MCP input projection', () => {
  it('projects ids, arrays, records, nested objects, and literal unions into JSON-schema-safe Zod', () => {
    const schema = defineArgs({
      description: 'Projected tool',
      args: {
        postId: v.id('posts'),
        workspaceId: v.optional(v.id('workspaces')),
        tagIds: v.array(v.id('tags')),
        labels: v.union(v.string(), v.record(v.string(), v.string())),
        filters: v.object({
          ownerId: v.id('users'),
          metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.null()))),
        }),
        visibility: v.optional(v.union(v.literal('public'), v.literal('draft'))),
      },
      meta: {
        postId: {
          description: 'The post to load.',
        },
      },
    })

    const tool = defineConvexToolInternal({
      schema,
      effect: 'read',
      name: 'projected-tool',
      handler: async (args, ctx) => ctx.ok(args),
    })

    const inputShape = tool.inputSchema ?? {}
    const inputSchema = z.object(inputShape)

    expect(() => z.toJSONSchema(inputSchema)).not.toThrow()
    expect(inputShape.postId?.description).toContain('Convex ID for "posts" table')
    expect(inputShape.postId?.description).toContain('The post to load.')

    expect(
      inputSchema.safeParse({
        postId: 'post_1',
        tagIds: ['tag_1', 'tag_2'],
        labels: { en: 'Hello' },
        filters: { ownerId: 'user_1' },
        visibility: 'public',
      }).success,
    ).toBe(true)

    expect(
      inputSchema.safeParse({
        postId: 'post_1',
        workspaceId: undefined,
        tagIds: ['tag_1'],
        labels: 'Hello',
        filters: {
          ownerId: 'user_1',
          metadata: {
            section: 'hero',
            priority: 1,
            fallback: null,
          },
        },
      }).success,
    ).toBe(true)
  })

  it('fails fast on unions containing ids', () => {
    const schema = defineArgs({
      description: 'Ambiguous tool',
      args: {
        target: v.union(v.id('posts'), v.string()),
      },
    })

    expect(() =>
      defineConvexToolInternal({
        schema,
        effect: 'read',
        name: 'ambiguous-tool',
        handler: async (args, ctx) => ctx.ok(args),
      }),
    ).toThrow(/v\.union\(\) containing v\.id\(\) at "target" cannot be projected/)
  })

  it('fails fast on unsupported validator kinds', () => {
    const schema = defineArgs({
      description: 'Unsupported tool',
      args: {
        count: v.int64(),
      },
    })

    expect(() =>
      defineConvexToolInternal({
        schema,
        effect: 'read',
        name: 'unsupported-tool',
        handler: async (args, ctx) => ctx.ok(args),
      }),
    ).toThrow(/validator kind "int64" at "count" is not supported/)
  })
})

describe('defineConvexToolInternal visibility and auth parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitStore = new ToolRateLimiter()
    useEventMock.mockReturnValue(createEvent())
  })

  afterEach(() => {
    delete process.env.CONVEX_IDENTITY_FORWARDING_KEY
  })

  it('hides auth-required tools for anonymous callers', async () => {
    const tool = defineConvexToolInternal({
      schema: emptySchema,
      effect: 'read',
      name: 'private-tool',
      auth: 'required',
      handler: async (_args, ctx) => ctx.ok({ ok: true }),
    })

    await expect(tool.enabled?.(createEvent())).resolves.toBe(false)
  })

  it('hides check-denied tools during discovery', async () => {
    const tool = defineConvexToolInternal({
      schema: emptySchema,
      effect: 'read',
      name: 'member-only-tool',
      auth: 'required',
      check: (appIdentity) => appIdentity.role === 'member',
      handler: async (_args, ctx) => ctx.ok({ ok: true }),
    })

    await expect(
      tool.enabled?.(createEvent({ role: 'viewer', userId: 'viewer-1', workspaceId: 'org-1' })),
    ).resolves.toBe(false)
    await expect(
      tool.enabled?.(createEvent({ role: 'member', userId: 'member-1', workspaceId: 'org-1' })),
    ).resolves.toBe(true)
  })

  it('rejects non-boolean MCP check results during discovery', async () => {
    const tool = defineConvexToolInternal({
      schema: emptySchema,
      effect: 'read',
      name: 'invalid-check-tool',
      auth: 'required',
      check: (async () => ({ allowed: true })) as unknown as (appIdentity: {
        role: string
      }) => boolean,
      handler: async (_args, ctx) => ctx.ok({ ok: true }),
    })

    await expect(
      tool.enabled?.(createEvent({ role: 'member', userId: 'member-1', workspaceId: 'org-1' })),
    ).rejects.toThrow(/MCP tool checks must return a boolean\. Received object\./)
  })

  it('hides scoped tools when the appIdentity has no workspaceId', async () => {
    const tool = defineConvexToolInternal({
      schema: scopedSchema,
      effect: 'read',
      name: 'scoped-tool',
      auth: 'required',
      scoped: true,
      handler: async (_args, ctx) => ctx.ok({ ok: true }),
    })

    await expect(tool.enabled?.(createEvent({ role: 'member', userId: 'member-1' }))).resolves.toBe(
      false,
    )
    await expect(
      tool.enabled?.(createEvent({ role: 'member', userId: 'member-1', workspaceId: 'org-1' })),
    ).resolves.toBe(true)
  })

  it('keeps handler-time auth errors aligned when execution bypasses discovery', async () => {
    const tool = defineConvexToolInternal({
      schema: emptySchema,
      effect: 'read',
      name: 'guarded-tool',
      auth: 'required',
      check: (appIdentity) => appIdentity.role === 'member',
      handler: async (_args, ctx) => ctx.ok({ ok: true }),
    })

    useEventMock.mockReturnValue(
      createEvent({ role: 'viewer', userId: 'viewer-1', workspaceId: 'org-1' }),
    )

    const result = await tool.handler({} as never, {} as never)

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          category: 'auth',
          message: 'Forbidden.',
        },
      },
    })
  })

  it('rejects invalid MCP check results before handler execution', async () => {
    const handler = vi.fn(async (_args, ctx) => ctx.ok({ ok: true }))
    const tool = defineConvexToolInternal({
      schema: emptySchema,
      effect: 'read',
      name: 'invalid-handler-check-tool',
      auth: 'required',
      check: (() => 'true') as unknown as (appIdentity: { role: string }) => boolean,
      handler,
    })

    useEventMock.mockReturnValue(
      createEvent({ role: 'member', userId: 'member-1', workspaceId: 'org-1' }),
    )

    const result = await tool.handler({} as never, {} as never)

    expect(handler).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          message: expect.stringContaining('MCP tool checks must return a boolean'),
        },
      },
    })
  })
})

describe('defineConvexToolInternal error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitStore = new ToolRateLimiter()
    useEventMock.mockReturnValue(createEvent({ role: 'member', userId: 'member-1' }))
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'test-identity-forwarding-key'
  })

  afterEach(() => {
    delete process.env.CONVEX_IDENTITY_FORWARDING_KEY
  })

  it('cleans internal transport noise from convex errors', async () => {
    vi.mocked(serverConvexQuery).mockRejectedValueOnce(
      new Error(
        '[serverConvexQuery] Request failed for posts:list via http://localhost/api. ' +
          'Server Error\nUncaught Error: Unauthorized access\n    at Object.handler (file.ts:10:5)',
      ),
    )

    const tool = defineConvexToolInternal({
      schema: emptySchema,
      effect: 'read',
      name: 'query-tool',
      auth: 'required',
      handler: async (_args, ctx) => {
        await ctx.query('posts:list' as never)
        return ctx.ok({ ok: true })
      },
    })

    const result = await tool.handler({} as never, {} as never)

    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        error: {
          message: 'Unauthorized access',
          category: 'auth',
        },
      },
    })
  })

  it('requires a typed unsafe permit for external-service custom tools', () => {
    expect(() =>
      defineConvexToolInternal({
        schema: emptySchema,
        effect: 'external-service',
        name: 'external-tool',
        handler: async (_args, ctx) => ctx.ok({ ok: true }),
      }),
    ).toThrow(/external-service custom MCP tools: unsafe handlers require unsafe\.permit/)
  })

  it('accepts external-service custom tools with a typed unsafe permit', () => {
    expect(() =>
      defineConvexToolInternal({
        schema: emptySchema,
        effect: 'external-service',
        permit: unsafe.permit({
          kind: 'externalService',
          reason: 'Calls a diagnostic external service without app writes.',
          scope: ['mcp'],
        }),
        name: 'external-tool',
        handler: async (_args, ctx) => ctx.ok({ ok: true }),
      }),
    ).not.toThrow()
  })

  it('rejects malformed unsafe permits', () => {
    expect(() =>
      unsafe.permit({
        kind: '',
        reason: 'Missing kind.',
        scope: ['mcp'],
      }),
    ).toThrow(/kind/)
  })
})

describe('defineMcpApp middleware forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitStore = new ToolRateLimiter()
    useEventMock.mockReturnValue(createEvent())
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'test-identity-forwarding-key'
  })

  afterEach(() => {
    delete process.env.CONVEX_IDENTITY_FORWARDING_KEY
  })

  it('uses the canonical MCP Convex caller when callConvex is omitted', async () => {
    vi.mocked(serverConvexQuery).mockResolvedValueOnce({ ok: true })

    const event = createEvent()
    const caller = {
      kind: 'agent' as const,
      agentId: 'assistant-bot',
      subject: 'agent:assistant-bot',
    }
    const actingFor = {
      subject: 'user:user_1',
    }
    const mcp = defineMcpApp({
      resolveCaller: async () => caller,
      resolveActingFor: async () => actingFor,
    })

    const ctx = await mcp.resolve(event)
    await ctx.convex.query('runbooks:getWorkspace' as never, { id: 'runbook_1' } as never)

    expect(serverConvexQuery).toHaveBeenCalledWith(
      event,
      'runbooks:getWorkspace',
      { id: 'runbook_1' },
      {
        auth: {
          transport: 'mcp',
          caller,
          actingFor,
          identityForwardingKey: 'test-identity-forwarding-key',
        },
      },
    )
  })

  it('uses the projected trusted caller inside middleware query helpers', async () => {
    vi.mocked(serverConvexQuery).mockResolvedValueOnce({ ok: true })

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveActingFor: async () => ({
        subject: 'user:user_1',
      }),
      callConvex: async (event, caller) =>
        createServerConvexCaller(event, {
          auth: {
            transport: 'mcp',
            caller: caller.caller,
            ...(caller.actingFor ? { actingFor: caller.actingFor } : {}),
          } as never,
        }),
    })

    const tool = mcp.tool.query({
      schema: emptySchema,
      call: {} as never,
      middleware: async (_args, ctx, next) => {
        await ctx.query('runbooks:getWorkspace' as never, { id: 'runbook_1' } as never)
        return await next()
      },
    })

    await tool.handler({} as never, {} as never)

    expect(serverConvexQuery).toHaveBeenCalledWith(
      expect.anything(),
      'runbooks:getWorkspace',
      {
        id: 'runbook_1',
      },
      {
        auth: {
          transport: 'mcp',
          caller: {
            kind: 'agent',
            agentId: 'assistant-bot',
            subject: 'agent:assistant-bot',
          },
          actingFor: {
            subject: 'user:user_1',
          },
        },
      },
    )
  })
})

describe('MCP rate-limit integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitStore = new ToolRateLimiter()
    useEventMock.mockReturnValue(
      createEvent({ role: 'member', userId: 'member-1', workspaceId: 'org-1' }),
    )
  })

  it('applies shared storage-backed rate limits to defineConvexToolInternal', async () => {
    const tool = defineConvexToolInternal({
      schema: emptySchema,
      effect: 'read',
      name: 'limited-tool',
      auth: 'required',
      rateLimit: { max: 1, window: '1m' },
      rateLimitStore,
      handler: async (_args, ctx) => ctx.ok({ ok: true }),
    })

    const first = await tool.handler({} as never, {} as never)
    const second = await tool.handler({} as never, {} as never)

    expect(first).toMatchObject({
      structuredContent: {
        ok: true,
      },
    })
    expect(second).toMatchObject({
      structuredContent: {
        ok: false,
        error: {
          category: 'cooldown',
        },
      },
    })
  })

  it('applies shared storage-backed rate limits to defineMcpApp tools', async () => {
    const mcp = defineMcpApp({
      rateLimitStore,
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
        workspaceId: 'org-1',
      }),
      callConvex: async () => ({
        query: async () => ({ ok: true }),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.query({
      schema: emptySchema,
      call: {} as never,
      rateLimit: { max: 1, window: '1m' },
      meta: { name: 'limited-project-tool' },
    })

    const first = await tool.handler({} as never, {} as never)
    const second = await tool.handler({} as never, {} as never)

    expect(first).toMatchObject({
      structuredContent: {
        ok: true,
      },
    })
    expect(second).toMatchObject({
      structuredContent: {
        ok: false,
        error: {
          category: 'cooldown',
        },
      },
    })
  })

  it('requires meta.name for rate-limited defineMcpApp direct tools', () => {
    const mcp = defineMcpApp({
      rateLimitStore,
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
        workspaceId: 'org-1',
      }),
      callConvex: async () => ({
        query: async () => ({ ok: true }),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    expect(() =>
      mcp.tool.query({
        schema: emptySchema,
        call: {} as never,
        rateLimit: { max: 1, window: '1m' },
      }),
    ).toThrow(/rateLimit.*meta\.name/)
  })

  it('refuses production rate-limited tools without an explicit distributed store', () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    try {
      expect(() =>
        defineConvexToolInternal({
          schema: emptySchema,
          effect: 'read',
          name: 'production-limited-tool',
          auth: 'required',
          rateLimit: { max: 5, window: '1m' },
          handler: async (_args, ctx) => ctx.ok({ ok: true }),
        }),
      ).toThrow(/rate.?limit.*store|distributed|redis/i)
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = previousNodeEnv
      }
    }
  })
})

describe('Destructive confirmation payload validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rateLimitStore = new ToolRateLimiter()
    useEventMock.mockReturnValue(createEvent())
  })

  it('exposes operation-first MCP alias for Phase 0 authoring', () => {
    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)
    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => deletePostPreview(),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(operation, {
      execute: operation as never,
      preview: preview as never,
    })

    expect(tool.name).toBe('delete-post')
    expect(tool.annotations?.destructiveHint).toBe(true)
  })

  it('preserves identity forwarding transport on destructive preview projections', () => {
    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      identityForwardingTransport: 'mcp',
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })

    expect(previewOf(operation).identityForwardingTransport).toBe('mcp')
  })

  it('binds operation-first MCP tools from shared descriptors and projected refs', () => {
    const descriptor = defineOperationDescriptor({
      id: 'posts.delete',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      safety: 'destructive-write',
    })
    const execute = projectOperationRef(descriptor, 'execute', {} as never)
    const preview = projectOperationRef(descriptor, 'preview', {} as never)

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => deletePostPreview(),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(descriptor, {
      execute,
      preview,
    })

    expect(tool.name).toBe('delete-post')
    expect(tool.annotations?.destructiveHint).toBe(true)
  })

  it('rejects backend-only operations in normal MCP operation bindings', () => {
    const descriptor = defineOperationDescriptor({
      id: 'posts.retention-purge',
      name: 'RetentionPurge',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      safety: 'destructive-write',
      exposure: 'backend-only',
      backendOnlyReason: 'Retention cleanup runs from a verified service job.',
    } as never)
    const execute = projectOperationRef(descriptor, 'execute', {} as never)
    const preview = projectOperationRef(descriptor, 'preview', {} as never)

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => deletePostPreview(),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    expect(() =>
      mcp.tool.operation(descriptor, {
        execute,
        preview,
      }),
    ).toThrow('backend-only')
  })

  it('requires explicit tenant binding for destructive MCP confirmations', () => {
    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)
    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      callConvex: async () => ({
        query: async () => deletePostPreview(),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
    })

    expect(() =>
      mcp.tool.operation(operation, {
        execute: operation as never,
        preview: preview as never,
      }),
    ).toThrow(/explicit scopeKey resolver/)
  })

  it('returns backend denial and emits drift when operation visibility is stale', async () => {
    const capture = createObservationCapture()
    const permission = definePermissionKey('posts.archive')
    const operation = defineOperation({
      id: 'posts.archive',
      name: 'ArchivePost',
      kind: 'safe',
      permission,
      safety: 'bounded-write',
      args: {
        id: v.string(),
      },
      handler: async () => ({ ok: true }),
    })
    const mcp = defineMcpApp({
      observability: { enabled: true, level: 'verbose' },
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: async () => ({
        [permission.key]: true,
      }),
      callConvex: async () => ({
        query: async () => ({ ok: true }),
        mutation: async () => {
          throw new Error('Forbidden by backend guard')
        },
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    try {
      const tool = mcp.tool.operation(operation, {
        execute: operation as never,
        meta: { name: 'archive-post' },
      })

      const result = await tool.handler({ id: 'post-1' } as never, {} as never)

      expect(result).toMatchObject({
        structuredContent: {
          ok: false,
          error: {
            category: 'auth',
            message: expect.stringContaining('Forbidden by backend guard'),
          },
        },
      })
      expect(capture.find('tool.denied')).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tool: 'archive-post',
            operation: 'posts.archive',
            reasonCode: 'tool.recordAccess_backend_drift',
            status: 'deny',
          }),
        ]),
      )
      expect(capture.find('tool.failed')).toEqual([])
    } finally {
      capture.stop()
    }
  })

  it('refuses production transport-only destructive confirmation without a distributed store', () => {
    const previousNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)

    try {
      const mcp = defineMcpApp({
        resolveCaller: async () => ({
          kind: 'agent' as const,
          agentId: 'assistant-bot',
          subject: 'agent:assistant-bot',
        }),
        resolveAccess: allowPostOperationAccess,
        callConvex: async () => ({
          query: async () => deletePostPreview(),
          mutation: async () => ({ ok: true }),
          action: async () => ({ ok: true }),
        }),
        scopeKey: () => 'global',
      })

      expect(() =>
        mcp.tool.operation(operation, {
          execute: operation as never,
          preview: preview as never,
          confirmationMode: 'transport',
        }),
      ).toThrow(/confirmationStore|distributed/i)
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = previousNodeEnv
      }
    }
  })

  it('rejects non-object destructive confirm payloads', async () => {
    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {},
      permission: postOperationPermission,
      preview: async () => ({
        allowed: true,
        summary: 'Delete post',
        blockers: [],
        warnings: [],
        effects: [],
        confirm: 'post-1',
      }),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => ({
          allowed: true,
          summary: 'Delete post',
          blockers: [],
          warnings: [],
          effects: [],
          confirm: 'post-1',
        }),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(operation, {
      execute: operation as never,
      preview: preview as never,
      confirmationMode: 'transport',
    })

    const result = await tool.handler({} as never, {} as never)

    expect(result).toMatchObject({
      structuredContent: {
        ok: false,
        error: {
          category: 'unknown',
          message: expect.stringContaining('non-empty plain-object confirm payload'),
        },
      },
    })
  })

  it('rejects destructive confirmation when the preview version changes', async () => {
    let previewVersion = 1

    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview({ version: { rev: previewVersion } }),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => deletePostPreview({ version: { rev: previewVersion } }),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(operation, {
      execute: operation as never,
      preview: preview as never,
      confirmationMode: 'transport',
    })

    const previewResult = (await tool.handler({ id: 'post-1' } as never, {} as never)) as {
      structuredContent?: {
        preview?: {
          confirmation?: { token?: string }
        }
      }
    }

    previewVersion = 2

    const confirmed = await tool.handler(
      {
        id: 'post-1',
        _confirmationToken: previewResult.structuredContent?.preview?.confirmation?.token,
      } as never,
      {} as never,
    )

    expect(confirmed).toMatchObject({
      structuredContent: {
        ok: false,
        error: {
          category: 'conflict',
          message: expect.stringContaining('Preview version changed before confirmation'),
        },
      },
    })
  })

  it('reports changed top-level args when destructive confirmation drifts', async () => {
    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
        message: v.optional(v.string()),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => deletePostPreview(),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(operation, {
      execute: operation as never,
      preview: preview as never,
      confirmationMode: 'transport',
    })

    const previewResult = (await tool.handler(
      { id: 'post-1', message: 'first' } as never,
      {} as never,
    )) as {
      structuredContent?: {
        preview?: {
          confirmation?: { token?: string }
        }
      }
    }

    const confirmed = await tool.handler(
      {
        id: 'post-1',
        message: 'changed',
        _confirmationToken: previewResult.structuredContent?.preview?.confirmation?.token,
      } as never,
      {} as never,
    )

    expect(confirmed).toMatchObject({
      structuredContent: {
        ok: false,
        error: {
          category: 'conflict',
          code: 'CONFIRMATION_ARGS_MISMATCH',
          details: {
            changedKeys: ['message'],
            retryWithPreview: true,
          },
        },
      },
    })
  })

  it('can keep confirmation token out of transport-confirmed bridge mutations', async () => {
    let executedArgs: Record<string, unknown> | null = null
    let executeCallOptions: Record<string, unknown> | undefined

    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => deletePostPreview(),
        mutation: async (_ref, args, options) => {
          executedArgs = args as Record<string, unknown>
          executeCallOptions = options as Record<string, unknown>
          return { ok: true }
        },
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(operation, {
      execute: operation as never,
      preview: preview as never,
      confirmationMode: 'transport',
    })

    const previewResult = (await tool.handler({ id: 'post-1' } as never, {} as never)) as {
      structuredContent?: {
        preview?: {
          confirmation?: { token?: string }
        }
      }
    }

    await tool.handler(
      {
        id: 'post-1',
        _confirmationToken: previewResult.structuredContent?.preview?.confirmation?.token,
      } as never,
      {} as never,
    )

    expect(executedArgs).toEqual({ id: 'post-1' })
    expect(executeCallOptions).toMatchObject({
      purpose: 'operation-execute',
      replay: {
        mode: 'operation-confirmation',
        jti: expect.any(String),
      },
    })
  })

  it('rejects replayed transport confirmation tokens', async () => {
    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)

    const mcp = defineMcpApp({
      resolveCaller: async () => ({
        kind: 'agent' as const,
        agentId: 'assistant-bot',
        subject: 'agent:assistant-bot',
      }),
      resolveAccess: allowPostOperationAccess,
      callConvex: async () => ({
        query: async () => deletePostPreview(),
        mutation: async () => ({ ok: true }),
        action: async () => ({ ok: true }),
      }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(operation, {
      execute: operation as never,
      preview: preview as never,
      confirmationMode: 'transport',
    })

    const previewResult = (await tool.handler({ id: 'post-1' } as never, {} as never)) as {
      structuredContent?: {
        preview?: {
          confirmation?: { token?: string }
        }
      }
    }
    const args = {
      id: 'post-1',
      _confirmationToken: previewResult.structuredContent?.preview?.confirmation?.token,
    }

    await tool.handler(args as never, {} as never)
    const replay = await tool.handler(args as never, {} as never)

    expect(replay).toMatchObject({
      structuredContent: {
        ok: false,
        error: {
          category: 'conflict',
          message: expect.stringContaining('already been redeemed'),
        },
      },
    })
  })

  it('routes backend-confirmed destructive execute through trusted forwarding without raw identity args', async () => {
    const backendConfirmation = {
      token: 'trellis-confirm-v1.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      expiresAt: Date.now() + 60_000,
    }
    vi.mocked(serverConvexQuery).mockResolvedValue({
      ...deletePostPreview(),
      confirmation: backendConfirmation,
    })
    vi.mocked(serverConvexMutation).mockResolvedValue({ ok: true })

    const operation = defineOperation({
      id: 'delete-post',
      name: 'DeletePost',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: postOperationPermission,
      preview: async () => deletePostPreview(),
      handler: async () => ({ ok: true }),
    })
    const preview = previewOf(operation)
    const caller = {
      kind: 'agent' as const,
      agentId: 'assistant-bot',
      subject: 'agent:assistant-bot',
    }
    const actingFor = {
      subject: 'user:user_1',
    }
    const mcp = defineMcpApp({
      resolveCaller: async () => caller,
      resolveActingFor: async () => actingFor,
      resolveAccess: allowPostOperationAccess,
      callConvex: async (event, caller) =>
        createServerConvexCaller(event, {
          auth: {
            transport: 'mcp',
            caller: caller.caller,
            ...(caller.actingFor ? { actingFor: caller.actingFor } : {}),
          } as never,
        }),
      scopeKey: () => 'global',
    })

    const tool = mcp.tool.operation(operation, {
      execute: operation as never,
      preview: preview as never,
    })

    const previewResult = (await tool.handler({ id: 'post-1' } as never, {} as never)) as {
      structuredContent?: {
        preview?: {
          confirmation?: { token?: string }
        }
      }
    }

    const confirmationToken = previewResult.structuredContent?.preview?.confirmation?.token
    const confirmationJti = await hashConfirmationToken(confirmationToken!)

    await tool.handler(
      {
        id: 'post-1',
        _confirmationToken: confirmationToken,
      } as never,
      {} as never,
    )

    expect(serverConvexQuery).toHaveBeenCalledWith(
      expect.anything(),
      preview,
      { id: 'post-1' },
      {
        auth: {
          transport: 'mcp',
          caller,
          actingFor,
        },
        purpose: 'operation-preview',
      },
    )
    expect(serverConvexMutation).toHaveBeenCalledWith(
      expect.anything(),
      operation,
      {
        id: 'post-1',
        _confirmationToken: confirmationToken,
      },
      {
        auth: {
          transport: 'mcp',
          caller,
          actingFor,
        },
        purpose: 'operation-execute',
        replay: {
          mode: 'operation-confirmation',
          jti: confirmationJti,
        },
      },
    )
  })
})
