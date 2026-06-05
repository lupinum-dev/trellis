import { describe, expect, it, vi } from 'vitest'

import { useRouter } from '#imports'

import type { ClientAuthStateResult } from '../../src/runtime/auth/client/auth-engine'
import routeProtectionMiddleware from '../../src/runtime/auth/middleware/route-protection.global'
import { installMockAuthEngine } from '../support/auth/nuxt-auth-engine'
import { captureInNuxt } from '../support/nuxt/runtime-harness'
import { createDeferred } from '../support/unit/deferred'

describe('route protection middleware', () => {
  it('waits for a session-driven refresh before deciding protected navigation', async () => {
    const refreshResult = createDeferred<ClientAuthStateResult>()

    const { result, flush } = await captureInNuxt(
      () => {
        const { engine, pending } = installMockAuthEngine({
          initialToken: 'stale.jwt.token',
          initialUser: { email: 'stale@test.com' },
          fetchAuthState: async () => await refreshResult.promise,
        })
        const router = useRouter()
        const pushSpy = vi.spyOn(router, 'push').mockImplementation(async () => undefined as never)

        const refreshPromise = engine.refreshAuth({ trigger: 'auth-session-signal' })
        const middlewarePromise = routeProtectionMiddleware({
          path: '/dashboard',
          fullPath: '/dashboard?tab=team',
          meta: { convexAuth: true },
        } as never)

        return {
          pending,
          pushSpy,
          refreshPromise,
          middlewarePromise,
        }
      },
      {
        convexConfig: {
          auth: {
            enabled: true,
            routeProtection: {
              redirectTo: '/auth/signin',
              preserveReturnTo: true,
            },
          },
        },
      },
    )

    expect(result.pending.value).toBe(true)
    expect(result.pushSpy).not.toHaveBeenCalled()

    refreshResult.resolve({
      token: null,
      user: null,
      error: null,
      source: 'exchange',
    })

    await expect(result.refreshPromise).resolves.toBeUndefined()
    await flush()

    await result.middlewarePromise
    expect(result.pending.value).toBe(false)
    expect(result.pushSpy).toHaveBeenCalledWith('/auth/signin?redirect=%2Fdashboard%3Ftab%3Dteam')
  })
})
