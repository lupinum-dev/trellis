import { operation } from '@lupinum/trellis/app'
import { deny } from '@lupinum/trellis/auth'

import { processTodoSyncWebhook as processTodoSyncWebhookContract } from '../../../shared/features/todos/contract'
import type { Id } from '../../_generated/dataModel'
import { ensureNotProcessed, markProcessed } from '../../auth/idempotency'
import { mutation } from '../../functions'
import { todoCreate } from './permissions'

export const processTodoSyncWebhookOp = operation.mutation({
  id: 'todos.process-sync-webhook',
  args: processTodoSyncWebhookContract.args,
  identityForwardingFunctionRef: 'features/todos/webhooks:processTodoSyncWebhookMutation',
  identityForwardingTransport: 'webhook',
  guard: todoCreate,
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()
    if (
      !appIdentity?.workspaceId ||
      appIdentity.workspaceId !== (args.workspaceId as Id<'workspaces'>)
    ) {
      throw deny('Not available.')
    }

    await ensureNotProcessed(ctx.db, 'webhook', args.eventId, args.workspaceId)

    const todoId = await ctx.db.insert('todos', {
      title: args.title,
      completed: args.completed ?? false,
      ownerId: appIdentity.userId,
      workspaceId: args.workspaceId,
      source: 'webhook',
      externalId: args.externalId,
      createdAt: Date.now(),
    })

    await markProcessed(ctx.db, args.eventId, 'webhook', args.workspaceId)

    return todoId
  },
})

export const processTodoSyncWebhookMutation = mutation.protected(processTodoSyncWebhookOp)
