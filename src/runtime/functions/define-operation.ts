/* eslint-disable @typescript-eslint/no-explicit-any -- Type-level function-shape inference needs `any` for parameter contravariance. */
import type { GenericValidator, ObjectType, PropertyValidators } from 'convex/values'

import type { AuthRequiredGuard } from '../auth/define-guard.js'
import { resolvePermissionKey, type PermissionKeyHandle } from '../auth/define-permission.js'
import type { IdentityForwardingTransport } from '../identity-forwarding/envelope.js'
import type { AwaitedValue, FallbackIfUnknownOrNever } from '../types/type-utils.js'
import type {
  StructuredCrossTenantCapability,
  StructuredGuard,
  StructuredHandlerDefinition,
  StructuredLoadedValue,
  StructuredPublicWriteCapability,
} from './define-handler.js'
import {
  getOperationMetadata,
  resolveOperationExposureMetadata,
  trellisOperationMetadataKey,
  trellisOperationProjectionMetadataKey,
  type McpWriteSafety,
  type OperationExposure,
  type OperationKind,
  type OperationDescriptor,
  type TrellisOperationMetadata,
  type TrellisOperationProjectionMetadata,
} from './operation-metadata.js'
export {
  blockedOperationPreview,
  isOperationPreviewEnvelope,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewEffectValidator,
  operationPreviewIssueValidator,
  operationPreviewValidator,
} from './operation-preview.js'
export type {
  OperationPreviewEffect,
  OperationPreviewEnvelope,
  OperationPreviewIssue,
} from './operation-preview.js'

export {
  defineOperationDescriptor,
  defineOperationHandle,
  defineOperationMetadata,
  executeOperationRef,
  getOperationMetadata,
  getOperationProjectionMetadata,
  isOperationHandle,
  isOperationDescriptor,
  previewOperationRef,
  projectOperationRef,
  trellisOperationMetadataKey,
  trellisOperationProjectionMetadataKey,
} from './operation-metadata.js'
export type {
  McpWriteSafety,
  OperationDescriptor,
  OperationHandle,
  OperationHandleFunctionKind,
  OperationHandleProjection,
  OperationHandleRuntime,
  OperationMetadataDefinition,
  OperationExposure,
  OperationKind,
  OperationIdOf,
  OperationProjectionRef,
  TrellisOperationMetadata,
  TrellisOperationProjectionMetadata,
  ValidateOperationId,
  ValidateOperationProjectionRef,
} from './operation-metadata.js'

// Intentional 0.3.0 boundary support: operation definitions can carry an
// internal guard only when projected from the surviving custom protected lane.
// Descriptor/app-authored operation metadata rejects guard and uses permission.

type MaybePromise<T> = T | Promise<T>
type Callback<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult

type HandlerArgs<TArgsValidator extends PropertyValidators> = ObjectType<TArgsValidator>

type PreviewFn<TCtx, TArgsValidator extends PropertyValidators, TLoaded, TPreview> = Callback<
  [TCtx, HandlerArgs<TArgsValidator>, TLoaded],
  MaybePromise<TPreview>
>

export type OperationDefinition<
  TCtx,
  TCaller,
  TActingFor,
  TActor,
  TGuard extends StructuredGuard<TCaller, TActor>,
  TArgsValidator extends PropertyValidators,
  TLoaded,
  TResult,
  TPreview = unknown,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
> =
  StructuredHandlerDefinition<
    TCtx,
    TCaller,
    TActingFor,
    TActor,
    TGuard,
    TArgsValidator,
    TLoaded,
    TResult,
    TCrossTenant,
    TPublicWrite
  > extends infer THandlerDefinition
    ? Omit<THandlerDefinition, 'guard'> & {
        guard?: TGuard
        id?: string
        name?: string
        kind?: OperationKind
        executeFunctionRef?: string
        identityForwardingTransport?: IdentityForwardingTransport
        allowForwardingFrom?: IdentityForwardingTransport
        permission?: PermissionKeyHandle<string>
        safety?: McpWriteSafety
        exposure?: OperationExposure
        backendOnlyReason?: string
        preview?: PreviewFn<TCtx, TArgsValidator, TLoaded, TPreview>
        previewReturns?: GenericValidator
        [trellisOperationMetadataKey]?: TrellisOperationMetadata
        [trellisOperationProjectionMetadataKey]?: TrellisOperationProjectionMetadata
      }
    : never

