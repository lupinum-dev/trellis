import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server'
import { computed, ref, type ComputedRef, type Ref } from 'vue'

import type {
  OperationHandle,
  OperationHandleFunctionKind,
} from '../../functions/operation-metadata.js'
import {
  isOperationPreviewEnvelope,
  type OperationPreviewConfirmation,
  type OperationPreviewEffect,
  type OperationPreviewEnvelope,
  type OperationPreviewIssue,
} from '../../functions/operation-preview.js'
import type { MutationStatus } from '../../utils/types.js'
import { useConvexAction, type UseConvexActionReturn } from './useConvexAction.js'
import { useConvexMutation, type UseConvexMutationReturn } from './useConvexMutation.js'
import { executeConvexQuery } from './useConvexQuery.js'

type AnyOperationFunctionRef = FunctionReference<'query' | 'mutation' | 'action'>
type AnyQueryFunctionRef = FunctionReference<'query'>
type AnyCommandFunctionRef = FunctionReference<'mutation'> | FunctionReference<'action'>
type AnyMutationFunctionRef = FunctionReference<'mutation'>
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

type ArgsOf<TRef> = TRef extends AnyOperationFunctionRef
  ? FunctionArgs<TRef> extends UnknownArgs
    ? FunctionArgs<TRef>
    : UnknownArgs
  : UnknownArgs
type ResultOf<TRef> = TRef extends AnyOperationFunctionRef ? FunctionReturnType<TRef> : unknown

type OperationArgs<TOperation extends OperationHandle> = ArgsOf<OperationExecuteRef<TOperation>>
type OperationResult<TOperation extends OperationHandle> = ResultOf<OperationExecuteRef<TOperation>>
type OperationPreviewResult<TOperation extends OperationHandle> =
  OperationPreviewRef<TOperation> extends undefined
    ? OperationPreviewEnvelope
    : ResultOf<OperationPreviewRef<TOperation>>

type OperationCommandReturn<TArgs extends UnknownArgs, TResult> =
  | UseConvexMutationReturn<TArgs, TResult>
  | UseConvexActionReturn<TArgs, TResult>

type OperationPreviewReturn<TArgs extends UnknownArgs, TResult> = Pick<
  UseConvexMutationReturn<TArgs, TResult>,
  'data' | 'status' | 'pending' | 'error' | 'reset'
> &
  ((args: TArgs) => Promise<TResult>)

export type UseTrellisOperationConfirmation =
  | OperationPreviewConfirmation
  | string
  | null
  | undefined

export interface UseTrellisOperationExecuteOptions {
  confirmation?: UseTrellisOperationConfirmation
}

export interface UseTrellisOperationReturn<
  TArgs extends UnknownArgs = UnknownArgs,
  TResult = unknown,
  TPreview = OperationPreviewEnvelope,
> {
  execute: (args: TArgs, options?: UseTrellisOperationExecuteOptions) => Promise<TResult>
  data: Ref<TResult | undefined>
  status: ComputedRef<MutationStatus>
  pending: ComputedRef<boolean>
  error: Ref<Error | null>
  reset: () => void
  preview: (args: TArgs) => Promise<TPreview>
  previewData: Ref<TPreview | undefined>
  previewStatus: ComputedRef<MutationStatus>
  previewPending: ComputedRef<boolean>
  previewError: Ref<Error | null>
  resetPreview: () => void
  warnings: ComputedRef<OperationPreviewIssue[]>
  blockers: ComputedRef<OperationPreviewIssue[]>
  effects: ComputedRef<OperationPreviewEffect[]>
  confirmation: ComputedRef<OperationPreviewConfirmation | null>
}

function assertCommandRef(
  refValue: unknown,
  operationId: string,
  projection: 'execute' | 'preview',
): asserts refValue is AnyCommandFunctionRef {
  if (refValue && typeof refValue === 'object') return

  throw new Error(
    `useTrellisOperation(${operationId}) requires a ${projection} Convex function reference.`,
  )
}

function assertMutationRef(
  refValue: unknown,
  operationId: string,
  projection: 'execute' | 'preview',
): asserts refValue is AnyMutationFunctionRef {
  assertCommandRef(refValue, operationId, projection)
}

function assertQueryRef(
  refValue: unknown,
  operationId: string,
  projection: 'execute' | 'preview',
): asserts refValue is AnyQueryFunctionRef {
  if (refValue && typeof refValue === 'object') return

  throw new Error(
    `useTrellisOperation(${operationId}) requires a ${projection} Convex query reference.`,
  )
}

function unsupportedKind(operationId: string, projection: 'execute' | 'preview', kind: string) {
  return new Error(
    `useTrellisOperation(${operationId}) does not support ${projection} ${kind} projections yet.`,
  )
}

function useOperationCommand<TArgs extends UnknownArgs, TResult>(
  refValue: unknown,
  kind: OperationHandleFunctionKind | undefined,
  operationId: string,
  projection: 'execute' | 'preview',
): OperationCommandReturn<TArgs, TResult> {
  if (kind === 'query') {
    throw unsupportedKind(operationId, projection, kind)
  }

  assertCommandRef(refValue, operationId, projection)

  if (kind === 'action') {
    return useConvexAction(refValue as FunctionReference<'action'>) as UseConvexActionReturn<
      TArgs,
      TResult
    >
  }

  return useConvexMutation(refValue as FunctionReference<'mutation'>) as UseConvexMutationReturn<
    TArgs,
    TResult
  >
}

