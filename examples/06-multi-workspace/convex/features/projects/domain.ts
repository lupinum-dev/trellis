import { operation, workspaceScope } from '@lupinum/trellis/app'

import {
  createProject,
  listProjects,
  toggleProjectStatus,
} from '../../../shared/features/projects/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'
import { projectCreate, projectRead } from './permissions'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type CreateProjectArgs = { name: string }
type ToggleProjectStatusArgs = { id: Id<'projects'> }

export const listProjectsOp = operation.query({
  id: 'projects.list',
  args: listProjects.args,
  scope: workspaceScope(),
  guard: projectRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    return ctx.db
      .query('projects')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()
  },
})

export const list = query.protected(listProjectsOp)

export const createProjectOp = operation.mutation({
  id: 'projects.create',
  args: createProject.args,
  scope: workspaceScope(),
  guard: projectCreate,
  handler: async (ctx: WorkspaceMutationCtx, args: CreateProjectArgs) => {
    return ctx.db.insert('projects', {
      workspaceId: ctx.workspaceId,
      name: args.name,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const create = mutation.protected(createProjectOp)

export const toggleProjectStatusOp = operation.mutation({
  id: 'projects.toggle-status',
  args: toggleProjectStatus.args,
  scope: workspaceScope(),
  guard: projectCreate,
  handler: async (ctx: WorkspaceMutationCtx, args: ToggleProjectStatusArgs) => {
    const project = await ctx.db.get(args.id)
    if (!project) throw new Error('Project not found.')

    const newStatus = project.status === 'active' ? 'paused' : 'active'
    await ctx.db.patch(args.id, { status: newStatus, updatedAt: Date.now() })
    return newStatus
  },
})

export const toggleStatus = mutation.protected(toggleProjectStatusOp)
