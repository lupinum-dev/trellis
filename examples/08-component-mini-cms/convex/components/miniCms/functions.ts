import { defineTrellis } from '@lupinum/trellis/app'
import { defineCaller, getForwardedCaller } from '@lupinum/trellis/backend'
import {
  actionGeneric as generatedAction,
  mutationGeneric as generatedMutation,
  queryGeneric as generatedQuery,
} from 'convex/server'

import { env } from './_generated/server'
import { miniCmsPrincipalValidator, type MiniCmsPrincipal } from '../../../shared/caller'

export type MiniCmsActor =
  | { kind: 'viewer' }
  | { kind: 'editor'; authKey: string }
  | { kind: 'agent'; agentId: string }

export const caller = defineCaller({
  validator: miniCmsPrincipalValidator,
  resolve: async (_ctx, args): Promise<MiniCmsPrincipal> =>
    getForwardedCaller<MiniCmsPrincipal>(_ctx, args) ??
    ({ kind: 'anonymous', subject: 'system:anonymous' } satisfies MiniCmsPrincipal),
})

export async function getAppIdentityFromCaller(
  _ctx: unknown,
  _args: Record<string, unknown>,
  resolved: MiniCmsPrincipal,
): Promise<MiniCmsActor> {
  switch (resolved.kind) {
    case 'anonymous':
      return { kind: 'viewer' }
    case 'user':
      return { kind: 'editor', authKey: resolved.authKey }
    case 'agent':
      return { kind: 'agent', agentId: resolved.agentId }
  }
}

async function requirePublishIdentity(ctx: {
  appIdentity: () => Promise<MiniCmsActor | null>
}): Promise<Extract<MiniCmsActor, { kind: 'editor' | 'agent' }>> {
  const actor = await ctx.appIdentity()
  if (!actor || actor.kind === 'viewer') {
    throw new Error('Publish confirmation requires an editor or agent identity.')
  }
  return actor
}

export const { action, mutation, query, transportMutation } = defineTrellis(
  {
    action: generatedAction,
    query: generatedQuery,
    mutation: generatedMutation,
  },
  {
    caller,
    appIdentity: getAppIdentityFromCaller,
    identityForwardingKey: () => env.CONVEX_IDENTITY_FORWARDING_KEY,
    destructiveOperations: {
      confirmationTable: 'destructiveConfirmations',
      auditTable: 'destructiveAuditLog',
      previewConfirmation: {
        callerKey: async (ctx) => {
          const actor = await requirePublishIdentity(ctx)
          return actor.kind === 'editor' ? `editor:${actor.authKey}` : `agent:${actor.agentId}`
        },
        scopeKey: async (_ctx, args) => `page:${String(args.id)}`,
      },
    },
    trustedReplay: {
      table: 'trustedReplay',
    },
  },
)
