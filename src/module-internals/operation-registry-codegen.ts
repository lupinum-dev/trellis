import { createHash } from 'node:crypto'
import { posix } from 'node:path'

import type { OperationHandleBindingInput } from './operation-handle-codegen.js'
import { renderOperationHandlesModule } from './operation-handle-codegen.js'
import type { OperationRefBindingInput } from './operation-ref-codegen.js'
import type {
  OperationDefinitionMetadata,
  OperationProjectionBindingMetadata,
  PublicSurfaceCodegenMetadata,
} from './public-surface-codegen.js'
import { renderGeneratedApiPath } from './ref-codegen.js'

export type OperationRegistryProjectionKind = 'execute' | 'preview'

export interface OperationRegistryProjection {
  exportName: string
  file: string
  line: number
  projection: OperationRegistryProjectionKind
  functionKind: 'query' | 'mutation' | 'action'
  apiPath: string[]
  functionRef: string
}

export interface OperationRegistryOperation {
  id: string
  exportName: string
  file: string
  line: number
  name?: string
  kind: 'safe' | 'destructive'
  execute: OperationRegistryProjection
  preview?: OperationRegistryProjection
}

export interface OperationRegistry {
  operations: OperationRegistryOperation[]
}

export interface OperationRegistryGeneratedFile {
  path: string
  content: string
}

export interface OperationRegistryGeneratedFilesOptions {
  operationRefsPath?: string
  operationHandlesPath?: string
  operationProjectionsPath?: string
  projectOperationRefImport?: string
  defineOperationHandleImport?: string
  operationDescriptorTypeImport?: string
  operationProjectionRegistryImport?: string
  apiImport?: string
  relativeImportExtension?: '' | '.js'
  runtimes?: OperationHandleBindingInput['runtimes']
  descriptorMode?: 'runtime-import' | 'generated-metadata'
}

type MutableOperationRegistryOperation = Omit<OperationRegistryOperation, 'execute'> & {
  execute?: OperationRegistryProjection
}

export interface OperationRegistryBuildOptions {
  convexSourceRoot?: string
}

function normalizeSourceRoot(value: string): string {
  return value.replace(/^\/+|\/+$/gu, '')
}

function toGeneratedApiPath(
  file: string,
  exportName: string,
  options: OperationRegistryBuildOptions = {},
): string[] {
  const sourceRoot = normalizeSourceRoot(options.convexSourceRoot ?? 'convex')
  const prefix = sourceRoot.length > 0 ? `${sourceRoot}/` : ''
  if (prefix && !file.startsWith(prefix)) {
    throw new Error(`Operation projection "${exportName}" must be exported from ${sourceRoot}/.`)
  }

  const modulePath = (prefix ? file.slice(prefix.length) : file)
    .replace(/\.[cm]?[jt]sx?$/u, '')
    .split('/')
    .filter(Boolean)

  if (modulePath.length === 0) {
    throw new Error(`Operation projection "${exportName}" does not produce a Convex api path.`)
  }

  return [...modulePath, exportName]
}

function toRegistryProjection(
  projection: OperationProjectionBindingMetadata,
  options: OperationRegistryBuildOptions = {},
): OperationRegistryProjection {
  const apiPath = toGeneratedApiPath(projection.file, projection.exportName, options)
  return {
    exportName: projection.exportName,
    file: projection.file,
    line: projection.line,
    projection: projection.projection,
    functionKind: projection.functionKind,
    apiPath,
    functionRef: projection.targetFunctionRef,
  }
}

function toMutableRegistryOperation(
  operation: OperationDefinitionMetadata,
): MutableOperationRegistryOperation {
  return {
    id: operation.id,
    exportName: operation.exportName,
    file: operation.file,
    line: operation.line,
    ...(operation.name ? { name: operation.name } : {}),
    kind: operation.kind,
  }
}

function getOperationHandleExportName(operationExportName: string): string {
  const baseName = operationExportName.replace(/(?:Descriptor|Operation|Op)$/u, '')
  return `${baseName || operationExportName}Handle`
}

function toIdentifierSegment(value: string): string {
  const parts = value.split(/[^A-Za-z0-9]+/u).filter(Boolean)
  return parts.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join('')
}

function toOperationIdentifierBase(operationId: string): string {
  const pascal = operationId.split('.').map(toIdentifierSegment).filter(Boolean).join('')

  if (!pascal) {
    throw new Error(`Operation id "${operationId}" does not produce a generated ref name.`)
  }

  return `${pascal.slice(0, 1).toLowerCase()}${pascal.slice(1)}`
}

