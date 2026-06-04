/**
 * Why this file exists:
 * It proves the 0.3 webhook lane: verify the external delivery, forward a
 * short-lived service/user delegation binding, and let Convex revalidate the
 * user/workspace binding plus domain idempotency in one mutation.
 */
import { createError, defineEventHandler } from 'h3'

import {
  domainIdempotency,
  requireDelegationBinding,
  serverConvexMutation,
  transportProof,
  verifyHmacWebhookDelivery,
} from '#trellis/server'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type WebhookBody = {
  workspaceId?: string
  targetUserId?: string
  eventId?: string
  title?: string
  completed?: boolean
  externalId?: string
}

function getWebhookSecret(): string {
  const secret = process.env.TEAM_TODO_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw createError({
      statusCode: 500,
      message: 'TEAM_TODO_WEBHOOK_SECRET is required for the webhook example.',
    })
  }

  return secret
}

export default defineEventHandler(async (event) => {
  const delivery = await verifyHmacWebhookDelivery(event, {
    signatureHeader: 'x-example-signature',
    timestampHeader: 'x-example-timestamp',
    deliveryIdHeader: 'x-example-delivery-id',
    secret: getWebhookSecret(),
    parse: (value) => {
      const parsed = JSON.parse(String(value)) as WebhookBody
      if (!parsed.workspaceId || !parsed.targetUserId || !parsed.eventId || !parsed.title) {
        throw createError({
          statusCode: 400,
          message: 'workspaceId, targetUserId, eventId, and title are required.',
        })
      }

      return parsed as Required<
        Pick<WebhookBody, 'workspaceId' | 'targetUserId' | 'eventId' | 'title'>
      > &
        WebhookBody
    },
  })
  const body = delivery.body
  const target = api.features.todos.webhooks.processTodoSyncWebhookMutation
  const actingFor = requireDelegationBinding({
    serviceId: 'todo-sync-webhook',
    targetUserId: body.targetUserId,
    workspaceId: body.workspaceId,
    purpose: 'todo-sync-webhook',
    grantSource: 'workspace-service-policy',
    grantId: `delivery:${delivery.id}`,
    expiresAt: Date.now() + 5 * 60 * 1000,
    reason: 'HMAC verified todo sync webhook',
  })

  const todoId = await serverConvexMutation(
    event,
    target,
    {
      workspaceId: body.workspaceId as Id<'workspaces'>,
      eventId: body.eventId,
      title: body.title,
      ...(body.completed !== undefined ? { completed: body.completed } : {}),
      ...(body.externalId ? { externalId: body.externalId } : {}),
    },
    {
      auth: transportProof.webhook({
        caller: {
          kind: 'service',
          serviceId: 'todo-sync-webhook',
          subject: 'service:todo-sync-webhook',
        },
        actingFor,
        replay: domainIdempotency({
          key: delivery.id,
          target,
        }),
      }),
    },
  )

  return {
    ok: true,
    todoId,
  }
})
