import { operation, workspaceScope } from '@lupinum/trellis/app'

import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { query } from '../../functions'
import { canIssueKeyRole, mcpManage } from '../mcpKeys'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type PublicQueryCtx = QueryCtx & {
  appIdentity: () => Promise<AppIdentity | null>
}

export const getCurrentUserOp = operation.query({
  id: 'users.current',
  args: {},
  handler: async (ctx: PublicQueryCtx) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity) return null

    return await ctx.db.get(appIdentity.userId as Id<'users'>)
  },
})

export const getCurrentUser = query.public(getCurrentUserOp)

export const listWorkspaceUsersForMcpKeysOp = operation.query({
  id: 'users.list-for-mcp-keys',
  guard: mcpManage,
  args: {},
  scope: workspaceScope(),
  handler: async (ctx: WorkspaceQueryCtx) => {
    const appIdentity = await ctx.appIdentity()

    const users = await ctx.db.query('users').collect()

    return users
      .filter((user) => user.workspaceId === ctx.workspaceId)
      .filter((user) => canIssueKeyRole(appIdentity, user.role))
      .map((user) => ({
        userId: user._id,
        authKey: user.authKey,
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        role: user.role,
      }))
  },
})

export const listWorkspaceUsersForMcpKeys = query.protected(listWorkspaceUsersForMcpKeysOp)
