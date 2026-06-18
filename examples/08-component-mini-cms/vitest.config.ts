import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

import { convexTestConfig } from '../../src/runtime/testing/index'

export default defineConfig(
  convexTestConfig({
    test: {
      include: ['test/**/*.test.ts'],
      name: 'example-component-mini-cms',
    },
    resolve: {
      alias: {
        '@lupinum/trellis-bridge/component': fileURLToPath(
          new URL('../../packages/trellis-bridge/src/component.ts', import.meta.url),
        ),
        '@lupinum/trellis/args': fileURLToPath(
          new URL('../../src/runtime/args/index.ts', import.meta.url),
        ),
        '@lupinum/trellis/app': fileURLToPath(
          new URL('../../src/runtime/app/index.ts', import.meta.url),
        ),
        '@lupinum/trellis/auth': fileURLToPath(
          new URL('../../src/runtime/auth/index.ts', import.meta.url),
        ),
        '@lupinum/trellis/backend': fileURLToPath(
          new URL('../../src/runtime/backend/index.ts', import.meta.url),
        ),
        '@lupinum/trellis/mcp': fileURLToPath(
          new URL('../../src/runtime/mcp/index.ts', import.meta.url),
        ),
        '@lupinum/trellis/server': fileURLToPath(
          new URL('../../src/runtime/server/index.ts', import.meta.url),
        ),
        '@lupinum/trellis/testing': fileURLToPath(
          new URL('../../src/runtime/testing/index.ts', import.meta.url),
        ),
        '@lupinum/trellis-bridge': fileURLToPath(
          new URL('../../packages/trellis-bridge/src/index.ts', import.meta.url),
        ),
        '@lupinum/trellis/workspace': fileURLToPath(
          new URL('../../src/runtime/workspace/index.ts', import.meta.url),
        ),
      },
    },
  }),
)
