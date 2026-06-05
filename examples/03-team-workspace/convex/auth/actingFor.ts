import { deny } from '@lupinum/trellis/auth'
import {
  assertDelegationBinding,
  defineActingFor,
  getForwardedActingFor,
  type DelegationBinding,
} from '@lupinum/trellis/backend'
import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from 'convex/server'
import { v } from 'convex/values'

import type { DataModel, Id } from '../_generated/dataModel'

type TeamTodoCtx =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>
  | GenericActionCtx<DataModel>

export type TeamTodoDelegation = DelegationBinding

export const teamTodoDelegationValidator = v.object({
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
  validator: teamTodoDelegationValidator,
  resolve: async (ctx: TeamTodoCtx, args): Promise<TeamTodoDelegation | null> => {
    const forwarded = getForwardedActingFor<TeamTodoDelegation>(ctx, args)
    if (!forwarded) return null

    const expectedWorkspaceId = typeof args.workspaceId === 'string' ? args.workspaceId : undefined
    const binding = assertDelegationBinding(forwarded, {
      serviceId: 'todo-sync-webhook',
      ...(expectedWorkspaceId ? { workspaceId: expectedWorkspaceId } : {}),
      purpose: 'todo-sync-webhook',
      grantSource: 'workspace-service-policy',
    })

    if (!('db' in ctx)) {
      throw deny('Delegation binding requires a query or mutation context.')
    }

    const user = await ctx.db.get(binding.targetUserId as Id<'users'>)
    if (!user || user.workspaceId !== binding.workspaceId) {
      throw deny('Delegation binding is not valid for this workspace user.')
    }

    return binding
  },
})
