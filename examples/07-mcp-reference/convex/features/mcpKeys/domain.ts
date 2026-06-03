import { operation, workspaceScope } from '@lupinum/trellis/app'
import { deny } from '@lupinum/trellis/auth'
import type { GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { v } from 'convex/values'

import { createMcpKey, revokeMcpKey } from '../../../shared/features/mcpKeys/contract'
import type { DataModel, Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'
import { canIssueKeyRole } from './checks'
import { mcpManage } from './permissions'

const TOUCH_DEBOUNCE_MS = 60_000

type BoundUser = Pick<
  Doc<'users'>,
  '_id' | 'authKey' | 'displayName' | 'email' | 'role' | 'workspaceId'
>
type McpKeyDoc = Doc<'mcpKeys'>
type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>
type KeyUsability = 'usable' | 'revoked' | 'bound_user_missing' | 'bound_user_workspace_mismatch'
type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<AppIdentity>
}
type CreateMcpKeyArgs = {
  name: string
  boundUserId: Id<'users'>
  prefix: string
  hash: string
}
type RevokeMcpKeyArgs = { id: Id<'mcpKeys'> }
type ValidateMcpKeyArgs = { hash: string }

async function getBoundUser(ctx: Ctx, boundUserId: Id<'users'>): Promise<BoundUser | null> {
  const user = await ctx.db.get(boundUserId)

  return user ?? null
}

function getKeyUsability(key: McpKeyDoc, boundUser: BoundUser | null): KeyUsability {
  if (key.status === 'revoked') return 'revoked'
  if (!boundUser?.workspaceId) return 'bound_user_missing'
  if (boundUser.workspaceId !== key.boundWorkspaceId) return 'bound_user_workspace_mismatch'
  return 'usable'
}

function toListedKey(key: McpKeyDoc, boundUser: BoundUser | null) {
  return {
    _id: key._id,
    _creationTime: key._creationTime,
    name: key.name,
    prefix: key.prefix,
    boundUserId: key.boundUserId,
    boundWorkspaceId: key.boundWorkspaceId,
    issuedByUserId: key.issuedByUserId,
    status: key.status,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    effectiveRole: boundUser?.role ?? null,
    usability: getKeyUsability(key, boundUser),
    boundUser: boundUser
      ? {
          userId: boundUser._id,
          authKey: boundUser.authKey,
          displayName: boundUser.displayName ?? null,
          email: boundUser.email ?? null,
          role: boundUser.role,
        }
      : null,
  }
}

export const listMcpKeysOp = operation.query({
  id: 'mcpKeys.list',
  guard: mcpManage,
  args: {},
  scope: workspaceScope(),
  handler: async (ctx: WorkspaceQueryCtx) => {
    const keys = await ctx.db
      .query('mcpKeys')
      .withIndex('by_bound_workspace', (q) => q.eq('boundWorkspaceId', ctx.workspaceId))
      .order('desc')
      .collect()

    return await Promise.all(
      keys.map(async (key) => toListedKey(key, await getBoundUser(ctx, key.boundUserId))),
    )
  },
})

export const list = query.protected(listMcpKeysOp)

export const createMcpKeyOp = operation.mutation({
  id: 'mcpKeys.create',
  guard: mcpManage,
  args: createMcpKey.args,
  scope: workspaceScope(),
  handler: async (ctx: WorkspaceMutationCtx, args: CreateMcpKeyArgs) => {
    const appIdentity = await ctx.appIdentity()

    const boundUser = await getBoundUser(ctx, args.boundUserId)
    if (!boundUser?.workspaceId || boundUser.workspaceId !== ctx.workspaceId) {
      throw deny('You can only issue MCP keys for users in your workspace.')
    }
    if (!canIssueKeyRole(appIdentity, boundUser.role)) {
      throw deny('You cannot issue an MCP key for that user.')
    }

    return await ctx.db.insert('mcpKeys', {
      name: args.name,
      prefix: args.prefix,
      hash: args.hash,
      boundUserId: boundUser._id,
      boundWorkspaceId: ctx.workspaceId,
      issuedByUserId: appIdentity.userId as Id<'users'>,
      status: 'active',
      createdAt: Date.now(),
    })
  },
})

export const create = mutation.protected(createMcpKeyOp)

export const revokeMcpKeyOp = operation.mutation({
  id: 'mcpKeys.revoke',
  guard: mcpManage,
  args: revokeMcpKey.args,
  scope: workspaceScope(),
  handler: async (ctx: WorkspaceMutationCtx, args: RevokeMcpKeyArgs) => {
    const appIdentity = await ctx.appIdentity()

    const rawKey = await ctx.db.get(args.id)
    if (!rawKey || rawKey.boundWorkspaceId !== ctx.workspaceId) {
      throw deny('MCP key not found.')
    }

    const boundUser = await getBoundUser(ctx, rawKey.boundUserId)
    if (
      boundUser?.workspaceId &&
      boundUser.workspaceId === rawKey.boundWorkspaceId &&
      !canIssueKeyRole(appIdentity, boundUser.role)
    ) {
      throw deny('You cannot revoke an MCP key for that user.')
    }

    await ctx.db.patch(args.id, {
      status: 'revoked',
      revokedAt: Date.now(),
    })
  },
})

export const revoke = mutation.protected(revokeMcpKeyOp)

export const validateMcpKeyOp = operation.query({
  id: 'mcpKeys.validate',
  args: {
    hash: createMcpKey.args.hash,
  },
  handler: async (ctx: QueryCtx, args: ValidateMcpKeyArgs) => {
    const key = await ctx.db
      .query('mcpKeys')
      .withIndex('by_hash', (q) => q.eq('hash', args.hash))
      .first()

    if (!key || key.status !== 'active') return null
    const boundUser = await getBoundUser(ctx, key.boundUserId)
    if (!boundUser?.workspaceId || boundUser.workspaceId !== key.boundWorkspaceId) return null

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
  handler: async (ctx: MutationCtx, args: ValidateMcpKeyArgs) => {
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
