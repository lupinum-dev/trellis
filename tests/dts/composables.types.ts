import { operationPreviewValidator, type OperationPreviewEnvelope } from '@lupinum/trellis/app'
import { defineOperationDescriptor } from '@lupinum/trellis/backend'
import { useTrellisOperation } from '@lupinum/trellis/composables'
import { defineOperationHandle } from '@lupinum/trellis/mcp'
import type { FunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { expectTypeOf } from 'vitest'

type RemoveTaskArgs = { id: string }
type RemoveTaskResult = { removed: true }
type RemoveTaskPreview = OperationPreviewEnvelope<{ id: string }>

const removeTaskDescriptor = defineOperationDescriptor({
  id: 'tasks.remove',
  kind: 'destructive',
  args: { id: v.string() },
  previewReturns: operationPreviewValidator({
    confirm: v.object({ id: v.string() }),
  }),
})

const removeTaskHandle = defineOperationHandle(removeTaskDescriptor, {
  executeRef: {} as FunctionReference<'mutation', 'public', RemoveTaskArgs, RemoveTaskResult>,
  previewRef: {} as FunctionReference<'mutation', 'public', RemoveTaskArgs, RemoveTaskPreview>,
  executeOperation: 'mutation',
  previewOperation: 'mutation',
  runtimes: ['client'],
})

const removeTask = useTrellisOperation(removeTaskHandle)

expectTypeOf(removeTask.execute).parameter(0).toEqualTypeOf<RemoveTaskArgs>()
expectTypeOf(removeTask.execute({ id: 'task_1' })).toEqualTypeOf<Promise<RemoveTaskResult>>()
expectTypeOf(
  removeTask.execute({ id: 'task_1' }, { confirmation: { token: 'confirm-token', expiresAt: 1 } }),
).toEqualTypeOf<Promise<RemoveTaskResult>>()
expectTypeOf(removeTask.preview).parameter(0).toEqualTypeOf<RemoveTaskArgs>()
expectTypeOf(removeTask.preview({ id: 'task_1' })).toEqualTypeOf<Promise<RemoveTaskPreview>>()
expectTypeOf(removeTask.previewData.value).toEqualTypeOf<RemoveTaskPreview | undefined>()
expectTypeOf(removeTask.confirmation.value).toEqualTypeOf<{
  token: string
  expiresAt: number
} | null>()

// @ts-expect-error id is required by the generated operation handle.
removeTask.execute({})

removeTask.execute(
  { id: 'task_1' },
  // @ts-expect-error confirmation objects require an expiry timestamp.
  { confirmation: { token: 'confirm-token' } },
)