export type OperationShape = {
  args: PropertyValidators
  guard?: StructuredGuard<any, any>
  handler: (...args: any[]) => unknown
  load?: (...args: any[]) => unknown
  preview?: (...args: any[]) => unknown
  crossTenant?: StructuredCrossTenantCapability<any, any, any>
  publicWrite?: StructuredPublicWriteCapability<any, any, any>
  returns?: GenericValidator
  previewReturns?: GenericValidator
  id?: string
  name?: string
  kind?: OperationKind
  executeFunctionRef?: string
  identityForwardingTransport?: IdentityForwardingTransport
  allowForwardingFrom?: IdentityForwardingTransport
  permission?: PermissionKeyHandle<string>
  safety?: McpWriteSafety
  exposure?: OperationExposure
  backendOnlyReason?: string
  [trellisOperationMetadataKey]?: TrellisOperationMetadata
  [trellisOperationProjectionMetadataKey]?: TrellisOperationProjectionMetadata
}

export type InferOperationCtx<TDefinition extends OperationShape> = TDefinition['handler'] extends (
  ctx: infer TCtx,
  ...args: any[]
) => unknown
  ? TCtx
  : unknown

type InferOperationPrincipal<TDefinition extends OperationShape> =
  InferOperationCtx<TDefinition> extends {
    caller: () => Promise<infer TCaller>
  }
    ? TCaller
    : unknown

type InferOperationDelegation<TDefinition extends OperationShape> =
  InferOperationCtx<TDefinition> extends {
    actingFor: () => Promise<(infer TActingFor) | null>
  }
    ? TActingFor
    : unknown

type InferActorFromCtx<TCtx> = TCtx extends {
  appIdentity: () => Promise<infer TActor>
}
  ? TActor
  : never

type InferActorFromGuard<TGuard> =
  TGuard extends StructuredGuard<unknown, infer TActor> ? TActor : never

type InferOwnOperationGuard<TDefinition extends OperationShape> = TDefinition extends {
  guard?: infer TGuard
}
  ? Exclude<TGuard, undefined> extends StructuredGuard<any, any>
    ? Exclude<TGuard, undefined>
    : never
  : never

type InferOperationGuard<TDefinition extends OperationShape> = [
  InferOwnOperationGuard<TDefinition>,
] extends [never]
  ? TDefinition extends { permission: PermissionKeyHandle<string> }
    ? AuthRequiredGuard
    : TDefinition extends { scope: unknown }
      ? AuthRequiredGuard
      : never
  : InferOwnOperationGuard<TDefinition>

type InferOperationActor<TDefinition extends OperationShape> = FallbackIfUnknownOrNever<
  InferActorFromCtx<InferOperationCtx<TDefinition>>,
  InferActorFromGuard<InferOperationGuard<TDefinition>>
>

type InferOperationArgsValidator<TDefinition extends OperationShape> = TDefinition['args']

export type InferOperationLoaded<TDefinition extends OperationShape> = TDefinition['load'] extends (
  ...args: any[]
) => infer TLoaded
  ? AwaitedValue<TLoaded>
  : TDefinition['handler'] extends (
        ctx: unknown,
        args: unknown,
        loaded: infer TLoaded,
        ...rest: any[]
      ) => unknown
    ? TLoaded
    : undefined

export type InferOperationResult<TDefinition extends OperationShape> =
  TDefinition['handler'] extends (...args: any[]) => infer TResult ? AwaitedValue<TResult> : unknown

export type InferOperationPreview<TDefinition extends OperationShape> =
  TDefinition['preview'] extends (...args: any[]) => infer TPreview
    ? AwaitedValue<TPreview>
    : unknown

type ResolvedOperationBase<TDefinition extends OperationShape> = OperationDefinition<
  InferOperationCtx<TDefinition>,
  InferOperationPrincipal<TDefinition>,
  InferOperationDelegation<TDefinition>,
  InferOperationActor<TDefinition>,
  InferOperationGuard<TDefinition>,
  InferOperationArgsValidator<TDefinition>,
  InferOperationLoaded<TDefinition>,
  InferOperationResult<TDefinition>,
  InferOperationPreview<TDefinition>
>

