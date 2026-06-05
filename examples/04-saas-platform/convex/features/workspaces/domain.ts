import { operation } from '@lupinum/trellis/app'

import { createWorkspace } from '../../../shared/features/workspaces/contract'
import type { MutationCtx } from '../../_generated/server'
import type { ProjectBoardPrincipal } from '../../auth/caller'
import { mutation } from '../../functions'

type WorkspaceBootstrapMutationCtx = MutationCtx & {
  caller: () => Promise<ProjectBoardPrincipal>
}
type CreateWorkspaceArgs = { name: string; slug: string }

export const createWorkspaceOp = operation.mutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  handler: async (ctx: WorkspaceBootstrapMutationCtx, args: CreateWorkspaceArgs) => {
    const caller = await ctx.caller()
    if (caller.kind !== 'user') throw new Error('Workspace creation requires a signed-in user.')

    const existing = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first()

    if (existing) throw new Error('That workspace slug is already taken.')

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_key', (q) => q.eq('authKey', caller.authKey))
      .first()

    if (!user) throw new Error('Current user row not found.')

    const now = Date.now()
    const workspaceId = await ctx.db.insert('workspaces', {
      name: args.name,
      slug: args.slug,
      plan: 'free',
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(user._id, {
      workspaceId,
      role: 'owner',
      updatedAt: now,
    })

    return workspaceId
  },
})

export const createWorkspaceMutation = mutation.authenticated(createWorkspaceOp)
