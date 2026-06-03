import { operation, previewOf, workspaceScope } from '@lupinum/trellis/app'
import { can, deny, enforce, loadTenantResource as loadResource } from '@lupinum/trellis/auth'
import { asyncMap } from 'convex-helpers'
import { v } from 'convex/values'

import {
  assignTask,
  createTask,
  moveTask,
  taskStatusValidator,
} from '../../../shared/features/tasks/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { hasRole, hasWorkspace } from '../../auth/guards'
import { mutation, query } from '../../functions'
import { canUpdateTask } from './checks'
import { removeTaskOp } from './operations'
import { taskAssign, taskCreate, taskRead } from './permissions'
import { taskCapabilities } from './recordAccess'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type TaskPriority = 'low' | 'medium' | 'high'
type TaskStatus = 'backlog' | 'in_progress' | 'done'
type ProjectIdArgs = { projectId: Id<'projects'> }
type TaskIdArgs = { id: Id<'tasks'> }
type CreateTaskArgs = ProjectIdArgs & { title: string; priority?: TaskPriority }
type MoveTaskArgs = TaskIdArgs & { status: TaskStatus }
type AssignTaskArgs = TaskIdArgs & { assigneeId?: Id<'users'> }
type BulkUpdateTaskStatusArgs = { ids: Id<'tasks'>[]; status: TaskStatus }

export const listTasksByProjectOp = operation.query({
  id: 'tasks.list-by-project',
  args: { projectId: v.id('projects') },
  scope: workspaceScope(),
  guard: taskRead,
  handler: async (ctx: WorkspaceQueryCtx, args: ProjectIdArgs) => {
    const appIdentity = await ctx.appIdentity()

    loadResource(appIdentity, await ctx.db.get(args.projectId), 'Project')

    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()

    return taskCapabilities.attach(appIdentity, tasks)
  },
})

export const listByProject = query.protected(listTasksByProjectOp)

export const getTaskOp = operation.query({
  id: 'tasks.get',
  args: { id: v.id('tasks') },
  scope: workspaceScope(),
  guard: taskRead,
  handler: async (ctx: WorkspaceQueryCtx, args: TaskIdArgs) => {
    const appIdentity = await ctx.appIdentity()
    const task = loadResource(
      appIdentity,
      (await ctx.db.get(args.id)) as Doc<'tasks'> | null,
      'Task',
    )
    return taskCapabilities.attach(appIdentity, task)
  },
})

export const get = query.protected(getTaskOp)

export const createTaskOp = operation.mutation({
  id: 'tasks.create',
  args: createTask.args,
  scope: workspaceScope(),
  guard: taskCreate,
  handler: async (ctx: WorkspaceMutationCtx, args: CreateTaskArgs) => {
    const appIdentity = await ctx.appIdentity()

    const project = loadResource(
      appIdentity,
      (await ctx.db.get(args.projectId)) as Doc<'projects'> | null,
      'Project',
    )

    if (project.status === 'archived') {
      throw deny('Cannot add tasks to archived projects.')
    }

    const now = Date.now()
    const taskId = await ctx.db.insert('tasks', {
      projectId: args.projectId,
      title: args.title,
      status: 'backlog',
      priority: args.priority ?? 'medium',
      ownerId: appIdentity.userId,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'task',
      entityId: taskId,
      action: 'task.created',
      description: `Created task "${args.title}".`,
      createdAt: now,
    })

    return taskId
  },
})

export const create = mutation.protected(createTaskOp)

export const moveTaskToColumnOp = operation.mutation({
  id: 'tasks.move-to-column',
  args: moveTask.args,
  scope: workspaceScope(),
  guard: taskRead,
  handler: async (ctx: WorkspaceMutationCtx, args: MoveTaskArgs) => {
    const appIdentity = await ctx.appIdentity()
    const task = loadResource(
      appIdentity,
      (await ctx.db.get(args.id)) as Doc<'tasks'> | null,
      'Task',
    )
    enforce(appIdentity, 'Update task', canUpdateTask(task))

    const now = Date.now()
    await ctx.db.patch(args.id, { status: args.status, updatedAt: now })

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'task',
      entityId: args.id,
      action: 'task.moved',
      description: `Moved "${task.title}" to ${args.status}.`,
      createdAt: now,
    })
  },
})

export const moveToColumn = mutation.protected(moveTaskToColumnOp)

export const assignTaskOp = operation.mutation({
  id: 'tasks.assign',
  args: assignTask.args,
  scope: workspaceScope(),
  guard: taskAssign,
  handler: async (ctx: WorkspaceMutationCtx, args: AssignTaskArgs) => {
    const appIdentity = await ctx.appIdentity()

    const task = loadResource(
      appIdentity,
      (await ctx.db.get(args.id)) as Doc<'tasks'> | null,
      'Task',
    )

    if (args.assigneeId) {
      const assignee = await ctx.db.get(args.assigneeId)
      if (!assignee || assignee.workspaceId !== ctx.workspaceId) {
        throw deny('Assignee must already belong to this workspace.')
      }
    }

    const now = Date.now()
    await ctx.db.patch(args.id, { assigneeId: args.assigneeId, updatedAt: now })

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'task',
      entityId: args.id,
      action: 'task.assigned',
      description: `Assigned "${task.title}" to ${args.assigneeId ?? 'nobody'}.`,
      createdAt: now,
    })
  },
})

export const assign = mutation.protected(assignTaskOp)

export const bulkUpdateTaskStatusOp = operation.mutation({
  id: 'tasks.bulk-update-status',
  args: {
    ids: v.array(v.id('tasks')),
    status: taskStatusValidator,
  },
  scope: workspaceScope(),
  guard: hasWorkspace.and(hasRole('owner', 'admin', 'member')),
  handler: async (ctx: WorkspaceMutationCtx, args: BulkUpdateTaskStatusArgs) => {
    const appIdentity = await ctx.appIdentity()

    const now = Date.now()
    const updates = await asyncMap(args.ids, async (id) => {
      const task = await ctx.db.get(id)
      const typedTask = task as Doc<'tasks'> | null
      if (!typedTask || typedTask.workspaceId !== ctx.workspaceId) {
        return { id, updated: false as const }
      }

      if (!can(appIdentity, canUpdateTask(typedTask))) {
        return { id, updated: false as const }
      }

      await ctx.db.patch(id, { status: args.status, updatedAt: now })
      return { id, updated: true as const }
    })

    const results = {
      updated: updates.filter((entry) => entry.updated).length,
      skipped: updates.filter((entry) => !entry.updated).map((entry) => entry.id),
    }

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'task',
      entityId: results.skipped.join(',') || 'bulk',
      action: 'task.bulk_status',
      description: `Bulk updated ${results.updated} task(s) to ${args.status}.`,
      createdAt: now,
    })

    return results
  },
})

export const bulkUpdateStatus = mutation.protected(bulkUpdateTaskStatusOp)

export const previewRemoveTask = mutation.protected(previewOf(removeTaskOp))
export const remove = mutation.protected(removeTaskOp)

export const listTasksForExportOp = operation.query({
  id: 'tasks.list-for-export',
  args: { projectId: v.id('projects') },
  scope: workspaceScope(),
  guard: taskRead,
  handler: async (ctx: WorkspaceQueryCtx, args: ProjectIdArgs) => {
    const appIdentity = await ctx.appIdentity()

    loadResource(appIdentity, await ctx.db.get(args.projectId), 'Project')

    return ctx.db
      .query('tasks')
      .withIndex('by_project', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()
  },
})

export const listForExport = query.protected(listTasksForExportOp)