type ResolvedOperationGuardProperty<TDefinition extends OperationShape> = [
  InferOwnOperationGuard<TDefinition>,
] extends [never]
  ? { guard?: never }
  : { guard?: InferOwnOperationGuard<TDefinition> }

type ResolvedOperationDefinition<TDefinition extends OperationShape> = Omit<
  ResolvedOperationBase<TDefinition>,
  'guard'
> &
  ResolvedOperationGuardProperty<TDefinition>

export type ValidateOperationDefinition<TDefinition extends OperationShape> = TDefinition &
  ResolvedOperationDefinition<TDefinition>

export type DefinedOperation<TDefinition extends OperationShape = OperationShape> =
  ValidateOperationDefinition<TDefinition> & {
    [trellisOperationMetadataKey]: TrellisOperationMetadata
    [trellisOperationProjectionMetadataKey]?: TrellisOperationProjectionMetadata
  }

type ContextBoundOperationShape<TCtx> = Omit<OperationShape, 'handler' | 'load' | 'preview'> & {
  handler: (ctx: TCtx, ...args: any[]) => unknown
  load?: (ctx: TCtx, ...args: any[]) => unknown
  preview?: (ctx: TCtx, ...args: any[]) => unknown
}

type DescriptorBoundOperationShape = Omit<
  OperationShape,
  | 'id'
  | 'kind'
  | 'args'
  | 'guard'
  | 'permission'
  | 'safety'
  | 'returns'
  | 'previewReturns'
  | 'exposure'
  | 'backendOnlyReason'
> & {
  id?: string
  kind?: OperationKind
  args?: PropertyValidators
  guard?: never
  permission?: PermissionKeyHandle<string>
  safety?: McpWriteSafety
  returns?: GenericValidator
  previewReturns?: GenericValidator
  exposure?: OperationExposure
  backendOnlyReason?: string
}

type DescriptorBoundOperationDefinition<
  TDescriptor extends OperationDescriptor,
  TDefinition extends DescriptorBoundOperationShape,
> = TDefinition & {
  id: TDescriptor['id']
  kind: TDescriptor['kind']
  args: TDescriptor['args']
} & (TDescriptor extends { permission: infer TPermission } ? { permission: TPermission } : unknown)

type DefineOperationFn = {
  <const TDefinition extends OperationShape>(
    definition: ValidateOperationDefinition<TDefinition>,
  ): DefinedOperation<TDefinition>
  withContext: <TCtx>() => <const TDefinition extends ContextBoundOperationShape<TCtx>>(
    definition: ValidateOperationDefinition<TDefinition>,
  ) => DefinedOperation<TDefinition>
}

/**
 * Define a reusable protected business operation.
 *
 * Use this when one business action should own its guard/load/authorize/handler
 * logic in one place and potentially be reused across multiple registration
 * points or transports.
 */
function defineOperationImpl<const TDefinition extends OperationShape>(
  definition: ValidateOperationDefinition<TDefinition>,
): DefinedOperation<TDefinition> {
  const kind = definition.kind ?? 'safe'
  const exposure = resolveOperationExposureMetadata({
    kind,
    exposure: definition.exposure,
    backendOnlyReason: definition.backendOnlyReason,
  })
  const permissionKey =
    definition.permission === undefined ? undefined : resolvePermissionKey(definition.permission)
  const metadata = {
    id: definition.id,
    name: definition.name,
    kind,
    ...exposure,
    ...(permissionKey ? { permissionKey } : {}),
    ...(definition.safety ? { safety: definition.safety } : {}),
    ...(definition.allowForwardingFrom
      ? { allowForwardingFrom: definition.allowForwardingFrom }
      : {}),
  } satisfies TrellisOperationMetadata

  if (metadata.kind === 'destructive' && !metadata.id) {
    throw new Error('defineOperation(...) requires `id` for destructive operations.')
  }

  return Object.assign(definition, {
    ...(definition.allowForwardingFrom
      ? { identityForwardingTransport: definition.allowForwardingFrom }
      : {}),
    [trellisOperationMetadataKey]: metadata,
    ...(metadata.id
      ? {
          [trellisOperationProjectionMetadataKey]: {
            operationId: metadata.id,
            projection: 'execute' as const,
          },
        }
      : {}),
  }) as DefinedOperation<TDefinition>
}

