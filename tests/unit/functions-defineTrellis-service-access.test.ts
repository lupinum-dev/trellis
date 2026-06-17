import { v } from 'convex/values'
import { afterEach, describe, expect, it } from 'vitest'

import { defineCaller, defineTrellis } from '../../src/runtime/backend'
import { defineOperation } from '../../src/runtime/functions/define-operation'
import { getForwardedCaller } from '../../src/runtime/identity-forwarding'
import { createIdentityForwardingEnvelopeArgs } from '../../src/runtime/identity-forwarding/shared'
import { createObservationCapture } from '../../src/runtime/testing'
import {
  allowAll,
  createMemoryDb,
  destructiveTestPermission,
} from '../support/unit/define-trellis-testkit'

describe('defineTrellis service access', () => {
  const originalIdentityForwardingKey = process.env.CONVEX_IDENTITY_FORWARDING_KEY

  afterEach(() => {
    if (originalIdentityForwardingKey === undefined) {
      delete process.env.CONVEX_IDENTITY_FORWARDING_KEY
    } else {
      process.env.CONVEX_IDENTITY_FORWARDING_KEY = originalIdentityForwardingKey
    }
  })

  it('applies derived service tenant scope to configured tables', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        isolation: {
          tables: ['tasks'] as never[],
          field: 'workspaceId',
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.tenantWorkspaceId',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'derived',
              deriveTenant: ({ args }) => args.tenantWorkspaceId as string,
            },
          },
        },
      },
    )
    const definition = runtime.query.public({
      reads: ['tasks'] as never[],
      args: {
        rowWorkspaceId: v.string(),
        tenantWorkspaceId: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:list',
      handler: async (ctx, args) => {
        return await ctx.db
          .query('tasks' as never)
          .withIndex('by_workspace', (q) => q.eq('workspaceId', args.rowWorkspaceId))
          .unique()
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { rowWorkspaceId: string; tenantWorkspaceId: string },
      ) => Promise<{ title: string; workspaceId: string } | null>
    }
    const memory = createMemoryDb()
    await memory.db.insert('tasks', { title: 'one', workspaceId: 'ws_1' })
    await memory.db.insert('tasks', { title: 'two', workspaceId: 'ws_2' })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { rowWorkspaceId: 'ws_1', tenantWorkspaceId: 'ws_1' },
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        title: 'one',
        workspaceId: 'ws_1',
      }),
    )
    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { rowWorkspaceId: 'ws_2', tenantWorkspaceId: 'ws_1' },
      ),
    ).rejects.toThrow(/Service scope denied access/)
  })

  it('rejects derived service access when no tenant scope can be resolved before handler execution', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        isolation: {
          tables: ['tasks'] as never[],
          field: 'workspaceId',
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.tenantWorkspaceId',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'derived',
              deriveTenant: () => null,
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.query.public({
      reads: ['tasks'] as never[],
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{ ok: true }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/could not resolve a derived tenant scope/)
    expect(reachedHandler).toBe(false)
  })

  it('rejects unconfigured service principals before handler execution', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'unknown-sync',
        subject: 'service:unknown-sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.query.public({
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async (ctx) => {
        reachedHandler = true
        return await ctx.db.query('tasks' as never).collect()
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<Array<{ title: string }>>
    }
    const memory = createMemoryDb()
    await memory.db.insert('tasks', { title: 'one' })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/Service "unknown-sync" is not configured in defineTrellis\(\{ services \}\)/)
    expect(reachedHandler).toBe(false)
  })

  it('rejects unrestricted service access before handler execution', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: 'unrestricted',
          },
        } as never,
      },
    )
    let reachedHandler = false
    const definition = runtime.query.public({
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{ ok: true }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/must declare restricted access/)
    expect(reachedHandler).toBe(false)
  })

  it('rejects incomplete service contract metadata before handler execution', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: '',
              auditTable: 'tasks' as never,
              auditCorrelationId: '',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        } as never,
      },
    )
    let reachedHandler = false
    const definition = runtime.query.public({
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{ ok: true }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/must declare non-empty service metadata.*auditEvent.*auditCorrelationId/)
    expect(reachedHandler).toBe(false)
  })

  it('rejects service metadata without target allow-list before handler execution', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        } as never,
      },
    )
    let reachedHandler = false
    const definition = runtime.query.public({
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{ ok: true }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/must declare at least one allowed operation id or function ref/)
    expect(reachedHandler).toBe(false)
  })

  it('rejects service access without an allowed table scope before handler execution', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: [] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.query.public({
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{ ok: true }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/must declare at least one allowed table/)
    expect(reachedHandler).toBe(false)
  })

  it('keeps global service access table-restricted but row-unscoped', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        isolation: {
          tables: ['tasks'] as never[],
          field: 'workspaceId',
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    const definition = runtime.query.public({
      reads: ['tasks'] as never[],
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async (ctx) => {
        const tasks = await ctx.db.query('tasks' as never).collect()
        let denied = false
        try {
          await ctx.db.query('comments' as never).collect()
        } catch (error) {
          denied = error instanceof Error && /cannot access table "comments"/i.test(error.message)
        }
        return { denied, titles: tasks.map((task) => task.title) }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{ denied: boolean; titles: string[] }>
    }
    const memory = createMemoryDb()
    await memory.db.insert('tasks', { title: 'one', workspaceId: 'ws_1' })
    await memory.db.insert('tasks', { title: 'two', workspaceId: 'ws_2' })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        {},
      ),
    ).resolves.toEqual({
      denied: true,
      titles: ['one', 'two'],
    })
  })

  it('rejects service principals before handler execution when the target function ref is not allowed', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:create'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.query.public({
      args: {},
      identityForwardingFunctionRef: 'tasks:delete',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{ ok: true }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/not allowed to call function.*tasks:delete/)
    expect(reachedHandler).toBe(false)
  })

  it('rejects direct service principals when service metadata requires forwarded replay', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:create'],
              replayMode: 'domain-idempotency',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.mutation.public({
      args: { title: v.string() },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { title: string },
      ) => Promise<{ ok: true }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        { title: 'Direct bypass' },
      ),
    ).rejects.toThrow(/requires replay mode.*domain-idempotency.*none/)
    expect(reachedHandler).toBe(false)
  })

  it('allows service table-explicit writes and rejects id-only updates', async () => {
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async () => ({
        kind: 'service' as const,
        serviceId: 'sync',
        subject: 'service:sync' as const,
      }),
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        appIdentity: async () => ({ kind: 'service-test' }),
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:update'],
              replayMode: 'none',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    const definition = runtime.mutation.protected({
      args: { id: v.string() },
      guard: allowAll,
      identityForwardingFunctionRef: 'tasks:update',
      handler: async (ctx, args) => {
        await (
          ctx.db as { patch: (table: string, id: string, value: object) => Promise<unknown> }
        ).patch('tasks', args.id, { title: 'updated' })
        try {
          await (ctx.db as { patch: (id: string, value: object) => Promise<unknown> }).patch(
            args.id,
            { title: 'id-only' },
          )
          return false
        } catch (error) {
          return (
            error instanceof Error &&
            /cannot use id-only patch through a table-restricted DB facade/i.test(error.message)
          )
        }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string },
      ) => Promise<boolean>
    }
    const memory = createMemoryDb()
    const id = await memory.db.insert('tasks', { title: 'original' })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { id },
      ),
    ).resolves.toBe(true)
    await expect(memory.db.get(id)).resolves.toMatchObject({ title: 'updated' })
  })

  it('does not claim trusted replay JTI before service target preflight succeeds', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async (ctx) =>
        getForwardedCaller<{
          kind: 'service'
          serviceId: string
          subject: `service:${string}`
        }>(ctx)!,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        trustedReplay: {
          table: 'trustedReplay' as never,
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedFunctionRefs: ['tasks:allowed'],
              replayMode: 'jti-redemption',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.mutation.public({
      args: { title: v.string() },
      identityForwardingFunctionRef: 'tasks:denied',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<{ ok: true }>
    }
    const memory = createMemoryDb()
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Denied target' },
      caller: { kind: 'service', serviceId: 'sync', subject: 'service:sync' },
      functionRef: 'tasks:denied',
      operation: 'mutation',
      replayMode: 'jti-redemption',
      jti: 'service-preflight-denied',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        args,
      ),
    ).rejects.toThrow(/not allowed to call function.*tasks:denied/)
    expect(reachedHandler).toBe(false)
    expect(memory.tables.trustedReplay ?? []).toHaveLength(0)
  })

  it('rejects service principals before handler execution when the target operation id is not allowed', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async (ctx) =>
        getForwardedCaller<{
          kind: 'service'
          serviceId: string
          subject: `service:${string}`
        }>(ctx)!,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.allowed'],
              replayMode: 'domain-idempotency',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const operation = defineOperation({
      id: 'sync.denied',
      kind: 'safe',
      args: { title: v.string() },
      identityForwardingFunctionRef: 'tasks:create',
      permission: destructiveTestPermission,
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    })
    const definition = runtime.mutation.public(operation as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<{ ok: true }>
    }
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Denied operation' },
      caller: { kind: 'service', serviceId: 'sync', subject: 'service:sync' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'domain-idempotency',
      jti: 'service-operation-denied',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        args,
      ),
    ).rejects.toThrow(/not allowed to call operation.*sync\.denied/)
    expect(reachedHandler).toBe(false)
  })

  it('allows service principals when the target operation id is allowed', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async (ctx) =>
        getForwardedCaller<{
          kind: 'service'
          serviceId: string
          subject: `service:${string}`
        }>(ctx)!,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.allowed'],
              replayMode: 'domain-idempotency',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    const operation = defineOperation({
      id: 'sync.allowed',
      kind: 'safe',
      args: { title: v.string() },
      identityForwardingFunctionRef: 'tasks:create',
      permission: destructiveTestPermission,
      handler: async () => ({ ok: true }),
    })
    const definition = runtime.mutation.public(operation as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<{ ok: true }>
    }
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Allowed operation' },
      caller: { kind: 'service', serviceId: 'sync', subject: 'service:sync' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'domain-idempotency',
      jti: 'service-operation-allowed',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        args,
      ),
    ).resolves.toEqual({ ok: true })
  })

  it('rejects forwarded service callers whose replay mode does not match service metadata', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async (ctx) =>
        getForwardedCaller<{
          kind: 'service'
          serviceId: string
          subject: `service:${string}`
        }>(ctx)!,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:create'],
              replayMode: 'jti-redemption',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<{ ok: true }>
    }
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Wrong replay mode' },
      caller: { kind: 'service', serviceId: 'sync', subject: 'service:sync' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'domain-idempotency',
      jti: 'service-replay-mismatch',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        args,
      ),
    ).rejects.toThrow(/requires replay mode.*jti-redemption.*domain-idempotency/)
    expect(reachedHandler).toBe(false)
  })

  it('allows forwarded service callers whose replay mode matches service metadata', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async (ctx) =>
        getForwardedCaller<{
          kind: 'service'
          serviceId: string
          subject: `service:${string}`
        }>(ctx)!,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:create'],
              replayMode: 'domain-idempotency',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => ({ ok: true }),
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<{ ok: true }>
    }
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Matching replay mode' },
      caller: { kind: 'service', serviceId: 'sync', subject: 'service:sync' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'domain-idempotency',
      jti: 'service-replay-matched',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        args,
      ),
    ).resolves.toEqual({ ok: true })
  })

  it('rejects forwarded service callers carrying actingFor evidence when service metadata forbids it', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async (ctx) =>
        getForwardedCaller<{
          kind: 'service'
          serviceId: string
          subject: `service:${string}`
        }>(ctx)!,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:create'],
              replayMode: 'domain-idempotency',
              actingFor: false,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    let reachedHandler = false
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        reachedHandler = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<{ ok: true }>
    }
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Forbidden actingFor' },
      caller: { kind: 'service', serviceId: 'sync', subject: 'service:sync' },
      actingFor: { kind: 'user', userId: 'user_1', subject: 'user:user_1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'domain-idempotency',
      jti: 'service-acting-for-forbidden',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        args,
      ),
    ).rejects.toThrow(/not allowed to carry actingFor evidence/)
    expect(reachedHandler).toBe(false)
  })

  it('allows forwarded service callers carrying actingFor evidence when service metadata permits it', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const serviceCaller = defineCaller({
      resolve: async (ctx) =>
        getForwardedCaller<{
          kind: 'service'
          serviceId: string
          subject: `service:${string}`
        }>(ctx)!,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: serviceCaller,
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:create'],
              replayMode: 'domain-idempotency',
              actingFor: true,
              auditEvent: 'sync.test',
              auditTable: 'tasks' as never,
              auditCorrelationId: 'args.id',
            },
            access: {
              tables: ['tasks'] as never[],
              tenant: 'global',
            },
          },
        },
      },
    )
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => ({ ok: true }),
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<{ ok: true }>
    }
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Allowed actingFor' },
      caller: { kind: 'service', serviceId: 'sync', subject: 'service:sync' },
      actingFor: { kind: 'user', userId: 'user_1', subject: 'user:user_1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'domain-idempotency',
      jti: 'service-acting-for-allowed',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        args,
      ),
    ).resolves.toEqual({ ok: true })
  })
})
