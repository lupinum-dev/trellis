import { relative, resolve } from 'node:path'

import type { createResolver } from '@nuxt/kit'
import { addTemplate, addTypeTemplate, updateTemplates } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import type { OperationHandleBindingInput } from '../module-internals/operation-handle-codegen.js'
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
  resolver: ReturnType<typeof createResolver>
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

function renderEmptyOperationProjectionsModule(): string {
  return `// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
  executeById: {},
  previewById: {},
} as const satisfies OperationProjectionRegistry
`
}

function renderOperationRegistryTemplate(
  registry: OperationRegistry,
  path: string,
  options: {
    operationRefsPath: string
    operationHandlesPath: string
    operationProjectionsPath: string
    defineOperationHandleImport: string
    projectOperationRefImport: string
    runtimes: OperationHandleBindingInput['runtimes']
  },
): string {
  if (registry.operations.length === 0) {
    if (path === options.operationRefsPath) return renderEmptyOperationRefsModule()
    if (path === options.operationHandlesPath) return renderEmptyOperationHandlesModule()
    return renderEmptyOperationProjectionsModule()
  }

  const rendered = renderOperationRegistryGeneratedFiles(registry, {
    operationRefsPath: options.operationRefsPath,
    operationHandlesPath: options.operationHandlesPath,
    operationProjectionsPath: options.operationProjectionsPath,
    projectOperationRefImport: options.projectOperationRefImport,
    defineOperationHandleImport: options.defineOperationHandleImport,
    apiImport: '#trellis/api',
    runtimes: options.runtimes,
  })
  const file = rendered.find((entry) => entry.path === path)
  if (!file) {
    throw new Error(`Operation registry template "${path}" was not generated.`)
  }
  return file.content
}

export function installPermissionCodegen(options: InstallPermissionCodegenOptions): void {
  const { nuxt, resolver, include } = options

  const readMetadata = () => extractPermissionCodegenMetadata(nuxt.options.rootDir, include)
  const readPublicSurfaceMetadata = () => extractPublicSurfaceCodegenMetadata(nuxt.options.rootDir)
  const readOperationRegistry = () => buildOperationRegistry(readPublicSurfaceMetadata())
  const operationRefsFilename = 'trellis/operation-refs.ts'
  const operationProjectionsFilename = 'trellis/operation-projections.ts'
  const operationRuntimeFilename = 'trellis/operation-runtime.ts'
  const operationHandleTargets = [
    { runtime: 'client', filename: 'trellis/operation-handles/client.ts' },
    { runtime: 'server', filename: 'trellis/operation-handles/server.ts' },
    { runtime: 'testing', filename: 'trellis/operation-handles/testing.ts' },
    { runtime: 'mcp', filename: 'trellis/operation-handles/mcp.ts' },
  ] as const
  const operationRefsPath = templatePathForImports(nuxt, operationRefsFilename)
  const operationProjectionsPath = templatePathForImports(nuxt, operationProjectionsFilename)
  const operationHandleTargetsWithPaths = operationHandleTargets.map((target) => ({
    ...target,
    path: templatePathForImports(nuxt, target.filename),
  }))

  const renderRegistryFile = (
    path: string,
    operationHandlesPath: string,
    runtimes: OperationHandleBindingInput['runtimes'],
  ) =>
    renderOperationRegistryTemplate(readOperationRegistry(), path, {
      operationRefsPath,
      operationHandlesPath,
      operationProjectionsPath,
      defineOperationHandleImport: '#trellis/operation-runtime',
      projectOperationRefImport: '#trellis/operation-runtime',
      runtimes,
    })

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
      renderRegistryFile(operationRefsPath, operationHandleTargetsWithPaths[0]!.path, ['client']),
  })

  const operationRuntimeTemplate = addTemplate({
    filename: operationRuntimeFilename,
    write: true,
    getContents: () => {
      const operationMetadataPath = resolver.resolve('./runtime/functions/operation-metadata')
      return `export { defineOperationHandle, projectOperationRef } from '${operationMetadataPath}'
`
    },
  })
  nuxt.options.alias['#trellis/operation-runtime'] = operationRuntimeTemplate.dst

  for (const target of operationHandleTargetsWithPaths) {
    const operationHandlesTemplate = addTemplate({
      filename: target.filename,
      write: true,
      getContents: () => renderRegistryFile(target.path, target.path, [target.runtime]),
    })
    nuxt.options.alias[`#trellis/operations/${target.runtime}`] = operationHandlesTemplate.dst
  }

  const operationProjectionsTemplate = addTemplate({
    filename: operationProjectionsFilename,
    write: true,
    getContents: () =>
      renderRegistryFile(operationProjectionsPath, operationHandleTargetsWithPaths[0]!.path, [
        'client',
      ]),
  })
  nuxt.options.alias['#trellis/operation-projections'] = operationProjectionsTemplate.dst

  nuxt.hook('builder:watch', async (_event, path) => {
    if (!shouldRefreshPermissionCodegen(path, include) && !shouldRefreshPublicSurfaceCodegen(path))
      return
    await updateTemplates()
  })
}
