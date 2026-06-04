/**
 * Why this file exists:
 * It proves the MCP reference webhook lane without route-owned authorization:
 * the route verifies the external delivery and forwards binding evidence; the
 * Convex mutation revalidates the user/workspace/service binding and owns
 * idempotency with the runbook write.
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

type RunbookWebhookBody = {
  workspaceId?: string
  targetUserId?: string
  title?: string
  summary?: string
  content?: string
  visibility?: 'public' | 'workspace' | 'draft'
  tags?: string[]
}

function getWebhookSecret(): string {
  const secret = process.env.MCP_REFERENCE_WEBHOOK_SECRET?.trim()
  if (!secret) {
    throw createError({
      statusCode: 500,
      message: 'MCP_REFERENCE_WEBHOOK_SECRET is required for the runbook webhook example.',
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
      const parsed = JSON.parse(String(value)) as RunbookWebhookBody
      if (
        !parsed.workspaceId ||
        !parsed.targetUserId ||
        !parsed.title ||
        !parsed.summary ||
        !parsed.content
      ) {
        throw createError({
          statusCode: 400,
          message: 'workspaceId, targetUserId, title, summary, and content are required.',
        })
      }

      return parsed as Required<
        Pick<
          RunbookWebhookBody,
          'workspaceId' | 'targetUserId' | 'title' | 'summary' | 'content'
        >
      > &
        RunbookWebhookBody
    },
  })
  const body = delivery.body
  const target = api.features.runbooks.webhooks.createRunbookFromWebhookMutation
  const actingFor = requireDelegationBinding({
    serviceId: 'runbook-webhook',
    targetUserId: body.targetUserId,
    workspaceId: body.workspaceId,
    purpose: 'runbook-webhook:create',
    grantSource: 'workspace-service-policy',
    grantId: `delivery:${delivery.id}`,
    expiresAt: Date.now() + 5 * 60 * 1000,
    reason: 'HMAC verified runbook webhook',
  })

  const runbookId = await serverConvexMutation(
    event,
    target,
    {
      deliveryId: delivery.id,
      workspaceId: body.workspaceId as Id<'workspaces'>,
      title: body.title,
      summary: body.summary,
      content: body.content,
      ...(body.visibility ? { visibility: body.visibility } : {}),
      ...(body.tags ? { tags: body.tags } : {}),
    },
    {
      auth: transportProof.webhook({
        caller: {
          kind: 'service',
          serviceId: 'runbook-webhook',
          subject: 'service:runbook-webhook',
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
    runbookId,
  }
})
