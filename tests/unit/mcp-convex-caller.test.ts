import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { definePermissionKey } from '../../src/runtime/auth'

const { serverConvexActionMock, serverConvexMutationMock, serverConvexQueryMock } = vi.hoisted(
  () => ({
    serverConvexQueryMock: vi.fn(),
    serverConvexMutationMock: vi.fn(),
    serverConvexActionMock: vi.fn(),
  }),
)

vi.mock('../../src/runtime/convex/server/convex', () => ({
  serverConvexQuery: serverConvexQueryMock,
  serverConvexMutation: serverConvexMutationMock,
  serverConvexAction: serverConvexActionMock,
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ public: { convex: {} } }),
}))

vi.mock('nitropack/runtime', () => ({
  useEvent: () => undefined,
}))

describe('createMcpConvexCaller', () => {
  let mcpApi: typeof import('../../src/runtime/mcp/create-mcp-convex-caller')
  const originalCanonicalKey = process.env.CONVEX_IDENTITY_FORWARDING_KEY
  const originalAliasKey = process.env.GINKO_CONVEX_IDENTITY_FORWARDING_KEY

  beforeAll(async () => {
    mcpApi = await import('../../src/runtime/mcp/create-mcp-convex-caller')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    if (originalCanonicalKey === undefined) {
      delete process.env.CONVEX_IDENTITY_FORWARDING_KEY
    } else {
      process.env.CONVEX_IDENTITY_FORWARDING_KEY = originalCanonicalKey
    }
    if (originalAliasKey === undefined) {
      delete process.env.GINKO_CONVEX_IDENTITY_FORWARDING_KEY
    } else {
      process.env.GINKO_CONVEX_IDENTITY_FORWARDING_KEY = originalAliasKey
    }
  })

  it('uses unauthenticated Convex calls when no MCP caller is present', async () => {
    serverConvexQueryMock.mockResolvedValueOnce({ ok: true })

    const event = { __is_event__: true } as never
    const convex = mcpApi.createMcpConvexCaller(event, {
      caller: null,
    })

    await expect(convex.query({ _path: 'todos:list' } as never, {} as never)).resolves.toEqual({
      ok: true,
    })

    expect(serverConvexQueryMock).toHaveBeenCalledWith(
      event,
      { _path: 'todos:list' },
      {},
      { auth: 'none' },
    )
  })

  it('uses unauthenticated Convex calls for anonymous MCP callers', async () => {
    serverConvexQueryMock.mockResolvedValueOnce({ ok: true })

    const event = { __is_event__: true } as never
    const convex = mcpApi.createMcpConvexCaller(event, {
      caller: { kind: 'anonymous', subject: 'system:anonymous' },
    })

    await expect(convex.query({ _path: 'todos:list' } as never, {} as never)).resolves.toEqual({
      ok: true,
    })

    expect(serverConvexQueryMock).toHaveBeenCalledWith(
      event,
      { _path: 'todos:list' },
      {},
      { auth: 'none' },
    )
  })

  it('forwards trusted MCP callers through the canonical server caller', async () => {
    serverConvexMutationMock.mockResolvedValueOnce({ ok: true })

    const event = { __is_event__: true } as never
    const caller = { kind: 'agent', agentId: 'agent-1', subject: 'agent:agent-1' }
    const actingFor = { subject: 'user:user-1', reason: 'MCP delegation' }
    const convex = mcpApi.createMcpConvexCaller(event, {
      caller,
      actingFor,
      isForwardedCaller: (candidate) => candidate.kind === 'agent',
      identityForwardingKey: 'explicit-forwarding-key',
    })

    await convex.mutation({ _path: 'todos:create' } as never, { title: 'Hello' } as never, {
      identityForwardingEnvelope: {
        purpose: 'mutation',
        jti: 'call-1',
      },
    })

    expect(serverConvexMutationMock).toHaveBeenCalledWith(
      event,
      { _path: 'todos:create' },
      { title: 'Hello' },
      {
        auth: 'trusted',
        caller,
        actingFor,
        identityForwardingKey: 'explicit-forwarding-key',
        identityForwardingEnvelope: {
          purpose: 'mutation',
          jti: 'call-1',
        },
      },
    )
  })

  it('uses the canonical forwarding key before integration aliases', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'canonical-forwarding-key'
    process.env.GINKO_CONVEX_IDENTITY_FORWARDING_KEY = 'integration-forwarding-key'
    serverConvexActionMock.mockResolvedValueOnce({ ok: true })

    const event = { __is_event__: true } as never
    const caller = { kind: 'agent', agentId: 'agent-1', subject: 'agent:agent-1' }
    const convex = mcpApi.createMcpConvexCaller(event, {
      caller,
      identityForwardingKeyEnvAliases: ['GINKO_CONVEX_IDENTITY_FORWARDING_KEY'],
    })

    await convex.action({ _path: 'todos:sync' } as never, {} as never)

    expect(serverConvexActionMock).toHaveBeenCalledWith(
      event,
      { _path: 'todos:sync' },
      {},
      {
        auth: 'trusted',
        caller,
        identityForwardingKey: 'canonical-forwarding-key',
      },
    )
  })

  it('resolves ordered server-only integration forwarding key aliases', async () => {
    process.env.GINKO_CONVEX_IDENTITY_FORWARDING_KEY = 'integration-forwarding-key'
    serverConvexActionMock.mockResolvedValueOnce({ ok: true })

    const event = { __is_event__: true } as never
    const caller = { kind: 'agent', agentId: 'agent-1', subject: 'agent:agent-1' }
    const convex = mcpApi.createMcpConvexCaller(event, {
      caller,
      identityForwardingKeyEnvAliases: [
        'MISSING_CONVEX_IDENTITY_FORWARDING_KEY',
        'GINKO_CONVEX_IDENTITY_FORWARDING_KEY',
      ],
    })

    await convex.action({ _path: 'todos:sync' } as never, {} as never)

    expect(serverConvexActionMock).toHaveBeenCalledWith(
      event,
      { _path: 'todos:sync' },
      {},
      {
        auth: 'trusted',
        caller,
        identityForwardingKey: 'integration-forwarding-key',
      },
    )
  })

  it('rejects public forwarding key aliases', () => {
    const event = { __is_event__: true } as never

    expect(() =>
      mcpApi.createMcpConvexCaller(event, {
        caller: { kind: 'agent', agentId: 'agent-1', subject: 'agent:agent-1' },
        identityForwardingKeyEnvAliases: ['NUXT_PUBLIC_CONVEX_IDENTITY_FORWARDING_KEY'],
      }),
    ).toThrow(/aliases must be server-only/)
  })

  it('rejects actingFor on anonymous MCP callers', () => {
    expect(() =>
      mcpApi.createMcpConvexCaller({ __is_event__: true } as never, {
        caller: { kind: 'anonymous', subject: 'system:anonymous' },
        actingFor: { subject: 'user:user-1' },
      }),
    ).toThrow(/cannot set actingFor for an anonymous MCP caller/)
  })

  it('requires forwarded MCP callers to carry a canonical subject', () => {
    expect(() =>
      mcpApi.createMcpConvexCaller({ __is_event__: true } as never, {
        caller: { kind: 'agent', agentId: 'agent-1' },
      }),
    ).toThrow(/forwarded MCP callers must include subject/)
  })

  it('derives denied access snapshots from permission handles', () => {
    const publish = definePermissionKey('posts.publish')

    expect(mcpApi.deniedMcpAccessSnapshot([publish, 'posts.archive'])).toEqual({
      'posts.publish': false,
      'posts.archive': false,
    })
  })
})
