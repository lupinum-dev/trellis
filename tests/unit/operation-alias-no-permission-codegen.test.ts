import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function runNuxi(fixtureRoot: string, command: 'prepare' | 'typecheck') {
  const result = spawnSync('pnpm', ['exec', 'nuxi', command, '--cwd', fixtureRoot], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NUXT_TELEMETRY_DISABLED: '1',
    },
  })

  return {
    status: result.status,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

describe('operation aliases without permission codegen', () => {
  it(
    'prepares and typechecks MCP operation handles with permission codegen disabled',
    { timeout: 120000 },
    () => {
      const fixtureRoot = resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp')
      const nuxtConfig = readFileSync(resolve(fixtureRoot, 'nuxt.config.ts'), 'utf8')
      expect(nuxtConfig).not.toContain('codegen')
      expect(nuxtConfig).not.toContain('permissions:')

      const prepare = runNuxi(fixtureRoot, 'prepare')
      expect(prepare.status, prepare.output).toBe(0)

      const typecheck = runNuxi(fixtureRoot, 'typecheck')
      expect(typecheck.status, typecheck.output).toBe(0)

      const generatedMcpHandlesPath = resolve(fixtureRoot, '.nuxt/trellis/operation-handles/mcp.ts')
      const generatedMcpHandles = readFileSync(generatedMcpHandlesPath, 'utf8')
      expect(generatedMcpHandles).toContain("runtimes: ['mcp']")
      expect(generatedMcpHandles).toContain("'projects.create': createProjectHandle")
      expect(generatedMcpHandles).toContain('executeRef: projectsCreateExecuteRef')

      const generatedRefs = readFileSync(
        resolve(fixtureRoot, '.nuxt/trellis/operation-refs.ts'),
        'utf8',
      )
      expect(generatedRefs).toContain("import { api } from '#trellis/api'")
      expect(generatedRefs).toContain('api.features.projects.domain.createProject')

      const generatedTsconfig = readFileSync(resolve(fixtureRoot, '.nuxt/tsconfig.json'), 'utf8')
      expect(generatedTsconfig).toContain('"#trellis/operations/mcp"')
      expect(generatedTsconfig).toContain('./trellis/operation-handles/mcp')

      const virtualAliasTool = readFileSync(
        resolve(fixtureRoot, 'server/mcp/tools/create-project-from-virtual-alias.ts'),
        'utf8',
      )
      expect(virtualAliasTool).toContain("from '#trellis/operations/mcp'")
      expect(virtualAliasTool).not.toContain('generated/operation-handles')

      expect(existsSync(resolve(fixtureRoot, '.nuxt/trellis/permissions.ts'))).toBe(false)
      expect(existsSync(resolve(fixtureRoot, '.nuxt/types/trellis-permissions.d.ts'))).toBe(false)
    },
  )
})
