import { authRequired } from '../auth/define-guard.js'
import { isOpenGuard, isPermissionDefinition, open } from '../auth/index.js'

export const trellisBackendLaneMetadataKey = Symbol.for('trellis.backendLane')

export type TrellisBackendLane =
  | 'public'
  | 'session'
  | 'authenticated'
  | 'workspace'
  | 'protected'
  | 'unsafe'

export function stampBackendLane<TResult>(value: TResult, lane: TrellisBackendLane): TResult {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return value
  }

  Object.defineProperty(value, trellisBackendLaneMetadataKey, {
    value: lane,
    enumerable: false,
    configurable: false,
    writable: false,
  })
  return value
}

function cloneDefinitionWithExtras(
  definition: object,
  extras: Record<string | symbol, unknown>,
): object {
  const clone = {}
  Object.defineProperties(clone, Object.getOwnPropertyDescriptors(definition))
  return Object.assign(clone, extras)
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function getOwnGuard(definition: object): unknown {
  return hasOwn(definition, 'guard') ? (definition as { guard?: unknown }).guard : undefined
}

function getOwnReads(definition: object): unknown {
  return hasOwn(definition, 'reads') ? (definition as { reads?: unknown }).reads : undefined
}

function readPublicReadTables(value: unknown, lane: 'public'): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw new TypeError(`${lane} backend handlers must provide \`reads\` as an array.`)
  }

  const seen = new Set<string>()
  const tables: string[] = []
  for (const table of value) {
    if (typeof table !== 'string' || table.trim().length === 0) {
      throw new Error(`${lane} backend handler \`reads\` must contain non-empty table names.`)
    }
    if (seen.has(table)) {
      throw new Error(`${lane} backend handler \`reads\` contains a duplicate table: "${table}".`)
    }
    seen.add(table)
    tables.push(table)
  }
  return tables
}

function getOwnPermission(definition: object): unknown {
  return hasOwn(definition, 'permission')
    ? (definition as { permission?: unknown }).permission
    : undefined
}

function assertSignedInLaneGuard(definition: unknown, lane: 'authenticated' | 'workspace'): void {
  if (!definition || typeof definition !== 'object') return

  const guard = getOwnGuard(definition)
  if (guard === undefined) return

  throw new Error(
    `${lane} backend handlers must not provide \`guard\`; use protected(...) for custom guard predicates.`,
  )
}

function resolveWorkspaceLaneGuard(definition: object): unknown {
  const permission = getOwnPermission(definition)
  if (permission === undefined) {
    throw new Error(
      'workspace backend handlers require `permission` with a definePermission(...) object so the lane can enforce workspace authority.',
    )
  }
  if (isPermissionDefinition(permission)) return permission

  throw new Error(
    'workspace backend handlers with `permission` must provide a definePermission(...) object so the lane can enforce it.',
  )
}

function createPublicLaneBuilder<TBuilder extends (definition: never) => unknown>(
  protectedBuilder: TBuilder,
): TBuilder {
  return ((definition: unknown) => {
    if (
      definition &&
      typeof definition === 'object' &&
      Object.prototype.hasOwnProperty.call(definition, 'guard')
    ) {
      throw new Error(
        'public backend handlers must not provide `guard`; use protected(...) instead.',
      )
    }
    if (!definition || typeof definition !== 'object') {
      throw new Error('public backend handlers require a definition object.')
    }
    const reads = readPublicReadTables(getOwnReads(definition), 'public')

    return stampBackendLane(
      protectedBuilder(
        cloneDefinitionWithExtras(definition as object, {
          guard: open,
          trellisBackendLane: 'public',
          ...(reads ? { publicReadTables: reads } : {}),
        }) as never,
      ),
      'public',
    )
  }) as unknown as TBuilder
}

