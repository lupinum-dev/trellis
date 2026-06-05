const internalUnsafeDbByDecoratedDb = new WeakMap<object, object>()

export function getInternalUnsafeDb<TDb extends object>(db: TDb): TDb | undefined {
  return internalUnsafeDbByDecoratedDb.get(db) as TDb | undefined
}

export function decorateDb<TDb extends object>(db: TDb, unsafeDb: TDb): TDb {
  const decoratedDb = new Proxy(db, {}) as TDb

  internalUnsafeDbByDecoratedDb.set(decoratedDb, unsafeDb)
  return decoratedDb
}
