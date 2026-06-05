import { operation } from '@lupinum/trellis/app'

import { createWorkspace } from '../../../shared/features/workspaces/contract'
import type { MutationCtx } from '../../_generated/server'
import type { WorkspaceCaller } from '../../auth/caller'
import { mutation } from '../../functions'

type WorkspaceBootstrapCtx = MutationCtx & {
  caller: () => Promise<WorkspaceCaller>
}

export const createWorkspaceOp = operation.mutation({
  id: 'workspaces.create',
  args: createWorkspace.args,
  handler: async (ctx: WorkspaceBootstrapCtx, args) => {
    const caller = await ctx.caller()
    if (caller.kind !== 'user') {
      throw new Error('Workspace creation requires a user caller.')
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_auth_key', (q) => q.eq('authKey', caller.authKey))
      .first()

    if (!user) {
      throw new Error('Current user row not found.')
    }

    const now = Date.now()
    const workspaceId = await ctx.db.insert('workspaces', {
      name: args.name,
      createdAt: now,
    })

    await ctx.db.patch(user._id, {
      role: 'owner',
      workspaceId,
      updatedAt: now,
    })

    return workspaceId
  },
})

export const createWorkspaceMutation = mutation.authenticated(createWorkspaceOp)
