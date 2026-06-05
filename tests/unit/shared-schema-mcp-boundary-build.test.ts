import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function listSourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry)
    if (statSync(path).isDirectory()) {
      files.push(...listSourceFiles(path))
      continue
    }
    if (/\.(?:ts|tsx|vue)$/.test(path)) files.push(path)
  }
  return files
}

describe('shared schema + MCP boundary build smoke', () => {
  it(
    'builds a Nuxt app whose server files import the schema and MCP subpaths',
    { timeout: 120000 },
    () => {
      const fixtureRoot = resolve(process.cwd(), 'tests/fixtures/shared-schema-mcp-boundary')
      const result = spawnSync('pnpm', ['exec', 'nuxi', 'build', '--cwd', fixtureRoot], {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NUXT_TELEMETRY_DISABLED: '1',
        },
      })

      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

      expect(result.status, output).toBe(0)
      expect(output).not.toContain('failed to find "useNuxtApp" imported from "#imports"')
    },
  )

  it('keeps fixture server and shared files on public/generated Trellis imports', () => {
    const fixtureRoot = resolve(process.cwd(), 'tests/fixtures/shared-schema-mcp-boundary')
    const files = [
      ...listSourceFiles(resolve(fixtureRoot, 'server')),
      ...listSourceFiles(resolve(fixtureRoot, 'shared')),
    ]

    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/src\/runtime|\.\.\/.*src\/runtime/)
    }
  })
})
