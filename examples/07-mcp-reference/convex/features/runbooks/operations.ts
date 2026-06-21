import {
  blockedOperationPreview,
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  workspaceScope,
} from '@lupinum/trellis/app'
import {
  can,
  deny,
  loadTenantResource as loadResource,
  requireAuth,
  requireRecord,
} from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import {
  bulkDeleteRunbooks,
  createRunbook,
  deleteRunbook,
  getRunbook,
  listRunbooks,
  updateRunbook,
} from '../../../shared/features/runbooks/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { canDeleteRunbook, canUpdateRunbook } from './checks'
import {
  runbookBulkDelete,
  runbookCreate,
  runbookDelete,
  runbookPublish,
  runbookRead,
} from './permissions'
import { workspaceRunbookCapabilities } from './recordAccess'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}

type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}

type RunbookIdArgs = {
  id: Id<'runbooks'>
}

type DeleteRunbookArgs = RunbookIdArgs

type BulkDeleteRunbooksArgs = {
  ids: Id<'runbooks'>[]
}

type CreateRunbookArgs = {
  title: string
  summary: string
  content: string
  visibility?: 'public' | 'workspace' | 'draft'
  tags?: string[]
}

type UpdateRunbookArgs = {
  id: Id<'runbooks'>
  title?: string
  summary?: string
  content?: string
  visibility?: 'public' | 'workspace' | 'draft'
  tags?: string[]
}

type LoadedRunbook = {
  runbook: Doc<'runbooks'>
}

type LoadedBulkRunbooks = {
  found: Doc<'runbooks'>[]
}

export const listWorkspaceRunbooksOp = operation.query({
  id: 'runbooks.list-workspace',
  args: listRunbooks.args,
  allowForwardingFrom: 'mcp',
  scope: workspaceScope(),
  permission: runbookRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const appIdentity = await ctx.appIdentity()
    const runbooks = await ctx.db
      .query('runbooks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()

    return workspaceRunbookCapabilities.attach(appIdentity, runbooks)
  },
})

export const getWorkspaceRunbookOp = operation.query({
  id: 'runbooks.get-workspace',
  args: getRunbook.args,
  allowForwardingFrom: 'mcp',
  scope: workspaceScope(),
  permission: runbookRead,
  handler: async (ctx: WorkspaceQueryCtx, args: RunbookIdArgs) => {
    const appIdentity = await ctx.appIdentity()
    const runbook = await ctx.db.get(args.id)
    if (!runbook) return null

    return workspaceRunbookCapabilities.attach(
      appIdentity,
      loadResource(appIdentity, runbook, 'Runbook'),
    )
  },
})

export const createRunbookOp = operation.mutation({
  id: 'runbooks.create',
  args: createRunbook.args,
  allowForwardingFrom: 'mcp',
  scope: workspaceScope(),
  permission: runbookCreate,
  safety: 'bounded-write',
  handler: async (ctx: WorkspaceMutationCtx, args: CreateRunbookArgs) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)

    const visibility = args.visibility ?? 'draft'
    if (visibility === 'public' && !can(appIdentity, runbookPublish.check)) {
      throw deny('Only owners and admins can create public runbooks.')
    }

    const now = Date.now()
    return await ctx.db.insert('runbooks', {
      title: args.title,
      summary: args.summary,
      content: args.content,
      visibility,
      tags: args.tags ?? [],
      ownerId: appIdentity.userId as Id<'users'>,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
      ...(visibility === 'public' ? { publishedAt: now } : {}),
    })
  },
})

export const updateRunbookOp = operation.mutation({
  id: 'runbooks.update',
  args: updateRunbook.args,
  allowForwardingFrom: 'mcp',
  scope: workspaceScope(),
  permission: runbookCreate,
  safety: 'bounded-write',
  load: async (ctx: WorkspaceMutationCtx, args: RunbookIdArgs): Promise<LoadedRunbook> => {
    const runbook = await ctx.db.get(args.id)
    requireRecord(runbook, 'Runbook')
    return { runbook }
  },
  authorize: {
    check: (_actor: AppIdentity, { runbook }: LoadedRunbook) => canUpdateRunbook(runbook),
  },
  handler: async (
    ctx: WorkspaceMutationCtx,
    args: UpdateRunbookArgs,
    { runbook }: LoadedRunbook,
  ) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)
    const nextVisibility = args.visibility ?? runbook.visibility
    if (nextVisibility === 'public' && !can(appIdentity, runbookPublish.check)) {
      throw deny('Only owners and admins can publish runbooks.')
    }

    await ctx.db.patch(args.id, {
      ...(args.title !== undefined ? { title: args.title } : {}),
      ...(args.summary !== undefined ? { summary: args.summary } : {}),
      ...(args.content !== undefined ? { content: args.content } : {}),
      ...(args.tags !== undefined ? { tags: args.tags } : {}),
      ...(args.visibility !== undefined ? { visibility: args.visibility } : {}),
      updatedAt: Date.now(),
      ...(nextVisibility === 'public' && runbook.visibility !== 'public'
        ? { publishedAt: Date.now() }
        : {}),
    })
  },
})

export const removeRunbookOp = operation.destructive({
  id: 'runbooks.remove',
  args: deleteRunbook.args,
  allowForwardingFrom: 'mcp',
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

export const workspaceOverviewOp = operation.query({
  id: 'runbooks.workspace-overview',
  args: listRunbooks.args,
  allowForwardingFrom: 'mcp',
  scope: workspaceScope(),
  permission: runbookRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const runbooks = await ctx.db
      .query('runbooks')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()

    return {
      total: runbooks.length,
      public: runbooks.filter((runbook) => runbook.visibility === 'public').length,
      workspaceOnly: runbooks.filter((runbook) => runbook.visibility === 'workspace').length,
      drafts: runbooks.filter((runbook) => runbook.visibility === 'draft').length,
      recentTitles: runbooks.slice(0, 5).map((runbook) => runbook.title),
    }
  },
})

export const bulkRemoveRunbooksOp = operation.destructive({
  id: 'runbooks.bulkRemove',
  args: bulkDeleteRunbooks.args,
  allowForwardingFrom: 'mcp',
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
