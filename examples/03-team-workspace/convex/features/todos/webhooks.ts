import { operation } from '@lupinum/trellis/app'
import { can, deny, requireAuth } from '@lupinum/trellis/auth'

import { processTodoSyncWebhook as processTodoSyncWebhookContract } from '../../../shared/features/todos/contract'
import type { Id } from '../../_generated/dataModel'
import { processDomainIdempotentEvent } from '../../auth/idempotency'
import { mutation } from '../../functions'
import { todoCreate } from './permissions'

export const processTodoSyncWebhookOp = operation.mutation({
  id: 'todos.process-sync-webhook',
  args: processTodoSyncWebhookContract.args,
  executeFunctionRef: 'features/todos/webhooks:processTodoSyncWebhookMutation',
  identityForwardingTransport: 'webhook',
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)
    if (appIdentity.workspaceId !== (args.workspaceId as Id<'workspaces'>)) {
      throw deny('Not available.')
    }
    if (!can(appIdentity, todoCreate.check)) {
      throw deny('Forbidden: Create todo')
    }

    return await processDomainIdempotentEvent(
      ctx.db,
      {
        source: 'webhook',
        eventId: args.eventId,
        workspaceId: args.workspaceId,
      },
      async () => {
        return await ctx.db.insert('todos', {
          title: args.title,
          completed: args.completed ?? false,
          ownerId: appIdentity.userId,
          workspaceId: args.workspaceId,
          source: 'webhook',
          externalId: args.externalId,
          createdAt: Date.now(),
        })
      },
    )
  },
})

export const processTodoSyncWebhookMutation = mutation.authenticated(processTodoSyncWebhookOp)
