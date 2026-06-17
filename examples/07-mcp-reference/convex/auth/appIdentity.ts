import { deny, getAuth, getSubjectValue, type DefaultAppIdentity } from '@lupinum/trellis/auth'
import { assertDelegationBinding, type ActingFor } from '@lupinum/trellis/backend'
import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from 'convex/server'

import type { DataModel, Id } from '../_generated/dataModel'
import type { McpReferencePrincipal, Role } from './caller'

type McpReferenceCtx =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>

export type AccessIdentity = DefaultAppIdentity & {
  role: Role
  workspaceId?: Id<'workspaces'>
  email?: string | null
  displayName?: string | null
}

export type AppIdentity = AccessIdentity

type ForwardedIdentityCtx = McpReferenceCtx & {
  caller: () => Promise<McpReferencePrincipal>
  actingFor: () => Promise<ActingFor | null>
}

function hasForwardedIdentity(ctx: McpReferenceCtx): ctx is ForwardedIdentityCtx {
  return 'caller' in ctx && typeof ctx.caller === 'function'
}

async function loadUserActorByAuthKey(
  ctx: McpReferenceCtx,
  authKey: string,
): Promise<AccessIdentity | null> {
  if (!('db' in ctx)) {
    throw new Error('MCP reference appIdentity resolution requires a query or mutation context.')
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_auth_key', (q: any) => q.eq('authKey', authKey))
    .first()

  if (!user) return null

  return {
    kind: 'user',
    userId: user._id,
    authKey: user.authKey,
    role: user.role as Role,
    workspaceId: user.workspaceId as Id<'workspaces'> | undefined,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
  }
}

async function loadUserActorByUserId(
  ctx: McpReferenceCtx,
  userId: string,
): Promise<AccessIdentity | null> {
  if (!('db' in ctx)) {
    throw new Error('MCP reference appIdentity resolution requires a query or mutation context.')
  }

  const user = await ctx.db.get('users', userId as Id<'users'>)
  if (!user) return null

  return {
    kind: 'user',
    userId: user._id,
    authKey: user.authKey,
    role: user.role as Role,
    workspaceId: user.workspaceId as Id<'workspaces'> | undefined,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
  }
}

function getDelegatedUserId(actingFor: ActingFor | null): string | null {
  return getSubjectValue(actingFor?.subject, 'user')
}

function getAuthKeyFromPrincipal(caller: McpReferencePrincipal): string | null {
  if (caller.kind !== 'user') return null
  return caller.authKey
}

async function resolveAccessIdentityFromCaller(
  ctx: McpReferenceCtx,
  caller: McpReferencePrincipal,
  actingFor: ActingFor | null,
): Promise<AccessIdentity | null> {
  // When a non-user caller acts for a user, permissions resolve as that user.
  const delegatedUserId = getDelegatedUserId(actingFor)
  if (delegatedUserId) {
    const delegatedActor = await loadUserActorByUserId(ctx, delegatedUserId)
    if (caller.kind === 'agent') {
      const binding = assertDelegationBinding(actingFor, {
        serviceId: caller.agentId,
      })
      if (!delegatedActor || delegatedActor.workspaceId !== binding.workspaceId) {
        throw deny('Delegation binding is not valid for this MCP caller.')
      }
    }
    if (caller.kind === 'service') {
      const binding = assertDelegationBinding(actingFor, {
        serviceId: caller.serviceId,
      })
      if (!delegatedActor || delegatedActor.workspaceId !== binding.workspaceId) {
        throw deny('Delegation binding is not valid for this service caller.')
      }
    }
    return delegatedActor
  }

  // Browser-style calls resolve directly from the user caller.
  const directAuthKey = getAuthKeyFromPrincipal(caller)
  if (!directAuthKey) return null

  return await loadUserActorByAuthKey(ctx, directAuthKey)
}

export async function getAppIdentityFromCaller(
  ctx: McpReferenceCtx,
  _args: Record<string, unknown>,
  caller: McpReferencePrincipal,
  actingFor: ActingFor | null,
): Promise<AppIdentity | null> {
  return await resolveAccessIdentityFromCaller(ctx, caller, actingFor)
}

export async function getAccessIdentity(ctx: McpReferenceCtx): Promise<AccessIdentity | null> {
  // Backend handlers may expose caller/actingFor accessors, so prefer those
  // over raw browser auth when they are available.
  if (hasForwardedIdentity(ctx)) {
    const caller = await ctx.caller()
    const actingFor = await ctx.actingFor()
    return await resolveAccessIdentityFromCaller(ctx, caller, actingFor)
  }

  // Access context queries can still run outside the backend handler
  // surface, so fall back to the signed-in browser user identity there.
  const auth = await getAuth(ctx)
  if (!auth) return null
  return await loadUserActorByAuthKey(ctx, auth.authKey)
}

export async function getAppIdentity(ctx: McpReferenceCtx): Promise<AppIdentity | null> {
  return await getAccessIdentity(ctx)
}
