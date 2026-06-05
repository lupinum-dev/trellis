import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWebhookHmacSignature } from '../../../../src/runtime/server/webhooks'

const { createErrorMock, readRawBodyMock, serverConvexMutationMock } = vi.hoisted(() => ({
  createErrorMock: vi.fn(
    (input: { statusCode: number; message?: string; statusMessage?: string }) =>
      Object.assign(new Error(input.message ?? input.statusMessage ?? 'error'), input),
  ),
  readRawBodyMock: vi.fn(),
  serverConvexMutationMock: vi.fn(),
}))

vi.mock('h3', () => ({
  createError: createErrorMock,
  defineEventHandler: (handler: unknown) => handler,
  readRawBody: readRawBodyMock,
}))

vi.mock('#trellis/server', async () => {
  const webhooks = await vi.importActual<typeof import('../../../../src/runtime/server/webhooks')>(
    '../../../../src/runtime/server/webhooks',
  )
  const actingFor = await vi.importActual<
    typeof import('../../../../src/runtime/server/acting-for')
  >('../../../../src/runtime/server/acting-for')

  return {
    domainIdempotency: (input: Record<string, unknown>) => ({
      mode: 'domain-idempotency',
      ...input,
      target:
        typeof input.target === 'object' &&
        input.target !== null &&
        typeof (input.target as { _path?: unknown })._path === 'string'
          ? (input.target as { _path: string })._path
          : input.target,
    }),
    requireDelegationBinding: actingFor.requireDelegationBinding,
    serverConvexMutation: serverConvexMutationMock,
    transportProof: {
      webhook: (input: Record<string, unknown>) => ({ transport: 'webhook', ...input }),
    },
    verifyHmacWebhookDelivery: webhooks.verifyHmacWebhookDelivery,
  }
})

vi.mock('../../convex/_generated/api', () => ({
  api: {
    features: {
      runbooks: {
        webhooks: {
          createRunbookFromWebhookMutation: {
            _path: 'features/runbooks/webhooks:createRunbookFromWebhookMutation',
          },
        },
      },
    },
  },
}))

const { default: handler } = await import('./runbook-webhook.post')

function createEvent(rawBody: string, signatureOverride?: string) {
  const timestamp = String(Date.now())
  const deliveryId = 'delivery_123'
  const signature =
    signatureOverride ??
    createWebhookHmacSignature({
      secret: 'runbook-webhook-demo',
      timestamp,
      deliveryId,
      rawBody,
    })

  return {
    node: {
      req: {
        headers: {
          'x-example-signature': signature,
          'x-example-timestamp': timestamp,
          'x-example-delivery-id': deliveryId,
        },
      },
    },
  }
}

describe('example 07 webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.MCP_REFERENCE_WEBHOOK_SECRET = 'runbook-webhook-demo'
  })

  it('forwards HMAC-verified runbook webhooks with binding evidence and domain idempotency', async () => {
    const rawBody = JSON.stringify({
      workspaceId: 'workspace_123',
      targetUserId: 'user_123',
      title: 'Webhook runbook',
      summary: 'Created from webhook',
      content: '# Webhook runbook',
      visibility: 'workspace',
      tags: ['webhook'],
    })
    readRawBodyMock.mockResolvedValue(rawBody)
    serverConvexMutationMock.mockResolvedValue('runbook_123')

    const result = await handler(createEvent(rawBody) as never)

    expect(result).toEqual({
      ok: true,
      runbookId: 'runbook_123',
    })
    expect(serverConvexMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        node: expect.any(Object),
      }),
      expect.objectContaining({
        _path: 'features/runbooks/webhooks:createRunbookFromWebhookMutation',
      }),
      {
        deliveryId: 'delivery_123',
        workspaceId: 'workspace_123',
        title: 'Webhook runbook',
        summary: 'Created from webhook',
        content: '# Webhook runbook',
        visibility: 'workspace',
        tags: ['webhook'],
      },
      {
        auth: expect.objectContaining({
          transport: 'webhook',
          caller: {
            kind: 'service',
            serviceId: 'runbook-webhook',
            subject: 'service:runbook-webhook',
          },
          actingFor: expect.objectContaining({
            subject: 'user:user_123',
            grantSource: 'workspace-service-policy',
            serviceId: 'runbook-webhook',
            targetUserId: 'user_123',
            workspaceId: 'workspace_123',
            purpose: 'runbook-webhook:create',
            grantId: 'delivery:delivery_123',
          }),
          replay: expect.objectContaining({
            mode: 'domain-idempotency',
            key: 'delivery_123',
            target: 'features/runbooks/webhooks:createRunbookFromWebhookMutation',
          }),
        }),
      },
    )
  })

  it('rejects webhook bodies that omit required delegation fields', async () => {
    const rawBody = JSON.stringify({
      workspaceId: 'workspace_123',
      title: 'Webhook runbook',
      summary: 'Created from webhook',
      content: '# Webhook runbook',
    })
    readRawBodyMock.mockResolvedValue(rawBody)

    await expect(handler(createEvent(rawBody) as never)).rejects.toMatchObject({
      statusCode: 400,
      message: 'workspaceId, targetUserId, title, summary, and content are required.',
    })
    expect(serverConvexMutationMock).not.toHaveBeenCalled()
  })

  it('rejects invalid HMAC signatures', async () => {
    const rawBody = JSON.stringify({
      workspaceId: 'workspace_123',
      targetUserId: 'user_123',
      title: 'Webhook runbook',
      summary: 'Created from webhook',
      content: '# Webhook runbook',
    })
    readRawBodyMock.mockResolvedValue(rawBody)

    await expect(handler(createEvent(rawBody, 'sha256=wrong') as never)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid signature',
    })
    expect(serverConvexMutationMock).not.toHaveBeenCalled()
  })

  it('does not route-consume valid deliveries when backend dispatch fails', async () => {
    const rawBody = JSON.stringify({
      workspaceId: 'workspace_123',
      targetUserId: 'user_123',
      title: 'Webhook runbook',
      summary: 'Created from webhook',
      content: '# Webhook runbook',
    })
    readRawBodyMock.mockResolvedValue(rawBody)
    serverConvexMutationMock.mockRejectedValueOnce(new Error('Convex unavailable'))
    serverConvexMutationMock.mockResolvedValueOnce('runbook_123')

    await expect(handler(createEvent(rawBody) as never)).rejects.toThrow(/Convex unavailable/)
    await expect(handler(createEvent(rawBody) as never)).resolves.toEqual({
      ok: true,
      runbookId: 'runbook_123',
    })

    expect(serverConvexMutationMock).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the webhook route secret is not configured', async () => {
    delete process.env.MCP_REFERENCE_WEBHOOK_SECRET
    const rawBody = JSON.stringify({
      workspaceId: 'workspace_123',
      targetUserId: 'user_123',
      title: 'Webhook runbook',
      summary: 'Created from webhook',
      content: '# Webhook runbook',
    })
    readRawBodyMock.mockResolvedValue(rawBody)

    await expect(handler(createEvent(rawBody) as never)).rejects.toMatchObject({
      statusCode: 500,
      message: 'MCP_REFERENCE_WEBHOOK_SECRET is required for the runbook webhook example.',
    })
  })
})
