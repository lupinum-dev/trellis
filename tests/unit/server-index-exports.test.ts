import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { serverConvexActionMock, serverConvexMutationMock, serverConvexQueryMock } = vi.hoisted(
  () => ({
    serverConvexQueryMock: vi.fn(),
    serverConvexMutationMock: vi.fn(),
    serverConvexActionMock: vi.fn(),
  }),
)

vi.mock('../../src/runtime/convex/server/convex', () => ({
  serverConvexQuery: serverConvexQueryMock,
  serverConvexMutation: serverConvexMutationMock,
  serverConvexAction: serverConvexActionMock,
  transportProof: {
    server: (input: Record<string, unknown>) => ({ transport: 'server', ...input }),
    webhook: (input: Record<string, unknown>) => ({ transport: 'webhook', ...input }),
    mcp: (input: Record<string, unknown>) => ({ transport: 'mcp', ...input }),
  },
  operationConfirmation: (input: { jti: string }) => ({
    mode: 'operation-confirmation',
    jti: input.jti,
  }),
  jtiRedemption: (input: { jti: string }) => ({ mode: 'jti-redemption', jti: input.jti }),
  domainIdempotency: (input: { key: string; target?: string }) => ({
    mode: 'domain-idempotency',
    ...input,
  }),
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ public: { convex: {} } }),
}))

vi.mock('nitropack/runtime', () => ({
  useEvent: () => undefined,
}))

describe('server entrypoint exports', () => {
  let serverApi: typeof import('../../src/runtime/server/index')

  beforeAll(async () => {
    serverApi = await import('../../src/runtime/server/index')
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports hard-cutover server helper names', () => {
    expect(serverApi).toHaveProperty('serverConvexQuery')
    expect(serverApi).toHaveProperty('serverConvexMutation')
    expect(serverApi).toHaveProperty('serverConvexAction')
    expect(serverApi).toHaveProperty('createServerConvexCaller')
    expect(serverApi).toHaveProperty('transportProof')
    expect(serverApi).toHaveProperty('domainIdempotency')
    expect(serverApi).toHaveProperty('verifyHmacWebhookDelivery')
    expect(serverApi).toHaveProperty('requireDelegationBinding')
    expect(serverApi).toHaveProperty('assertDelegationBinding')
  })

  it('does not expose legacy or MCP-only helper names', () => {
    expect(serverApi).not.toHaveProperty('fetchQuery')
    expect(serverApi).not.toHaveProperty('fetchMutation')
    expect(serverApi).not.toHaveProperty('fetchAction')
    expect(serverApi).not.toHaveProperty('defineConvexMcpTool')
    expect(serverApi).not.toHaveProperty('delegateToUser')
  })

  it('creates a caller that defaults to auth:auto', async () => {
    serverConvexQueryMock.mockResolvedValueOnce({ ok: 'query' })
    serverConvexMutationMock.mockResolvedValueOnce({ ok: 'mutation' })
    serverConvexActionMock.mockResolvedValueOnce({ ok: 'action' })

    const event = { __is_event__: true } as never
    const caller = serverApi.createServerConvexCaller(event)

    await expect(
      caller.query({ _path: 'notes:list' } as never, { limit: 1 } as never),
    ).resolves.toEqual({
      ok: 'query',
    })
    await expect(
      caller.mutation({ _path: 'notes:create' } as never, { title: 'Hello' } as never),
    ).resolves.toEqual({ ok: 'mutation' })
    await expect(
      caller.action({ _path: 'notes:sync' } as never, { id: 'n1' } as never),
    ).resolves.toEqual({
      ok: 'action',
    })

    expect(serverConvexQueryMock).toHaveBeenCalledWith(
      event,
      { _path: 'notes:list' },
      { limit: 1 },
      { auth: 'auto' },
    )
    expect(serverConvexMutationMock).toHaveBeenCalledWith(
      event,
      { _path: 'notes:create' },
      { title: 'Hello' },
      { auth: 'auto' },
    )
    expect(serverConvexActionMock).toHaveBeenCalledWith(
      event,
      { _path: 'notes:sync' },
      { id: 'n1' },
      { auth: 'auto' },
    )
  })

  it('forwards transport proof auth to request-scoped calls', async () => {
    serverConvexQueryMock.mockResolvedValueOnce({ ok: true })

    const event = { __is_event__: true } as never
    const caller = { kind: 'agent', agentId: 'a1', subject: 'agent:a1' }
    const actingFor = { subject: 'user:u1', reason: 'approved' }
    const proof = serverApi.transportProof.server({ caller, actingFor })
    const convex = serverApi.createServerConvexCaller(event, {
      auth: proof,
    })

    await expect(
      convex.query({ _path: 'notes:list' } as never, { limit: 2 } as never),
    ).resolves.toEqual({
      ok: true,
    })

    expect(serverConvexQueryMock).toHaveBeenCalledWith(
      event,
      { _path: 'notes:list' },
      { limit: 2 },
      { auth: proof },
    )
  })

  it('forwards per-call transport proof options to request-scoped calls', async () => {
    serverConvexMutationMock.mockResolvedValueOnce({ ok: true })

    const event = { __is_event__: true } as never
    const caller = { kind: 'agent', agentId: 'a1', subject: 'agent:a1' }
    const baseProof = serverApi.transportProof.server({ caller })
    const executeProof = serverApi.transportProof.server({
      caller,
      purpose: 'operation-execute',
      replay: serverApi.operationConfirmation({ jti: 'confirm-1' }),
    })
    const convex = serverApi.createServerConvexCaller(event, {
      auth: baseProof,
    })

    await convex.mutation({ _path: 'notes:delete' } as never, { id: 'n1' } as never, {
      auth: executeProof,
    })

    expect(serverConvexMutationMock).toHaveBeenCalledWith(
      event,
      { _path: 'notes:delete' },
      { id: 'n1' },
      {
        auth: executeProof,
      },
    )
  })

  it('does not expose forwarded identity as request-scoped caller options', () => {
    const event = { __is_event__: true } as never
    const convex = serverApi.createServerConvexCaller(event, {
      auth: 'auto',
      caller: { kind: 'agent', agentId: 'a1', subject: 'agent:a1' },
      actingFor: { subject: 'user:u1', reason: 'approved' },
    } as never)

    expect(convex).toHaveProperty('query')
  })
})
