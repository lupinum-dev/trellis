import { fileURLToPath } from 'node:url'

const moduleEntry = fileURLToPath(new URL('../../../src/module.ts', import.meta.url))
const runtimeAppEntry = fileURLToPath(new URL('../../../src/runtime/app/index.ts', import.meta.url))
const runtimeAuthEntry = fileURLToPath(
  new URL('../../../src/runtime/auth/index.ts', import.meta.url),
)
const runtimeBackendEntry = fileURLToPath(
  new URL('../../../src/runtime/backend/index.ts', import.meta.url),
)
const runtimeMcpEntry = fileURLToPath(new URL('../../../src/runtime/mcp/index.ts', import.meta.url))
const runtimeWorkspaceEntry = fileURLToPath(
  new URL('../../../src/runtime/workspace/index.ts', import.meta.url),
)

export default defineNuxtConfig({
  modules: [moduleEntry, '@nuxtjs/mcp-toolkit'],

  alias: {
    '@lupinum/trellis/app': runtimeAppEntry,
    '@lupinum/trellis/auth': runtimeAuthEntry,
    '@lupinum/trellis/backend': runtimeBackendEntry,
    '@lupinum/trellis/mcp': runtimeMcpEntry,
    '@lupinum/trellis/workspace': runtimeWorkspaceEntry,
  },

  nitro: {
    experimental: { asyncContext: true },
  },

  mcp: {
    name: 'phase0-workspace-mcp',
  },

  trellis: {
    url: 'https://phase0-workspace-mcp.convex.cloud',
  },
})
