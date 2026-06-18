import {
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  workspaceScope,
} from '@lupinum/trellis/app'
import { enforce, loadTenantResource as loadResource } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { canDeleteTask } from './checks'
import { taskRead } from './permissions'

type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type RemoveTaskArgs = { id: Id<'tasks'> }
type RemoveTaskLoaded = { task: Doc<'tasks'>; comments: Doc<'comments'>[] }

export const removeTaskOp = operation.destructive({
  id: 'tasks.remove',
  args: { id: v.id('tasks') },
  returns: v.null(),
  scope: workspaceScope(),
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('tasks.remove'),
      targetId: v.id('tasks'),
      affectedCounts: v.object({
        tasks: v.number(),
        comments: v.number(),
      }),
    }),
  }),
  permission: taskRead,
  safety: 'destructive-write',
  load: async (ctx: WorkspaceMutationCtx, args: RemoveTaskArgs): Promise<RemoveTaskLoaded> => {
    const appIdentity = await ctx.appIdentity()
    const task = loadResource(
      appIdentity,
      (await ctx.db.get(args.id)) as Doc<'tasks'> | null,
      'Task',
    )
    const comments = await ctx.db
      .query('comments')
      .withIndex('by_task', (q) => q.eq('taskId', args.id))
      .collect()
    return { task, comments }
  },
  preview: async (
    _ctx: WorkspaceMutationCtx,
    _args: RemoveTaskArgs,
    { task, comments }: RemoveTaskLoaded,
  ) =>
    operationPreview({
      summary: `Will permanently delete "${task.title}".`,
      warnings: [
        operationIssue({
          code: 'delete-comments',
          message: 'This also removes all comments on the task.',
        }),
      ],
      effects: [
        operationEffect({ kind: 'tasks', summary: 'Tasks deleted', count: 1 }),
        operationEffect({ kind: 'comments', summary: 'Comments deleted', count: comments.length }),
      ],
      confirm: {
        operation: 'tasks.remove',
        targetId: task._id,
        affectedCounts: { tasks: 1, comments: comments.length },
      },
    }),
  handler: async (
    ctx: WorkspaceMutationCtx,
    args: RemoveTaskArgs,
    { task, comments }: RemoveTaskLoaded,
  ) => {
    const appIdentity = await ctx.appIdentity()
    enforce(appIdentity, 'Delete task', canDeleteTask(task))

    for (const comment of comments) {
      await ctx.db.delete(comment._id)
    }
    await ctx.db.delete(args.id)

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'task',
      entityId: args.id,
      action: 'task.deleted',
      description: `Deleted task "${task.title}".`,
      createdAt: Date.now(),
    })

    return null
  },
})
