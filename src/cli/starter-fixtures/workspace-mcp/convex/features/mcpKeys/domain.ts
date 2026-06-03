import { operation } from '@lupinum/trellis/app'
import { v } from 'convex/values'

import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { mutation, query } from '../../functions'

const TOUCH_DEBOUNCE_MS = 60_000

export const validateMcpKeyOp = operation.query({
  id: 'mcpKeys.validate',
  args: {
    hash: v.string(),
  },
  handler: async (ctx: QueryCtx, args) => {
    const key = await ctx.db
      .query('mcpKeys')
      .withIndex('by_hash', (q) => q.eq('hash', args.hash))
      .first()

    if (!key || key.status !== 'active') return null
    const boundUser = await ctx.db.get(key.boundUserId)

    if (!boundUser?.workspaceId || boundUser.workspaceId !== key.boundWorkspaceId) return null
    if (!boundUser.role) return null

    return {
      id: key._id,
      role: boundUser.role,
      userId: boundUser._id,
      workspaceId: boundUser.workspaceId,
      lastUsedAt: key.lastUsedAt ?? null,
    }
  },
})

export const validate = query.public(validateMcpKeyOp)

export const touchMcpKeyOp = operation.mutation({
  id: 'mcpKeys.touch',
  args: {
    hash: v.string(),
  },
  handler: async (ctx: MutationCtx, args) => {
    const key = await ctx.db
      .query('mcpKeys')
      .withIndex('by_hash', (q) => q.eq('hash', args.hash))
      .first()
    if (!key || key.status !== 'active') return

    const now = Date.now()
    const lastUsedAt = typeof key.lastUsedAt === 'number' ? key.lastUsedAt : 0
    if (now - lastUsedAt < TOUCH_DEBOUNCE_MS) return

    await ctx.db.patch(key._id, {
      lastUsedAt: now,
    })
  },
})

export const touch = mutation.public(touchMcpKeyOp)
