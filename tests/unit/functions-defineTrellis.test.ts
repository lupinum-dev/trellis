import { v } from 'convex/values'
import { afterEach, describe, expect, it } from 'vitest'

import { operation as appOperation } from '../../src/runtime/app'
import { defineGuard, definePermission, open } from '../../src/runtime/auth'
import {
  defineCaller,
  defineTrellis,
  getOperationMetadata,
  trellisBackendLaneMetadataKey,
  unsafe,
} from '../../src/runtime/backend'
import {
  createConfirmationToken,
  hashConfirmationValue,
  hashConfirmationToken,
} from '../../src/runtime/functions/confirmation-token'
import {
  defineOperation,
  operationPreview,
  previewOf,
  transportExecuteOperationRef,
} from '../../src/runtime/functions/define-operation'
import { getForwardedCaller } from '../../src/runtime/identity-forwarding'
import { createIdentityForwardingEnvelopeArgs } from '../../src/runtime/identity-forwarding/shared'
import { createObservationCapture } from '../../src/runtime/testing'

// Intentional 0.3.0 coverage: this file exercises the surviving custom
// protected-lane runtime and destructive operation execution machinery.
// App-author normal-path fixtures belong on explicit public/authenticated/
// workspace lanes with permission metadata instead.

type MemoryRow = Record<string, unknown>

function createMemoryDb() {
  const tables: Record<string, MemoryRow[]> = {}

  const tableFromId = (id: unknown) => {
    if (typeof id !== 'string') return null
    const serviceSeparator = id.lastIndexOf(';')
    if (serviceSeparator !== -1) return id.slice(serviceSeparator + 1)
    const localSeparator = id.indexOf(':')
    return localSeparator === -1 ? null : id.slice(0, localSeparator)
  }

  const findRow = (id: string) => {
    for (const [table, rows] of Object.entries(tables)) {
      const row = rows.find((candidate) => candidate._id === id)
      if (row) return { table, row, rows }
    }
    return null
  }

  const createQuery = (table: string, rows: MemoryRow[]) => ({
    withIndex: (
      _indexName: string,
      callback: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
    ) => {
      const filters: Array<{ field: string; value: unknown }> = []
      callback({
        eq: (field, value) => {
          filters.push({ field, value })
          return null
        },
      })
      return createQuery(
        table,
        rows.filter((row) => filters.every((filter) => row[filter.field] === filter.value)),
      )
    },
    collect: async () => [...rows],
    unique: async () => {
      if (rows.length > 1) {
        throw new Error(`unique() query returned more than one result from "${table}".`)
      }
      return rows[0] ?? null
    },
    first: async () => rows[0] ?? null,
    take: async (count: number) => rows.slice(0, count),
    order: () => createQuery(table, rows),
    fullTableScan: () => createQuery(table, rows),
    async *[Symbol.asyncIterator]() {
      for (const row of rows) yield row
    },
  })

  return {
    tables,
    db: {
      normalizeId: (table: string, id: unknown) => (tableFromId(id) === table ? id : null),
      get: async (arg0: string, arg1?: string) => {
        const id = arg1 ?? arg0
        return findRow(id)?.row ?? null
      },
      query: (table: string) => createQuery(table, tables[table] ?? []),
      insert: async (table: string, value: MemoryRow) => {
        tables[table] ??= []
        const id = `${table}:${tables[table].length + 1};${table}`
        tables[table].push({ _id: id, ...value })
        return id
      },
      patch: async (id: string, value: MemoryRow) => {
        const match = findRow(id)
        if (match) {
          Object.assign(match.row, value)
          return null
        }
        throw new Error(`Missing row "${id}"`)
      },
      replace: async (id: string, value: MemoryRow) => {
        const match = findRow(id)
        if (match) {
          match.rows[match.rows.indexOf(match.row)] = { _id: id, ...value }
          return null
        }
        throw new Error(`Missing row "${id}"`)
      },
      delete: async (id: string) => {
        const match = findRow(id)
        if (match) {
          match.rows.splice(match.rows.indexOf(match.row), 1)
          return null
        }
        throw new Error(`Missing row "${id}"`)
      },
    },
  }
}

async function confirmationToken(args: {
  memory: ReturnType<typeof createMemoryDb>
  operationId: string
  executeArgs: Record<string, unknown>
  confirm: Record<string, unknown>
  version?: unknown
  jti: string
  executePath?: string
  previewPath?: string
}) {
  const token = createConfirmationToken()
  await args.memory.db.insert('destructiveConfirmations', {
    tokenHash: await hashConfirmationToken(token),
    operationId: args.operationId,
    executePath: args.executePath ?? 'execute',
    previewPath: args.previewPath ?? 'preview',
    jti: args.jti,
    callerKey: 'caller:test',
    scopeKey: 'tenant:test',
    argsHash: await hashConfirmationValue(args.executeArgs),
    previewHash: await hashConfirmationValue(args.confirm),
    ...(args.version === undefined
      ? {}
      : { versionHash: await hashConfirmationValue(args.version) }),
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
  })
  return token
}

