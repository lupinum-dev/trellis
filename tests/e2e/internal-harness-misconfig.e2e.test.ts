import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fetchWithTimeout } from '../support/e2e/http'
import { startManagedNuxtDev } from '../support/e2e/managed-nuxt-dev'

const harnessRoot = fileURLToPath(new URL('../../apps/harness', import.meta.url))

describe('internal harness dev misconfig overlay', () => {
  const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))
  let devServer: Awaited<ReturnType<typeof startManagedNuxtDev>> | null = null

  beforeAll(async () => {
    devServer = await startManagedNuxtDev({
      projectDir: harnessRoot,
      workspaceRoot,
      env: {
        CONVEX_URL: 'https://demo.convex.cloud',
        CONVEX_SITE_URL: 'http://127.0.0.1:1',
        NUXT_PUBLIC_CONVEX_URL: 'https://demo.convex.cloud',
        NUXT_PUBLIC_CONVEX_SITE_URL: 'http://127.0.0.1:1',
        NODE_ENV: 'development',
      },
    })
  }, 60_000)

  afterAll(async () => {
    if (!devServer) return
    await devServer.release()
    devServer = null
  })

  it('renders a visible SSR error page when token exchange fails in dev', async () => {
    const response = await fetchWithTimeout(
      `${devServer!.origin}/labs/guard-open?force_misconfig=1`,
      {
        headers: {
          cookie: 'better-auth.session_token=e2e-session-token',
        },
      },
      30_000,
    )

    expect(response.status).toBe(500)

    const body = await response.text()
    expect(body).toContain('NuxtConvexError')
    expect(body).toMatch(/token exchange failed/i)
  })
})
