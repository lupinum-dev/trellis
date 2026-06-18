import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installPermissionCodegen } from '../../src/installers/permission-codegen'

const nuxtKitMocks = vi.hoisted(() => ({
  addTemplate: vi.fn(({ filename }: { filename: string }) => ({
    dst: `/virtual/${filename}`,
  })),
  addTypeTemplate: vi.fn(({ filename }: { filename: string }) => ({
    dst: `/virtual/${filename}`,
  })),
  updateTemplates: vi.fn(),
}))

vi.mock('@nuxt/kit', () => ({
  addTemplate: nuxtKitMocks.addTemplate,
  addTypeTemplate: nuxtKitMocks.addTypeTemplate,
  updateTemplates: nuxtKitMocks.updateTemplates,
}))

function createFixture(files: Record<string, string>) {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'trellis-permission-codegen-installer-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = resolve(rootDir, relativePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, contents, 'utf8')
  }
  return rootDir
}

function createNuxt(rootDir: string) {
  return {
    options: {
      alias: {} as Record<string, string>,
      buildDir: resolve(rootDir, '.nuxt'),
      rootDir,
    },
    hook: vi.fn(),
  }
}

function getTemplate(filename: string): { getContents: () => string } {
  const call = nuxtKitMocks.addTemplate.mock.calls.find(([input]) => input.filename === filename)
  expect(call, filename).toBeDefined()
  return call![0] as { getContents: () => string }
}

describe('permission codegen installer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits registry-derived operation refs and MCP handles', () => {
    const rootDir = createFixture({
      'shared/features/projects/operations.ts': `
        import { defineOperationDescriptor, operationPreviewValidator } from '@lupinum/trellis/backend'
        import { v } from 'convex/values'

        export const createProjectDescriptor = defineOperationDescriptor({
          id: 'projects.create',
          kind: 'safe',
          args: { name: v.string() },
        })

        export const deleteProjectDescriptor = defineOperationDescriptor({
          id: 'projects.delete',
          kind: 'destructive',
          args: { id: v.string() },
          previewReturns: operationPreviewValidator({
            confirm: v.object({ id: v.string() }),
          }),
        })
      `,
      'convex/features/projects/domain.ts': `
        import { mutation } from '../../functions'
        import { createProjectDescriptor, deleteProjectDescriptor } from '../../../shared/features/projects/operations'

        export const createProject = mutation.workspace(createProjectDescriptor)
        export const deleteProject = mutation.workspace(deleteProjectDescriptor)
        export const previewDeleteProject = mutation.workspace.preview(deleteProjectDescriptor)
      `,
    })
    const nuxt = createNuxt(rootDir)

    installPermissionCodegen({
      nuxt: nuxt as never,
      include: [],
    })

    expect(nuxt.options.alias).toMatchObject({
      '#trellis/operations/mcp': '/virtual/trellis/operation-handles/mcp.ts',
      '#trellis/operation-projections': '/virtual/trellis/operation-projections.ts',
    })

    const refsSource = getTemplate('trellis/operation-refs.ts').getContents()
    expect(refsSource).toContain("import { projectOperationRef } from '#trellis/mcp'")
    expect(refsSource).toContain("import { api } from '#trellis/api'")
    expect(refsSource).toContain("from '../../shared/features/projects/operations'")
    expect(refsSource).toContain('api.features.projects.domain.createProject')
    expect(refsSource).toContain("{ functionRef: 'features/projects/domain:createProject' }")
    expect(refsSource).toContain("functionRef: 'features/projects/domain:previewDeleteProject'")
    expect(refsSource).toContain("executeFunctionRef: 'features/projects/domain:deleteProject'")

    const handlesSource = getTemplate('trellis/operation-handles/mcp.ts').getContents()
    expect(handlesSource).toContain("import { defineOperationHandle } from '#trellis/mcp'")
    expect(handlesSource).toContain("from '../../../shared/features/projects/operations'")
    expect(handlesSource).toContain("from '../operation-refs'")
    expect(handlesSource).toContain("executeOperation: 'mutation'")
    expect(handlesSource).toContain("previewOperation: 'mutation'")
    expect(handlesSource).toContain("'projects.delete': deleteProjectHandle")

    const projectionsSource = getTemplate('trellis/operation-projections.ts').getContents()
    expect(projectionsSource).toContain(
      "import type { OperationProjectionRegistry } from '@lupinum/trellis/app'",
    )
    expect(projectionsSource).toContain("fingerprint: 'sha256:")
    expect(projectionsSource).toContain(
      "'projects.create': 'features/projects/domain:createProject'",
    )
    expect(projectionsSource).toContain(
      "'projects.delete': 'features/projects/domain:deleteProject'",
    )
    expect(projectionsSource).toContain(
      "'projects.delete': 'features/projects/domain:previewDeleteProject'",
    )
  })

  it('emits empty operation registry modules when no operations are defined', () => {
    const rootDir = createFixture({})
    const nuxt = createNuxt(rootDir)

    installPermissionCodegen({
      nuxt: nuxt as never,
      include: [],
    })

    expect(getTemplate('trellis/operation-refs.ts').getContents())
      .toBe(`// AUTO-GENERATED. Do not edit.
export {}
`)
    expect(getTemplate('trellis/operation-handles/mcp.ts').getContents())
      .toBe(`// AUTO-GENERATED. Do not edit.
export const operations = {
  byId: {},
} as const
`)
    expect(getTemplate('trellis/operation-projections.ts').getContents())
      .toBe(`// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  executeById: {},
  previewById: {},
} as const satisfies OperationProjectionRegistry
`)
  })
})
