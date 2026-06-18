import type { H3Event } from 'h3'

import {
  serverConvexAction,
  serverConvexMutation,
  serverConvexQuery,
  type ServerConvexOptions,
} from '../convex/server/convex.js'
import type {
  AnyActionFunction,
  AnyConvexFunction,
  AnyMutationFunction,
  AnyQueryFunction,
  FunctionLikeArgs,
  FunctionLikeReturnType,
} from '../convex/shared/convex-shared.js'
import {
  isOperationHandle,
  type OperationHandle,
  type OperationHandleFunctionKind,
} from '../functions/operation-metadata.js'
import type { OperationPreviewConfirmation } from '../functions/operation-preview.js'

type UnknownArgs = Record<string, unknown>

type OperationExecuteRef<TOperation extends OperationHandle> = TOperation extends {
  readonly executeRef: infer TExecuteRef
}
  ? TExecuteRef
  : never

type OperationPreviewRef<TOperation extends OperationHandle> = TOperation extends {
  readonly previewRef?: infer TPreviewRef
}
  ? TPreviewRef
  : undefined

type ArgsOf<TRef> = TRef extends AnyConvexFunction ? FunctionLikeArgs<TRef> : UnknownArgs
type ResultOf<TRef> = TRef extends AnyConvexFunction ? FunctionLikeReturnType<TRef> : unknown

type OperationArgs<TOperation extends OperationHandle> = ArgsOf<OperationExecuteRef<TOperation>>
type OperationResult<TOperation extends OperationHandle> = ResultOf<OperationExecuteRef<TOperation>>
type OperationPreviewResult<TOperation extends OperationHandle> =
  OperationPreviewRef<TOperation> extends undefined
    ? unknown
    : ResultOf<OperationPreviewRef<TOperation>>

export type ServerOperationConfirmation = OperationPreviewConfirmation | string | null | undefined

export type ServerOperationCallOptions = ServerConvexOptions

export interface ServerOperationExecuteOptions extends ServerConvexOptions {
  confirmation?: ServerOperationConfirmation
}

export interface ServerOperationAdapter<
  TArgs = UnknownArgs,
  TResult = unknown,
  TPreview = unknown,
> {
  query: (args: TArgs, options?: ServerOperationCallOptions) => Promise<TResult>
  execute: (args: TArgs, options?: ServerOperationExecuteOptions) => Promise<TResult>
  preview: (args: TArgs, options?: ServerOperationCallOptions) => Promise<TPreview>
}

function assertServerOperationHandle(operation: OperationHandle): void {
  if (!isOperationHandle(operation)) {
    throw new Error('serverOperation(...) requires a generated operation handle.')
  }
  if (!operation.runtimes.includes('server')) {
    throw new Error(
      `serverOperation(${operation.id}) requires a handle generated for the server runtime.`,
    )
  }
}

function requireProjectionKind(
  operation: OperationHandle,
  projection: 'execute' | 'preview',
  kind: OperationHandleFunctionKind | undefined,
): OperationHandleFunctionKind {
  if (kind) return kind
  throw new Error(
    `serverOperation(${operation.id}).${projection} requires generated ${projection} operation kind metadata.`,
  )
}

function confirmationToken(value: ServerOperationConfirmation): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value.token === 'string') return value.token
  return undefined
}

function withConfirmation<TArgs>(
  args: TArgs,
  options?: ServerOperationExecuteOptions,
): TArgs | (TArgs & { _confirmationToken: string }) {
  const token = confirmationToken(options?.confirmation)
  if (!token) return args
  return { ...(args as object), _confirmationToken: token } as TArgs & {
    _confirmationToken: string
  }
}

function toServerConvexOptions(
  options?: ServerOperationExecuteOptions,
): ServerConvexOptions | undefined {
  if (!options) return undefined
  const { confirmation: _confirmation, ...serverOptions } = options
  return serverOptions
}

async function callPreview<TRef extends AnyConvexFunction>(
  event: H3Event,
  ref: TRef,
  kind: OperationHandleFunctionKind,
  args: FunctionLikeArgs<TRef>,
  options?: ServerOperationCallOptions,
): Promise<FunctionLikeReturnType<TRef>> {
  if (kind === 'query') {
    return await serverConvexQuery(event, ref as AnyQueryFunction, args as never, options)
  }
  if (kind === 'mutation') {
    return await serverConvexMutation(event, ref as AnyMutationFunction, args as never, options)
  }
  return await serverConvexAction(event, ref as AnyActionFunction, args as never, options)
}

/**
 * Explicit server-route adapter for generated Trellis operation handles.
 *
 * Server routes still own HTTP concerns such as request parsing, webhook/HMAC
 * verification, response headers, status codes, and idempotency. This helper
 * only chooses the operation's generated Convex projection and forwards through
 * the existing server Convex auth/transport-proof path.
 */
export function serverOperation<TOperation extends OperationHandle>(
  event: H3Event,
  operation: TOperation,
): ServerOperationAdapter<
  OperationArgs<TOperation>,
  OperationResult<TOperation>,
  OperationPreviewResult<TOperation>
> {
  assertServerOperationHandle(operation)

  return {
    query: async (args, options) => {
      const kind = requireProjectionKind(operation, 'execute', operation.executeOperation)
      if (kind !== 'query') {
        throw new Error(
          `serverOperation(${operation.id}).query requires a query projection. Use .execute(...) for mutation or action operations.`,
        )
      }
      return await serverConvexQuery(
        event,
        operation.executeRef as AnyQueryFunction,
        args as never,
        options,
      )
    },
    execute: async (args, options) => {
      const kind = requireProjectionKind(operation, 'execute', operation.executeOperation)
      if (kind === 'query') {
        throw new Error(
          `serverOperation(${operation.id}).execute requires a mutation or action projection. Use .query(...) for query operations.`,
        )
      }
      const executeArgs = withConfirmation(args, options)
      const serverOptions = toServerConvexOptions(options)
      if (kind === 'mutation') {
        return await serverConvexMutation(
          event,
          operation.executeRef as AnyMutationFunction,
          executeArgs as never,
          serverOptions,
        )
      }
      return await serverConvexAction(
        event,
        operation.executeRef as AnyActionFunction,
        executeArgs as never,
        serverOptions,
      )
    },
    preview: async (args, options) => {
      if (operation.previewRef === undefined) {
        throw new Error(`serverOperation(${operation.id}).preview requires a preview projection.`)
      }
      const kind = requireProjectionKind(operation, 'preview', operation.previewOperation)
      return (await callPreview(
        event,
        operation.previewRef as AnyConvexFunction,
        kind,
        args as never,
        options,
      )) as OperationPreviewResult<TOperation>
    },
  }
}
