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

function templateFilenames(): string[] {
  return nuxtKitMocks.addTemplate.mock.calls.map(([input]) => input.filename)
}

describe('permission codegen installer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits permission and public-surface metadata without operation aliases', () => {
    const rootDir = createFixture({
      'convex/features/projects/permissions.ts': `
        import { definePermission } from '@lupinum/trellis/app'

        export const projectRead = definePermission({
          key: 'projects.read',
          description: 'Read projects',
        })
      `,
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
    })
    const nuxt = createNuxt(rootDir)

    installPermissionCodegen({
      nuxt: nuxt as never,
      include: ['convex/features/**/permissions.ts'],
    })

    expect(nuxt.options.alias).toEqual({
      '#trellis/permissions': '/virtual/trellis/permissions.ts',
    })
    expect(templateFilenames()).toEqual(
      expect.arrayContaining(['trellis/permissions.ts', 'trellis/public-surface.json']),
    )
    expect(templateFilenames()).not.toEqual(
      expect.arrayContaining([
        'trellis/operation-refs.ts',
        'trellis/operation-runtime.ts',
        'trellis/operation-handles/mcp.ts',
        'trellis/operation-projections.ts',
      ]),
    )

    const permissionsSource = getTemplate('trellis/permissions.ts').getContents()
    expect(permissionsSource).toContain('projects.read')

    const publicSurfaceSource = getTemplate('trellis/public-surface.json').getContents()
    expect(publicSurfaceSource).toContain('projects.create')
    expect(publicSurfaceSource).toContain('createProject')
  })
})
