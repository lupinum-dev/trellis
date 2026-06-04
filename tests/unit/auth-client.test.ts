import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const authClientMocks = vi.hoisted(() => ({
  convexClientPluginMock: vi.fn(() => ({ kind: 'convex-plugin' })),
  createAuthClientMock: vi.fn(),
}))

vi.mock('@convex-dev/better-auth/client/plugins', () => ({
  convexClient: authClientMocks.convexClientPluginMock,
}))

vi.mock('better-auth/vue', () => ({
  createAuthClient: authClientMocks.createAuthClientMock,
}))

let initAuthClient: typeof import('../../src/runtime/auth/client/auth-client').initAuthClient

class SilentSetAuthConvexClient {
  setAuth(
    fetchToken: (input: { forceRefreshToken: boolean }) => Promise<string | null>,
    _onChange?: (isAuthenticated: boolean) => void,
  ) {
    void fetchToken({ forceRefreshToken: true })
  }
}

describe('initAuthClient', () => {
  const buildOptions = (
    overrides: Partial<Parameters<typeof initAuthClient>[1]> = {},
  ): Parameters<typeof initAuthClient>[1] => ({
    baseURL: 'http://localhost:3000/api/auth',
    authRoute: '/api/auth',
    skipRoutes: [],
    convexToken: ref(null),
    convexUser: ref(null),
    logger: {
      auth: vi.fn(),
      debug: vi.fn(),
    } as never,
    nuxtApp: {},
    router: {
      currentRoute: ref({ path: '/', meta: {} }),
    } as never,
    traceId: 'test-trace',
    ...overrides,
  })

  beforeAll(async () => {
    ;({ initAuthClient } = await import('../../src/runtime/auth/client/auth-client'))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    authClientMocks.createAuthClientMock.mockReturnValue({
      convex: {
        token: vi.fn(async () => ({ data: null, error: null })),
      },
    })
  })

  it('resolves invalidate even when Convex never invokes onChange', async () => {
    const transport = initAuthClient(new SilentSetAuthConvexClient() as never, buildOptions())

    await expect(transport.invalidate()).resolves.toBeUndefined()
  })

  it('rejects refresh promptly when forced token fetching fails without onChange', async () => {
    const transport = initAuthClient(new SilentSetAuthConvexClient() as never, buildOptions())

    await expect(
      transport.refresh(async () => {
        throw new Error('token fetch failed')
      }, vi.fn()),
    ).rejects.toThrow('token fetch failed')
  })

  it('refreshes Trellis auth after Better Auth session signal changes', async () => {
    let sessionListener: ((value: boolean, oldValue?: boolean) => void) | null = null
    const onBetterAuthSessionSignal = vi.fn()
    authClientMocks.createAuthClientMock.mockReturnValue({
      convex: {
        token: vi.fn(async () => ({ data: null, error: null })),
      },
      $store: {
        listen: vi.fn((_signal, listener) => {
          sessionListener = listener
          listener(false)
        }),
      },
    })

    initAuthClient(
      new SilentSetAuthConvexClient() as never,
      buildOptions({ onBetterAuthSessionSignal }),
    )

    expect(onBetterAuthSessionSignal).not.toHaveBeenCalled()

    sessionListener?.(true, false)
    await Promise.resolve()

    expect(onBetterAuthSessionSignal).toHaveBeenCalledTimes(1)
  })

  it('ignores Better Auth session signal emissions with the same value', async () => {
    let sessionListener: ((value: boolean, oldValue?: boolean) => void) | null = null
    const onBetterAuthSessionSignal = vi.fn()
    authClientMocks.createAuthClientMock.mockReturnValue({
      convex: {
        token: vi.fn(async () => ({ data: null, error: null })),
      },
      $store: {
        listen: vi.fn((_signal, listener) => {
          sessionListener = listener
          listener(false)
        }),
      },
    })

    initAuthClient(
      new SilentSetAuthConvexClient() as never,
      buildOptions({ onBetterAuthSessionSignal }),
    )

    sessionListener?.(false, false)
    await Promise.resolve()

    expect(onBetterAuthSessionSignal).not.toHaveBeenCalled()
  })
})
