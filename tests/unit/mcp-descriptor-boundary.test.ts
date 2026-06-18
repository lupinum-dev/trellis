import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildOperationRegistry,
  renderOperationRegistryGeneratedFiles,
} from '../../src/module-internals/operation-registry-codegen'
import { extractPublicSurfaceCodegenMetadata } from '../../src/module-internals/public-surface-codegen'

const advancedOperationToolFiles = ['apps/harness/server/mcp/tools/delete-post.ts'] as const

const componentBridgeOperationToolFiles = [
  'examples/08-component-mini-cms/server/mcp/tools/create-page.ts',
  'examples/08-component-mini-cms/server/mcp/tools/save-draft.ts',
  'examples/08-component-mini-cms/server/mcp/tools/publish-page.ts',
] as const

const referenceRunbookOperationToolFiles = [
  'examples/07-mcp-reference/server/mcp/tools/runbooks/create.ts',
  'examples/07-mcp-reference/server/mcp/tools/runbooks/update.ts',
  'examples/07-mcp-reference/server/mcp/tools/runbooks/delete.ts',
  'examples/07-mcp-reference/server/mcp/tools/runbooks/bulk-delete.ts',
] as const

const generatedProjectionRegistryExamples = [
  'examples/03-team-workspace',
  'examples/04-saas-platform',
  'examples/05-visibility-access',
  'examples/07-mcp-reference',
] as const

describe('MCP operation boundary', () => {
  it('keeps the MCP reference app on generated operation handles', () => {
    for (const file of referenceRunbookOperationToolFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')

      expect(source, file).toContain("from '#trellis/operations/mcp'")
      expect(source, file).toContain('tool.operation(operations.')
      expect(source, file).not.toMatch(/OperationRef\(/)
      expect(source, file).not.toMatch(/from ['"].*convex\/features\/runbooks/)
    }

    const exampleRoot = resolve(process.cwd(), 'examples/07-mcp-reference')
    const registry = buildOperationRegistry(extractPublicSurfaceCodegenMetadata(exampleRoot))
    const rendered = renderOperationRegistryGeneratedFiles(registry, {
      apiImport: '#trellis/api',
      defineOperationHandleImport: '#trellis/mcp',
      operationHandlesPath: '.nuxt/trellis/operation-handles/mcp.ts',
      operationProjectionsPath: 'generated/operation-projections.ts',
      operationRefsPath: '.nuxt/trellis/operation-refs.ts',
      projectOperationRefImport: '#trellis/mcp',
      runtimes: ['mcp'],
    })
    const handles = rendered.find((file) =>
      file.path.endsWith('/operation-handles/mcp.ts'),
    )?.content
    const projections = rendered.find(
      (file) => file.path === 'generated/operation-projections.ts',
    )?.content

    expect(handles).toContain("from '../../../shared/features/runbooks/operations'")
    expect(handles).not.toContain('convex/')
    expect(handles).toContain("'runbooks.remove': removeRunbookHandle")
    expect(handles).toContain("'runbooks.bulkRemove': bulkRemoveRunbooksHandle")
    expect(projections).toBe(
      readFileSync(resolve(exampleRoot, 'generated/operation-projections.ts'), 'utf8'),
    )
  })

  it('keeps advanced explicit MCP tools on projected refs without domain imports', () => {
    for (const file of advancedOperationToolFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')

      expect(source, file).toMatch(/tool\.operation\([^)]*[,)]/)
      expect(source, file).toMatch(/OperationRef\(/)
      expect(source, file).not.toMatch(/from ['"].*convex\/.*\/domain['"]/)
      expect(source, file).not.toMatch(/from ['"].*convex\/posts['"]/)
    }
  })

  it('keeps component bridge MCP tools on explicit host bridge refs', () => {
    for (const file of componentBridgeOperationToolFiles) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8')

      expect(source, file).toMatch(/tool\.operation\([^)]*[,)]/)
      expect(source, file).toMatch(/OperationRef\(/)
      expect(source, file).toContain('api.features.pages.domain.')
      expect(source, file).not.toContain("from '#trellis/operations/mcp'")
      expect(source, file).not.toContain('api.components.')
    }
  })

  it('keeps maintained generated operation projection registries in sync', () => {
    for (const example of generatedProjectionRegistryExamples) {
      const exampleRoot = resolve(process.cwd(), example)
      const registry = buildOperationRegistry(extractPublicSurfaceCodegenMetadata(exampleRoot))
      const rendered = renderOperationRegistryGeneratedFiles(registry, {
        apiImport: '#trellis/api',
        defineOperationHandleImport: '#trellis/mcp',
        operationHandlesPath: '.nuxt/trellis/operation-handles/mcp.ts',
        operationProjectionsPath: 'generated/operation-projections.ts',
        operationRefsPath: '.nuxt/trellis/operation-refs.ts',
        projectOperationRefImport: '#trellis/mcp',
        runtimes: ['mcp'],
      })
      const projections = rendered.find(
        (file) => file.path === 'generated/operation-projections.ts',
      )?.content

      expect(projections, example).toBe(
        readFileSync(resolve(exampleRoot, 'generated/operation-projections.ts'), 'utf8'),
      )
    }
  })
})
