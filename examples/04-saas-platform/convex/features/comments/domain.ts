import { operation, workspaceScope } from '@lupinum/trellis/app'
import { deny, loadTenantResource as loadResource, requireAuth } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { createComment } from '../../../shared/features/comments/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'
import { taskRead } from '../tasks'
import { commentCreate } from './permissions'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type ListCommentsByTaskArgs = { taskId: Id<'tasks'> }
type CreateCommentArgs = {
  taskId: Id<'tasks'>
  body: string
  attachmentStorageId?: Id<'_storage'>
}

export const listCommentsByTaskOp = operation.query({
  id: 'comments.list-by-task',
  args: { taskId: v.id('tasks') },
  scope: workspaceScope(),
  permission: taskRead,
  handler: async (ctx: WorkspaceQueryCtx, args: ListCommentsByTaskArgs) => {
    const appIdentity = await ctx.appIdentity()

    loadResource(appIdentity, (await ctx.db.get(args.taskId)) as Doc<'tasks'> | null, 'Task')

    return ctx.db
      .query('comments')
      .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
      .order('asc')
      .collect()
  },
})

export const listByTask = query.workspace(listCommentsByTaskOp)

export const createCommentOp = operation.mutation({
  id: 'comments.create',
  args: createComment.args,
  scope: workspaceScope(),
  permission: commentCreate,
  handler: async (ctx: WorkspaceMutationCtx, args: CreateCommentArgs) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)

    const task = loadResource(
      appIdentity,
      (await ctx.db.get(args.taskId)) as Doc<'tasks'> | null,
      'Task',
    )

    const project = loadResource(
      appIdentity,
      (await ctx.db.get(task.projectId)) as Doc<'projects'> | null,
      'Project',
    )
    if (project.status === 'archived') {
      throw deny('Cannot comment on tasks in archived projects.')
    }

    const now = Date.now()
    const commentId = await ctx.db.insert('comments', {
      taskId: args.taskId,
      body: args.body,
      attachmentStorageId: args.attachmentStorageId,
      ownerId: appIdentity.userId,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'comment',
      entityId: commentId,
      action: 'comment.created',
      description: 'Added a task comment.',
      createdAt: now,
    })

    return commentId
  },
})

export const create = mutation.workspace(createCommentOp)
