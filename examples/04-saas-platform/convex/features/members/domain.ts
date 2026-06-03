import { operation, workspaceScope } from '@lupinum/trellis/app'

import { listMembers } from '../../../shared/features/members/contract'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { query } from '../../functions'
import { projectRead } from '../projects'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}

export const listMembersOp = operation.query({
  id: 'members.list',
  args: listMembers.args,
  scope: workspaceScope(),
  guard: projectRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const users = await ctx.db.query('users').order('asc').collect()
    return users.filter((user) => user.workspaceId === ctx.workspaceId)
  },
})

export const list = query.protected(listMembersOp)
