import { operation } from '@lupinum/trellis/app'
import { sha256 } from '@noble/hashes/sha2.js'
import { v } from 'convex/values'

import type { Id } from './_generated/dataModel'
import { mutation as generatedMutation, query as generatedQuery } from './_generated/server'
import { canInviteMembers } from './auth/checks'
import { mcpKeyManagePermission } from './auth/permissions'
import { loadResource } from './auth/scope'
import { mutation, query } from './functions'

function hashKey(key: string): string {
  const bytes = sha256(new TextEncoder().encode(key))
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function generateKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'mcp_'
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function resolveIncomingKeyHash(input: { key?: string; keyHash?: string }): string {
  if (typeof input.keyHash === 'string' && input.keyHash.length > 0) {
    return input.keyHash
  }

  if (typeof input.key === 'string' && input.key.length > 0) {
    return hashKey(input.key)
  }

  throw new Error('Expected key or keyHash.')
}

export const list = query.authenticated({
  id: 'mcpKeys:list',
  args: {},
  handler: async (ctx) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity?.workspaceId) return []

    return await ctx.db
      .query('mcpKeys')
      .withIndex('by_organization', (q) =>
        q.eq('organizationId', appIdentity.workspaceId as Id<'organizations'>),
      )
      .order('desc')
      .collect()
  },
})

export const createMcpKeyOp = operation.mutation({
  id: 'mcp-keys.create',
  args: {
    name: v.string(),
    role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member'), v.literal('viewer')),
  },
  permission: mcpKeyManagePermission,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity.workspaceId || !canInviteMembers(appIdentity)) {
      throw new Error('Cannot create MCP keys in this workspace.')
    }

    const key = generateKey()
    const keyHash = hashKey(key)
    const prefix = key.slice(0, 12) + '...'

    const id = await ctx.db.insert('mcpKeys', {
      name: args.name,
      keyHash,
      prefix,
      role: args.role,
      userId: appIdentity.userId,
      organizationId: appIdentity.workspaceId as Id<'organizations'>,
      status: 'active',
      createdAt: Date.now(),
    })

    return { id, key }
  },
})

export const create = mutation.workspace(createMcpKeyOp)

export const revokeMcpKeyOp = operation.mutation({
  id: 'mcp-keys.revoke',
  args: { id: v.id('mcpKeys') },
  permission: mcpKeyManagePermission,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    if (!appIdentity.workspaceId || !canInviteMembers(appIdentity)) {
      throw new Error('Cannot revoke MCP keys in this workspace.')
    }
    loadResource(appIdentity, await ctx.db.get(args.id), 'MCP key')

    await ctx.db.patch(args.id, {
      status: 'revoked',
      revokedAt: Date.now(),
    })
  },
})

export const revoke = mutation.workspace(revokeMcpKeyOp)

export const validate = generatedQuery({
  args: {
    key: v.optional(v.string()),
    keyHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const keyHash = resolveIncomingKeyHash(args)
    const mcpKey = await ctx.db
      .query('mcpKeys')
      .withIndex('by_key_hash', (q) => q.eq('keyHash', keyHash))
      .first()

    if (!mcpKey || mcpKey.status !== 'active') return null

    return {
      id: mcpKey._id,
      role: mcpKey.role,
      userId: mcpKey.userId,
      workspaceId: mcpKey.organizationId ?? null,
    }
  },
})

export const touch = generatedMutation({
  args: {
    key: v.optional(v.string()),
    keyHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const keyHash = resolveIncomingKeyHash(args)
    const mcpKey = await ctx.db
      .query('mcpKeys')
      .withIndex('by_key_hash', (q) => q.eq('keyHash', keyHash))
      .first()

    if (mcpKey && mcpKey.status === 'active') {
      await ctx.db.patch(mcpKey._id, { lastUsedAt: Date.now() })
    }
  },
})