describe('defineTrellis', () => {
  const originalIdentityForwardingKey = process.env.CONVEX_IDENTITY_FORWARDING_KEY
  const allowAll = defineGuard('test.allowAll', true)
  const testAppIdentity = async () => ({ kind: 'test' as const })
  const signedInTestCaller = defineCaller({
    resolve: async () => ({
      kind: 'user' as const,
      subject: 'auth:test-user' as const,
      authKey: 'test-user',
    }),
  })
  const destructiveTestPermission = definePermission({
    key: 'tests.destroy',
    check: true,
  })

  afterEach(() => {
    if (originalIdentityForwardingKey === undefined) {
      delete process.env.CONVEX_IDENTITY_FORWARDING_KEY
    } else {
      process.env.CONVEX_IDENTITY_FORWARDING_KEY = originalIdentityForwardingKey
    }
  })

  it('exposes explicit backend lanes and unsafe escape hatches', () => {
    const builder = () => null as never

    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    expect(runtime.query).toBeTypeOf('object')
    expect(runtime.mutation).toBeTypeOf('object')
    expect(runtime.query.public).toBeTypeOf('function')
    expect(runtime.query.authenticated).toBeTypeOf('function')
    expect(runtime.query.workspace).toBeTypeOf('function')
    expect(runtime.query.protected).toBeTypeOf('function')
    expect(runtime.query.unsafe).toBeTypeOf('function')
    expect(runtime.mutation.public).toBeTypeOf('function')
    expect(runtime.mutation.authenticated).toBeTypeOf('function')
    expect(runtime.mutation.workspace).toBeTypeOf('function')
    expect(runtime.mutation.protected).toBeTypeOf('function')
    expect(runtime.mutation.unsafe).toBeTypeOf('function')
    expect(runtime.transportMutation).toBeTypeOf('function')
    expect(runtime.transportMutation.authenticated).toBeTypeOf('function')
    expect(runtime.unsafe.query).toBeTypeOf('function')
    expect(runtime.unsafe.mutation).toBeTypeOf('function')
    expect(runtime).not.toHaveProperty('app')
    expect(runtime).not.toHaveProperty('publicQuery')
  })

  it('does not attach recoverable raw DB to normal handler-visible ctx.db', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: signedInTestCaller,
      },
    )
    const memory = createMemoryDb()
    const rawDb = memory.db

    const definition = runtime.query.public({
      args: {},
      handler: async (ctx) => {
        const db = ctx.db as object & Record<PropertyKey, unknown>
        const descriptors = Object.getOwnPropertyDescriptors(db)
        const ownSymbols = Object.getOwnPropertySymbols(db)
        const ownValues = Object.values(descriptors).flatMap((descriptor) =>
          'value' in descriptor ? [descriptor.value] : [],
        )
        const symbolValues = ownSymbols.map((symbol) => db[symbol])

        return {
          sameReference: db === rawDb,
          ownSymbols: ownSymbols.length,
          descriptorLeaksRawDb: ownValues.includes(rawDb),
          symbolLeaksRawDb: symbolValues.includes(rawDb),
          knownStringLeaksRawDb: db.trellisUnsafeDb === rawDb,
          exposesEscapeIsolation: typeof db.escapeIsolation === 'function',
          canStillQuery: typeof db.query === 'function',
        }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<{
        sameReference: boolean
        ownSymbols: number
        descriptorLeaksRawDb: boolean
        symbolLeaksRawDb: boolean
        knownStringLeaksRawDb: boolean
        exposesEscapeIsolation: boolean
        canStillQuery: boolean
      }>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: rawDb,
          observe: async () => {},
        },
        {},
      ),
    ).resolves.toEqual({
      sameReference: false,
      ownSymbols: 0,
      descriptorLeaksRawDb: false,
      symbolLeaksRawDb: false,
      knownStringLeaksRawDb: false,
      exposesEscapeIsolation: false,
      canStillQuery: true,
    })
  })

  it('limits public handler ctx.db to explicitly declared read tables', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        public: {
          readTables: ['catalog'] as never[],
        },
      },
    )

    const definition = runtime.query.public({
      args: {
        catalogId: v.string(),
        privateId: v.string(),
      },
      handler: async (ctx, args) => {
        const catalogRows = await ctx.db.query('catalog' as never).collect()
        const catalogRow = await ctx.db.get(args.catalogId as never)
        let blockedRead = 'allowed'
        try {
          await ctx.db.query('privateUsers' as never).collect()
        } catch (error) {
          blockedRead = error instanceof Error ? error.message : String(error)
        }
        let blockedGet = 'allowed'
        try {
          await ctx.db.get(args.privateId as never)
        } catch (error) {
          blockedGet = error instanceof Error ? error.message : String(error)
        }
        let blockedWrite = 'allowed'
        try {
          await (ctx.db as { insert: (table: string, value: object) => unknown }).insert(
            'catalog',
            { title: 'write' },
          )
        } catch (error) {
          blockedWrite = error instanceof Error ? error.message : String(error)
        }

        return {
          catalogRows,
          catalogRow,
          blockedRead,
          blockedGet,
          blockedWrite,
        }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { catalogId: string; privateId: string },
      ) => Promise<{
        catalogRows: MemoryRow[]
        catalogRow: MemoryRow | null
        blockedRead: string
        blockedGet: string
        blockedWrite: string
      }>
    }

    const memory = createMemoryDb()
    const catalogId = await memory.db.insert('catalog', { title: 'public' })
    const privateId = await memory.db.insert('privateUsers', { email: 'secret@example.test' })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { catalogId, privateId },
      ),
    ).resolves.toMatchObject({
      catalogRows: [{ _id: catalogId, title: 'public' }],
      catalogRow: { _id: catalogId, title: 'public' },
      blockedRead:
        'Public handlers cannot access table "privateUsers". Add an explicit public.readTables entry or move this handler behind authentication.',
      blockedGet:
        'Public handlers cannot access table "privateUsers". Add an explicit public.readTables entry or move this handler behind authentication.',
      blockedWrite:
        'Public handlers cannot write through ctx.db. Use an operation-backed public write contract.',
    })
  })

  it('denies public handler ctx.db reads by default', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const definition = runtime.query.public({
      args: {},
      handler: async (ctx) => {
        try {
          await ctx.db.query('catalog' as never).collect()
          return 'allowed'
        } catch (error) {
          return error instanceof Error ? error.message : String(error)
        }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<string>
    }

    const memory = createMemoryDb()
    await memory.db.insert('catalog', { title: 'public' })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        {},
      ),
    ).resolves.toBe(
      'Public handlers cannot access table "catalog". Add an explicit public.readTables entry or move this handler behind authentication.',
    )
  })

  it('allows operation-backed public writes only through ctx.publicWrite', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        public: {
          readTables: ['todos'] as never[],
        },
      },
    )
    const capture = createObservationCapture()
    const definition = runtime.mutation.public(
      appOperation.publicMutation({
        id: 'todos.publicCreate',
        args: {
          title: v.string(),
        },
        publicWrite: {
          reason: 'Public todo demo allows anonymous todo creation.',
          tables: ['todos'],
          access: ({ db }) => ({
            create: async (title: string) =>
              await db.insert('todos' as never, {
                title,
                completed: false,
              }),
          }),
        },
        handler: async (ctx, args) => {
          let directWrite = 'allowed'
          try {
            await (ctx.db as { insert: (table: string, value: object) => unknown }).insert(
              'todos',
              { title: 'direct' },
            )
          } catch (error) {
            directWrite = error instanceof Error ? error.message : String(error)
          }
          const id = await ctx.publicWrite.create(args.title)
          return {
            id,
            directWrite,
          }
        },
      }),
    ) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { title: string },
      ) => Promise<{ id: string; directWrite: string }>
    }

    const memory = createMemoryDb()

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { title: 'public' },
      ),
    ).resolves.toEqual({
      id: 'todos:1;todos',
      directWrite:
        'Public handlers cannot write through ctx.db. Use an operation-backed public write contract.',
    })
    expect(memory.tables.todos).toEqual([
      {
        _id: 'todos:1;todos',
        title: 'public',
        completed: false,
      },
    ])
    expect(capture.find('db.public_write.used')).toContainEqual(
      expect.objectContaining({
        name: 'db.public_write.used',
        details: expect.objectContaining({
          reason: 'Public todo demo allows anonymous todo creation.',
          table: 'todos',
        }),
      }),
    )
    expect(capture.find('db.cross_tenant.used')).toEqual([])
  })

  it('requires publicWrite to be operation-backed', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })
    const definition = runtime.mutation.public({
      args: {},
      publicWrite: {
        reason: 'Attempt anonymous write without an operation id.',
        tables: ['todos'],
        access: ({ db }) => ({
          create: async () => await db.insert('todos' as never, { title: 'bad' }),
        }),
      },
      handler: async (ctx) => await ctx.publicWrite.create(),
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<unknown>
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
    ).rejects.toThrow(/publicWrite capabilities require an operation-backed handler with `id`/)
  })

  it('keeps publicWrite table-limited', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })
    const definition = runtime.mutation.public(
      appOperation.publicMutation({
        id: 'todos.publicWriteTableLimit',
        args: {},
        publicWrite: {
          reason: 'Attempt adjacent table write.',
          tables: ['todos'],
          access: ({ db }) => ({
            createPrivate: async () => await db.insert('privateUsers' as never, { email: 'x' }),
          }),
        },
        handler: async (ctx) => await ctx.publicWrite.createPrivate(),
      }),
    ) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<unknown>
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
    ).rejects.toThrow(/publicWrite capability does not allow table "privateUsers"/)
  })

  it('rejects publicWrite outside public mutation handlers', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })
    const queryDefinition = runtime.query.public({
      args: {},
      publicWrite: {
        reason: 'Invalid query write capability.',
        tables: ['todos'],
        access: () => ({}),
      },
      handler: async () => null,
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<unknown>
    }
    const authenticatedDefinition = runtime.mutation.authenticated(
      appOperation.publicMutation({
        id: 'todos.authenticatedPublicWrite',
        args: {},
        publicWrite: {
          reason: 'Invalid authenticated write capability.',
          tables: ['todos'],
          access: () => ({}),
        },
        handler: async () => null,
      } as never),
    ) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<unknown>
    }

    await expect(
      queryDefinition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/publicWrite capabilities are only valid on public mutation handlers/)

    await expect(
      authenticatedDefinition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        {},
      ),
    ).rejects.toThrow(/publicWrite capabilities are only valid on public mutation handlers/)
  })

  it('rejects duplicate public read table declarations', () => {
    const builder = (() => null) as never

    expect(() =>
      defineTrellis(
        {
          query: builder,
          mutation: builder,
        },
        {
          public: {
            readTables: ['catalog', 'catalog'] as never[],
          },
        },
      ),
    ).toThrow(/public\.readTables contains a duplicate table: "catalog"/)
  })

  it('exposes named read-only cross-tenant capabilities without a generic ctx.db escape', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        isolation: {
          tables: ['tasks'] as never[],
          field: 'workspaceId',
        },
      },
    )
    const capture = createObservationCapture()
    const definition = runtime.query.public({
      args: {
        id: v.string(),
      },
      crossTenant: {
        reason: 'Resolve visible task across workspace boundaries.',
        tables: ['tasks'],
        access: ({ db }) => ({
          getTask: async (id: string) => await db.get(id),
          listComments: async () => await db.query('comments' as never).collect(),
          insertTask: async () =>
            await (db as { insert: (table: string, value: unknown) => Promise<unknown> }).insert(
              'tasks',
              { title: 'bad', workspaceId: 'ws_2' },
            ),
        }),
      },
      handler: async (ctx, args) => {
        const task = await ctx.crossTenant.getTask(args.id)
        let adjacentDenied = false
        try {
          await ctx.crossTenant.listComments()
        } catch (error) {
          adjacentDenied =
            error instanceof Error && /does not allow table "comments"/i.test(error.message)
        }
        let writeDenied = false
        try {
          await ctx.crossTenant.insertTask()
        } catch (error) {
          writeDenied = error instanceof Error && /read-only/i.test(error.message)
        }
        return {
          title: task?.title,
          adjacentDenied,
          writeDenied,
          dbEscape: typeof (ctx.db as object & { escapeIsolation?: unknown }).escapeIsolation,
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
      ) => Promise<{
        title: string
        adjacentDenied: boolean
        writeDenied: boolean
        dbEscape: string
      }>
    }

    const memory = createMemoryDb()
    const id = await memory.db.insert('tasks', { title: 'cross', workspaceId: 'ws_2' })
    await memory.db.insert('comments', { body: 'nope', workspaceId: 'ws_2' })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { id },
      ),
    ).resolves.toEqual({
      title: 'cross',
      adjacentDenied: true,
      writeDenied: true,
      dbEscape: 'undefined',
    })
    expect(capture.find('db.cross_tenant.used')).toContainEqual(
      expect.objectContaining({
        name: 'db.cross_tenant.used',
        details: expect.objectContaining({
          reason: 'Resolve visible task across workspace boundaries.',
          table: 'tasks',
        }),
      }),
    )
  })

  it('requires cross-tenant writes to be operation-backed', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })
    const definition = runtime.mutation.public({
      args: {},
      crossTenant: {
        mode: 'write',
        reason: 'Attempt non-operation write.',
        tables: ['tasks'],
        access: ({ db }) => ({
          create: async () =>
            await (db as { insert: (table: string, value: unknown) => Promise<unknown> }).insert(
              'tasks',
              { title: 'bad', workspaceId: 'ws_1' },
            ),
        }),
      },
      handler: async (ctx) => await ctx.crossTenant.create(),
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<unknown>
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
    ).rejects.toThrow(/operation-backed handler with `id`/)
  })

  it('allows operation-backed cross-tenant write capabilities to expose narrow methods', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })
    const createTaskOp = appOperation.mutation({
      id: 'tasks.cross-tenant-create',
      args: {
        title: v.string(),
      },
      crossTenant: {
        mode: 'write',
        reason: 'Operation-backed workspace bootstrap writes one task table.',
        tables: ['tasks'],
        access: ({ db }) => ({
          create: async (title: string) =>
            await (db as { insert: (table: string, value: unknown) => Promise<unknown> }).insert(
              'tasks',
              { title, workspaceId: 'ws_2' },
            ),
        }),
      },
      handler: async (ctx, args: { title: string }) => await ctx.crossTenant.create(args.title),
    } as never)
    const definition = runtime.mutation.public(createTaskOp as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { title: string },
      ) => Promise<string>
    }
    const memory = createMemoryDb()

    const id = await definition.handler(
      {
        auth: { getUserIdentity: async () => null },
        db: memory.db,
        observe: async () => {},
      },
      { title: 'bootstrapped' },
    )

    await expect(memory.db.get(id)).resolves.toEqual(
      expect.objectContaining({
        title: 'bootstrapped',
        workspaceId: 'ws_2',
      }),
    )
  })

  it('does not expose callable root backend builders', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        appIdentity: testAppIdentity,
      },
    )

    expect(runtime.query).not.toBeTypeOf('function')
    expect(runtime.mutation).not.toBeTypeOf('function')
    expect(() => (runtime.query as unknown as (definition: unknown) => unknown)({})).toThrow(
      /runtime\.query is not a function|is not a function/i,
    )
    expect(() => (runtime.mutation as unknown as (definition: unknown) => unknown)({})).toThrow(
      /runtime\.mutation is not a function|is not a function/i,
    )
  })

  it('stamps explicit backend lane metadata', () => {
    const builder = ((definition: unknown) => definition) as never
    const workspacePermission = definePermission({
      key: 'workspace.read',
      check: true,
    })

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const publicQuery = runtime.query.public({
      args: {},
      handler: async () => ({ ok: true }),
    } as never) as Record<PropertyKey, unknown>
    const protectedMutation = runtime.mutation.protected({
      args: {},
      guard: allowAll,
      handler: async () => ({ ok: true }),
    } as never) as Record<PropertyKey, unknown>
    const authenticatedQuery = runtime.query.authenticated({
      args: {},
      handler: async () => ({ ok: true }),
    } as never) as Record<PropertyKey, unknown>
    const workspaceQuery = runtime.query.workspace({
      args: {},
      permission: workspacePermission,
      handler: async () => ({ ok: true }),
    } as never) as Record<PropertyKey, unknown>
    const unsafeMutation = runtime.mutation.unsafe({
      args: {},
      permit: unsafe.permit({
        kind: 'testSetup',
        reason: 'test setup',
        scope: ['tests'],
      }),
      handler: async () => ({ ok: true }),
    } as never) as Record<PropertyKey, unknown>

    expect(publicQuery[trellisBackendLaneMetadataKey]).toBe('public')
    expect(authenticatedQuery[trellisBackendLaneMetadataKey]).toBe('authenticated')
    expect(workspaceQuery[trellisBackendLaneMetadataKey]).toBe('workspace')
    expect(protectedMutation[trellisBackendLaneMetadataKey]).toBe('protected')
    expect(unsafeMutation[trellisBackendLaneMetadataKey]).toBe('unsafe')
  })

  it('registers beginner app operations through Convex backend lanes', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })
    const args = { title: v.string() }
    const listTodosOp = appOperation.query({
      id: 'todos.list',
      args,
      permission: 'todos.read',
      handler: async (_ctx, input: { title: string }) => ({ title: input.title }),
    })

    const definition = runtime.query.public(listTodosOp as never) as {
      args: { fields: { title: typeof args.title } }
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: Record<string, never>
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { title: string },
      ) => Promise<unknown>
      [trellisBackendLaneMetadataKey]: 'public'
    }

    expect(listTodosOp.args).toBe(args)
    expect(definition.args.fields.title).toBe(args.title)
    expect(definition[trellisBackendLaneMetadataKey]).toBe('public')
    expect(getOperationMetadata(definition)).toMatchObject({
      id: 'todos.list',
      kind: 'safe',
      permissionKey: 'todos.read',
    })
    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: {},
          observe: async () => {},
        },
        { title: 'Ship 0.3' },
      ),
    ).resolves.toEqual({ title: 'Ship 0.3' })
  })

  it('preserves app destructive operation permission metadata through preview and execute lanes', () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        appIdentity: testAppIdentity,
      },
    )
    const removeTodoPermission = definePermission({
      key: 'todos.remove',
      check: true,
    })
    const args = { id: v.string() }
    const removeTodoOp = appOperation.destructive({
      id: 'todos.remove',
      args,
      permission: removeTodoPermission,
      safety: 'destructive-write',
      preview: async (_ctx, input: { id: string }) =>
        operationPreview({
          summary: `Remove ${input.id}`,
          confirm: { id: input.id },
        }),
      handler: async () => null,
    })

    const previewDefinition = runtime.mutation.authenticated(previewOf(removeTodoOp as never)) as {
      args: { fields: { id: typeof args.id } }
    }
    const executeDefinition = runtime.mutation.authenticated(removeTodoOp as never) as {
      args: { fields: { id: typeof args.id } }
    }

    expect(previewDefinition.args.fields.id).toBe(args.id)
    expect(executeDefinition.args.fields.id).toBe(args.id)
    expect(getOperationMetadata(previewDefinition)).toMatchObject({
      id: 'todos.remove',
      kind: 'destructive',
      permissionKey: 'todos.remove',
      safety: 'destructive-write',
    })
    expect(getOperationMetadata(executeDefinition)).toEqual(getOperationMetadata(previewDefinition))
  })

  it('registers guardless app destructive previews through workspace lanes', () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        appIdentity: testAppIdentity,
      },
    )
    const removeTodoPermission = definePermission({
      key: 'todos.remove',
      check: true,
    })
    const args = { id: v.string() }
    const removeTodoOp = appOperation.destructive({
      id: 'todos.remove',
      args,
      permission: removeTodoPermission,
      safety: 'destructive-write',
      preview: async (_ctx, input: { id: string }) =>
        operationPreview({
          summary: `Remove ${input.id}`,
          confirm: { id: input.id },
        }),
      handler: async () => null,
    })
    const previewHandler = previewOf(removeTodoOp)

    expect(previewHandler).not.toHaveProperty('guard')
    expect(previewHandler.permission).toBe(removeTodoPermission)

    const previewDefinition = runtime.mutation.workspace(previewHandler as never) as {
      args: { fields: { id: typeof args.id } }
    }
    const executeDefinition = runtime.mutation.workspace(removeTodoOp as never) as {
      args: { fields: { id: typeof args.id } }
    }

    expect(previewDefinition.args.fields.id).toBe(args.id)
    expect(executeDefinition.args.fields.id).toBe(args.id)
    expect(getOperationMetadata(previewDefinition)).toMatchObject({
      id: 'todos.remove',
      kind: 'destructive',
      permissionKey: 'todos.remove',
      safety: 'destructive-write',
    })
    expect(getOperationMetadata(executeDefinition)).toEqual(getOperationMetadata(previewDefinition))
  })

  it('rejects guard on public backend lane', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    expect(() =>
      runtime.query.public({
        args: {},
        guard: allowAll,
        handler: async () => ({ ok: true }),
      } as never),
    ).toThrow(/must not provide `guard`/)
  })

  it('rejects protected backend handlers without a guard', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    expect(() =>
      runtime.query.protected({
        args: {},
        handler: async () => ({ ok: true }),
      } as never),
    ).toThrow(/protected backend handlers require `guard`/)
  })

  it('rejects open guards on protected backend handlers', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    expect(() =>
      runtime.query.protected({
        args: {},
        guard: open,
        handler: async () => ({ ok: true }),
      } as never),
    ).toThrow(/must not use `guard: open`/)
  })

  it('rejects custom guards on authenticated and workspace lanes', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    expect(() =>
      runtime.query.authenticated({
        args: {},
        guard: allowAll,
        handler: async () => ({ ok: true }),
      } as never),
    ).toThrow(/authenticated backend handlers must not provide `guard`/)

    expect(() =>
      runtime.query.workspace({
        args: {},
        guard: allowAll,
        handler: async () => ({ ok: true }),
      } as never),
    ).toThrow(/workspace backend handlers must not provide `guard`/)
  })

  it('accepts guardless app operation definitions on signed-in lanes', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const operation = appOperation.mutation({
      id: 'workspaces.create',
      args: {},
      handler: async () => ({ ok: true }),
    })

    const registered = runtime.mutation.authenticated(operation as never) as typeof operation & {
      [trellisBackendLaneMetadataKey]?: unknown
    }

    expect(getOperationMetadata(registered)).toMatchObject({ id: 'workspaces.create' })
    expect(registered[trellisBackendLaneMetadataKey]).toBe('authenticated')
  })

  it('uses concrete operation permission metadata as the workspace lane guard', async () => {
    const builder = ((definition: unknown) => definition) as never
    const workspaceRead = definePermission({
      key: 'workspace.read',
      check: (appIdentity: { workspaceId?: string }) => appIdentity.workspaceId === 'workspace-1',
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: defineCaller({
          resolve: async () => ({
            kind: 'user' as const,
            subject: 'auth:alice' as const,
            authKey: 'alice',
          }),
        }),
        appIdentity: async (_ctx, args) => ({
          userId: 'alice',
          workspaceId: typeof args.workspaceId === 'string' ? args.workspaceId : undefined,
        }),
      },
    )

    const operation = appOperation.query({
      id: 'todos.list',
      args: { workspaceId: v.string() },
      permission: workspaceRead,
      handler: async (ctx) => await ctx.appIdentity(),
    })

    const definition = runtime.query.workspace(operation as never) as {
      handler: (ctx: { db: ReturnType<typeof createMemoryDb>['db'] }, args: unknown) => unknown
      [trellisBackendLaneMetadataKey]?: unknown
    }

    expect(definition[trellisBackendLaneMetadataKey]).toBe('workspace')
    await expect(
      definition.handler({ db: createMemoryDb().db }, { workspaceId: 'workspace-1' }),
    ).resolves.toEqual({
      userId: 'alice',
      workspaceId: 'workspace-1',
    })
    await expect(
      definition.handler({ db: createMemoryDb().db }, { workspaceId: 'workspace-2' }),
    ).rejects.toThrow(/Forbidden: workspace.read/)
  })

  it('rejects metadata-only permission keys on workspace lanes', () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })
    const operation = appOperation.query({
      id: 'todos.list',
      args: {},
      permission: 'workspace.read',
      handler: async () => ({ ok: true }),
    })

    expect(() => runtime.query.workspace(operation as never)).toThrow(
      /must provide a definePermission\(\.\.\.\) object/,
    )
  })

  it('rejects workspace lanes without concrete permission metadata', () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    expect(() =>
      runtime.query.workspace({
        args: {},
        handler: async () => ({ ok: true }),
      } as never),
    ).toThrow(/workspace backend handlers require `permission`/)

    const operation = appOperation.mutation({
      id: 'todos.create',
      args: {},
      handler: async () => ({ ok: true }),
    })

    expect(() => runtime.mutation.workspace(operation as never)).toThrow(
      /workspace backend handlers require `permission`/,
    )
  })

  it('rejects custom-guard operation definitions on signed-in lanes', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const operation = defineOperation({
      id: 'workspaces.create',
      kind: 'safe',
      args: {},
      guard: allowAll,
      handler: async () => ({ ok: true }),
    })

    expect(() => runtime.mutation.authenticated(operation as never)).toThrow(
      /authenticated backend handlers must not provide `guard`/,
    )
    expect(() => runtime.mutation.workspace(operation as never)).toThrow(
      /workspace backend handlers must not provide `guard`/,
    )
  })

  it('requires an authenticated caller on the authenticated lane', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: defineCaller({
          resolve: async (_ctx, args) =>
            args.userId
              ? {
                  kind: 'user' as const,
                  subject: `auth:${args.userId}` as const,
                  authKey: String(args.userId),
                }
              : { kind: 'anonymous' as const, subject: 'system:anonymous' as const },
        }),
        appIdentity: async (_ctx, _args, caller) =>
          caller.kind === 'user' ? { userId: caller.authKey } : null,
      },
    )

    const definition = runtime.query.authenticated({
      args: { userId: v.optional(v.string()) },
      handler: async (ctx) => await ctx.caller(),
    } as never) as {
      handler: (ctx: { db: ReturnType<typeof createMemoryDb>['db'] }, args: unknown) => unknown
    }

    await expect(definition.handler({ db: createMemoryDb().db }, {})).rejects.toThrow(
      /Forbidden: authRequired/,
    )
    await expect(
      definition.handler({ db: createMemoryDb().db }, { userId: 'alice' }),
    ).resolves.toMatchObject({
      kind: 'user',
      authKey: 'alice',
    })
  })

  it('requires a resolved workspace identity on the workspace lane before load runs', async () => {
    const builder = ((definition: unknown) => definition) as never
    const workspaceRead = definePermission({
      key: 'workspace.read',
      check: true,
    })
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        caller: defineCaller({
          resolve: async () => ({
            kind: 'user' as const,
            subject: 'auth:alice' as const,
            authKey: 'alice',
          }),
        }),
        appIdentity: async (_ctx, args) =>
          args.workspaceId
            ? { userId: 'alice', workspaceId: args.workspaceId }
            : { userId: 'alice' },
      },
    )
    let loadCalls = 0
    const load = async () => {
      loadCalls += 1
      return { ok: true }
    }

    const definition = runtime.query.workspace({
      args: { workspaceId: v.optional(v.string()) },
      permission: workspaceRead,
      load,
      handler: async (ctx) => await ctx.appIdentity(),
    } as never) as {
      handler: (ctx: { db: ReturnType<typeof createMemoryDb>['db'] }, args: unknown) => unknown
    }

    await expect(definition.handler({ db: createMemoryDb().db }, {})).rejects.toThrow(
      /workspace required/,
    )
    expect(loadCalls).toBe(0)
    await expect(
      definition.handler({ db: createMemoryDb().db }, { workspaceId: 'workspace-1' }),
    ).resolves.toEqual({
      userId: 'alice',
      workspaceId: 'workspace-1',
    })
    expect(loadCalls).toBe(1)
  })

  it('rejects signed forwarding envelopes for the wrong function ref on real protected handlers', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const definition = runtime.query.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'posts:create',
      handler: async () => ({ ok: true }),
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: Record<string, never>
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Hello' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'posts:delete',
      operation: 'query',
      jti: 'wrong-function-ref',
      now: Date.UTC(2026, 4, 9, 12, 0, 0),
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: {},
          observe: async () => {},
        },
        args,
      ),
    ).rejects.toThrow(/function-ref/)
  })

  it('rejects signed forwarding envelopes when handler metadata does not name the expected function ref', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const definition = runtime.query.public({
      args: {
        title: v.string(),
      },
      handler: async () => ({ ok: true }),
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: Record<string, never>
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Hello' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'posts:create',
      operation: 'query',
      jti: 'missing-function-ref-metadata',
      now: Date.UTC(2026, 4, 9, 12, 0, 0),
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: {},
          observe: async () => {},
        },
        args,
      ),
    ).rejects.toThrow(/identityForwardingFunctionRef metadata/)
  })

  it('uses projected operation function-ref metadata for identity forwarding verification', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        appIdentity: testAppIdentity,
      },
    )

    const operation = defineOperation({
      id: 'tasks.delete',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({ summary: `Delete ${args.id}`, confirm: { id: args.id } }),
      handler: async () => ({ deleted: true }),
    })
    const definition = runtime.transportMutation.authenticated(
      transportExecuteOperationRef(operation, operation, {
        functionRef: 'tasks:delete',
      }),
    ) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<unknown>
    }
    const args = createIdentityForwardingEnvelopeArgs({
      args: { id: 'task_1' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:wrong',
      operation: 'mutation',
      purpose: 'operation-execute',
      replayMode: 'operation-confirmation',
      jti: 'execute-1',
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
    ).rejects.toThrow(/function-ref/)
  })

  it('requires trusted operation-execute forwarding for destructive transport mutations', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    let executed = false
    const operation = defineOperation({
      id: 'tasks.delete.transport',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({ summary: `Delete ${args.id}`, confirm: { id: args.id } }),
      handler: async () => {
        executed = true
        return { deleted: true }
      },
    })

    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const definition = runtime.transportMutation.authenticated(
      transportExecuteOperationRef(operation, operation, {
        functionRef: 'tasks:delete',
      }) as never,
    ) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
        loaded?: unknown,
      ) => Promise<unknown>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        { id: 'task_1' },
      ),
    ).rejects.toThrow(/operation-execute forwarding envelope/)
    expect(executed).toBe(false)

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        createIdentityForwardingEnvelopeArgs({
          args: { id: 'task_1' },
          caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
          functionRef: 'tasks:delete',
          operation: 'mutation',
          purpose: 'operation-execute',
          replayMode: 'operation-confirmation',
          jti: 'execute-1',
        }),
      ),
    ).resolves.toEqual({ deleted: true })
  })

  it('rejects anonymous callers on authenticated destructive transport mutations', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        appIdentity: testAppIdentity,
      },
    )

    let executed = false
    const operation = appOperation.destructive({
      id: 'tasks.delete.transport.authenticated',
      args: {
        id: v.string(),
      },
      preview: async (_ctx, args) =>
        operationPreview({ summary: `Delete ${args.id}`, confirm: { id: args.id } }),
      handler: async () => {
        executed = true
        return { deleted: true }
      },
    })

    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const definition = runtime.transportMutation.authenticated(
      transportExecuteOperationRef(operation, operation, {
        functionRef: 'tasks:delete',
      }) as never,
    ) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
        loaded?: unknown,
      ) => Promise<unknown>
    }

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: createMemoryDb().db,
          observe: async () => {},
        },
        createIdentityForwardingEnvelopeArgs({
          args: { id: 'task_1' },
          caller: { kind: 'anonymous', subject: 'system:anonymous' },
          functionRef: 'tasks:delete',
          operation: 'mutation',
          purpose: 'operation-execute',
          replayMode: 'operation-confirmation',
          jti: 'execute-anonymous',
        }),
      ),
    ).rejects.toThrow(/Forbidden: authRequired/)
    expect(executed).toBe(false)
  })

  it('rejects replayed operation-execute forwarding envelopes before handler execution', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
      },
    )

    let executed = false
    const definition = runtime.mutation.public({
      args: {
        id: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:delete',
      handler: async () => {
        executed = true
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
      ) => Promise<unknown>
    }

    const memory = createMemoryDb()
    memory.tables.destructiveConfirmations = [{ jti: 'execute-1', redeemedAt: 1 }]
    const args = createIdentityForwardingEnvelopeArgs({
      args: { id: 'task_1' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:delete',
      operation: 'mutation',
      purpose: 'operation-execute',
      replayMode: 'operation-confirmation',
      jti: 'execute-1',
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
    ).rejects.toThrow(/already been redeemed/i)
    expect(executed).toBe(false)
  })

  it('rejects operation-execute forwarding envelopes without operation-confirmation replay mode', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
      },
    )

    let executed = false
    const definition = runtime.mutation.public({
      args: {
        id: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:delete',
      handler: async () => {
        executed = true
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
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { id: 'task_1' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:delete',
      operation: 'mutation',
      purpose: 'operation-execute',
      jti: 'execute-missing-replay-mode',
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
    ).rejects.toThrow(/operation-execute envelopes require operation-confirmation replay mode/i)
    expect(executed).toBe(false)
  })

  it('fails closed for operation-execute forwarding envelopes without destructive safety', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    let executed = false
    const definition = runtime.mutation.public({
      args: {
        id: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:delete',
      handler: async () => {
        executed = true
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
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { id: 'task_1' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:delete',
      operation: 'mutation',
      purpose: 'operation-execute',
      replayMode: 'operation-confirmation',
      jti: 'execute-1',
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
    ).rejects.toThrow(/operation-execute envelopes require destructive safety confirmation/i)
    expect(executed).toBe(false)
  })

  it('reports destructive safety misconfiguration for operation-execute envelope replay checks', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
      },
    )

    let executed = false
    const definition = runtime.mutation.public({
      args: {
        id: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:delete',
      handler: async () => {
        executed = true
        return { ok: true }
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: Record<string, never>
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { id: 'task_1' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:delete',
      operation: 'mutation',
      purpose: 'operation-execute',
      replayMode: 'operation-confirmation',
      jti: 'execute-1',
    })

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: {},
          observe: async () => {},
        },
        args,
      ),
    ).rejects.toThrow(
      /Destructive safety for operation "tasks:delete" is misconfigured.*destructiveConfirmations.*by_jti.*destructiveAuditLog/i,
    )
    expect(executed).toBe(false)
  })

  it('rejects trusted mutation forwarding without declared replay behavior before handler execution', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    let executed = false
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        executed = true
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
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'No replay behavior' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      jti: 'trusted-jti-missing-replay',
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
    ).rejects.toThrow(/trusted identity forwarding writes require replay behavior/i)
    expect(executed).toBe(false)
  })

  it('rejects operation-confirmation replay mode on trusted mutation forwarding before handler execution', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    let executed = false
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        executed = true
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
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Wrong replay mode' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'operation-confirmation',
      jti: 'trusted-jti-wrong-operation-confirmation',
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
    ).rejects.toThrow(/operation-confirmation replay mode is only valid for operation-execute/i)
    expect(executed).toBe(false)
  })

  it('claims and completes trusted JTI redemption before allowing a mutation handler', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        trustedReplay: {
          table: 'trustedReplay' as never,
        },
      },
    )

    let executions = 0
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        executions += 1
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
      ) => Promise<unknown>
    }

    const memory = createMemoryDb()
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Create once' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'jti-redemption',
      jti: 'trusted-jti-1',
    })
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: memory.db,
      observe: async () => {},
    }

    await expect(definition.handler(ctx, args)).resolves.toEqual({ ok: true })
    await expect(definition.handler(ctx, args)).rejects.toThrow(/already been redeemed/i)

    expect(executions).toBe(1)
    expect(memory.tables.trustedReplay).toHaveLength(1)
    expect(memory.tables.trustedReplay[0]).toMatchObject({
      jti: 'trusted-jti-1',
      functionRef: 'tasks:create',
      replayMode: 'jti-redemption',
      state: 'completed',
    })
  })

  it('marks failed trusted JTI redemption and allows matching retry after handler failure', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        trustedReplay: {
          table: 'trustedReplay' as never,
        },
      },
    )

    let executions = 0
    let shouldFail = true
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        executions += 1
        if (shouldFail) throw new Error('business failed')
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
      ) => Promise<unknown>
    }

    const memory = createMemoryDb()
    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Fail once' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'jti-redemption',
      jti: 'trusted-jti-failed',
    })
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: memory.db,
      observe: async () => {},
    }

    await expect(definition.handler(ctx, args)).rejects.toThrow(/business failed/)
    expect(memory.tables.trustedReplay).toHaveLength(1)
    expect(memory.tables.trustedReplay[0]).toMatchObject({
      jti: 'trusted-jti-failed',
      state: 'failed',
      failure: { message: 'business failed' },
    })

    shouldFail = false
    await expect(definition.handler(ctx, args)).resolves.toEqual({ ok: true })
    await expect(definition.handler(ctx, args)).rejects.toThrow(/already been redeemed/i)

    expect(executions).toBe(2)
    expect(memory.tables.trustedReplay).toHaveLength(1)
    expect(memory.tables.trustedReplay[0]).toMatchObject({
      jti: 'trusted-jti-failed',
      state: 'completed',
    })
  })

  it('rejects failed trusted JTI redemption retry when the envelope metadata changes', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        trustedReplay: {
          table: 'trustedReplay' as never,
        },
      },
    )

    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        throw new Error('business failed')
      },
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<unknown>
    }

    const memory = createMemoryDb()
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: memory.db,
      observe: async () => {},
    }
    const firstArgs = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Fail once' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'jti-redemption',
      jti: 'trusted-jti-failed-mismatch',
    })
    const changedArgs = createIdentityForwardingEnvelopeArgs({
      args: { title: 'Different retry args' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'jti-redemption',
      jti: 'trusted-jti-failed-mismatch',
    })

    await expect(definition.handler(ctx, firstArgs)).rejects.toThrow(/business failed/)
    await expect(definition.handler(ctx, changedArgs)).rejects.toThrow(
      /does not match the failed claim/i,
    )
  })

  it('fails closed for trusted JTI redemption when no replay table is configured', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    let executed = false
    const definition = runtime.mutation.public({
      args: {
        title: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:create',
      handler: async () => {
        executed = true
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
      ) => Promise<unknown>
    }

    const args = createIdentityForwardingEnvelopeArgs({
      args: { title: 'No table' },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:create',
      operation: 'mutation',
      replayMode: 'jti-redemption',
      jti: 'trusted-jti-no-table',
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
    ).rejects.toThrow(/trusted identity forwarding writes require defineTrellis/i)
    expect(executed).toBe(false)
  })

  it('forwards internal builders when provided', () => {
    const builder = () => null as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
      internalQuery: builder,
      internalMutation: builder,
    })

    expect(runtime.internalQuery).toBeTypeOf('object')
    expect(runtime.internalQuery?.protected).toBeTypeOf('function')
    expect(runtime.internalMutation).toBeTypeOf('object')
    expect(runtime.internalMutation?.protected).toBeTypeOf('function')
  })

  it('forwards action builders when provided', () => {
    const builder = () => null as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
      action: builder,
    })

    expect(runtime.action).toBeTypeOf('object')
    expect(runtime.action?.protected).toBeTypeOf('function')
    expect(runtime.unsafe.action).toBeTypeOf('function')
  })

  it('requires a typed permit for unsafe builders', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    expect(() =>
      runtime.unsafe.query({
        args: {},
        handler: async () => null,
      } as never),
    ).toThrow(/unsafe\.query\(\{ permit \}\): unsafe handlers require unsafe\.permit\(\.\.\.\)/i)
  })

  it('emits an unsafe handler event with typed permit metadata', async () => {
    const builder = ((definition: unknown) => definition) as never
    const capture = createObservationCapture()

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const definition = runtime.unsafe.query({
      permit: unsafe.permit({
        kind: 'publicCatalog',
        reason: 'Public catalog listing is intentionally unauthenticated.',
        scope: ['runbooks'],
        reviewBy: '2026-07-01',
      }),
      args: {},
      handler: async () => ['ok'],
    } as never) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: Record<string, never>
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, never>,
      ) => Promise<unknown>
    }

    await definition.handler(
      {
        auth: {
          getUserIdentity: async () => null,
        },
        db: {},
        observe: async () => {},
      },
      {},
    )

    expect(capture.find('unsafe.handler.used')).toContainEqual(
      expect.objectContaining({
        name: 'unsafe.handler.used',
        status: 'success',
        details: {
          kind: 'publicCatalog',
          reason: 'Public catalog listing is intentionally unauthenticated.',
          reviewBy: '2026-07-01',
          scope: ['runbooks'],
          surface: 'unsafe.query',
        },
      }),
    )
    capture.stop()
  })

  it('rejects destructive operation registration when destructiveOperations is missing', () => {
    const builder = ((definition: unknown) => definition) as never

    const runtime = defineTrellis({
      query: builder,
      mutation: builder,
    })

    const destructiveOp = defineOperation({
      id: 'tests.destroy',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      preview: async () =>
        operationPreview({
          summary: 'Destroy test record',
          confirm: { operation: 'tests.destroy' },
        }),
      handler: async () => null,
    })

    expect(() => runtime.mutation.authenticated(destructiveOp)).toThrow(/destructiveOperations/)
  })

  it('requires confirmation before executing destructive operation mutations', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    const destructiveOp = defineOperation({
      id: 'tests.destroy',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      preview: async () =>
        operationPreview({
          summary: 'Destroy test record',
          confirm: { operation: 'tests.destroy' },
        }),
      handler: async () => 'destroyed',
    })

    const definition = runtime.mutation.authenticated(destructiveOp) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: Record<string, never>
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string },
      ) => Promise<unknown>
    }
    const capture = createObservationCapture()

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: {},
          observe: async () => {},
        },
        { id: 'record-1' },
      ),
    ).rejects.toThrow(/requires confirmation/i)

    expect(capture.find('operation.confirm.missing')).toContainEqual(
      expect.objectContaining({
        name: 'operation.confirm.missing',
        status: 'deny',
        operation: 'tests.destroy',
      }),
    )
    capture.stop()
  })

  it('rejects replayed destructive operation confirmation tokens', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
          previewConfirmation: {
            callerKey: () => 'caller:test',
            scopeKey: () => 'tenant:test',
          },
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    let executions = 0
    const destructiveOp = defineOperation({
      id: 'tests.destroy',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({
          summary: `Destroy ${args.id}`,
          confirm: { operation: 'tests.destroy', id: args.id },
        }),
      handler: async () => {
        executions += 1
        return 'destroyed'
      },
    })

    const definition = runtime.mutation.authenticated(destructiveOp) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string; _confirmationToken: string },
      ) => Promise<unknown>
    }
    const memory = createMemoryDb()
    const executeArgs = { id: 'record-1' }
    const token = await confirmationToken({
      memory,
      operationId: 'tests.destroy',
      executeArgs,
      confirm: { operation: 'tests.destroy', id: 'record-1' },
      jti: 'jti-replay-test',
    })
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: memory.db,
      observe: async () => {},
    }

    await expect(
      definition.handler(ctx, { ...executeArgs, _confirmationToken: token }),
    ).resolves.toBe('destroyed')
    await expect(
      definition.handler(ctx, { ...executeArgs, _confirmationToken: token }),
    ).rejects.toThrow(/already been redeemed/i)

    expect(executions).toBe(1)
    expect(memory.tables.destructiveConfirmations).toHaveLength(1)
    expect(memory.tables.destructiveAuditLog).toHaveLength(1)
  })

  it('attaches confirmation tokens to destructive operation previews when configured', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
          previewConfirmation: {
            callerKey: () => 'caller:test',
            scopeKey: () => 'tenant:test',
            ttlSeconds: 60,
          },
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    const destructiveOp = defineOperation({
      id: 'tests.preview-token',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:delete',
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({
          summary: `Destroy ${args.id}`,
          confirm: { operation: 'tests.preview-token', id: args.id },
          version: { id: args.id, version: 1 },
        }),
      handler: async () => 'destroyed',
    })

    const previewDefinition = runtime.mutation.authenticated({
      ...previewOf(destructiveOp),
      identityForwardingFunctionRef: 'tasks:previewDelete',
    }) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string },
      ) => Promise<{ confirmation?: { token: string; expiresAt: number } }>
    }
    const executeDefinition = runtime.mutation.authenticated(destructiveOp) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string; _confirmationToken: string },
      ) => Promise<unknown>
    }

    const memory = createMemoryDb()
    const ctx = {
      auth: { getUserIdentity: async () => null },
      db: memory.db,
      observe: async () => {},
    }
    const preview = await previewDefinition.handler(ctx, { id: 'record-1' })

    expect(preview.confirmation?.token).toEqual(expect.any(String))
    expect(preview.confirmation?.expiresAt).toBeGreaterThan(Date.now())
    expect(memory.tables.destructiveConfirmations).toHaveLength(1)
    expect(memory.tables.destructiveConfirmations[0]).not.toHaveProperty(
      'token',
      preview.confirmation?.token,
    )
    await expect(
      executeDefinition.handler(ctx, {
        id: 'record-1',
        _confirmationToken: preview.confirmation!.token,
      }),
    ).resolves.toBe('destroyed')
    await expect(
      executeDefinition.handler(ctx, {
        id: 'record-1',
        _confirmationToken: preview.confirmation!.token,
      }),
    ).rejects.toThrow(/already been redeemed/i)
  })

  it('rejects query previews that try to issue stored destructive confirmations', () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
          previewConfirmation: {
            callerKey: () => 'caller:test',
            scopeKey: () => 'tenant:test',
          },
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    const destructiveOp = defineOperation({
      id: 'tests.query-preview-token',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:delete',
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({
          summary: `Destroy ${args.id}`,
          confirm: { operation: 'tests.query-preview-token', id: args.id },
        }),
      handler: async () => 'destroyed',
    })

    expect(() =>
      runtime.query.authenticated({
        ...previewOf(destructiveOp),
        identityForwardingFunctionRef: 'tasks:previewDelete',
      }),
    ).toThrow(/cannot issue confirmation tokens.*mutation\(previewOf\(op\)\)/i)
  })

  it('requires operation-execute forwarding and confirmation tokens to share the same jti', async () => {
    process.env.CONVEX_IDENTITY_FORWARDING_KEY = 'trusted-key-with-enough-alpha-entropy'
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
          previewConfirmation: {
            callerKey: () => 'caller:test',
            scopeKey: () => 'tenant:test',
          },
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    let executed = false
    const destructiveOp = defineOperation({
      id: 'tests.destroy',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      identityForwardingFunctionRef: 'tasks:delete',
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({ summary: `Destroy ${args.id}`, confirm: { id: args.id } }),
      handler: async () => {
        executed = true
        return 'destroyed'
      },
    })

    const definition = runtime.mutation.authenticated(destructiveOp) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: Record<string, unknown>,
      ) => Promise<unknown>
    }
    const memory = createMemoryDb()
    const executeArgs = { id: 'record-1' }
    const token = await confirmationToken({
      memory,
      operationId: 'tests.destroy',
      executeArgs,
      confirm: { id: 'record-1' },
      jti: 'confirmation-jti',
      executePath: 'tasks:delete',
    })
    const args = createIdentityForwardingEnvelopeArgs({
      args: { ...executeArgs, _confirmationToken: token },
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      functionRef: 'tasks:delete',
      operation: 'mutation',
      purpose: 'operation-execute',
      replayMode: 'operation-confirmation',
      jti: 'envelope-jti',
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
    ).rejects.toThrow(/operation-execute envelope does not match the confirmation token/i)

    expect(executed).toBe(false)
    expect(memory.tables.destructiveConfirmations ?? []).toHaveLength(1)
    expect(memory.tables.destructiveAuditLog ?? []).toHaveLength(0)
  })

  it('reports destructive safety misconfiguration before destructive handler execution', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
          previewConfirmation: {
            callerKey: () => 'caller:test',
            scopeKey: () => 'tenant:test',
          },
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    let executed = false
    const destructiveOp = defineOperation({
      id: 'tests.destroy',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({ summary: `Destroy ${args.id}`, confirm: { id: args.id } }),
      handler: async () => {
        executed = true
        return 'destroyed'
      },
    })

    const definition = runtime.mutation.authenticated(destructiveOp) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: Record<string, never>
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string; _confirmationToken: string },
      ) => Promise<unknown>
    }
    const executeArgs = { id: 'record-1' }
    const token = createConfirmationToken()

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: {},
          observe: async () => {},
        },
        { ...executeArgs, _confirmationToken: token },
      ),
    ).rejects.toThrow(
      /Destructive safety for operation "tests.destroy" is misconfigured.*destructiveConfirmations.*by_token_hash.*by_jti.*destructiveAuditLog/i,
    )

    expect(executed).toBe(false)
  })

  it('re-runs authorization after destructive confirmation before redeeming', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
          previewConfirmation: {
            callerKey: () => 'caller:test',
            scopeKey: () => 'tenant:test',
          },
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    let authorized = true
    let executed = false
    const destructiveOp = defineOperation({
      id: 'tests.destroy',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      authorize: {
        label: 'tests.destroy',
        check: async () => authorized,
      },
      preview: async (_ctx, args) =>
        operationPreview({ summary: 'Destroy test record', confirm: { id: args.id } }),
      handler: async () => {
        executed = true
        return 'destroyed'
      },
    })

    const definition = runtime.mutation.authenticated(destructiveOp) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string; _confirmationToken: string },
      ) => Promise<unknown>
    }
    const memory = createMemoryDb()
    const executeArgs = { id: 'record-1' }
    const token = await confirmationToken({
      memory,
      operationId: 'tests.destroy',
      executeArgs,
      confirm: { id: 'record-1' },
      jti: 'auth-recheck',
    })

    authorized = false

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { ...executeArgs, _confirmationToken: token },
      ),
    ).rejects.toThrow(/tests\.destroy|Access denied|Forbidden/i)

    expect(executed).toBe(false)
    expect(memory.tables.destructiveConfirmations ?? []).toHaveLength(1)
    expect(memory.tables.destructiveAuditLog ?? []).toHaveLength(0)
  })

  it('rejects stale destructive operation confirmation tokens when preview state changes', async () => {
    const builder = ((definition: unknown) => definition) as never
    const runtime = defineTrellis(
      {
        query: builder,
        mutation: builder,
      },
      {
        destructiveOperations: {
          confirmationTable: 'destructiveConfirmations' as never,
          auditTable: 'destructiveAuditLog' as never,
          previewConfirmation: {
            callerKey: () => 'caller:test',
            scopeKey: () => 'tenant:test',
          },
        },
        caller: signedInTestCaller,
        appIdentity: testAppIdentity,
      },
    )

    let state = 'draft'
    let executions = 0
    const destructiveOp = defineOperation({
      id: 'tests.destroy',
      kind: 'destructive',
      args: {
        id: v.string(),
      },
      permission: destructiveTestPermission,
      preview: async (_ctx, args) =>
        operationPreview({
          summary: `Destroy ${args.id}`,
          confirm: { operation: 'tests.destroy', id: args.id, state },
          version: { state },
        }),
      handler: async () => {
        executions += 1
        return 'destroyed'
      },
    })

    const definition = runtime.mutation.authenticated(destructiveOp) as {
      handler: (
        ctx: {
          auth: { getUserIdentity: () => Promise<null> }
          db: ReturnType<typeof createMemoryDb>['db']
          observe: (event: Record<string, unknown>) => Promise<void>
        },
        args: { id: string; _confirmationToken: string },
      ) => Promise<unknown>
    }
    const memory = createMemoryDb()
    const executeArgs = { id: 'record-1' }
    const token = await confirmationToken({
      memory,
      operationId: 'tests.destroy',
      executeArgs,
      confirm: { operation: 'tests.destroy', id: 'record-1', state: 'draft' },
      version: { state: 'draft' },
      jti: 'jti-stale-test',
    })

    state = 'published'

    await expect(
      definition.handler(
        {
          auth: { getUserIdentity: async () => null },
          db: memory.db,
          observe: async () => {},
        },
        { ...executeArgs, _confirmationToken: token },
      ),
    ).rejects.toThrow(/changed before confirmation/i)

    expect(executions).toBe(0)
    expect(memory.tables.destructiveConfirmations ?? []).toHaveLength(1)
    expect(memory.tables.destructiveAuditLog ?? []).toHaveLength(0)
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
        public: {
          readTables: ['tasks'] as never[],
        },
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
              replayMode: 'domain-idempotency',
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
        public: {
          readTables: ['tasks'] as never[],
        },
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
              replayMode: 'domain-idempotency',
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
        public: {
          readTables: ['tasks'] as never[],
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
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
        public: {
          readTables: ['tasks'] as never[],
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'domain-idempotency',
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
        public: {
          readTables: ['tasks'] as never[],
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'domain-idempotency',
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
        public: {
          readTables: ['tasks'] as never[],
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
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
        public: {
          readTables: ['tasks'] as never[],
        },
        services: {
          sync: {
            metadata: {
              source: 'verifiedWebhook',
              purpose: 'sync-test',
              allowedOperations: ['sync.test'],
              allowedFunctionRefs: ['tasks:list'],
              replayMode: 'domain-idempotency',
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
        public: {
          readTables: ['tasks', 'comments'] as never[],
        },
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
    const capture = createObservationCapture()
    const definition = runtime.query.public({
      args: {},
      identityForwardingFunctionRef: 'tasks:list',
      handler: async (ctx) => {
        const tasks = await ctx.db.query('tasks' as never).collect()
        let denied = false
        try {
          await ctx.db.query('comments' as never).collect()
        } catch (error) {
          denied = error instanceof Error && /no access to table "comments"/i.test(error.message)
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
    expect(capture.find('service.access.denied')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'service.access.denied',
          serviceId: 'sync',
          status: 'deny',
          details: expect.objectContaining({ table: 'comments' }),
        }),
      ]),
    )
    capture.stop()
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
