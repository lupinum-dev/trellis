import type { GenericValidator } from 'convex/values'

import type { PermissionKeyHandle } from '../auth/define-permission.js'
import type { OperationShape } from '../functions/define-operation.js'
import {
  blockedOperationPreview,
  defineTrellis,
  defineOperation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  previewOf,
} from '../functions/index.js'
import type {
  McpWriteSafety,
  OperationPreviewEffect,
  OperationPreviewEnvelope,
  OperationPreviewIssue,
  TrellisOperationMetadata,
  trellisOperationMetadataKey,
} from '../functions/index.js'

type AwaitedValue<T> = T extends PromiseLike<infer U> ? AwaitedValue<U> : T
export const trellisWorkspaceScopeKey = Symbol.for('trellis.workspace-scope')

export type WorkspaceScopeDefinition<TField extends string = 'workspaceId'> = {
  readonly _type: 'workspace-scope'
  readonly field: TField
  readonly required: true
  readonly [trellisWorkspaceScopeKey]: true
}

export function workspaceScope(): WorkspaceScopeDefinition {
  return {
    _type: 'workspace-scope',
    field: 'workspaceId',
    required: true,
    [trellisWorkspaceScopeKey]: true,
  }
}

type WorkspaceScopedContext<TCtx> = Omit<TCtx, 'workspaceId'> & { workspaceId: string }

type AppOperationShape = Omit<OperationShape, 'guard'> & {
  guard?: never
  executeFunctionRef?: string
}

type WorkspaceScopedOperationDefinition = AppOperationShape & {
  scope?: WorkspaceScopeDefinition
}

export type InferOperationLoaded<TDefinition> = TDefinition extends {
  load: (...args: infer _LoadArgs) => infer TLoaded
}
  ? AwaitedValue<TLoaded>
  : TDefinition extends {
        handler: (
          ctx: infer _TCtx,
          args: infer _TArgs,
          loaded: infer TLoaded,
          ...rest: infer _TRest
        ) => unknown
      }
    ? TLoaded
    : undefined

export type InferOperationResult<TDefinition> = TDefinition extends {
  handler: (...args: infer _TArgs) => infer TResult
}
  ? AwaitedValue<TResult>
  : unknown

export type InferOperationPreview<TDefinition> = TDefinition extends {
  preview: (...args: infer _TArgs) => infer TPreview
}
  ? AwaitedValue<TPreview>
  : unknown

type ProjectRuntimeCallback<TCallback> = TCallback extends (
  ctx: infer _TCtx,
  ...args: infer TArgs
) => infer TResult
  ? (ctx: unknown, ...args: TArgs) => TResult
  : TCallback

type ProjectedRuntimeOperation<TDefinition> = TDefinition extends {
  scope: WorkspaceScopeDefinition
}
  ? Omit<TDefinition, 'guard' | 'handler' | 'load' | 'preview'> & {
      guard?: never
      handler: ProjectRuntimeCallback<
        TDefinition extends { handler: infer THandler } ? THandler : never
      >
    } & (TDefinition extends { load: infer TLoad }
        ? { load: ProjectRuntimeCallback<TLoad> }
        : unknown) &
      (TDefinition extends { preview: infer TPreview }
        ? { preview: ProjectRuntimeCallback<TPreview> }
        : unknown)
  : Omit<TDefinition, 'guard'> & { guard?: never }

function getWorkspaceId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('workspaceId' in value)) return null

  const workspaceId = (value as { workspaceId?: unknown }).workspaceId
  return typeof workspaceId === 'string' && workspaceId.trim().length > 0 ? workspaceId : null
}

async function resolveWorkspaceId(ctx: unknown): Promise<string> {
  if (typeof ctx !== 'object' || ctx === null || !('appIdentity' in ctx)) {
    throw new Error('workspaceScope(...) requires ctx.appIdentity() to resolve workspaceId.')
  }

  const appIdentity = (ctx as { appIdentity?: unknown }).appIdentity
  if (typeof appIdentity !== 'function') {
    throw new TypeError('workspaceScope(...) requires ctx.appIdentity() to resolve workspaceId.')
  }

  const workspaceId = getWorkspaceId(await appIdentity())
  if (!workspaceId) {
    throw new Error('workspaceScope(...) requires ctx.appIdentity() to resolve workspaceId.')
  }

  return workspaceId
}

