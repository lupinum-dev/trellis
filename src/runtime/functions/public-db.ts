import type { GenericDataModel, TableNamesInDataModel } from 'convex/server'

export type PublicAccessOptions = {
  readTables?: string[]
}

export function getTableFromId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const separator = value.lastIndexOf(';')
  if (separator !== -1) return value.slice(separator + 1)

  const convexTestId = value.match(/^\d+([a-z_]\w*)$/i)
  return convexTestId?.[1] ?? null
}

function createPublicDbError(table?: string): Error {
  return new Error(
    table
      ? `Public handlers cannot access table "${table}". Add an explicit public.readTables entry or move this handler behind authentication.`
      : 'Public handlers cannot write through ctx.db. Use an operation-backed public write contract.',
  )
}

function assertPublicReadTableAccess(tables: ReadonlySet<string>, table: string): void {
  if (!tables.has(table)) throw createPublicDbError(table)
}

export function createPublicSafeDb<TDb extends object, DataModel extends GenericDataModel>(
  db: TDb,
  options: PublicAccessOptions | undefined,
): TDb {
  const readTables = new Set<string>((options?.readTables ?? []).map(String))

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'query') {
          return (table: TableNamesInDataModel<DataModel>) => {
            assertPublicReadTableAccess(readTables, String(table))
            return (db as { query: (table: TableNamesInDataModel<DataModel>) => unknown }).query(
              table,
            )
          }
        }

        if (prop === 'get') {
          return (id: unknown, ...args: unknown[]) => {
            const table = getTableFromId(id)
            if (!table) {
              throw new Error(`Could not determine table from Convex id "${String(id)}".`)
            }
            assertPublicReadTableAccess(readTables, table)
            return (db as { get: (id: unknown, ...args: unknown[]) => unknown }).get(id, ...args)
          }
        }

        if (prop === 'normalizeId') {
          return (table: TableNamesInDataModel<DataModel>, id: unknown) => {
            assertPublicReadTableAccess(readTables, String(table))
            return (
              db as {
                normalizeId?: (table: TableNamesInDataModel<DataModel>, id: unknown) => unknown
              }
            ).normalizeId?.(table, id)
          }
        }

        if (prop === 'insert' || prop === 'patch' || prop === 'replace' || prop === 'delete') {
          return () => {
            throw createPublicDbError()
          }
        }

        return undefined
      },
      has(_target, prop) {
        return (
          prop === 'query' ||
          prop === 'get' ||
          prop === 'normalizeId' ||
          prop === 'insert' ||
          prop === 'patch' ||
          prop === 'replace' ||
          prop === 'delete'
        )
      },
    },
  ) as TDb
}