export const defineOperation = Object.assign(defineOperationImpl, {
  withContext:
    <TCtx>() =>
    <const TDefinition extends ContextBoundOperationShape<TCtx>>(
      definition: ValidateOperationDefinition<TDefinition>,
    ) =>
      defineOperationImpl(definition),
}) as DefineOperationFn

function assertDescriptorValue(
  descriptor: OperationDescriptor,
  label: string,
  descriptorValue: unknown,
  implementationValue: unknown,
): void {
  if (implementationValue === undefined || implementationValue === descriptorValue) return
  throw new Error(
    `implementOperation(${descriptor.id}) received ${label} that does not match the operation descriptor.`,
  )
}

function assertDescriptorPermission(
  descriptor: OperationDescriptor,
  definition: { permission?: PermissionKeyHandle<string> },
): void {
  if (!definition.permission || !descriptor.permissionKey) return
  const definitionKey = resolvePermissionKey(definition.permission)
  if (definitionKey === descriptor.permissionKey) return
  throw new Error(
    `implementOperation(...) received permission "${definitionKey}" but descriptor "${descriptor.id}" uses "${descriptor.permissionKey}".`,
  )
}

function assertDescriptorGuard(definition: { guard?: unknown }): void {
  if (definition.guard === undefined) return
  throw new Error('implementOperation(...) does not accept protected-lane guard metadata.')
}

/**
 * Bind a shared operation descriptor to its Convex implementation.
 *
 * The descriptor owns cross-surface metadata. The implementation owns backend
 * behavior. This helper keeps the two from silently drifting while Phase 0
 * proves operation-first MCP.
 */
export function implementOperation<
  const TDescriptor extends OperationDescriptor,
  const TDefinition extends DescriptorBoundOperationShape,
>(
  descriptor: TDescriptor,
  definition: TDefinition,
): DefinedOperation<DescriptorBoundOperationDefinition<TDescriptor, TDefinition>> {
  assertDescriptorValue(descriptor, 'id', descriptor.id, definition.id)
  assertDescriptorValue(descriptor, 'name', descriptor.name, definition.name)
  assertDescriptorValue(descriptor, 'kind', descriptor.kind, definition.kind)
  assertDescriptorValue(descriptor, 'args', descriptor.args, definition.args)
  assertDescriptorValue(descriptor, 'returns', descriptor.returns, definition.returns)
  assertDescriptorValue(
    descriptor,
    'previewReturns',
    descriptor.previewReturns,
    definition.previewReturns,
  )
  assertDescriptorValue(descriptor, 'safety', descriptor.safety, definition.safety)
  assertDescriptorValue(descriptor, 'exposure', descriptor.exposure, definition.exposure)
  assertDescriptorValue(
    descriptor,
    'backendOnlyReason',
    descriptor.backendOnlyReason,
    definition.backendOnlyReason,
  )
  assertDescriptorGuard(definition)
  assertDescriptorPermission(descriptor, definition)

  if (descriptor.kind === 'destructive' && !definition.preview) {
    throw new Error(
      `implementOperation(${descriptor.id}) requires a preview handler for destructive operations.`,
    )
  }

  return defineOperationImpl({
    ...definition,
    id: descriptor.id,
    name: definition.name ?? descriptor.name,
    kind: descriptor.kind,
    args: descriptor.args,
    ...(descriptor.permission !== undefined
      ? { permission: definition.permission ?? descriptor.permission }
      : {}),
    ...(descriptor.safety !== undefined ? { safety: definition.safety ?? descriptor.safety } : {}),
    ...(descriptor.exposure !== undefined
      ? { exposure: definition.exposure ?? descriptor.exposure }
      : {}),
    ...(descriptor.backendOnlyReason !== undefined
      ? { backendOnlyReason: definition.backendOnlyReason ?? descriptor.backendOnlyReason }
      : {}),
    ...(descriptor.allowForwardingFrom !== undefined
      ? { allowForwardingFrom: definition.allowForwardingFrom ?? descriptor.allowForwardingFrom }
      : {}),
    ...(descriptor.returns !== undefined ? { returns: descriptor.returns } : {}),
    ...(descriptor.previewReturns !== undefined
      ? { previewReturns: descriptor.previewReturns }
      : {}),
  } as ValidateOperationDefinition<DescriptorBoundOperationDefinition<TDescriptor, TDefinition>>)
}

