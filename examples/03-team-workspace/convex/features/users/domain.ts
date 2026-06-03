import { operation } from '@lupinum/trellis/app'

/**
 * Why this file exists:
 * The MCP demo middleware resolves `Bearer demo:<email>` into a real app user by calling this query.
 * That keeps the example's MCP auth setup tiny while still forwarding only transport identity into Convex.
 */
import { resolveMcpUserByEmail } from '../../../shared/features/users/contract'
import type { QueryCtx } from '../../_generated/server'
import { query } from '../../functions'

export const resolveMcpUserByEmailOp = operation.query({
  id: 'users.resolve-mcp-user-by-email',
  args: resolveMcpUserByEmail.args,
  handler: async (ctx: QueryCtx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first()

    if (!user || !user.workspaceId) {
      return null
    }

    return {
      userId: user._id,
    }
  },
})

export const resolveMcpUserByEmailQuery = query.public(resolveMcpUserByEmailOp)
