import { operation } from '@lupinum/trellis/app'
import { v } from 'convex/values'

import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { mutation, query } from '../../functions'

const TOUCH_DEBOUNCE_MS = 60_000

export const validateMcpKeyOp = operation.query({
  id: 'mcpKeys.validate',
  args: {
    hash: v.string(),
  },
  handler: async (ctx, args) => {
    const reader = ctx.db as QueryCtx['db']
    const key = await reader
      .query('mcpKeys')
      .withIndex('by_hash', (q) => q.eq('hash', args.hash))
      .first()

    if (!key || key.status !== 'active') return null
    const boundUser = await reader.get(key.boundUserId)

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

export const validate = query.public({ ...validateMcpKeyOp, reads: ['mcpKeys', 'users'] })

export const touchMcpKeyOp = operation.publicMutation({
  id: 'mcpKeys.touch',
  args: {
    hash: v.string(),
  },
  publicWrite: {
    reason: 'The MCP bearer middleware records debounced key usage after validation.',
    tables: ['mcpKeys'],
    access: ({ db }) => {
      const writer = db as MutationCtx['db']
      return {
        touch: async (id: Id<'mcpKeys'>, lastUsedAt: number) => {
          await writer.patch(id, { lastUsedAt })
        },
      }
    },
  },
  handler: async (ctx, args) => {
    const reader = ctx.db as QueryCtx['db']
    const key = await reader
      .query('mcpKeys')
      .withIndex('by_hash', (q) => q.eq('hash', args.hash))
      .first()
    if (!key || key.status !== 'active') return

    const now = Date.now()
    const lastUsedAt = typeof key.lastUsedAt === 'number' ? key.lastUsedAt : 0
    if (now - lastUsedAt < TOUCH_DEBOUNCE_MS) return

    await ctx.publicWrite.touch(key._id, now)
  },
})

export const touch = mutation.public(touchMcpKeyOp)
