import { resolve } from 'node:path'

import { makeFunctionReference, mutationGeneric, defineSchema } from 'convex/server'
import { v } from 'convex/values'
import { describe, expect, it } from 'vitest'

import { operationPreviewValidator } from '../../src/runtime/app'
import {
  defineOperationDescriptor,
  defineOperationHandle,
  projectOperationRef,
} from '../../src/runtime/functions/operation-metadata'
import { convexTestConfig, createTestContext } from '../../src/runtime/testing'

const identityForwardingKey = 'operation-testing-helper-identity-forwarding-key'

describe('convexTestConfig', () => {
  it('defaults vitest to the convex-friendly edge runtime setup', () => {
    const config = convexTestConfig()

    expect(config.test?.environment).toBe('edge-runtime')
    expect(config.test?.server?.deps?.inline).toEqual(expect.arrayContaining([expect.any(RegExp)]))
    expect(config.esbuild?.tsconfigRaw).toMatchObject({
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'Bundler',
        types: expect.arrayContaining(['node', 'vite/client']),
      },
    })
    expect(config.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'trellis-generated-server-mock',
        }),
      ]),
    )
  })

  it('resolves generated Trellis operation aliases for Vitest', () => {
    const config = convexTestConfig()

    expect(config.resolve?.alias).toMatchObject({
      '#trellis/api': resolve(process.cwd(), '.nuxt/trellis/api.ts'),
      '#trellis/operation-runtime': resolve(process.cwd(), '.nuxt/trellis/operation-runtime.ts'),
      '#trellis/operation-projections': resolve(
        process.cwd(),
        '.nuxt/trellis/operation-projections.ts',
      ),
      '#trellis/operations/testing': resolve(
        process.cwd(),
        '.nuxt/trellis/operation-handles/testing.ts',
      ),
    })
  })

  it('calls generated operation handles without caller-authored transport refs', async () => {
    const schema = defineSchema({})
    const modules = {
      '/convex/tasks.ts': async () => ({
        previewRemove: mutationGeneric({
          args: {
            id: v.string(),
            _trellisForwarding: v.optional(v.string()),
          },
          handler: async (_ctx, args) => ({
            allowed: true,
            summary: `Remove ${args.id}`,
            blockers: [],
            warnings: [],
            effects: [],
            confirm: { id: args.id },
            confirmation: { token: 'confirm-token', expiresAt: 1 },
            forwarded: typeof args._trellisForwarding === 'string',
          }),
        }),
        remove: mutationGeneric({
          args: {
            id: v.string(),
            _confirmationToken: v.optional(v.string()),
            _trellisForwarding: v.optional(v.string()),
          },
          handler: async (_ctx, args) => ({
            removed: args.id,
            confirmationToken: args._confirmationToken,
            forwarded: typeof args._trellisForwarding === 'string',
          }),
        }),
      }),
    }
    const descriptor = defineOperationDescriptor({
      id: 'tasks.remove',
      kind: 'destructive',
      args: { id: v.string() },
      previewReturns: operationPreviewValidator({ confirm: v.object({ id: v.string() }) }),
    })
    const previewRef = projectOperationRef(
      descriptor,
      'preview',
      makeFunctionReference<
        'mutation',
        { id: string },
        {
          allowed: boolean
          summary: string
          blockers: []
          warnings: []
          effects: []
          confirm: { id: string }
          confirmation: { token: string; expiresAt: number }
          forwarded: boolean
        }
      >('tasks:previewRemove'),
      { functionRef: 'tasks:previewRemove', executeFunctionRef: 'tasks:remove' },
    )
    const executeRef = projectOperationRef(
      descriptor,
      'execute',
      makeFunctionReference<
        'mutation',
        { id: string; _confirmationToken?: string },
        { removed: string; confirmationToken?: string; forwarded: boolean }
      >('tasks:remove'),
      { functionRef: 'tasks:remove' },
    )
    const operation = defineOperationHandle(descriptor, {
      executeRef,
      previewRef,
      executeOperation: 'mutation',
      previewOperation: 'mutation',
      runtimes: ['testing'],
    })
    const ctx = createTestContext({
      schema,
      modules,
      identityForwardingKey,
    })
    const caller = ctx.asUser({ userId: 'owner-1' })

    const preview = await caller.operation(operation).preview({ id: 'task_1' })
    expect(preview.forwarded).toBe(true)

    await expect(
      caller.operation(operation).execute({ id: 'task_1' }, { confirmation: preview.confirmation }),
    ).resolves.toMatchObject({
      removed: 'task_1',
      confirmationToken: 'confirm-token',
      forwarded: true,
    })
  })
})
