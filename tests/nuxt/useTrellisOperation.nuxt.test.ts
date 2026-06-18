import { v } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { operationPreviewValidator } from '../../src/runtime/app'
import { useTrellisOperation } from '../../src/runtime/convex/composables/useTrellisOperation'
import {
  defineOperationDescriptor,
  defineOperationHandle,
} from '../../src/runtime/functions/operation-metadata'
import { MockConvexClient, mockFnRef } from '../support/nuxt/mock-convex-client'
import { captureInNuxt } from '../support/nuxt/runtime-harness'

function createRemoveTaskHandle() {
  const descriptor = defineOperationDescriptor({
    id: 'tasks.remove',
    kind: 'destructive',
    args: { id: v.string() },
    previewReturns: operationPreviewValidator({
      confirm: v.object({ id: v.string() }),
    }),
  })

  return defineOperationHandle(descriptor, {
    executeRef: mockFnRef<'mutation'>('features/tasks/domain:remove'),
    previewRef: mockFnRef<'mutation'>('features/tasks/domain:previewRemoveTask'),
    executeOperation: 'mutation',
    previewOperation: 'mutation',
    runtimes: ['client'],
  })
}

describe('useTrellisOperation (Nuxt runtime)', () => {
  it('previews and executes destructive operation handles with explicit confirmation', async () => {
    const convex = new MockConvexClient()
    const operation = createRemoveTaskHandle()

    convex.setMutationHandler('features/tasks/domain:previewRemoveTask', async (args) => ({
      allowed: true,
      summary: `Remove ${(args as { id: string }).id}`,
      blockers: [],
      warnings: [{ code: 'delete', message: 'This cannot be undone.' }],
      effects: [{ kind: 'tasks', summary: 'Tasks deleted', count: 1 }],
      confirm: { id: (args as { id: string }).id },
      confirmation: { token: 'confirm-token-1', expiresAt: 1234 },
    }))
    convex.setMutationHandler('features/tasks/domain:remove', async (args) => ({
      removed: (args as { id: string }).id,
      token: (args as { _confirmationToken?: string })._confirmationToken,
    }))

    const { result } = await captureInNuxt(() => useTrellisOperation(operation), { convex })

    const preview = await result.preview({ id: 'task_1' })
    expect(preview.summary).toBe('Remove task_1')
    expect(result.previewStatus.value).toBe('success')
    expect(result.warnings.value).toEqual([{ code: 'delete', message: 'This cannot be undone.' }])
    expect(result.blockers.value).toEqual([])
    expect(result.effects.value).toEqual([{ kind: 'tasks', summary: 'Tasks deleted', count: 1 }])
    expect(result.confirmation.value).toEqual({ token: 'confirm-token-1', expiresAt: 1234 })

    await expect(
      result.execute({ id: 'task_1' }, { confirmation: preview.confirmation }),
    ).resolves.toEqual({
      removed: 'task_1',
      token: 'confirm-token-1',
    })
    expect(convex.calls.mutation.at(-1)?.args).toEqual({
      id: 'task_1',
      _confirmationToken: 'confirm-token-1',
    })
    expect(result.status.value).toBe('success')
  })

  it('keeps preview and execute state separate', async () => {
    const convex = new MockConvexClient()
    const operation = createRemoveTaskHandle()

    convex.setMutationHandler('features/tasks/domain:previewRemoveTask', async () => {
      throw new Error('preview failed')
    })
    convex.setMutationHandler('features/tasks/domain:remove', async () => ({ ok: true }))

    const { result } = await captureInNuxt(() => useTrellisOperation(operation), { convex })

    await expect(result.preview({ id: 'task_1' })).rejects.toThrow('preview failed')
    expect(result.previewStatus.value).toBe('error')
    expect(result.status.value).toBe('idle')

    await expect(result.execute({ id: 'task_1' })).resolves.toEqual({ ok: true })
    expect(result.status.value).toBe('success')
    expect(result.previewStatus.value).toBe('error')
  })
})