/**
 * Expose the preview phase of an operation as a standalone structured handler.
 *
 * Use this for confirmation flows where a destructive mutation should be
 * preceded by a read-only preview step.
 */
export function previewOf<
  const TDefinition extends {
    args: PropertyValidators
    preview: (...args: any[]) => unknown
    handler: (...args: any[]) => unknown
    guard?: undefined
    permission?: PermissionKeyHandle<string>
    previewReturns?: GenericValidator
    returns?: GenericValidator
    load?: (...args: any[]) => unknown
    authorize?: unknown
    executeFunctionRef?: string
    identityForwardingTransport?: IdentityForwardingTransport
    allowForwardingFrom?: IdentityForwardingTransport
    [trellisOperationMetadataKey]?: TrellisOperationMetadata
    [trellisOperationProjectionMetadataKey]?: TrellisOperationProjectionMetadata
  },
>(
  operation: TDefinition,
): Omit<
  StructuredHandlerDefinition<
    any,
    any,
    any,
    any,
    StructuredGuard<any, any>,
    TDefinition['args'],
    StructuredLoadedValue,
    AwaitedValue<ReturnType<TDefinition['preview']>>
  >,
  'guard'
> & {
  id: string
  guard?: never
  permission?: TDefinition['permission']
  identityForwardingTransport?: IdentityForwardingTransport
  allowForwardingFrom?: IdentityForwardingTransport
  [trellisOperationMetadataKey]: TrellisOperationMetadata
  [trellisOperationProjectionMetadataKey]: TrellisOperationProjectionMetadata
}
export function previewOf<
  TCtx,
  TCaller,
  TActingFor,
  TActor,
  TGuard extends StructuredGuard<TCaller, TActor>,
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TResult = unknown,
  TPreview = unknown,
>(
  operation: OperationDefinition<
    TCtx,
    TCaller,
    TActingFor,
    TActor,
    TGuard,
    TArgsValidator,
    TLoaded,
    TResult,
    TPreview
  > & { permission?: PermissionKeyHandle<string> },
): StructuredHandlerDefinition<
  TCtx,
  TCaller,
  TActingFor,
  TActor,
  TGuard,
  TArgsValidator,
  TLoaded,
  TPreview
> & {
  id: string
  permission?: PermissionKeyHandle<string>
  identityForwardingTransport?: IdentityForwardingTransport
  allowForwardingFrom?: IdentityForwardingTransport
  [trellisOperationMetadataKey]: TrellisOperationMetadata
  [trellisOperationProjectionMetadataKey]: TrellisOperationProjectionMetadata
}
export function previewOf(operation: any): any {
  if (!operation.preview) {
    throw new Error('previewOf() requires an operation with a preview handler.')
  }

  const metadata = getOperationMetadata(operation)

  return {
    ...(metadata.id ? { id: `${metadata.id}:preview` } : {}),
    args: operation.args,
    returns: operation.previewReturns,
    ...(operation.guard !== undefined ? { guard: operation.guard } : {}),
    ...(operation.permission !== undefined ? { permission: operation.permission } : {}),
    ...(operation.identityForwardingTransport !== undefined
      ? { identityForwardingTransport: operation.identityForwardingTransport }
      : {}),
    ...(operation.allowForwardingFrom !== undefined
      ? {
          allowForwardingFrom: operation.allowForwardingFrom,
          identityForwardingTransport: operation.allowForwardingFrom,
        }
      : {}),
    load: operation.load,
    authorize: operation.authorize,
    handler: async (ctx, args, loaded) => await operation.preview!(ctx, args, loaded),
    [trellisOperationMetadataKey]: metadata,
    ...(metadata.id
      ? {
          [trellisOperationProjectionMetadataKey]: {
            operationId: metadata.id,
            projection: 'preview' as const,
            ...(operation.executeFunctionRef
              ? { executeFunctionRef: operation.executeFunctionRef }
              : {}),
          },
        }
      : {}),
  } as StructuredHandlerDefinition<
    any,
    any,
    any,
    any,
    StructuredGuard<any, any>,
    PropertyValidators,
    StructuredLoadedValue,
    unknown
  > & { permission?: PermissionKeyHandle<string> }
}
