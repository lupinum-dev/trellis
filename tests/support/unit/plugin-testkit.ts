import { vi } from 'vitest'
import { ref } from 'vue'

export { createDeferred } from './deferred'

export const stateStore = new Map<string, { value: unknown }>()

const pluginTestkitHoisted = vi.hoisted(() => {
  const unwrapNuxtPlugin = (plugin: unknown) => {
    if (typeof plugin === 'function') {
      return plugin
    }
    if (
      plugin &&
      typeof plugin === 'object' &&
      'setup' in plugin &&
      typeof plugin.setup === 'function'
    ) {
      return plugin.setup
    }
    return plugin
  }

  const clientState = {
    fetchToken: null as null | ((input: { forceRefreshToken: boolean }) => Promise<string | null>),
    setAuthCalls: 0,
    skipOnChangeAfterFetch: false,
    sessionSignalValue: false,
    sessionSignalListeners: [] as Array<(value: boolean, oldValue?: boolean) => void>,
    mutations: [] as Array<{ name: string; args: unknown }>,
  }
  const hookRegistry = new Map<string, (...args: unknown[]) => unknown>()
  let currentNuxtApp: Record<string, unknown> | null = null

  class MockConvexClient {
    setAuth(
      fetchToken: (input: { forceRefreshToken: boolean }) => Promise<string | null>,
      onChange?: (isAuthenticated: boolean) => void,
    ) {
      clientState.fetchToken = fetchToken
      clientState.setAuthCalls += 1

      if (clientState.setAuthCalls === 1) {
        onChange?.(false)
        return
      }

      void fetchToken({ forceRefreshToken: true }).then(
        (token) => {
          if (!clientState.skipOnChangeAfterFetch) {
            onChange?.(Boolean(token))
          }
        },
        () => onChange?.(false),
      )
    }

    async mutation(ref: unknown, args: unknown) {
      const name =
        typeof ref === 'string'
          ? ref
          : typeof ref === 'object' && ref !== null && '_path' in ref
            ? String((ref as { _path: unknown })._path)
            : String(ref)
      clientState.mutations.push({ name, args })
      return { ok: true }
    }
  }

  return {
    defineNuxtPluginMock: vi.fn(unwrapNuxtPlugin),
    useRuntimeConfigMock: vi.fn(),
    useStateMock: vi.fn(),
    useRouterMock: vi.fn(),
    getConvexRuntimeConfigMock: vi.fn(),
    createAuthClientMock: vi.fn(),
    tokenMock: vi.fn(),
    authLogMock: vi.fn(),
    debugLogMock: vi.fn(),
    clientState,
    MockConvexClient,
    hookRegistry,
    getCurrentNuxtApp: () => currentNuxtApp,
    setCurrentNuxtApp: (nuxtApp: Record<string, unknown> | null) => {
      currentNuxtApp = nuxtApp
    },
  }
})

const defineNuxtPluginMock = pluginTestkitHoisted.defineNuxtPluginMock
const useRuntimeConfigMock = pluginTestkitHoisted.useRuntimeConfigMock
const useStateMock = pluginTestkitHoisted.useStateMock
const useRouterMock = pluginTestkitHoisted.useRouterMock
const getConvexRuntimeConfigMock = pluginTestkitHoisted.getConvexRuntimeConfigMock
const createAuthClientMock = pluginTestkitHoisted.createAuthClientMock
const tokenMock = pluginTestkitHoisted.tokenMock
const authLogMock = pluginTestkitHoisted.authLogMock
const debugLogMock = pluginTestkitHoisted.debugLogMock
const clientState = pluginTestkitHoisted.clientState
const MockConvexClient = pluginTestkitHoisted.MockConvexClient
const hookRegistry = pluginTestkitHoisted.hookRegistry
const getCurrentNuxtApp = pluginTestkitHoisted.getCurrentNuxtApp
const setCurrentNuxtApp = pluginTestkitHoisted.setCurrentNuxtApp

export {
  authLogMock,
  clientState,
  createAuthClientMock,
  debugLogMock,
  defineNuxtPluginMock,
  getConvexRuntimeConfigMock,
  hookRegistry,
  MockConvexClient,
  tokenMock,
  useRouterMock,
  useRuntimeConfigMock,
  useStateMock,
}

