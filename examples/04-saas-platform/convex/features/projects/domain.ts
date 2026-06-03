import { operation, previewOf, workspaceScope } from '@lupinum/trellis/app'
import { loadTenantResource as loadResource } from '@lupinum/trellis/auth'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { createProject } from '../../../shared/features/projects/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'
import { archiveProjectOp } from './operations'
import { projectCreate, projectExport, projectRead } from './permissions'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type ProjectIdArgs = { id: Id<'projects'> }
type CreateProjectArgs = { name: string; summary?: string }

export const listProjectsOp = operation.query({
  id: 'projects.list',
  args: { paginationOpts: paginationOptsValidator },
  scope: workspaceScope(),
  guard: projectRead,
  handler: async (ctx: WorkspaceQueryCtx, args) => {
    return ctx.db
      .query('projects')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .paginate(args.paginationOpts)
  },
})

export const list = query.protected(listProjectsOp)

export const getProjectOp = operation.query({
  id: 'projects.get',
  args: { id: v.id('projects') },
  scope: workspaceScope(),
  guard: projectRead,
  handler: async (ctx: WorkspaceQueryCtx, args: ProjectIdArgs): Promise<Doc<'projects'>> => {
    const appIdentity = await ctx.appIdentity()
    return loadResource(
      appIdentity,
      (await ctx.db.get(args.id)) as Doc<'projects'> | null,
      'Project',
    )
  },
})

export const get = query.protected(getProjectOp)

export const createProjectOp = operation.mutation({
  id: 'projects.create',
  args: createProject.args,
  scope: workspaceScope(),
  guard: projectCreate,
  handler: async (ctx: WorkspaceMutationCtx, args: CreateProjectArgs) => {
    const appIdentity = await ctx.appIdentity()

    const now = Date.now()
    const projectId = await ctx.db.insert('projects', {
      name: args.name,
      summary: args.summary,
      status: 'active',
      ownerId: appIdentity.userId,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.created',
      description: `Created project "${args.name}".`,
      createdAt: now,
    })

    return projectId
  },
})

export const create = mutation.protected(createProjectOp)

export const previewArchiveProject = mutation.protected(previewOf(archiveProjectOp))
export const archive = mutation.protected(archiveProjectOp)

export const exportProjectsOp = operation.query({
  id: 'projects.export',
  args: {},
  scope: workspaceScope(),
  guard: projectExport,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .collect()

    return projects.map((project) => project.name).join(', ')
  },
})

export const exportProjects = query.protected(exportProjectsOp)