function createSessionLaneBuilder<TBuilder extends (definition: never) => unknown>(
  protectedBuilder: TBuilder,
): TBuilder {
  return ((definition: unknown) => {
    if (
      definition &&
      typeof definition === 'object' &&
      Object.prototype.hasOwnProperty.call(definition, 'guard')
    ) {
      throw new Error(
        'session backend handlers must not provide `guard`; use protected(...) instead.',
      )
    }
    if (
      definition &&
      typeof definition === 'object' &&
      Object.prototype.hasOwnProperty.call(definition, 'reads')
    ) {
      throw new Error('session backend handlers must not provide `reads`; use public(...) instead.')
    }
    if (!definition || typeof definition !== 'object') {
      throw new Error('session backend handlers require a definition object.')
    }

    return stampBackendLane(
      protectedBuilder(
        cloneDefinitionWithExtras(definition as object, {
          guard: open,
          trellisBackendLane: 'session',
        }) as never,
      ),
      'session',
    )
  }) as unknown as TBuilder
}

function createProtectedLaneBuilder<TBuilder extends (definition: never) => unknown>(
  protectedBuilder: TBuilder,
): TBuilder {
  return ((definition: unknown) => {
    if (
      !definition ||
      typeof definition !== 'object' ||
      !Object.prototype.hasOwnProperty.call(definition, 'guard')
    ) {
      throw new Error(
        'protected backend handlers require `guard`; use public(...) for unauthenticated access.',
      )
    }
    if (isOpenGuard(getOwnGuard(definition))) {
      throw new Error('protected backend handlers must not use `guard: open`; use public(...).')
    }

    return stampBackendLane(
      protectedBuilder(
        cloneDefinitionWithExtras(definition, {
          trellisBackendLane: 'protected',
        }) as never,
      ),
      'protected',
    )
  }) as unknown as TBuilder
}

export function createAuthenticatedLaneBuilder<TBuilder extends (definition: never) => unknown>(
  protectedBuilder: TBuilder,
): TBuilder {
  return ((definition: unknown) => {
    assertSignedInLaneGuard(definition, 'authenticated')

    return stampBackendLane(
      protectedBuilder(
        cloneDefinitionWithExtras(definition as object, {
          guard: authRequired,
          trellisBackendLane: 'authenticated',
        }) as never,
      ),
      'authenticated',
    )
  }) as unknown as TBuilder
}

function createWorkspaceLaneBuilder<TBuilder extends (definition: never) => unknown>(
  protectedBuilder: TBuilder,
): TBuilder {
  return ((definition: unknown) => {
    assertSignedInLaneGuard(definition, 'workspace')

    return stampBackendLane(
      protectedBuilder(
        cloneDefinitionWithExtras(definition as object, {
          guard: resolveWorkspaceLaneGuard(definition as object),
          trellisBackendLane: 'workspace',
        }) as never,
      ),
      'workspace',
    )
  }) as unknown as TBuilder
}

function createUnsafeLaneBuilder<TBuilder extends (definition: never) => unknown>(
  unsafeBuilder: TBuilder,
): TBuilder {
  return ((definition: never) => stampBackendLane(unsafeBuilder(definition), 'unsafe')) as TBuilder
}

export function attachBackendQueryLanes<
  TProtectedBuilder extends (definition: never) => unknown,
  TUnsafeBuilder extends ((definition: never) => unknown) | undefined,
>(
  protectedBuilder: TProtectedBuilder,
  unsafeBuilder?: TUnsafeBuilder,
): {
  public: (definition: never) => unknown
  session: (definition: never) => unknown
  authenticated: (definition: never) => unknown
  workspace: (definition: never) => unknown
  protected: TProtectedBuilder
  unsafe?: TUnsafeBuilder
} {
  const lanes: {
    public: (definition: never) => unknown
    session: (definition: never) => unknown
    authenticated: (definition: never) => unknown
    workspace: (definition: never) => unknown
    protected: TProtectedBuilder
    unsafe?: TUnsafeBuilder
  } = {
    public: createPublicLaneBuilder(protectedBuilder),
    session: createSessionLaneBuilder(protectedBuilder),
    authenticated: createAuthenticatedLaneBuilder(protectedBuilder),
    workspace: createWorkspaceLaneBuilder(protectedBuilder),
    protected: createProtectedLaneBuilder(protectedBuilder),
  }
  if (unsafeBuilder) {
    lanes.unsafe = createUnsafeLaneBuilder(unsafeBuilder as never) as TUnsafeBuilder
  }
  return lanes
}
