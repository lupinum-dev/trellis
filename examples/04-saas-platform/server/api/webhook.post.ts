/**
 * Why this file exists:
 * Nitro routes often need to accept verified external requests, validate the payload, and then
 * hand work to a narrow internal Convex entrypoint.
 *
 * This example intentionally stops at the route-owned boundary. Example 07 shows the fuller
 * identity-forwarding model where a service caller and delegated user flow through the protected
 * root refs themselves.
 */
import { createError, defineEventHandler } from 'h3'

import { serverConvexMutation, verifyHmacWebhookDelivery } from '#trellis/server'

import { internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type WebhookBody = {
  projectId?: string
  title?: string
  priority?: 'low' | 'medium' | 'high'
}

function getWebhookSecret(): string {
  const secret = process.env.PROJECT_BOARD_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw createError({
      statusCode: 500,
      message: 'PROJECT_BOARD_WEBHOOK_SECRET is required for the webhook example.',
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
      if (!parsed.projectId || !parsed.title) {
        throw createError({
          statusCode: 400,
          message: 'projectId and title are required.',
        })
      }

      return parsed as Required<Pick<WebhookBody, 'projectId' | 'title'>> & WebhookBody
    },
  })
  const body = delivery.body

  const taskId = await serverConvexMutation(
    event,
    internal.features.tasks.webhooks.createTaskFromWebhookMutation,
    {
      deliveryId: delivery.id,
      projectId: body.projectId as Id<'projects'>,
      title: body.title,
      priority: body.priority ?? 'medium',
    },
    { auth: 'none' },
  )

  return {
    ok: true,
    taskId,
  }
})
