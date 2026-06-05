import { operation } from '@lupinum/trellis/app'

import { createWorkspace } from '../../../shared/features/workspaces/contract'
import type { MutationCtx } from '../../_generated/server'
import { mutation } from '../../functions'

type WorkspaceBootstrapCtx = MutationCtx & {
  caller: () => Promise<{ kind: string; authKey?: string }>
}
type CreateWorkspaceArgs = { name: string; slug: string }

export const createWorkspaceOp = operation.mutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  handler: async (ctx: WorkspaceBootstrapCtx, args: CreateWorkspaceArgs) => {
    const caller = await ctx.caller()
    if (caller.kind !== 'user' || !caller.authKey) {
      throw new Error('Workspace creation requires a signed-in user.')
    }
    const authKey = caller.authKey

    const existing = await ctx.db
      .query('workspaces')
      .withIndex('by_slug', (q) => q.eq('slug', args.slug))
      .first()
    if (existing) throw new Error('That workspace slug is already taken.')

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_key', (q) => q.eq('authKey', authKey))
      .first()
    if (!user) throw new Error('Current user row not found.')

    const now = Date.now()
    const workspaceId = await ctx.db.insert('workspaces', {
      name: args.name,
      slug: args.slug,
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
