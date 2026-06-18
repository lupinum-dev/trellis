import type { OperationHandleBindingInput } from './operation-handle-codegen.js'
import { renderConvexFunctionRef } from './operation-ref-codegen.js'
import type { OperationRefBindingInput } from './operation-ref-codegen.js'
import type {
  OperationDefinitionMetadata,
  OperationProjectionBindingMetadata,
  PublicSurfaceCodegenMetadata,
} from './public-surface-codegen.js'

export type OperationRegistryProjectionKind = 'execute' | 'preview'

export interface OperationRegistryProjection {
  exportName: string
  file: string
  line: number
  projection: OperationRegistryProjectionKind
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

type MutableOperationRegistryOperation = Omit<OperationRegistryOperation, 'execute'> & {
  execute?: OperationRegistryProjection
}

function toGeneratedApiPath(file: string, exportName: string): string[] {
  if (!file.startsWith('convex/')) {
    throw new Error(`Operation projection "${exportName}" must be exported from convex/.`)
  }

  const modulePath = file
    .slice('convex/'.length)
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
): OperationRegistryProjection {
  const apiPath = toGeneratedApiPath(projection.file, projection.exportName)
  return {
    exportName: projection.exportName,
    file: projection.file,
    line: projection.line,
    projection: projection.projection,
    apiPath,
    functionRef: renderConvexFunctionRef(apiPath),
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

function getOperationRefExportName(projection: OperationRegistryProjection): string {
  return `${projection.exportName}Ref`
}

export function buildOperationRegistry(metadata: PublicSurfaceCodegenMetadata): OperationRegistry {
  if (metadata.diagnostics.length > 0) {
    const [firstDiagnostic] = metadata.diagnostics
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

    const registryProjection = toRegistryProjection(projection)

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
        exportName: getOperationRefExportName(operation.execute),
        descriptorName: operation.exportName,
        projection: 'execute',
        apiPath: operation.execute.apiPath,
      },
    ]

    if (operation.preview) {
      refs.push({
        exportName: getOperationRefExportName(operation.preview),
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
): OperationHandleBindingInput[] {
  return registry.operations.map((operation) => ({
    exportName: getOperationHandleExportName(operation.exportName),
    operationId: operation.id,
    descriptorName: operation.exportName,
    executeRefName: getOperationRefExportName(operation.execute),
    ...(operation.preview ? { previewRefName: getOperationRefExportName(operation.preview) } : {}),
  }))
}