function getOperationRefExportName(
  operation: OperationRegistryOperation,
  projection: OperationRegistryProjection,
): string {
  return `${toOperationIdentifierBase(operation.id)}${projection.projection === 'preview' ? 'Preview' : 'Execute'}Ref`
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

function shouldUseRuntimeNeutralHandles(options: OperationRegistryGeneratedFilesOptions): boolean {
  return (options.runtimes?.length ?? 0) > 0
}

function operationHandleRegistryFor(
  registry: OperationRegistry,
  options: OperationRegistryGeneratedFilesOptions,
): OperationRegistry {
  if (!shouldUseRuntimeNeutralHandles(options) || options.descriptorMode === 'generated-metadata') {
    return registry
  }
  return {
    operations: registry.operations.filter((operation) => operation.file.startsWith('shared/')),
  }
}

function renderImport(names: readonly string[], from: string): string {
  if (names.length > 1) {
    return [`import {`, ...names.map((name) => `  ${name},`), `} from '${from}'`].join('\n')
  }

  return `import { ${names.join(', ')} } from '${from}'`
}

function withoutExtension(path: string): string {
  return path.replace(/\.[cm]?[jt]sx?$/u, '')
}

function toRelativeImport(fromFile: string, toFile: string, extension: '' | '.js' = ''): string {
  const fromDirectory = posix.dirname(fromFile)
  const relativePath = posix.relative(fromDirectory, withoutExtension(toFile))
  const importPath = `${relativePath}${extension}`
  if (importPath.startsWith('.')) return importPath
  return `./${importPath}`
}

function descriptorImportsFor(
  operations: readonly OperationRegistryOperation[],
  fromFile: string,
  extension: '' | '.js' = '',
): { from: string; names: string[] }[] {
  const namesByFile = new Map<string, Set<string>>()
  for (const operation of operations) {
    const names = namesByFile.get(operation.file) ?? new Set<string>()
    names.add(operation.exportName)
    namesByFile.set(operation.file, names)
  }

  return [...namesByFile.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, names]) => ({
      from: toRelativeImport(fromFile, file, extension),
      names: [...names].sort((left, right) => left.localeCompare(right)),
    }))
}

function renderOperationRefsModuleFromRegistry(
  registry: OperationRegistry,
  options: {
    apiImport: string
    descriptorMode?: OperationRegistryGeneratedFilesOptions['descriptorMode']
    operationDescriptorTypeImport?: string
    operationRefsPath: string
    projectOperationRefImport: string
    relativeImportExtension?: '' | '.js'
  },
): string {
  if (registry.operations.length === 0) {
    throw new Error('Operation registry refs module requires at least one operation')
  }

  const lines = [
    '// AUTO-GENERATED. Do not edit.',
    renderImport(['projectOperationRef'], options.projectOperationRefImport),
    '',
    renderImport(['api'], options.apiImport),
  ]

  const usesGeneratedMetadata = options.descriptorMode === 'generated-metadata'

  if (!usesGeneratedMetadata) {
    for (const descriptorImport of descriptorImportsFor(
      registry.operations,
      options.operationRefsPath,
      options.relativeImportExtension,
    )) {
      lines.push(renderImport(descriptorImport.names, descriptorImport.from))
    }
  }

  lines.push('')

  if (usesGeneratedMetadata) {
    registry.operations.forEach((operation, index) => {
      lines.push(
        ...renderOperationMetadataDescriptor(
          operation,
          options.operationDescriptorTypeImport ?? '@lupinum/trellis/backend',
        ),
      )
      if (index < registry.operations.length - 1) lines.push('')
    })
    lines.push('')
  }

  const refs = buildOperationRefBindingsFromRegistry(registry)
  const projectionByRefName = new Map<string, OperationRegistryProjection>()
  const executeFunctionRefByPreviewRefName = new Map<string, string>()
  for (const operation of registry.operations) {
    projectionByRefName.set(
      getOperationRefExportName(operation, operation.execute),
      operation.execute,
    )
    if (operation.preview) {
      projectionByRefName.set(
        getOperationRefExportName(operation, operation.preview),
        operation.preview,
      )
      executeFunctionRefByPreviewRefName.set(
        getOperationRefExportName(operation, operation.preview),
        operation.execute.functionRef,
      )
    }
  }

  refs.forEach((ref, index) => {
    const projection = projectionByRefName.get(ref.exportName)
    if (!projection) {
      throw new Error(`Operation registry projection for ref "${ref.exportName}" was not found.`)
    }

    lines.push(
      `export const ${ref.exportName} = projectOperationRef(`,
      `  ${usesGeneratedMetadata ? operationMetadataDescriptorName(ref.descriptorName) : ref.descriptorName},`,
      `  '${ref.projection}',`,
      `  ${renderGeneratedApiPath(ref.apiPath, 'Operation ref')},`,
    )
    if (ref.projection === 'preview') {
      lines.push(
        '  {',
        `    functionRef: '${projection.functionRef}',`,
        `    executeFunctionRef: '${executeFunctionRefByPreviewRefName.get(ref.exportName)}',`,
        '  },',
      )
    } else {
      lines.push(`  { functionRef: '${projection.functionRef}' },`)
    }
    lines.push(')')
    if (index < refs.length - 1) lines.push('')
  })

  lines.push('')
  return lines.join('\n')
}

