import { relative, resolve } from 'node:path'

import type { createResolver } from '@nuxt/kit'
import { addTemplate, updateTemplates } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import type { OperationHandleBindingInput } from '../module-internals/operation-handle-codegen.js'
import {
  buildOperationRegistry,
  renderOperationRegistryGeneratedFiles,
  type OperationRegistry,
  type OperationRegistryGeneratedFilesOptions,
} from '../module-internals/operation-registry-codegen.js'
import {
  extractPublicSurfaceCodegenMetadata,
  shouldRefreshPublicSurfaceCodegen,
} from '../module-internals/public-surface-codegen.js'

interface InstallOperationCodegenOptions {
  nuxt: Nuxt
  resolver: ReturnType<typeof createResolver>
}

function toPosixPath(value: string): string {
  return value.replaceAll('\\', '/')
}

function templatePathForImports(nuxt: Nuxt, filename: string): string {
  return toPosixPath(relative(nuxt.options.rootDir, resolve(nuxt.options.buildDir, filename)))
}

function renderOperationRegistryTemplate(
  registry: OperationRegistry,
  path: string,
  options: OperationRegistryGeneratedFilesOptions,
): string {
  const rendered = renderOperationRegistryGeneratedFiles(registry, options)
  const file = rendered.find((entry) => entry.path === path)
  if (!file) {
    throw new Error(`Operation registry template "${path}" was not generated.`)
  }
  return file.content
}

export function installOperationCodegen(options: InstallOperationCodegenOptions): void {
  const { nuxt, resolver } = options

  const readOperationRegistry = () =>
    buildOperationRegistry(extractPublicSurfaceCodegenMetadata(nuxt.options.rootDir))
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

  addTemplate({
    filename: operationRefsFilename,
    write: true,
    getContents: () =>
      renderOperationRegistryTemplate(readOperationRegistry(), operationRefsPath, {
        operationRefsPath,
        projectOperationRefImport: '#trellis/operation-runtime',
        apiImport: '#trellis/api',
        operationDescriptorTypeImport: '#trellis/operation-runtime',
        descriptorMode: 'generated-metadata',
      }),
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
    const descriptorMode =
      target.runtime === 'client' ? 'generated-metadata' : 'runtime-import'
    const operationHandlesTemplate = addTemplate({
      filename: target.filename,
      write: true,
      getContents: () =>
        renderOperationRegistryTemplate(readOperationRegistry(), target.path, {
          operationRefsPath,
          operationHandlesPath: target.path,
          projectOperationRefImport: '#trellis/operation-runtime',
          defineOperationHandleImport: '#trellis/operation-runtime',
          apiImport: '#trellis/api',
          operationDescriptorTypeImport: '#trellis/operation-runtime',
          descriptorMode,
          runtimes: [target.runtime] as OperationHandleBindingInput['runtimes'],
        }),
    })
    nuxt.options.alias[`#trellis/operations/${target.runtime}`] = operationHandlesTemplate.dst
  }

  const operationProjectionsTemplate = addTemplate({
    filename: operationProjectionsFilename,
    write: true,
    getContents: () =>
      renderOperationRegistryTemplate(readOperationRegistry(), operationProjectionsPath, {
        operationProjectionsPath,
      }),
  })
  nuxt.options.alias['#trellis/operation-projections'] = operationProjectionsTemplate.dst

  nuxt.hook('builder:watch', async (_event, path) => {
    if (!shouldRefreshPublicSurfaceCodegen(path)) return
    await updateTemplates()
  })
}
