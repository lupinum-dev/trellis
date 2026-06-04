import {
  assertDelegationBinding,
  defineActingFor,
  getForwardedActingFor,
  getForwardedCaller,
  type DelegationBinding,
} from '@lupinum/trellis/backend'
import { deny } from '@lupinum/trellis/auth'
import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { v } from 'convex/values'

import type { DataModel, Id } from '../_generated/dataModel'
import type { McpReferencePrincipal } from './caller'

type McpReferenceCtx =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>

export type McpReferenceDelegation = DelegationBinding

export const mcpReferenceDelegationValidator = v.object({
  subject: v.string(),
  reason: v.optional(v.string()),
  grantedBy: v.optional(v.string()),
  grantSource: v.string(),
  issuer: v.string(),
  serviceId: v.string(),
  targetUserId: v.string(),
  workspaceId: v.string(),
  purpose: v.string(),
  expiresAt: v.number(),
  grantId: v.optional(v.string()),
  revocationVersion: v.optional(v.union(v.string(), v.number())),
})

export const actingFor = defineActingFor({
  validator: mcpReferenceDelegationValidator,
  resolve: async (ctx: McpReferenceCtx, args): Promise<McpReferenceDelegation | null> => {
    const forwarded = getForwardedActingFor<McpReferenceDelegation>(ctx, args)
    if (!forwarded) return null

    const caller = getForwardedCaller<McpReferencePrincipal>(ctx, args)
    if (!caller) {
      throw deny('Delegation binding requires a forwarded caller.')
    }
    if (!('db' in ctx)) {
      throw deny('Delegation binding requires a query or mutation context.')
    }

    if (caller.kind === 'agent') {
      const binding = assertDelegationBinding(forwarded, {
        serviceId: caller.agentId,
        purpose: 'mcp-session',
        grantSource: 'mcp-key-binding',
      })
      const key = await ctx.db.get(caller.agentId as Id<'mcpKeys'>)
      const user = await ctx.db.get(binding.targetUserId as Id<'users'>)
      if (
        !key ||
        key.status !== 'active' ||
        key.boundUserId !== binding.targetUserId ||
        key.boundWorkspaceId !== binding.workspaceId ||
        !user ||
        user.workspaceId !== binding.workspaceId
      ) {
        throw deny('MCP delegation binding is not valid for this key.')
      }

      return binding
    }

    if (caller.kind === 'service') {
      const expectedWorkspaceId =
        typeof args.workspaceId === 'string' ? (args.workspaceId as Id<'workspaces'>) : undefined
      const binding = assertDelegationBinding(forwarded, {
        serviceId: caller.serviceId,
        purpose: 'runbook-webhook:create',
        grantSource: 'workspace-service-policy',
        ...(expectedWorkspaceId ? { workspaceId: expectedWorkspaceId } : {}),
      })
      const user = await ctx.db.get(binding.targetUserId as Id<'users'>)
      if (!user || user.workspaceId !== binding.workspaceId) {
        throw deny('Webhook delegation binding is not valid for this workspace user.')
      }

      return binding
    }

    throw deny('Delegation binding requires an agent or service caller.')
  },
})
