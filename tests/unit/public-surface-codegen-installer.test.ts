import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installPublicSurfaceCodegen } from '../../src/installers/public-surface-codegen'

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
  const rootDir = mkdtempSync(resolve(tmpdir(), 'trellis-public-surface-installer-'))
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

function getTypeTemplate(filename: string): { getContents: () => string } {
  const call = nuxtKitMocks.addTypeTemplate.mock.calls.find(
    ([input]) => input.filename === filename,
  )
  expect(call, filename).toBeDefined()
  return call![0] as { getContents: () => string }
}

describe('public surface codegen installer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits operation, projection, and tool inventory without permission codegen', () => {
    const rootDir = createFixture({
      'shared/features/projects/operations.ts': `
        import { defineOperationDescriptor } from '@lupinum/trellis/backend'

        export const createProjectDescriptor = defineOperationDescriptor({
          id: 'projects.create',
          kind: 'safe',
          args: {},
        })
      `,
      'convex/features/projects/domain.ts': `
        import { mutation } from '../../functions'
        import { createProjectDescriptor } from '../../../shared/features/projects/operations'

        export const createProject = mutation.workspace(createProjectDescriptor)
      `,
      'server/mcp/tools/create-project.ts': `
        import { tool } from '../runtime'
        import { operations } from '#trellis/operations/mcp'

        export default tool.operation(operations.projects.create, {
          name: 'create-project',
        })
      `,
    })
    const nuxt = createNuxt(rootDir)

    installPublicSurfaceCodegen({ nuxt: nuxt as never })

    expect(nuxt.options.alias).toEqual({})

    const publicSurfaceSource = getTemplate('trellis/public-surface.json').getContents()
    expect(publicSurfaceSource).toContain('projects.create')
    expect(publicSurfaceSource).toContain('createProject')
    expect(publicSurfaceSource).toContain('create-project')

    const typesSource = getTypeTemplate('types/trellis-public-surface.d.ts').getContents()
    expect(typesSource).toContain('projects.create')
    expect(typesSource).toContain('create-project')
  })
})
