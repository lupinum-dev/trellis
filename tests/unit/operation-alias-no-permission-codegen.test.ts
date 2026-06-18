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
    'prepares and typechecks MCP and server operation handles with permission codegen disabled',
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

      const generatedServerHandlesPath = resolve(
        fixtureRoot,
        '.nuxt/trellis/operation-handles/server.ts',
      )
      const generatedServerHandles = readFileSync(generatedServerHandlesPath, 'utf8')
      expect(generatedServerHandles).toContain("runtimes: ['server']")
      expect(generatedServerHandles).toContain("'projects.create': createProjectHandle")
      expect(generatedServerHandles).toContain('executeRef: projectsCreateExecuteRef')

      const generatedRefs = readFileSync(
        resolve(fixtureRoot, '.nuxt/trellis/operation-refs.ts'),
        'utf8',
      )
      expect(generatedRefs).toContain("import { api } from '#trellis/api'")
      expect(generatedRefs).toContain('api.features.projects.domain.createProject')

      const generatedTsconfig = readFileSync(resolve(fixtureRoot, '.nuxt/tsconfig.json'), 'utf8')
      expect(generatedTsconfig).toContain('"#trellis/operations/mcp"')
      expect(generatedTsconfig).toContain('./trellis/operation-handles/mcp')
      expect(generatedTsconfig).toContain('"#trellis/operations/server"')
      expect(generatedTsconfig).toContain('./trellis/operation-handles/server')

      const virtualAliasTool = readFileSync(
        resolve(fixtureRoot, 'server/mcp/tools/create-project-from-virtual-alias.ts'),
        'utf8',
      )
      expect(virtualAliasTool).toContain("from '#trellis/operations/mcp'")
      expect(virtualAliasTool).not.toContain('generated/operation-handles')

      const serverRoute = readFileSync(resolve(fixtureRoot, 'server/api/projects.post.ts'), 'utf8')
      expect(serverRoute).toContain("from '@lupinum/trellis/server'")
      expect(serverRoute).toContain("from '#trellis/operations/server'")
      expect(serverRoute).toContain('serverOperation(event, operations.projects.create)')
      expect(serverRoute).not.toContain('generated/operation-handles')
      expect(serverRoute).not.toContain('operation-refs')

      expect(existsSync(resolve(fixtureRoot, '.nuxt/trellis/permissions.ts'))).toBe(false)
      expect(existsSync(resolve(fixtureRoot, '.nuxt/types/trellis-permissions.d.ts'))).toBe(false)
    },
  )
})
