import { authRequired } from '../auth/define-guard.js'
import { isOpenGuard, isPermissionDefinition, open } from '../auth/index.js'

export const trellisBackendLaneMetadataKey = Symbol.for('trellis.backendLane')

export type TrellisBackendLane = 'public' | 'authenticated' | 'workspace' | 'protected' | 'unsafe'

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

    return stampBackendLane(
      protectedBuilder(
        cloneDefinitionWithExtras(definition as object, {
          guard: open,
          trellisBackendLane: 'public',
        }) as never,
      ),
      'public',
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
  authenticated: (definition: never) => unknown
  workspace: (definition: never) => unknown
  protected: TProtectedBuilder
  unsafe?: TUnsafeBuilder
} {
  const lanes: {
    public: (definition: never) => unknown
    authenticated: (definition: never) => unknown
    workspace: (definition: never) => unknown
    protected: TProtectedBuilder
    unsafe?: TUnsafeBuilder
  } = {
    public: createPublicLaneBuilder(protectedBuilder),
    authenticated: createAuthenticatedLaneBuilder(protectedBuilder),
    workspace: createWorkspaceLaneBuilder(protectedBuilder),
    protected: createProtectedLaneBuilder(protectedBuilder),
  }
  if (unsafeBuilder) {
    lanes.unsafe = createUnsafeLaneBuilder(unsafeBuilder as never) as TUnsafeBuilder
  }
  return lanes
}
