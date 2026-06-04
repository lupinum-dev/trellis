import { describe, expect, it } from 'vitest'

import {
  assertDelegationBinding,
  requireDelegationBinding,
} from '../../src/runtime/server/acting-for'
import {
  createWebhookHmacSignature,
  isWebhookHmacSignatureValid,
  readHmacVerifiedWebhookBody,
  readSharedSecretWebhookBody,
  verifyHmacWebhookDelivery,
} from '../../src/runtime/server/webhooks'

describe('server delegation binding helper', () => {
  it('creates represented-user binding evidence without boolean delegation', () => {
    const binding = requireDelegationBinding({
      serviceId: 'linear',
      targetUserId: 'user_123',
      workspaceId: 'workspace_alpha',
      purpose: 'create-task',
      grantSource: 'workspace-service-policy',
      grantId: 'grant_123',
      expiresAt: 1_700_000_060_000,
      now: 1_700_000_000_000,
      reason: 'verified webhook handoff',
    })

    expect(binding).toEqual({
      subject: 'user:user_123',
      reason: 'verified webhook handoff',
      grantSource: 'workspace-service-policy',
      issuer: 'trellis://server',
      serviceId: 'linear',
      targetUserId: 'user_123',
      workspaceId: 'workspace_alpha',
      purpose: 'create-task',
      grantId: 'grant_123',
      expiresAt: 1_700_000_060_000,
    })
  })

  it('rejects binding evidence when expected scope does not match', () => {
    const binding = requireDelegationBinding({
      serviceId: 'linear',
      targetUserId: 'user_123',
      workspaceId: 'workspace_alpha',
      purpose: 'create-task',
      grantSource: 'workspace-service-policy',
      expiresAt: 1_700_000_060_000,
      now: 1_700_000_000_000,
    })

    expect(() =>
      assertDelegationBinding(binding, {
        serviceId: 'linear',
        targetUserId: 'user_123',
        workspaceId: 'workspace_beta',
        purpose: 'create-task',
        now: 1_700_000_000_000,
      }),
    ).toThrow(/workspaceId does not match/i)
  })

  it('rejects expired binding evidence', () => {
    expect(() =>
      assertDelegationBinding(
        {
          subject: 'user:user_123',
          serviceId: 'linear',
          targetUserId: 'user_123',
          workspaceId: 'workspace_alpha',
          purpose: 'create-task',
          grantSource: 'workspace-service-policy',
          issuer: 'trellis://server',
          expiresAt: 1_700_000_000_000,
        },
        {
          serviceId: 'linear',
          targetUserId: 'user_123',
          workspaceId: 'workspace_alpha',
          purpose: 'create-task',
          now: 1_700_000_000_001,
        },
      ),
    ).toThrow(/expiresAt must be in the future/i)
  })
})

describe('verified webhook helper', () => {
  it('accepts verified webhook bodies and runs the parser', async () => {
    await expect(
      readSharedSecretWebhookBody({
        signature: 'shared-secret',
        secret: 'shared-secret',
        readBody: async () => ({ title: 'Deploy' }),
        parse: (body) => ({ ...body, title: body.title.toUpperCase() }),
      }),
    ).resolves.toEqual({ title: 'DEPLOY' })
  })

  it('rejects invalid webhook signatures', async () => {
    await expect(
      readSharedSecretWebhookBody({
        signature: 'wrong-secret',
        secret: 'shared-secret',
        readBody: async () => ({ title: 'Deploy' }),
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid signature',
    })
  })

  it('rejects replayed webhook deliveries when idempotency is configured', async () => {
    await expect(
      readSharedSecretWebhookBody({
        signature: 'shared-secret',
        secret: 'shared-secret',
        readBody: async () => ({ eventId: 'evt_123' }),
        idempotency: {
          key: 'evt_123',
          consume: async () => false,
          conflictMessage: 'Webhook event already processed.',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Webhook event already processed.',
    })
  })
})

describe('HMAC webhook helper', () => {
  it('binds signatures to raw body, timestamp, and delivery id', async () => {
    const timestamp = '1700000000'
    const deliveryId = 'evt_123'
    const rawBody = JSON.stringify({ title: 'Deploy' })
    const signature = createWebhookHmacSignature({
      secret: 'webhook-secret',
      timestamp,
      deliveryId,
      rawBody,
    })

    expect(
      isWebhookHmacSignatureValid({
        signature,
        timestamp,
        deliveryId,
        rawBody,
        secret: 'webhook-secret',
        nowMs: 1_700_000_000_000,
      }),
    ).toBe(true)
    expect(
      isWebhookHmacSignatureValid({
        signature,
        timestamp,
        deliveryId,
        rawBody: JSON.stringify({ title: 'Other' }),
        secret: 'webhook-secret',
        nowMs: 1_700_000_000_000,
      }),
    ).toBe(false)
  })

  it('rejects stale HMAC webhooks and replayed deliveries', async () => {
    const timestamp = '1700000000'
    const deliveryId = 'evt_123'
    const rawBody = '{}'
    const signature = createWebhookHmacSignature({
      secret: 'webhook-secret',
      timestamp,
      deliveryId,
      rawBody,
    })

    await expect(
      readHmacVerifiedWebhookBody({
        signature,
        timestamp,
        deliveryId,
        rawBody,
        secret: 'webhook-secret',
        nowMs: 1_700_000_600_000,
        parse: () => ({}),
      }),
    ).rejects.toMatchObject({ statusCode: 401 })

    await expect(
      readHmacVerifiedWebhookBody({
        signature,
        timestamp,
        deliveryId,
        rawBody,
        secret: 'webhook-secret',
        nowMs: 1_700_000_000_000,
        parse: () => ({}),
        idempotency: {
          consume: async () => false,
          conflictMessage: 'Webhook event already processed.',
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Webhook event already processed.',
    })
  })

  it('parses HMAC webhook bodies before invoking optional idempotency', async () => {
    const timestamp = '1700000000'
    const deliveryId = 'evt_parse_failed'
    const rawBody = '{'
    const signature = createWebhookHmacSignature({
      secret: 'webhook-secret',
      timestamp,
      deliveryId,
      rawBody,
    })
    let consumed = false

    await expect(
      readHmacVerifiedWebhookBody({
        signature,
        timestamp,
        deliveryId,
        rawBody,
        secret: 'webhook-secret',
        nowMs: 1_700_000_000_000,
        parse: () => {
          throw Object.assign(new Error('Invalid payload'), { statusCode: 400 })
        },
        idempotency: {
          consume: async () => {
            consumed = true
            return true
          },
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 })

    expect(consumed).toBe(false)
  })

  it('fails closed when HMAC webhook secret is blank', async () => {
    const rawBody = '{}'
    const event = {
      node: {
        req: {
          headers: {
            'x-signature': 'sha256=ignored',
            'x-timestamp': '1700000000',
            'x-delivery-id': 'evt_blank_secret',
          },
        },
      },
    }

    await expect(
      verifyHmacWebhookDelivery(event as never, {
        secret: '   ',
        parse: () => JSON.parse(rawBody) as Record<string, unknown>,
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Webhook HMAC secret must be configured.',
    })
  })
})