function renderStringMap(name: string, entries: readonly (readonly [string, string])[]): string[] {
  if (entries.length === 0) {
    return [`  ${name}: {},`]
  }

  return [`  ${name}: {`, ...entries.map(([key, value]) => `    '${key}': '${value}',`), '  },']
}

function renderStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "\\'")}'`
}

function operationMetadataDescriptorName(operationExportName: string): string {
  return `__${operationExportName}Descriptor`
}

function renderOperationMetadataDescriptor(
  operation: OperationRegistryOperation,
  operationDescriptorTypeImport: string,
): string[] {
  const lines = [
    `const ${operationMetadataDescriptorName(operation.exportName)} = {`,
    `  _type: 'operation-descriptor',`,
    `  id: ${renderStringLiteral(operation.id)},`,
  ]

  if (operation.name) {
    lines.push(`  name: ${renderStringLiteral(operation.name)},`)
  }

  lines.push(
    `  kind: '${operation.kind}',`,
    `  args: {},`,
    `} as unknown as import('${operationDescriptorTypeImport}').OperationDescriptor<${renderStringLiteral(operation.id)}>`,
  )

  return lines
}

function operationRegistryFingerprint(registry: OperationRegistry): string {
  const payload = registry.operations.map((operation) => ({
    id: operation.id,
    kind: operation.kind,
    execute: operation.execute.functionRef,
    preview: operation.preview?.functionRef,
  }))
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`
}

function renderOperationProjectionRegistryModule(
  registry: OperationRegistry,
  options: Pick<OperationRegistryGeneratedFilesOptions, 'operationProjectionRegistryImport'>,
): string {
  const executeEntries = registry.operations.map(
    (operation) => [operation.id, operation.execute.functionRef] as const,
  )
  const previewEntries = registry.operations
    .filter((operation) => operation.preview !== undefined)
    .map((operation) => [operation.id, operation.preview!.functionRef] as const)

  return [
    '// AUTO-GENERATED. Do not edit.',
    `import type { OperationProjectionRegistry } from '${options.operationProjectionRegistryImport ?? '@lupinum/trellis/app'}'`,
    '',
    'export const operationProjectionRegistry = {',
    `  fingerprint: '${operationRegistryFingerprint(registry)}',`,
    ...renderStringMap('executeById', executeEntries),
    ...renderStringMap('previewById', previewEntries),
    '} as const satisfies OperationProjectionRegistry',
    '',
  ].join('\n')
}

export function buildOperationRegistry(
  metadata: PublicSurfaceCodegenMetadata,
  options: OperationRegistryBuildOptions = {},
): OperationRegistry {
  if (metadata.diagnostics.length > 0) {
    const firstDiagnostic = metadata.diagnostics[0]!
    throw new Error(
      `Cannot build operation registry with unsupported projection syntax at ${firstDiagnostic.file}:${firstDiagnostic.line}. ${firstDiagnostic.message}`,
    )
  }

  const operationsById = new Map<string, MutableOperationRegistryOperation>()

  for (const operation of metadata.operations) {
    const existing = operationsById.get(operation.id)
    if (existing) {
      throw new Error(
        `Duplicate operation id "${operation.id}" found at ${existing.file} and ${operation.file}.`,
      )
    }

    operationsById.set(operation.id, toMutableRegistryOperation(operation))
  }

  for (const projection of metadata.projections) {
    const operation = operationsById.get(projection.operationId)
    if (!operation) continue

    const registryProjection = toRegistryProjection(projection, options)

    if (projection.projection === 'execute') {
      if (operation.execute) {
        throw new Error(`Operation "${operation.id}" has multiple execute projections.`)
      }
      operation.execute = registryProjection
      continue
    }

    if (operation.preview) {
      throw new Error(`Operation "${operation.id}" has multiple preview projections.`)
    }
    operation.preview = registryProjection
  }

  const operations = [...operationsById.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((operation) => {
      if (!operation.execute) {
        throw new Error(`Operation "${operation.id}" requires exactly one execute projection.`)
      }

      if (operation.kind === 'destructive' && !operation.preview) {
        throw new Error(
          `Destructive operation "${operation.id}" requires exactly one preview projection.`,
        )
      }

      if (operation.kind !== 'destructive' && operation.preview) {
        throw new Error(`Safe operation "${operation.id}" cannot define a preview projection.`)
      }

      return operation as OperationRegistryOperation
    })

  return { operations }
}

export function buildOperationRefBindingsFromRegistry(
  registry: OperationRegistry,
): OperationRefBindingInput[] {
  return registry.operations.flatMap((operation) => {
    const refs: OperationRefBindingInput[] = [
      {
        exportName: getOperationRefExportName(operation, operation.execute),
        descriptorName: operation.exportName,
        projection: 'execute',
        apiPath: operation.execute.apiPath,
      },
    ]

    if (operation.preview) {
      refs.push({
        exportName: getOperationRefExportName(operation, operation.preview),
        descriptorName: operation.exportName,
        projection: 'preview',
        apiPath: operation.preview.apiPath,
      })
    }

    return refs
  })
}

export function buildOperationHandleBindingsFromRegistry(
  registry: OperationRegistry,
  options: { runtimes?: OperationHandleBindingInput['runtimes'] } = {},
): OperationHandleBindingInput[] {
  return registry.operations.map((operation) => ({
    exportName: getOperationHandleExportName(operation.exportName),
    operationId: operation.id,
    ...(operation.name ? { operationName: operation.name } : {}),
    operationKind: operation.kind,
    descriptorName: operation.exportName,
    executeRefName: getOperationRefExportName(operation, operation.execute),
    ...(operation.preview
      ? { previewRefName: getOperationRefExportName(operation, operation.preview) }
      : {}),
    executeOperation: operation.execute.functionKind,
    ...(operation.preview ? { previewOperation: operation.preview.functionKind } : {}),
    ...(options.runtimes ? { runtimes: options.runtimes } : {}),
  }))
}

export function renderOperationRegistryGeneratedFiles(
  registry: OperationRegistry,
  options: OperationRegistryGeneratedFilesOptions,
): OperationRegistryGeneratedFile[] {
  if (!options.operationRefsPath && options.operationHandlesPath) {
    throw new Error('Operation handle generation requires operationRefsPath.')
  }
  if (
    !options.operationRefsPath &&
    !options.operationHandlesPath &&
    !options.operationProjectionsPath
  ) {
    throw new Error('Operation registry generation requires at least one output path.')
  }

  const files: OperationRegistryGeneratedFile[] = []

  if (options.operationRefsPath) {
    if (!options.projectOperationRefImport) {
      throw new Error('Operation ref generation requires projectOperationRefImport.')
    }
    if (!options.apiImport) {
      throw new Error('Operation ref generation requires apiImport.')
    }

    const handleRegistry = operationHandleRegistryFor(registry, options)
    const refs = buildOperationRefBindingsFromRegistry(handleRegistry)

    files.push({
      path: options.operationRefsPath,
      content:
        handleRegistry.operations.length === 0
          ? renderEmptyOperationRefsModule()
          : renderOperationRefsModuleFromRegistry(handleRegistry, {
              apiImport: options.apiImport,
              descriptorMode: options.descriptorMode,
              operationDescriptorTypeImport: options.operationDescriptorTypeImport,
              operationRefsPath: options.operationRefsPath,
              projectOperationRefImport: options.projectOperationRefImport,
              relativeImportExtension: options.relativeImportExtension,
            }),
    })

    if (options.operationHandlesPath) {
      if (!options.defineOperationHandleImport) {
        throw new Error('Operation handle generation requires defineOperationHandleImport.')
      }

      files.push({
        path: options.operationHandlesPath,
        content:
          handleRegistry.operations.length === 0
            ? renderEmptyOperationHandlesModule()
            : renderOperationHandlesModule({
                defineOperationHandleImport: options.defineOperationHandleImport,
                operationDescriptorTypeImport: options.operationDescriptorTypeImport,
                descriptorImports: descriptorImportsFor(
                  handleRegistry.operations,
                  options.operationHandlesPath,
                  options.relativeImportExtension,
                ),
                descriptorMode: options.descriptorMode,
                refsImport: toRelativeImport(
                  options.operationHandlesPath,
                  options.operationRefsPath,
                  options.relativeImportExtension,
                ),
                descriptors: handleRegistry.operations.map((operation) => operation.exportName),
                refs: refs.map((ref) => ref.exportName),
                handles: buildOperationHandleBindingsFromRegistry(handleRegistry, {
                  runtimes: options.runtimes,
                }),
              }),
      })
    }
  }

  if (options.operationProjectionsPath) {
    files.push({
      path: options.operationProjectionsPath,
      content: renderOperationProjectionRegistryModule(registry, options),
    })
  }

  return files
}