export function emitBetterAuthSessionSignal() {
  const oldValue = clientState.sessionSignalValue
  clientState.sessionSignalValue = !clientState.sessionSignalValue
  for (const listener of clientState.sessionSignalListeners) {
    listener(clientState.sessionSignalValue, oldValue)
  }
}

vi.mock('#app', () => ({
  defineNuxtPlugin: defineNuxtPluginMock,
  useRuntimeConfig: useRuntimeConfigMock,
  useState: useStateMock,
  useRouter: useRouterMock,
}))

vi.mock('#imports', () => ({
  useNuxtApp: () => getCurrentNuxtApp(),
  useState: useStateMock,
}))

vi.mock('@convex-dev/better-auth/client/plugins', () => ({
  convexClient: () => ({}),
}))

vi.mock('better-auth/vue', () => ({
  createAuthClient: createAuthClientMock,
}))

vi.mock('convex/browser', () => {
  return { ConvexClient: MockConvexClient }
})

vi.mock('../../../src/runtime/convex/shared/runtime-config', () => ({
  getConvexRuntimeConfig: getConvexRuntimeConfigMock,
}))

vi.mock('../../../src/runtime/observability/runtime-observer', () => ({
  createRuntimeObserver: () => ({
    auth: authLogMock,
    debug: debugLogMock,
    query: vi.fn(),
    mutation: vi.fn(),
    action: vi.fn(),
    connection: vi.fn(),
    upload: vi.fn(),
    time: () => vi.fn(),
    setSummary: vi.fn(),
    emitSummary: vi.fn(),
  }),
}))

export function createNuxtAppMock(options?: { serverRendered?: boolean }) {
  const nuxtApp = {
    payload: { serverRendered: options?.serverRendered ?? false },
    hook: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      hookRegistry.set(event, handler)
      return vi.fn()
    }),
    provide: vi.fn((name: string, value: unknown) => {
      ;(nuxtApp as Record<string, unknown>)[`$${name}`] = value
    }),
  }
  setCurrentNuxtApp(nuxtApp)
  return nuxtApp
}

export function resetPluginClientTestkit() {
  vi.clearAllMocks()
  vi.useRealTimers()
  stateStore.clear()
  clientState.fetchToken = null
  clientState.setAuthCalls = 0
  clientState.skipOnChangeAfterFetch = false
  clientState.sessionSignalValue = false
  clientState.sessionSignalListeners = []
  clientState.mutations = []
  hookRegistry.clear()
  setCurrentNuxtApp(null)

  useRuntimeConfigMock.mockReturnValue({
    public: {
      convex: {
        observability: {
          enabled: false,
          service: 'plugin-testkit',
          capture: { backend: false, mcp: false, browser: false },
          level: 'critical',
          sample: {},
          correlation: { header: 'x-trellis-correlation-id' },
        },
      },
    },
  })

  useStateMock.mockImplementation((key: string, init?: (() => unknown) | unknown) => {
    if (!stateStore.has(key)) {
      const value =
        typeof init === 'function' ? (init as () => unknown)() : init === undefined ? null : init
      stateStore.set(key, ref(value))
    }
    return stateStore.get(key)
  })

  useRouterMock.mockReturnValue({
    currentRoute: {
      value: {
        path: '/dashboard',
        meta: {},
      },
    },
  })

  getConvexRuntimeConfigMock.mockReturnValue({
    url: 'https://demo.convex.cloud',
    siteUrl: 'https://demo.convex.site',
    auth: {
      enabled: true,
      route: '/api/auth',
      skipAuthTokenFetchRoutes: [],
      bootstrap: { enabled: true, mutation: 'auth.createUserIfNeeded' },
    },
  })

  createAuthClientMock.mockReturnValue({
    $store: {
      listen: vi.fn((signal: string, listener: (value: boolean, oldValue?: boolean) => void) => {
        if (signal !== '$sessionSignal') {
          return
        }
        clientState.sessionSignalListeners.push(listener)
        listener(clientState.sessionSignalValue)
        return () => {
          clientState.sessionSignalListeners = clientState.sessionSignalListeners.filter(
            (candidate) => candidate !== listener,
          )
        }
      }),
    },
    convex: {
      token: tokenMock,
    },
  })
}

export async function loadClientPlugin() {
  return (await import('../../../src/runtime/plugin.client.ts')).default
}
