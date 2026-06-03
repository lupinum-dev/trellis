import { operation, workspaceScope } from '@lupinum/trellis/app'

import { listMembers as listMembersArgs } from '../../../shared/features/memberships/contract'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { query } from '../../functions'
import { membershipRead } from './permissions'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}

export const listMembersOp = operation.query({
  id: 'memberships.list',
  args: listMembersArgs.args,
  scope: workspaceScope(),
  guard: membershipRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .collect()

    return Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)

        return {
          _id: membership._id,
          userId: membership.userId,
          role: membership.role,
          displayName: user?.displayName ?? null,
          email: user?.email ?? null,
        }
      }),
    )
  },
})

export const listMembers = query.protected(listMembersOp)
