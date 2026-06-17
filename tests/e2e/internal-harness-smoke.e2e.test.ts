import { fileURLToPath } from 'node:url'

import { $fetch, createPage, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

import { harnessE2ePort } from '../support/e2e/harness-port'
import { ensureManagedLocalConvex } from '../support/e2e/managed-convex'

const harnessRoot = fileURLToPath(new URL('../../apps/harness', import.meta.url))

const local = await ensureManagedLocalConvex({
  cwd: harnessRoot,
})

await setup({
  rootDir: harnessRoot,
  env: local.env,
  port: harnessE2ePort,
})

describe('internal harness smoke', () => {
  afterAll(async () => {
    await local.release()
  })

  const fetchAny = $fetch as unknown as (
    request: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>

  it('renders open routes normally', async () => {
    const page = await createPage('/labs/guard-open')
    expect(page.url()).toContain('/labs/guard-open')
    expect(await page.textContent('.container h1')).toContain('Guard Open')
  })

  it('redirects protected routes and preserves the return path', async () => {
    const page = await createPage('/labs/guard-protected')
    const currentUrl = new URL(page.url())

    expect(currentUrl.pathname).toBe('/auth/signin')
    expect(currentUrl.searchParams.get('redirect')).toBe('/labs/guard-protected')
  })

  it('never mounts protected content while auth is pending', async () => {
    const page = await createPage('/labs/guard-pending-control')

    await page.click('[data-testid="start-pending-guard-nav"]')
    await page.waitForURL(/\/auth\/signin/, { timeout: 10_000 })

    const currentUrl = new URL(page.url())
    expect(currentUrl.pathname).toBe('/auth/signin')
    expect(currentUrl.searchParams.get('redirect')).toBe('/labs/guard-pending-protected')

    const protectedMountCount = await page.evaluate(() => {
      return (
        (window as Window & { __BCN_PENDING_GUARD_PROTECTED_MOUNTED__?: number })
          .__BCN_PENDING_GUARD_PROTECTED_MOUNTED__ ?? 0
      )
    })

    expect(protectedMountCount).toBe(0)
  })

  it('round-trips Nitro endpoints backed by server fetch helpers', async () => {
    const queryResponse = (await fetchAny('/api/test-server-query?limit=1')) as {
      success: boolean
      count: number
      totalAvailable: number
      notes: unknown[]
      executedOn: string
    }

    expect(queryResponse.success).toBe(true)
    expect(queryResponse.executedOn).toBe('server')
    expect(Array.isArray(queryResponse.notes)).toBe(true)
    expect(queryResponse.count).toBeLessThanOrEqual(1)

    const uniqueTitle = `Internal harness smoke ${Date.now()}`
    const mutationResponse = (await fetchAny('/api/test-server-mutation', {
      method: 'POST',
      body: {
        title: uniqueTitle,
        content: 'Created by internal-harness-smoke.e2e.test.ts',
      },
    })) as {
      success: boolean
      noteId?: string
      meta?: { title?: string; executedOn?: string }
    }

    expect(mutationResponse.success).toBe(true)
    expect(mutationResponse.noteId).toBeTruthy()
    expect(mutationResponse.meta?.title).toBe(uniqueTitle)
    expect(mutationResponse.meta?.executedOn).toBe('server')
  })
})
