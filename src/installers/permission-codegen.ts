import { relative, resolve } from 'node:path'

import { addTemplate, addTypeTemplate, updateTemplates } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import {
  buildOperationRegistry,
  renderOperationRegistryGeneratedFiles,
  type OperationRegistry,
} from '../module-internals/operation-registry-codegen.js'
import {
  extractPermissionCodegenMetadata,
  renderPermissionCodegenMetadata,
  renderPermissionCodegenTypes,
  renderPermissionRuntimeExports,
  shouldRefreshPermissionCodegen,
} from '../module-internals/permissions-codegen.js'
import {
  extractPublicSurfaceCodegenMetadata,
  renderPublicSurfaceCodegenMetadata,
  renderPublicSurfaceCodegenTypes,
  shouldRefreshPublicSurfaceCodegen,
} from '../module-internals/public-surface-codegen.js'

interface InstallPermissionCodegenOptions {
  nuxt: Nuxt
  include: string[]
}

function toPosixPath(value: string): string {
  return value.replaceAll('\\', '/')
}

function templatePathForImports(nuxt: Nuxt, filename: string): string {
  return toPosixPath(relative(nuxt.options.rootDir, resolve(nuxt.options.buildDir, filename)))
}

function renderEmptyOperationRefsModule(): string {
  return `// AUTO-GENERATED. Do not edit.
export {}
`
}

function renderEmptyOperationHandlesModule(): string {
  return `// AUTO-GENERATED. Do not edit.
export const operations = {
  byId: {},
} as const
`
}

function renderOperationRegistryTemplate(
  registry: OperationRegistry,
  path: string,
  options: {
    operationRefsPath: string
    operationHandlesPath: string
  },
): string {
  if (registry.operations.length === 0) {
    return path === options.operationRefsPath
      ? renderEmptyOperationRefsModule()
      : renderEmptyOperationHandlesModule()
  }

  const rendered = renderOperationRegistryGeneratedFiles(registry, {
    operationRefsPath: options.operationRefsPath,
    operationHandlesPath: options.operationHandlesPath,
    projectOperationRefImport: '#trellis/mcp',
    defineOperationHandleImport: '#trellis/mcp',
    apiImport: '#trellis/api',
    runtimes: ['mcp'],
  })
  const file = rendered.find((entry) => entry.path === path)
  if (!file) {
    throw new Error(`Operation registry template "${path}" was not generated.`)
  }
  return file.content
}

export function installPermissionCodegen(options: InstallPermissionCodegenOptions): void {
  const { nuxt, include } = options

  const readMetadata = () => extractPermissionCodegenMetadata(nuxt.options.rootDir, include)
  const readPublicSurfaceMetadata = () => extractPublicSurfaceCodegenMetadata(nuxt.options.rootDir)
  const readOperationRegistry = () => buildOperationRegistry(readPublicSurfaceMetadata())
  const operationRefsFilename = 'trellis/operation-refs.ts'
  const operationHandlesFilename = 'trellis/operation-handles/mcp.ts'
  const operationRefsPath = templatePathForImports(nuxt, operationRefsFilename)
  const operationHandlesPath = templatePathForImports(nuxt, operationHandlesFilename)

  addTypeTemplate({
    filename: 'types/trellis-permissions.d.ts',
    write: true,
    getContents: () => renderPermissionCodegenTypes(readMetadata()),
  })

  addTemplate({
    filename: 'trellis/permissions.json',
    write: true,
    getContents: () => renderPermissionCodegenMetadata(readMetadata()),
  })

  const permissionRuntimeTemplate = addTemplate({
    filename: 'trellis/permissions.ts',
    write: true,
    getContents: () => renderPermissionRuntimeExports(readMetadata()),
  })
  nuxt.options.alias['#trellis/permissions'] = permissionRuntimeTemplate.dst

  addTypeTemplate({
    filename: 'types/trellis-public-surface.d.ts',
    write: true,
    getContents: () => renderPublicSurfaceCodegenTypes(readPublicSurfaceMetadata()),
  })

  addTemplate({
    filename: 'trellis/public-surface.json',
    write: true,
    getContents: () => renderPublicSurfaceCodegenMetadata(readPublicSurfaceMetadata()),
  })

  addTemplate({
    filename: operationRefsFilename,
    write: true,
    getContents: () =>
      renderOperationRegistryTemplate(readOperationRegistry(), operationRefsPath, {
        operationRefsPath,
        operationHandlesPath,
      }),
  })

  const operationHandlesTemplate = addTemplate({
    filename: operationHandlesFilename,
    write: true,
    getContents: () =>
      renderOperationRegistryTemplate(readOperationRegistry(), operationHandlesPath, {
        operationRefsPath,
        operationHandlesPath,
      }),
  })
  nuxt.options.alias['#trellis/operations/mcp'] = operationHandlesTemplate.dst

  nuxt.hook('builder:watch', async (_event, path) => {
    if (!shouldRefreshPermissionCodegen(path, include) && !shouldRefreshPublicSurfaceCodegen(path))
      return
    await updateTemplates()
  })
}
