import { fileURLToPath } from 'node:url'

import { convexLocal } from 'convex-vite-plugin'

import { trellisObservability } from './observability.config'

const runtimeComposablesEntry = fileURLToPath(
  new URL('../../src/runtime/composables/index.ts', import.meta.url),
)
const runtimeAuthEntry = fileURLToPath(new URL('../../src/runtime/auth/index.ts', import.meta.url))
const runtimeArgsEntry = fileURLToPath(new URL('../../src/runtime/args/index.ts', import.meta.url))
const runtimeIdentityForwardingEntry = fileURLToPath(
  new URL('../../src/runtime/identity-forwarding/index.ts', import.meta.url),
)
const runtimeVisibilityEntry = fileURLToPath(
  new URL('../../src/runtime/visibility/index.ts', import.meta.url),
)
const runtimeMcpEntry = fileURLToPath(new URL('../../src/runtime/mcp/index.ts', import.meta.url))
const runtimeBackendEntry = fileURLToPath(
  new URL('../../src/runtime/backend/index.ts', import.meta.url),
)
const runtimeServerEntry = fileURLToPath(
  new URL('../../src/runtime/server/index.ts', import.meta.url),
)
const runtimeWorkspaceEntry = fileURLToPath(
  new URL('../../src/runtime/workspace/index.ts', import.meta.url),
)
const harnessRoot = fileURLToPath(new URL('./', import.meta.url))
const useLocalConvex = process.env.USE_LOCAL_CONVEX === 'true'
const resetLocalBackend = process.env.RESET_LOCAL_BACKEND === 'true'
const harnessUrl = process.env.SITE_URL || 'http://localhost:3000'

function parsePort(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback

  const port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new TypeError(`${name} must be a valid TCP port, received: ${value}`)
  }

  return port
}

const localConvexPort = parsePort(
  process.env.CONVEX_LOCAL_BACKEND_PORT,
  3210,
  'CONVEX_LOCAL_BACKEND_PORT',
)
const localConvexSiteProxyPort = parsePort(
  process.env.CONVEX_LOCAL_SITE_PROXY_PORT,
  localConvexPort + 1,
  'CONVEX_LOCAL_SITE_PROXY_PORT',
)
const localConvexUrl = process.env.CONVEX_URL || `http://127.0.0.1:${localConvexPort}`

function appendOrigin(origins: string | undefined, origin: string): string {
  const values = new Set(
    (origins ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
  values.add(origin)
  return Array.from(values).join(',')
}

export default defineNuxtConfig({
  modules: ['../../src/module', '@nuxtjs/mcp-toolkit'],

  mcp: {
    name: 'trellis-internal-harness',
    sessions: true,
  },

  alias: {
    '@lupinum/trellis/composables': runtimeComposablesEntry,
    '@lupinum/trellis/auth': runtimeAuthEntry,
    '@lupinum/trellis/args': runtimeArgsEntry,
    '@lupinum/trellis/backend': runtimeBackendEntry,
    '@lupinum/trellis/workspace': runtimeWorkspaceEntry,
    '@lupinum/trellis/mcp': runtimeMcpEntry,
    '@lupinum/trellis/server': runtimeServerEntry,
    '@lupinum/trellis/identity-forwarding': runtimeIdentityForwardingEntry,
    '@lupinum/trellis/visibility': runtimeVisibilityEntry,
  },

  nitro: {
    experimental: { asyncContext: true },
  },

  compatibilityDate: '2026-02-26',

  trellis: {
    url: useLocalConvex
      ? localConvexUrl
      : process.env.NUXT_PUBLIC_CONVEX_URL || process.env.CONVEX_URL,
    auth: {
      enabled: true,
    },
    permissions: {
      query: 'auth.getAccessContext',
    },
    observability: trellisObservability,
  },

  hooks: {
    'vite:extendConfig': (config, { isClient }) => {
      if (!useLocalConvex || !isClient) return
      config.plugins = [
        ...(config.plugins ?? []),
        convexLocal({
          instanceName: 'trellis-internal-harness',
          stateIdSuffix: 'internal-harness-local-v1',
          port: localConvexPort,
          siteProxyPort: localConvexSiteProxyPort,
          projectDir: harnessRoot,
          convexDir: 'convex',
          reset: resetLocalBackend,
          envVars: {
            SITE_URL: harnessUrl,
            AUTH_BASE_URL: process.env.AUTH_BASE_URL || harnessUrl,
            AUTH_TRUSTED_ORIGINS: appendOrigin(process.env.AUTH_TRUSTED_ORIGINS, harnessUrl),
            BETTER_AUTH_SECRET:
              process.env.BETTER_AUTH_SECRET || 'local-dev-better-auth-secret-not-for-production',
          },
        }),
      ]
    },
  },
})
