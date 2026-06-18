import { operationPreviewValidator, type OperationPreviewEnvelope } from '@lupinum/trellis/app'
import { defineOperationDescriptor } from '@lupinum/trellis/backend'
import { defineOperationHandle } from '@lupinum/trellis/mcp'
import { createTestContext } from '@lupinum/trellis/testing'
import type { FunctionReference } from 'convex/server'
import { v } from 'convex/values'
import { expectTypeOf } from 'vitest'

const testContext = createTestContext({ schema: {} as never })

expectTypeOf(testContext).toHaveProperty('seed')
expectTypeOf(testContext).toHaveProperty('asCaller')
expectTypeOf(testContext).toHaveProperty('asUser')
expectTypeOf(testContext).toHaveProperty('asService')

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
  runtimes: ['testing'],
})
const operationClient = testContext.asUser({ userId: 'owner-1' }).operation(removeTaskHandle)

expectTypeOf(operationClient.preview).parameter(0).toEqualTypeOf<RemoveTaskArgs>()
expectTypeOf(operationClient.preview({ id: 'task_1' })).toEqualTypeOf<Promise<RemoveTaskPreview>>()
expectTypeOf(operationClient.execute).parameter(0).toEqualTypeOf<RemoveTaskArgs>()
expectTypeOf(operationClient.execute({ id: 'task_1' })).toEqualTypeOf<Promise<RemoveTaskResult>>()
expectTypeOf(
  operationClient.execute(
    { id: 'task_1' },
    { confirmation: { token: 'confirm-token', expiresAt: 1 } },
  ),
).toEqualTypeOf<Promise<RemoveTaskResult>>()
