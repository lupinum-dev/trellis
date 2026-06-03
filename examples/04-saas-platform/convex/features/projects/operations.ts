import {
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  workspaceScope,
} from '@lupinum/trellis/app'
import { deny, requireRecord } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { archiveProject } from '../../../shared/features/projects/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { projectArchive } from './permissions'

type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type ArchiveProjectArgs = { id: Id<'projects'> }

export const archiveProjectOp = operation.destructive({
  id: 'projects.archive',
  identityForwardingFunctionRef: 'features/projects/domain:archive',
  args: archiveProject.args,
  returns: v.null(),
  scope: workspaceScope(),
  guard: projectArchive,
  permission: projectArchive,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('projects.archive'),
      targetId: v.id('projects'),
      affectedCounts: v.object({
        projects: v.number(),
      }),
    }),
  }),
  load: async (
    ctx: WorkspaceMutationCtx,
    args: ArchiveProjectArgs,
  ): Promise<{ project: Doc<'projects'> }> => {
    const project = await ctx.db.get(args.id)
    requireRecord(project, 'Project')
    return { project: project as Doc<'projects'> }
  },
  preview: async (
    _ctx: WorkspaceMutationCtx,
    _args: ArchiveProjectArgs,
    loaded: { project: Doc<'projects'> },
  ) =>
    operationPreview({
      summary: `Will archive "${loaded.project.name}".`,
      warnings: [
        operationIssue({
          code: 'archive-project',
          message: 'Archived projects stop accepting new tasks.',
        }),
      ],
      effects: [operationEffect({ kind: 'projects', summary: 'Projects archived', count: 1 })],
      confirm: {
        operation: 'projects.archive',
        targetId: loaded.project._id,
        affectedCounts: { projects: 1 },
      },
    }),
  handler: async (
    ctx: WorkspaceMutationCtx,
    args: ArchiveProjectArgs,
    loaded: { project: Doc<'projects'> },
  ) => {
    const appIdentity = await ctx.appIdentity()

    if (loaded.project.status === 'archived') throw deny('Project is already archived.')

    const now = Date.now()
    await ctx.db.patch(args.id, {
      status: 'archived',
      updatedAt: now,
    })

    await ctx.db.insert('auditEvents', {
      workspaceId: ctx.workspaceId,
      actorId: appIdentity.userId,
      entityType: 'project',
      entityId: args.id,
      action: 'project.archived',
      description: `Archived "${loaded.project.name}".`,
      createdAt: now,
    })

    return null
  },
})
