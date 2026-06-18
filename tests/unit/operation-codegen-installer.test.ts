import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installOperationCodegen } from '../../src/installers/operation-codegen'

const nuxtKitMocks = vi.hoisted(() => ({
  addTemplate: vi.fn(({ filename }: { filename: string }) => ({
    dst: `/virtual/${filename}`,
  })),
  updateTemplates: vi.fn(),
}))

vi.mock('@nuxt/kit', () => ({
  addTemplate: nuxtKitMocks.addTemplate,
  updateTemplates: nuxtKitMocks.updateTemplates,
}))

function createFixture(files: Record<string, string>) {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'trellis-operation-codegen-installer-'))
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

function createResolver() {
  return {
    resolve: (path: string) => `/resolved${path}`,
  }
}

function getTemplate(filename: string): { getContents: () => string } {
  const call = nuxtKitMocks.addTemplate.mock.calls.find(([input]) => input.filename === filename)
  expect(call, filename).toBeDefined()
  return call![0] as { getContents: () => string }
}

describe('operation codegen installer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits registry-derived operation refs and runtime-filtered handles', () => {
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

    installOperationCodegen({
      nuxt: nuxt as never,
      resolver: createResolver() as never,
    })

    expect(nuxt.options.alias).toMatchObject({
      '#trellis/operation-runtime': '/virtual/trellis/operation-runtime.ts',
      '#trellis/operations/client': '/virtual/trellis/operation-handles/client.ts',
      '#trellis/operations/mcp': '/virtual/trellis/operation-handles/mcp.ts',
      '#trellis/operations/server': '/virtual/trellis/operation-handles/server.ts',
      '#trellis/operations/testing': '/virtual/trellis/operation-handles/testing.ts',
      '#trellis/operation-projections': '/virtual/trellis/operation-projections.ts',
    })

    const runtimeSource = getTemplate('trellis/operation-runtime.ts').getContents()
    expect(runtimeSource).toContain(
      "export { defineOperationHandle, projectOperationRef } from '/resolved./runtime/functions/operation-metadata'",
    )

    const refsSource = getTemplate('trellis/operation-refs.ts').getContents()
    expect(refsSource).toContain("import { projectOperationRef } from '#trellis/operation-runtime'")
    expect(refsSource).toContain("import { api } from '#trellis/api'")
    expect(refsSource).toContain("from '../../shared/features/projects/operations'")
    expect(refsSource).toContain('api.features.projects.domain.createProject')
    expect(refsSource).toContain("{ functionRef: 'projects.create' }")
    expect(refsSource).toContain("functionRef: 'projects.delete:preview'")
    expect(refsSource).toContain("executeFunctionRef: 'projects.delete'")

    for (const runtime of ['client', 'server', 'testing', 'mcp'] as const) {
      const handlesSource = getTemplate(`trellis/operation-handles/${runtime}.ts`).getContents()
      expect(handlesSource).toContain(
        "import { defineOperationHandle } from '#trellis/operation-runtime'",
      )
      expect(handlesSource).toContain("from '../../../shared/features/projects/operations'")
      expect(handlesSource).toContain("from '../operation-refs'")
      expect(handlesSource).toContain("executeOperation: 'mutation'")
      expect(handlesSource).toContain("previewOperation: 'mutation'")
      expect(handlesSource).toContain(`runtimes: ['${runtime}']`)
      expect(handlesSource).toContain("'projects.delete': deleteProjectHandle")
    }

    const projectionsSource = getTemplate('trellis/operation-projections.ts').getContents()
    expect(projectionsSource).toContain(
      "import type { OperationProjectionRegistry } from '@lupinum/trellis/app'",
    )
    expect(projectionsSource).toContain("fingerprint: 'sha256:")
    expect(projectionsSource).toContain("'projects.create': 'projects.create'")
    expect(projectionsSource).toContain("'projects.delete': 'projects.delete'")
    expect(projectionsSource).toContain("'projects.delete': 'projects.delete:preview'")
  })

  it('emits empty operation registry modules when no operations are defined', () => {
    const rootDir = createFixture({})
    const nuxt = createNuxt(rootDir)

    installOperationCodegen({
      nuxt: nuxt as never,
      resolver: createResolver() as never,
    })

    expect(getTemplate('trellis/operation-refs.ts').getContents())
      .toBe(`// AUTO-GENERATED. Do not edit.
export {}
`)
    for (const runtime of ['client', 'server', 'testing', 'mcp'] as const) {
      expect(getTemplate(`trellis/operation-handles/${runtime}.ts`).getContents())
        .toBe(`// AUTO-GENERATED. Do not edit.
export const operations = {
  byId: {},
} as const
`)
    }
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
