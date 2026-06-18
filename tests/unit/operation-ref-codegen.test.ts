import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { renderConvexFunctionRef } from '../../src/module-internals/operation-ref-codegen'
import {
  renderStarterFixtureFiles,
  renderStarterGeneratedFiles,
  type StarterFixtureManifest,
} from '../../src/module-internals/starter-fixture-codegen'

describe('operation ref codegen', () => {
  const fixtureRoot = resolve(process.cwd(), 'tests/fixtures/phase0-workspace-mcp')

  it('renders registry-derived operation bindings from the phase0 starter manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(fixtureRoot, 'starter.manifest.json'), 'utf8'),
    ) as StarterFixtureManifest
    const rendered = renderStarterGeneratedFiles(manifest, fixtureRoot)

    const operationRefsFixture = readFileSync(
      resolve(fixtureRoot, 'generated/operation-refs.ts'),
      'utf8',
    )
    const operationHandlesFixture = readFileSync(
      resolve(fixtureRoot, 'generated/operation-handles/mcp.ts'),
      'utf8',
    )

    expect(rendered).toEqual([
      { path: 'generated/operation-refs.ts', content: operationRefsFixture },
      { path: 'generated/operation-handles/mcp.ts', content: operationHandlesFixture },
    ])
    expect(JSON.stringify(manifest)).not.toContain('executeDeleteProjectRef')
    expect(JSON.stringify(manifest)).not.toContain('createProjectHandle')
  })

  it('renders a fixture-backed workspace-mcp starter file set from the manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(fixtureRoot, 'starter.manifest.json'), 'utf8'),
    ) as StarterFixtureManifest
    const rendered = renderStarterFixtureFiles(fixtureRoot, manifest)
    const byPath = new Map(rendered.map((file) => [file.path, file.content]))

    expect(byPath.has('.env.local')).toBe(false)
    expect(byPath.has('.nuxt/nuxt.d.ts')).toBe(false)
    expect(byPath.has('.output/nitro.json')).toBe(false)
    expect(byPath.has('server/mcp/tools/delete-project.ts')).toBe(true)
    expect(byPath.get('generated/operation-refs.ts')).toBe(
      readFileSync(resolve(fixtureRoot, 'generated/operation-refs.ts'), 'utf8'),
    )
    expect(byPath.get('generated/operation-handles/mcp.ts')).toBe(
      readFileSync(resolve(fixtureRoot, 'generated/operation-handles/mcp.ts'), 'utf8'),
    )
    expect(byPath.has('generated/mcp-tool-refs.ts')).toBe(false)
  })

  it('derives Convex function refs from generated api paths', () => {
    expect(renderConvexFunctionRef(['features', 'projects', 'domain', 'deleteProject'])).toBe(
      'features/projects/domain:deleteProject',
    )
  })
})
