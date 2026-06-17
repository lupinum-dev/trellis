import {
  blockedOperationPreview,
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  workspaceScope,
} from '@lupinum/trellis/app'
import { can } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { bulkDeleteRunbooks, deleteRunbook } from '../../../shared/features/runbooks/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { canDeleteRunbook } from './checks'
import { runbookBulkDelete, runbookDelete } from './permissions'

type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}

type DeleteRunbookArgs = {
  id: Id<'runbooks'>
}

type BulkDeleteRunbooksArgs = {
  ids: Id<'runbooks'>[]
}

type LoadedRunbook = {
  runbook: Doc<'runbooks'>
}

type LoadedBulkRunbooks = {
  found: Doc<'runbooks'>[]
}

export const removeRunbookOp = operation.destructive({
  id: 'runbooks.remove',
  executeFunctionRef: 'features/runbooks/domain:remove',
  args: deleteRunbook.args,
  returns: v.null(),
  scope: workspaceScope(),
  permission: runbookDelete,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('runbooks.remove'),
      targetId: v.id('runbooks'),
      affectedCounts: v.object({
        runbooks: v.number(),
      }),
    }),
  }),
  load: async (ctx: WorkspaceMutationCtx, args: DeleteRunbookArgs): Promise<LoadedRunbook> => {
    const runbook = await ctx.db.get(args.id)
    if (!runbook) throw new Error('Runbook not found.')
    const appIdentity = await ctx.appIdentity()
    if (!can(appIdentity, canDeleteRunbook(runbook))) {
      throw new Error('Forbidden: Delete runbook')
    }
    return { runbook }
  },
  preview: async (
    _ctx: WorkspaceMutationCtx,
    _args: DeleteRunbookArgs,
    { runbook }: LoadedRunbook,
  ) =>
    operationPreview({
      summary: `Will permanently delete "${runbook.title}".`,
      warnings: [operationIssue({ code: 'permanent-delete', message: 'This cannot be undone.' })],
      effects: [operationEffect({ kind: 'runbooks', summary: 'Runbooks deleted', count: 1 })],
      confirm: {
        operation: 'runbooks.remove',
        targetId: runbook._id,
        affectedCounts: { runbooks: 1 },
      },
    }),
  handler: async (ctx: WorkspaceMutationCtx, args: DeleteRunbookArgs) => {
    await ctx.db.delete(args.id)
    return null
  },
})

export const bulkRemoveRunbooksOp = operation.destructive({
  id: 'runbooks.bulkRemove',
  executeFunctionRef: 'features/runbooks/domain:bulkRemove',
  args: bulkDeleteRunbooks.args,
  returns: v.object({
    deleted: v.number(),
    skipped: v.array(
      v.object({
        id: v.string(),
        reason: v.string(),
      }),
    ),
    total: v.number(),
  }),
  scope: workspaceScope(),
  permission: runbookBulkDelete,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('runbooks.bulkRemove'),
      targetIds: v.array(v.id('runbooks')),
      affectedCounts: v.object({
        runbooks: v.number(),
      }),
    }),
  }),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: BulkDeleteRunbooksArgs,
  ): Promise<LoadedBulkRunbooks> => {
    const appIdentity = await ctx.appIdentity()
    const runbooks = await Promise.all(args.ids.map((id) => ctx.db.get(id)))
    const found = runbooks.filter(
      (runbook): runbook is NonNullable<(typeof runbooks)[number]> =>
        !!runbook &&
        runbook.workspaceId === ctx.workspaceId &&
        can(appIdentity, canDeleteRunbook(runbook)),
    )

    return { found }
  },
  preview: async (
    _ctx: WorkspaceMutationCtx,
    args: BulkDeleteRunbooksArgs,
    { found }: LoadedBulkRunbooks,
  ) => {
    if (found.length === 0) {
      return blockedOperationPreview({
        summary: 'None of the selected runbooks can be deleted.',
        blockers: [
          operationIssue({
            code: 'no-deletable-runbooks',
            message: 'None of the selected runbooks can be deleted.',
          }),
        ],
        confirm: {
          operation: 'runbooks.bulkRemove',
          targetIds: [],
          affectedCounts: { runbooks: 0 },
        },
      })
    }

    return operationPreview({
      summary: `Will delete ${found.length} runbook${found.length === 1 ? '' : 's'}: ${found.map((runbook) => `"${runbook.title}"`).join(', ')}`,
      warnings:
        found.length !== args.ids.length
          ? [
              operationIssue({
                code: 'some-runbooks-skipped',
                message: 'Some ids were missing and will be skipped.',
              }),
            ]
          : [],
      effects: [
        operationEffect({ kind: 'runbooks', summary: 'Runbooks deleted', count: found.length }),
      ],
      confirm: {
        operation: 'runbooks.bulkRemove',
        targetIds: found.map((runbook) => runbook._id).sort(),
        affectedCounts: { runbooks: found.length },
      },
    })
  },
  handler: async (ctx: WorkspaceMutationCtx, args: BulkDeleteRunbooksArgs) => {
    const appIdentity = await ctx.appIdentity()

    let deleted = 0
    const skipped: { id: string; reason: string }[] = []

    for (const id of args.ids) {
      const runbook = await ctx.db.get(id)
      if (!runbook) {
        skipped.push({ id, reason: 'not_found' })
        continue
      }
      if (runbook.workspaceId !== ctx.workspaceId) {
        skipped.push({ id, reason: 'different_workspace' })
        continue
      }
      if (!can(appIdentity, canDeleteRunbook(runbook))) {
        skipped.push({ id, reason: 'forbidden' })
        continue
      }

      await ctx.db.delete(id)
      deleted++
    }

    return {
      deleted,
      skipped,
      total: args.ids.length,
    }
  },
})