function useOperationPreview<TArgs extends UnknownArgs, TResult>(
  refValue: unknown,
  kind: OperationHandleFunctionKind | undefined,
  operationId: string,
): OperationPreviewReturn<TArgs, TResult> {
  if (kind === 'query') {
    assertQueryRef(refValue, operationId, 'preview')
    const data = ref<TResult | undefined>(undefined) as Ref<TResult | undefined>
    const error = ref<Error | null>(null)
    const status = ref<MutationStatus>('idle')
    const pending = computed(() => status.value === 'pending')
    const reset = () => {
      data.value = undefined
      error.value = null
      status.value = 'idle'
    }
    const run = (async (args: TArgs): Promise<TResult> => {
      status.value = 'pending'
      error.value = null
      try {
        const result = await executeConvexQuery(refValue, args, { subscribe: false })
        data.value = result as TResult
        status.value = 'success'
        return result as TResult
      } catch (cause) {
        const nextError = cause instanceof Error ? cause : new Error(String(cause))
        error.value = nextError
        status.value = 'error'
        throw nextError
      }
    }) as OperationPreviewReturn<TArgs, TResult>
    run.data = data
    run.error = error
    run.status = computed(() => status.value)
    run.pending = pending
    run.reset = reset
    return run
  }

  if (kind !== undefined && kind !== 'mutation') {
    throw unsupportedKind(operationId, 'preview', kind)
  }

  assertMutationRef(refValue, operationId, 'preview')
  return useConvexMutation(refValue as FunctionReference<'mutation'>) as UseConvexMutationReturn<
    TArgs,
    TResult
  >
}

function confirmationToken(value: UseTrellisOperationConfirmation): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value.token === 'string') return value.token
  return undefined
}

function withConfirmation<TArgs extends UnknownArgs>(
  args: TArgs,
  options?: UseTrellisOperationExecuteOptions,
): TArgs {
  const token = confirmationToken(options?.confirmation)
  if (!token) return args
  return { ...args, _confirmationToken: token } as TArgs
}

/**
 * Client composable for generated Trellis operation handles.
 *
 * It keeps preview and execute state separate, exposes preview warnings and
 * blockers, and maps explicit preview confirmation to the internal transport
 * token expected by the backend.
 */
export function useTrellisOperation<TOperation extends OperationHandle>(
  operation: TOperation,
): UseTrellisOperationReturn<
  OperationArgs<TOperation>,
  OperationResult<TOperation>,
  OperationPreviewResult<TOperation>
> {
  type Args = OperationArgs<TOperation>
  type Result = OperationResult<TOperation>
  type Preview = OperationPreviewResult<TOperation>

  if (!operation.runtimes.includes('client')) {
    throw new Error(
      `useTrellisOperation(${operation.id}) requires a handle generated for the client runtime.`,
    )
  }

  const executeCall = useOperationCommand<Args, Result>(
    operation.executeRef,
    operation.executeOperation,
    operation.id,
    'execute',
  )
  const previewCall =
    operation.previewRef === undefined
      ? undefined
      : useOperationPreview<Args, Preview>(
          operation.previewRef,
          operation.previewOperation,
          operation.id,
        )
  const emptyPreviewData = ref<Preview | undefined>(undefined) as Ref<Preview | undefined>
  const emptyPreviewError = ref<Error | null>(null)
  const idleStatus = computed<MutationStatus>(() => 'idle')
  const idlePending = computed(() => false)

  const previewData: Ref<Preview | undefined> = previewCall?.data ?? emptyPreviewData
  const previewEnvelope = computed<OperationPreviewEnvelope | null>(() =>
    isOperationPreviewEnvelope(previewData.value) ? previewData.value : null,
  )
  const preview = async (args: Args): Promise<Preview> => {
    if (!previewCall) {
      throw new Error(`useTrellisOperation(${operation.id}) does not have a preview projection.`)
    }

    return previewCall(args)
  }
  const execute = (args: Args, options?: UseTrellisOperationExecuteOptions): Promise<Result> =>
    executeCall(withConfirmation(args, options))

  const result: UseTrellisOperationReturn<Args, Result, Preview> = {
    execute,
    data: executeCall.data,
    status: executeCall.status,
    pending: executeCall.pending,
    error: executeCall.error,
    reset: executeCall.reset,
    preview,
    previewData,
    previewStatus: previewCall?.status ?? idleStatus,
    previewPending: previewCall?.pending ?? idlePending,
    previewError: previewCall?.error ?? emptyPreviewError,
    resetPreview: previewCall?.reset ?? (() => {}),
    warnings: computed<OperationPreviewIssue[]>(() => previewEnvelope.value?.warnings ?? []),
    blockers: computed<OperationPreviewIssue[]>(() => previewEnvelope.value?.blockers ?? []),
    effects: computed<OperationPreviewEffect[]>(() => previewEnvelope.value?.effects ?? []),
    confirmation: computed<OperationPreviewConfirmation | null>(
      () => previewEnvelope.value?.confirmation ?? null,
    ),
  }
  return result
}