async function withWorkspaceScope<TCtx>(ctx: TCtx): Promise<WorkspaceScopedContext<TCtx>> {
  const workspaceId = await resolveWorkspaceId(ctx)
  const existingWorkspaceId = getWorkspaceId(ctx)

  if (existingWorkspaceId !== null && existingWorkspaceId !== workspaceId) {
    throw new Error('workspaceScope(...) received conflicting ctx.workspaceId values.')
  }

  return {
    ...(ctx as object),
    workspaceId,
  } as WorkspaceScopedContext<TCtx>
}

function applyWorkspaceScope<const TDefinition extends WorkspaceScopedOperationDefinition>(
  definition: TDefinition,
): TDefinition {
  if (!definition.scope) return definition

  const load = definition.load
  const preview = definition.preview
  const handler = definition.handler

  return {
    ...definition,
    ...(load
      ? {
          load: async (ctx: unknown, args: unknown) =>
            await load(await withWorkspaceScope(ctx), args),
        }
      : {}),
    ...(preview
      ? {
          preview: async (ctx: unknown, args: unknown, loaded: unknown) =>
            await preview(await withWorkspaceScope(ctx), args, loaded),
        }
      : {}),
    handler: async (ctx: unknown, args: unknown, loaded: unknown) =>
      await handler(await withWorkspaceScope(ctx), args, loaded),
  } as TDefinition
}

type BaseAppOperationDefinition<TDefinition extends AppOperationShape> = Omit<
  TDefinition,
  'kind' | 'safety'
> & {
  returns?: GenericValidator
  permission?: PermissionKeyHandle<string>
  scope?: WorkspaceScopeDefinition
}

export type QueryOperationDefinition<TDefinition extends AppOperationShape = AppOperationShape> =
  BaseAppOperationDefinition<TDefinition> & {
    kind?: never
    safety?: 'read'
  }

export type MutationOperationDefinition<TDefinition extends AppOperationShape = AppOperationShape> =
  BaseAppOperationDefinition<TDefinition> & {
    kind?: never
    safety?: Exclude<McpWriteSafety, 'destructive-write'>
  }

export type PublicMutationOperationDefinition<
  TDefinition extends AppOperationShape = AppOperationShape,
> = BaseAppOperationDefinition<TDefinition> & {
  id: string
  publicWrite: NonNullable<TDefinition['publicWrite']>
  kind?: never
  safety?: Exclude<McpWriteSafety, 'destructive-write'>
}

export type DestructiveOperationDefinition<
  TDefinition extends AppOperationShape = AppOperationShape,
> = Omit<BaseAppOperationDefinition<TDefinition>, 'id'> & {
  id: string
  kind?: never
  safety: McpWriteSafety
  preview: NonNullable<TDefinition['preview']>
  previewReturns?: GenericValidator
}

type AppOperationResult<
  TDefinition,
  TKind extends TrellisOperationMetadata['kind'],
> = ProjectedRuntimeOperation<TDefinition> & {
  kind: TKind
  readonly [trellisOperationMetadataKey]?: TrellisOperationMetadata
}

function defineQueryOperation<const TDefinition extends QueryOperationDefinition>(
  definition: TDefinition,
): AppOperationResult<TDefinition, 'safe'> {
  return defineOperation({
    ...applyWorkspaceScope(definition),
    kind: 'safe',
  } as never) as AppOperationResult<TDefinition, 'safe'>
}

function defineMutationOperation<const TDefinition extends MutationOperationDefinition>(
  definition: TDefinition,
): AppOperationResult<TDefinition, 'safe'> {
  return defineOperation({
    ...applyWorkspaceScope(definition),
    kind: 'safe',
  } as never) as AppOperationResult<TDefinition, 'safe'>
}

function definePublicMutationOperation<const TDefinition extends PublicMutationOperationDefinition>(
  definition: TDefinition,
): AppOperationResult<TDefinition, 'safe'> {
  return defineOperation({
    ...applyWorkspaceScope(definition),
    kind: 'safe',
  } as never) as AppOperationResult<TDefinition, 'safe'>
}

function defineDestructiveOperation<const TDefinition extends DestructiveOperationDefinition>(
  definition: TDefinition,
): AppOperationResult<TDefinition, 'destructive'> {
  return defineOperation({
    ...applyWorkspaceScope(definition),
    kind: 'destructive',
  } as never) as AppOperationResult<TDefinition, 'destructive'>
}

export const operation = {
  query: defineQueryOperation,
  mutation: defineMutationOperation,
  publicMutation: definePublicMutationOperation,
  destructive: defineDestructiveOperation,
}

export { defineTrellis }

export {
  blockedOperationPreview,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  previewOf,
}
export type {
  McpWriteSafety,
  OperationPreviewEffect,
  OperationPreviewEnvelope,
  OperationPreviewIssue,
}
