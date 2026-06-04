import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWebhookHmacSignature } from '../../../../src/runtime/server/webhooks'

const { createErrorMock, readRawBodyMock, serverConvexMutationMock } = vi.hoisted(() => ({
  createErrorMock: vi.fn((input: { statusCode: number; message: string }) =>
    Object.assign(new Error(input.message), input),
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

  return {
    serverConvexMutation: serverConvexMutationMock,
    verifyHmacWebhookDelivery: webhooks.verifyHmacWebhookDelivery,
  }
})

vi.mock('../../convex/_generated/api', () => ({
  internal: {
    features: {
      tasks: {
        webhooks: {
          createTaskFromWebhookMutation: {
            _path: 'internal/features/tasks/webhooks:createTaskFromWebhookMutation',
          },
        },
      },
    },
  },
}))

const { default: handler } = await import('./webhook.post')

function createEvent(rawBody: string, signatureOverride?: string) {
  const timestamp = String(Date.now())
  const deliveryId = 'delivery_123'
  const signature =
    signatureOverride ??
    createWebhookHmacSignature({
      secret: 'project-board-demo',
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

describe('example 04 webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PROJECT_BOARD_WEBHOOK_SECRET = 'project-board-demo'
  })

  it('accepts HMAC-verified webhook bodies and calls the internal mutation path', async () => {
    const rawBody = JSON.stringify({
      projectId: 'project_123',
      title: 'Webhook task',
    })
    readRawBodyMock.mockResolvedValue(rawBody)
    serverConvexMutationMock.mockResolvedValue('task_123')

    const result = await handler(createEvent(rawBody) as never)

    expect(result).toEqual({
      ok: true,
      taskId: 'task_123',
    })
    expect(serverConvexMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        node: expect.any(Object),
      }),
      expect.objectContaining({
        _path: 'internal/features/tasks/webhooks:createTaskFromWebhookMutation',
      }),
      {
        deliveryId: 'delivery_123',
        projectId: 'project_123',
        title: 'Webhook task',
        priority: 'medium',
      },
      {
        auth: 'none',
      },
    )
  })

  it('rejects webhook bodies that omit the required task fields', async () => {
    const rawBody = JSON.stringify({
      projectId: 'project_123',
    })
    readRawBodyMock.mockResolvedValue(rawBody)

    await expect(handler(createEvent(rawBody) as never)).rejects.toMatchObject({
      statusCode: 400,
      message: 'projectId and title are required.',
    })
  })

  it('rejects invalid HMAC signatures', async () => {
    const rawBody = JSON.stringify({
      projectId: 'project_123',
      title: 'Webhook task',
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
      projectId: 'project_123',
      title: 'Webhook task',
    })
    readRawBodyMock.mockResolvedValue(rawBody)
    serverConvexMutationMock.mockRejectedValueOnce(new Error('Convex unavailable'))
    serverConvexMutationMock.mockResolvedValueOnce('task_123')

    await expect(handler(createEvent(rawBody) as never)).rejects.toThrow(/Convex unavailable/)
    await expect(handler(createEvent(rawBody) as never)).resolves.toEqual({
      ok: true,
      taskId: 'task_123',
    })

    expect(serverConvexMutationMock).toHaveBeenCalledTimes(2)
  })

  it('fails closed when the webhook route secret is not configured', async () => {
    delete process.env.PROJECT_BOARD_WEBHOOK_SECRET
    const rawBody = JSON.stringify({
      projectId: 'project_123',
      title: 'Webhook task',
    })
    readRawBodyMock.mockResolvedValue(rawBody)

    await expect(handler(createEvent(rawBody) as never)).rejects.toMatchObject({
      statusCode: 500,
      message: 'PROJECT_BOARD_WEBHOOK_SECRET is required for the webhook example.',
    })
  })
})
