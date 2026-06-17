import { defineGuard, definePermission } from '../../../src/runtime/auth'
import { defineCaller } from '../../../src/runtime/backend'
import {
  createConfirmationToken,
  hashConfirmationValue,
  hashConfirmationToken,
} from '../../../src/runtime/functions/confirmation-token'

type MemoryRow = Record<string, unknown>

export function createMemoryDb() {
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
      patch: async (arg0: string, arg1: string | MemoryRow, arg2?: MemoryRow) => {
        const id = arg2 === undefined ? arg0 : (arg1 as string)
        const value = arg2 ?? (arg1 as MemoryRow)
        const match = findRow(id)
        if (match) {
          for (const [key, nextValue] of Object.entries(value)) {
            if (nextValue === undefined) {
              Reflect.deleteProperty(match.row, key)
            } else {
              match.row[key] = nextValue
            }
          }
          return null
        }
        throw new Error(`Missing row "${id}"`)
      },
      replace: async (arg0: string, arg1: string | MemoryRow, arg2?: MemoryRow) => {
        const id = arg2 === undefined ? arg0 : (arg1 as string)
        const value = arg2 ?? (arg1 as MemoryRow)
        const match = findRow(id)
        if (match) {
          match.rows[match.rows.indexOf(match.row)] = { _id: id, ...value }
          return null
        }
        throw new Error(`Missing row "${id}"`)
      },
      delete: async (arg0: string, arg1?: string) => {
        const id = arg1 ?? arg0
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

export async function confirmationToken(args: {
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

export const allowAll = defineGuard('test.allowAll', true)
export const testAppIdentity = async () => ({ kind: 'test' as const })
export const signedInTestCaller = defineCaller({
  resolve: async () => ({
    kind: 'user' as const,
    subject: 'auth:test-user' as const,
    authKey: 'test-user',
  }),
})
export const destructiveTestPermission = definePermission({
  key: 'tests.destroy',
  check: true,
})
