import { isAbsolute, relative, resolve } from 'node:path'

import { defineCommand } from 'citty'

import {
  collectTrellisCliInventory,
  collectTrellisCliInventoryFacts,
  type TrellisCliInventory,
  type TrellisCliInventoryAppInventoryFeatureBinding,
  type TrellisCliInventoryFeature,
  type TrellisCliInventoryPermission,
  type TrellisCliInventoryPublicSurfaceOperation,
  type TrellisCliInventoryPublicSurfaceProjection,
  type TrellisCliInventoryPublicSurfaceTool,
  type TrellisCliInventorySourceLocation,
} from '../lib/inventory.js'
import { inspectProject } from '../lib/project.js'

type ExplainAppPrivacy = 'public' | 'developer' | 'internal'

interface ExplainAppReport {
  schemaVersion: 1
  cwd?: string
  privacy: ExplainAppPrivacy
  app: {
    package: TrellisCliInventory['package']
    layers: TrellisCliInventory['layers']
    files?: TrellisCliInventory['files']
    surfaces: TrellisCliInventory['surfaces']
    counts: {
      features: number
      permissionDefinitions: number
      permissionInventories: number
      operations: number
      projections: number
      mcpTools: number
      findings: number
    }
    features: Array<{
      name: string
      exportName?: string
      file?: string
      source?: TrellisCliInventorySourceLocation
      tenantTables?: string[]
      sharedTables?: string[]
      permissionRefs?: string[]
      operationRefs?: string[]
    }>
    permissions: Array<{
      key: string
      label?: string
      description?: string
      roles: string[]
      projected: boolean
      exportName?: string
      source?: TrellisCliInventorySourceLocation
    }>
    operations: Array<{
      id: string
      kind: 'safe' | 'destructive'
      exportName?: string
      source?: TrellisCliInventorySourceLocation
      projections: Array<{
        projection: 'preview' | 'execute'
        exportName?: string
        source?: TrellisCliInventorySourceLocation
      }>
      mcpTools: Array<{
        name: string
        source: 'tool' | 'operation' | 'defineMcpTool'
        sourceLocation?: TrellisCliInventorySourceLocation
      }>
    }>
    appInventory?: {
      detected: boolean
      file: string | null
      featureBindings: Array<
        Pick<TrellisCliInventoryAppInventoryFeatureBinding, 'name' | 'importPath' | 'source'>
      >
      warnings: TrellisCliInventory['appInventory']['warnings']
    }
    findings?: TrellisCliInventory['findings']
  }
}

interface ExplainOperationReport {
  schemaVersion: 1
  cwd: string
  operation: {
    id: string
    exportName: string
    kind: 'safe' | 'destructive'
    source: TrellisCliInventorySourceLocation
    projections: TrellisCliInventoryPublicSurfaceProjection[]
    mcpTools: {
      status: 'none' | 'matched'
      tools: TrellisCliInventoryPublicSurfaceTool[]
      message?: string
    }
    featureRefs: Array<{
      exportName: string
      name: string
      file: string
      source: TrellisCliInventorySourceLocation
    }>
  }
}

interface ExplainOperationMissingReport {
  schemaVersion: 1
  cwd: string
  error: {
    code: 'operation-not-found' | 'no-operations'
    message: string
    availableOperationIds: string[]
  }
}

interface ExplainToolReport {
  schemaVersion: 1
  cwd: string
  tool: {
    name: string
    source: 'tool' | 'operation' | 'defineMcpTool'
    sourceLocation: TrellisCliInventorySourceLocation
    operationId?: string
    operationExportName?: string
    operation:
      | {
          status: 'matched'
          id: string
          exportName: string
          kind: 'safe' | 'destructive'
          source: TrellisCliInventorySourceLocation
          projections: TrellisCliInventoryPublicSurfaceProjection[]
          featureRefs: ExplainOperationReport['operation']['featureRefs']
        }
      | {
          status: 'missing'
          operationId: string
          operationExportName?: string
          message: string
        }
      | {
          status: 'none'
          message: string
        }
  }
}

interface ExplainToolMissingReport {
  schemaVersion: 1
  cwd: string
  error: {
    code: 'tool-not-found' | 'no-tools'
    message: string
    availableToolNames: string[]
  }
}

interface ExplainPermissionReport {
  schemaVersion: 1
  cwd: string
  permission: {
    key: string
    exportName: string
    label: string
    description?: string
    roles: string[]
    projected: boolean
    source: TrellisCliInventorySourceLocation
    inventories: Array<{
      exportName: string
      file: string
      source: TrellisCliInventorySourceLocation
    }>
    featureRefs: Array<{
      exportName: string
      name: string
      file: string
      source: TrellisCliInventorySourceLocation
    }>
  }
}

interface ExplainPermissionMissingReport {
  schemaVersion: 1
  cwd: string
  error: {
    code: 'permission-not-found' | 'no-permissions'
    message: string
    availablePermissionKeys: string[]
    suggestedCommand: string
  }
}

interface ExplainFeatureReport {
  schemaVersion: 1
  cwd: string
  feature: {
    name: string
    exportName: string
    file: string
    source: TrellisCliInventorySourceLocation
    tenantTables: string[]
    sharedTables: string[]
    permissions: Array<{
      key: string
      exportName: string
      label?: string
      description?: string
      source: TrellisCliInventorySourceLocation
    }>
    operations: Array<{
      id: string
      exportName: string
      kind: 'safe' | 'destructive'
      source: TrellisCliInventorySourceLocation
      projections: TrellisCliInventoryPublicSurfaceProjection[]
      mcpTools: TrellisCliInventoryPublicSurfaceTool[]
    }>
    missingPermissionRefs: string[]
    missingOperationRefs: string[]
  }
}

interface ExplainFeatureMissingReport {
  schemaVersion: 1
  cwd: string
  error: {
    code: 'feature-not-found' | 'no-features'
    message: string
    availableFeatureNames: string[]
  }
}

interface ExplainFileReport {
  schemaVersion: 1
  cwd: string
  file: {
    path: string
    matched: boolean
    features: Array<{
      name: string
      exportName: string
      source: TrellisCliInventorySourceLocation
    }>
    permissions: Array<{
      key: string
      exportName: string
      label?: string
      description?: string
      source: TrellisCliInventorySourceLocation
    }>
    permissionInventories: Array<{
      exportName: string
      source: TrellisCliInventorySourceLocation
    }>
    operations: Array<{
      id: string
      exportName: string
      kind: 'safe' | 'destructive'
      source: TrellisCliInventorySourceLocation
    }>
    projections: TrellisCliInventoryPublicSurfaceProjection[]
    mcpTools: TrellisCliInventoryPublicSurfaceTool[]
  }
}

function readPrivacy(value: unknown): ExplainAppPrivacy {
  const privacy = value === undefined ? 'public' : String(value)
  if (privacy === 'public' || privacy === 'developer' || privacy === 'internal') return privacy
  throw new Error('Invalid explain privacy. Use public, developer, or internal.')
}

function formatLocation(location: TrellisCliInventorySourceLocation): string {
  return `${location.path}:${location.line}`
}

function findOperation(
  inventory: TrellisCliInventory,
  operationId: string,
): TrellisCliInventoryPublicSurfaceOperation | null {
  return (
    inventory.publicSurface.operations.find((operation) => operation.id === operationId) ?? null
  )
}

function findTool(
  inventory: TrellisCliInventory,
  toolName: string,
): TrellisCliInventoryPublicSurfaceTool | null {
  return inventory.publicSurface.tools.find((tool) => tool.name === toolName) ?? null
}

function findFeature(
  inventory: TrellisCliInventory,
  featureId: string,
): TrellisCliInventoryFeature | null {
  return (
    inventory.features.find(
      (feature) => feature.name === featureId || feature.exportName === featureId,
    ) ?? null
  )
}

function findOperationByExportName(
  inventory: TrellisCliInventory,
  exportName: string,
): TrellisCliInventoryPublicSurfaceOperation | null {
  return (
    inventory.publicSurface.operations.find((operation) => operation.exportName === exportName) ??
    null
  )
}

function findPermissionByExportName(
  inventory: TrellisCliInventory,
  exportName: string,
): TrellisCliInventoryPermission | null {
  return (
    inventory.permissions.definitions.find((permission) => permission.exportName === exportName) ??
    null
  )
}

function findOperationProjections(
  inventory: TrellisCliInventory,
  operationId: string,
): TrellisCliInventoryPublicSurfaceProjection[] {
  return inventory.publicSurface.projections.filter(
    (projection) => projection.operationId === operationId,
  )
}

function findFeatureRefs(
  inventory: TrellisCliInventory,
  operation: TrellisCliInventoryPublicSurfaceOperation,
): ExplainOperationReport['operation']['featureRefs'] {
  return inventory.features
    .filter((feature: TrellisCliInventoryFeature) =>
      feature.operationRefs.includes(operation.exportName),
    )
    .map((feature) => ({
      exportName: feature.exportName,
      name: feature.name,
      file: feature.file,
      source: feature.source,
    }))
}

function findPermissionFeatureRefs(
  inventory: TrellisCliInventory,
  permissionExportName: string,
): ExplainPermissionReport['permission']['featureRefs'] {
  return inventory.features
    .filter((feature) => feature.permissionRefs.includes(permissionExportName))
    .map((feature) => ({
      exportName: feature.exportName,
      name: feature.name,
      file: feature.file,
      source: feature.source,
    }))
}

function findPermissionInventories(
  inventory: TrellisCliInventory,
  permissionExportName: string,
): ExplainPermissionReport['permission']['inventories'] {
  return inventory.permissions.inventories
    .filter((permissionInventory) => permissionInventory.permissions.includes(permissionExportName))
    .map((permissionInventory) => ({
      exportName: permissionInventory.exportName,
      file: permissionInventory.file,
      source: permissionInventory.source,
    }))
}

function findOperationMcpTools(
  inventory: TrellisCliInventory,
  operation: TrellisCliInventoryPublicSurfaceOperation,
): TrellisCliInventoryPublicSurfaceTool[] {
  return inventory.publicSurface.tools.filter(
    (tool) => tool.source === 'operation' && tool.operationId === operation.id,
  )
}

function normalizePathSeparators(path: string): string {
  return path.replaceAll('\\', '/')
}

function normalizeExplainFilePath(cwd: string, path: string): string {
  if (isAbsolute(path)) return normalizePathSeparators(relative(cwd, path))
  return normalizePathSeparators(relative(cwd, resolve(cwd, path)))
}

function isSameInventoryPath(left: string, right: string): boolean {
  return normalizePathSeparators(left) === normalizePathSeparators(right)
}

function createAppFeatureReport(
  feature: TrellisCliInventoryFeature,
  privacy: ExplainAppPrivacy,
): ExplainAppReport['app']['features'][number] {
  const base = {
    name: feature.name,
  }

  if (privacy === 'public') return base

  return {
    ...base,
    exportName: feature.exportName,
    file: feature.file,
    source: feature.source,
    tenantTables: feature.tenantTables,
    sharedTables: feature.sharedTables,
    permissionRefs: feature.permissionRefs,
    operationRefs: feature.operationRefs,
  }
}

function createAppPermissionReport(
  permission: TrellisCliInventoryPermission,
  privacy: ExplainAppPrivacy,
): ExplainAppReport['app']['permissions'][number] {
  const base = {
    key: permission.key,
    ...(permission.label ? { label: permission.label } : {}),
    ...(permission.description ? { description: permission.description } : {}),
    roles: permission.roles,
    projected: permission.projected,
  }

  if (privacy === 'public') return base

  return {
    ...base,
    exportName: permission.exportName,
    source: permission.source,
  }
}

function createAppOperationReport(
  inventory: TrellisCliInventory,
  operation: TrellisCliInventoryPublicSurfaceOperation,
  privacy: ExplainAppPrivacy,
): ExplainAppReport['app']['operations'][number] {
  const projections = findOperationProjections(inventory, operation.id).map((projection) => ({
    projection: projection.projection,
    ...(privacy !== 'public'
      ? {
          exportName: projection.exportName,
          source: projection.source,
        }
      : {}),
  }))
  const mcpTools = inventory.publicSurface.tools
    .filter((tool) => tool.source === 'operation' && tool.operationId === operation.id)
    .map((tool) => ({
      name: tool.name,
      source: tool.source,
      ...(privacy !== 'public' ? { sourceLocation: tool.sourceLocation } : {}),
    }))
  const base = {
    id: operation.id,
    kind: operation.kind,
    projections,
    mcpTools,
  }

  if (privacy === 'public') return base

  return {
    ...base,
    exportName: operation.exportName,
    source: operation.source,
  }
}

function createAppReport(
  cwd: string,
  inventory: TrellisCliInventory,
  privacy: ExplainAppPrivacy,
): ExplainAppReport {
  return {
    schemaVersion: 1,
    ...(privacy !== 'public' ? { cwd } : {}),
    privacy,
    app: {
      package: inventory.package,
      layers: inventory.layers,
      ...(privacy !== 'public' ? { files: inventory.files } : {}),
      surfaces: inventory.surfaces,
      counts: {
        features: inventory.features.length,
        permissionDefinitions: inventory.permissions.definitions.length,
        permissionInventories: inventory.permissions.inventories.length,
        operations: inventory.publicSurface.operations.length,
        projections: inventory.publicSurface.projections.length,
        mcpTools: inventory.publicSurface.tools.length,
        findings: inventory.findings.length,
      },
      features: inventory.features.map((feature) => createAppFeatureReport(feature, privacy)),
      permissions: inventory.permissions.definitions.map((permission) =>
        createAppPermissionReport(permission, privacy),
      ),
      operations: inventory.publicSurface.operations.map((operation) =>
        createAppOperationReport(inventory, operation, privacy),
      ),
      ...(privacy !== 'public'
        ? {
            appInventory: {
              detected: inventory.appInventory.detected,
              file: inventory.appInventory.file,
              featureBindings: inventory.appInventory.featureBindings,
              warnings: inventory.appInventory.warnings,
            },
            findings: inventory.findings,
          }
        : {}),
    },
  }
}

function createOperationReport(
  cwd: string,
  inventory: TrellisCliInventory,
  operation: TrellisCliInventoryPublicSurfaceOperation,
): ExplainOperationReport {
  const matchedTools = inventory.publicSurface.tools.filter(
    (tool) => tool.source === 'operation' && tool.operationId === operation.id,
  )

  return {
    schemaVersion: 1,
    cwd,
    operation: {
      id: operation.id,
      exportName: operation.exportName,
      kind: operation.kind,
      source: operation.source,
      projections: findOperationProjections(inventory, operation.id),
      mcpTools: {
        status: matchedTools.length > 0 ? 'matched' : 'none',
        tools: matchedTools,
        ...(matchedTools.length === 0
          ? { message: 'No MCP tools were found for this operation id.' }
          : {}),
      },
      featureRefs: findFeatureRefs(inventory, operation),
    },
  }
}

function createToolReport(
  cwd: string,
  inventory: TrellisCliInventory,
  tool: TrellisCliInventoryPublicSurfaceTool,
): ExplainToolReport {
  const operation =
    tool.operationId !== undefined ? findOperation(inventory, tool.operationId) : null
  const operationReport =
    operation !== null
      ? {
          status: 'matched' as const,
          id: operation.id,
          exportName: operation.exportName,
          kind: operation.kind,
          source: operation.source,
          projections: findOperationProjections(inventory, operation.id),
          featureRefs: findFeatureRefs(inventory, operation),
        }
      : tool.operationId !== undefined
        ? {
            status: 'missing' as const,
            operationId: tool.operationId,
            ...(tool.operationExportName ? { operationExportName: tool.operationExportName } : {}),
            message: `Tool "${tool.name}" references operation "${tool.operationId}", but that operation was not found in inventory.`,
          }
        : {
            status: 'none' as const,
            message: `Tool "${tool.name}" is not operation-backed in public-surface inventory.`,
          }

  return {
    schemaVersion: 1,
    cwd,
    tool: {
      name: tool.name,
      source: tool.source,
      sourceLocation: tool.sourceLocation,
      ...(tool.operationId ? { operationId: tool.operationId } : {}),
      ...(tool.operationExportName ? { operationExportName: tool.operationExportName } : {}),
      operation: operationReport,
    },
  }
}

function createPermissionReport(
  cwd: string,
  inventory: TrellisCliInventory,
  permission: TrellisCliInventory['permissions']['definitions'][number],
): ExplainPermissionReport {
  return {
    schemaVersion: 1,
    cwd,
    permission: {
      key: permission.key,
      exportName: permission.exportName,
      label: permission.label ?? permission.key,
      ...(permission.description ? { description: permission.description } : {}),
      roles: permission.roles,
      projected: permission.projected,
      source: permission.source,
      inventories: findPermissionInventories(inventory, permission.exportName),
      featureRefs: findPermissionFeatureRefs(inventory, permission.exportName),
    },
  }
}

function createFeatureReport(
  cwd: string,
  inventory: TrellisCliInventory,
  feature: TrellisCliInventoryFeature,
): ExplainFeatureReport {
  const permissions = feature.permissionRefs
    .map((permissionRef) => findPermissionByExportName(inventory, permissionRef))
    .filter((permission): permission is TrellisCliInventoryPermission => permission !== null)
    .map((permission) => ({
      key: permission.key,
      exportName: permission.exportName,
      ...(permission.label ? { label: permission.label } : {}),
      ...(permission.description ? { description: permission.description } : {}),
      source: permission.source,
    }))
  const operations = feature.operationRefs
    .map((operationRef) => findOperationByExportName(inventory, operationRef))
    .filter(
      (operation): operation is TrellisCliInventoryPublicSurfaceOperation => operation !== null,
    )
    .map((operation) => ({
      id: operation.id,
      exportName: operation.exportName,
      kind: operation.kind,
      source: operation.source,
      projections: findOperationProjections(inventory, operation.id),
      mcpTools: findOperationMcpTools(inventory, operation),
    }))

  return {
    schemaVersion: 1,
    cwd,
    feature: {
      name: feature.name,
      exportName: feature.exportName,
      file: feature.file,
      source: feature.source,
      tenantTables: feature.tenantTables,
      sharedTables: feature.sharedTables,
      permissions,
      operations,
      missingPermissionRefs: feature.permissionRefs.filter(
        (permissionRef) => findPermissionByExportName(inventory, permissionRef) === null,
      ),
      missingOperationRefs: feature.operationRefs.filter(
        (operationRef) => findOperationByExportName(inventory, operationRef) === null,
      ),
    },
  }
}

function createFileReport(
  cwd: string,
  inventory: TrellisCliInventory,
  path: string,
): ExplainFileReport {
  const normalizedPath = normalizeExplainFilePath(cwd, path)
  const features = inventory.features
    .filter(
      (feature) =>
        isSameInventoryPath(feature.file, normalizedPath) ||
        isSameInventoryPath(feature.source.path, normalizedPath),
    )
    .map((feature) => ({
      name: feature.name,
      exportName: feature.exportName,
      source: feature.source,
    }))
  const permissions = inventory.permissions.definitions
    .filter(
      (permission) =>
        isSameInventoryPath(permission.file, normalizedPath) ||
        isSameInventoryPath(permission.source.path, normalizedPath),
    )
    .map((permission) => ({
      key: permission.key,
      exportName: permission.exportName,
      ...(permission.label ? { label: permission.label } : {}),
      ...(permission.description ? { description: permission.description } : {}),
      source: permission.source,
    }))
  const permissionInventories = inventory.permissions.inventories
    .filter(
      (permissionInventory) =>
        isSameInventoryPath(permissionInventory.file, normalizedPath) ||
        isSameInventoryPath(permissionInventory.source.path, normalizedPath),
    )
    .map((permissionInventory) => ({
      exportName: permissionInventory.exportName,
      source: permissionInventory.source,
    }))
  const operations = inventory.publicSurface.operations
    .filter((operation) => isSameInventoryPath(operation.source.path, normalizedPath))
    .map((operation) => ({
      id: operation.id,
      exportName: operation.exportName,
      kind: operation.kind,
      source: operation.source,
    }))
  const projections = inventory.publicSurface.projections.filter((projection) =>
    isSameInventoryPath(projection.source.path, normalizedPath),
  )
  const mcpTools = inventory.publicSurface.tools.filter((tool) =>
    isSameInventoryPath(tool.sourceLocation.path, normalizedPath),
  )

  return {
    schemaVersion: 1,
    cwd,
    file: {
      path: normalizedPath,
      matched:
        features.length > 0 ||
        permissions.length > 0 ||
        permissionInventories.length > 0 ||
        operations.length > 0 ||
        projections.length > 0 ||
        mcpTools.length > 0,
      features,
      permissions,
      permissionInventories,
      operations,
      projections,
      mcpTools,
    },
  }
}

function createMissingReport(
  cwd: string,
  inventory: TrellisCliInventory,
  operationId: string,
): ExplainOperationMissingReport {
  const availableOperationIds = inventory.publicSurface.operations.map((operation) => operation.id)

  return {
    schemaVersion: 1,
    cwd,
    error: {
      code: availableOperationIds.length === 0 ? 'no-operations' : 'operation-not-found',
      message:
        availableOperationIds.length === 0
          ? 'No operations were found in inventory.'
          : `Operation "${operationId}" was not found in inventory.`,
      availableOperationIds,
    },
  }
}

function createMissingFeatureReport(
  cwd: string,
  inventory: TrellisCliInventory,
  featureId: string,
): ExplainFeatureMissingReport {
  const availableFeatureNames = inventory.features.map((feature) => feature.name)

  return {
    schemaVersion: 1,
    cwd,
    error: {
      code: availableFeatureNames.length === 0 ? 'no-features' : 'feature-not-found',
      message:
        availableFeatureNames.length === 0
          ? 'No features were found in inventory.'
          : `Feature "${featureId}" was not found in inventory.`,
      availableFeatureNames,
    },
  }
}

function createMissingToolReport(
  cwd: string,
  inventory: TrellisCliInventory,
  toolName: string,
): ExplainToolMissingReport {
  const availableToolNames = inventory.publicSurface.tools.map((tool) => tool.name)

  return {
    schemaVersion: 1,
    cwd,
    error: {
      code: availableToolNames.length === 0 ? 'no-tools' : 'tool-not-found',
      message:
        availableToolNames.length === 0
          ? 'No MCP tools were found in inventory.'
          : `MCP tool "${toolName}" was not found in inventory.`,
      availableToolNames,
    },
  }
}

function createMissingPermissionReport(
  cwd: string,
  inventory: TrellisCliInventory,
  permissionKey: string,
): ExplainPermissionMissingReport {
  const availablePermissionKeys = inventory.permissions.definitions.map(
    (permission) => permission.key,
  )

  return {
    schemaVersion: 1,
    cwd,
    error: {
      code: availablePermissionKeys.length === 0 ? 'no-permissions' : 'permission-not-found',
      message:
        availablePermissionKeys.length === 0
          ? 'No permissions were found in inventory.'
          : `Permission "${permissionKey}" was not found in inventory.`,
      availablePermissionKeys,
      suggestedCommand: 'trellis permissions matrix',
    },
  }
}

function renderAppReport(report: ExplainAppReport): void {
  const { app } = report

  process.stdout.write(`App inventory (${report.privacy})\n`)
  process.stdout.write(
    `Layers: ${
      Object.entries(app.layers)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name)
        .join(', ') || 'none'
    }\n`,
  )
  process.stdout.write(`Operations: ${app.counts.operations}\n`)
  process.stdout.write(`MCP tools: ${app.counts.mcpTools}\n`)
  process.stdout.write(`Features: ${app.counts.features}\n`)
  process.stdout.write(`Permissions: ${app.counts.permissionDefinitions}\n`)
}

function renderOperationReport(report: ExplainOperationReport): void {
  const { operation } = report

  process.stdout.write(`Operation ${operation.id}\n`)
  process.stdout.write(`Kind: ${operation.kind}\n`)
  process.stdout.write(`Export: ${operation.exportName}\n`)
  process.stdout.write(`Source: ${formatLocation(operation.source)}\n`)
  process.stdout.write('Projections:\n')

  if (operation.projections.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const projection of operation.projections) {
      process.stdout.write(
        `  ${projection.projection}: ${projection.exportName} at ${formatLocation(projection.source)}\n`,
      )
    }
  }

  process.stdout.write('MCP tools:\n')
  if (operation.mcpTools.tools.length === 0) {
    process.stdout.write(`  ${operation.mcpTools.message ?? 'none'}\n`)
  } else {
    for (const tool of operation.mcpTools.tools) {
      process.stdout.write(
        `  ${tool.name}: operation-backed at ${formatLocation(tool.sourceLocation)}\n`,
      )
    }
  }

  process.stdout.write('Feature refs:\n')
  if (operation.featureRefs.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const feature of operation.featureRefs) {
      process.stdout.write(
        `  ${feature.exportName} (${feature.name}) at ${formatLocation(feature.source)}\n`,
      )
    }
  }
}

function renderToolReport(report: ExplainToolReport): void {
  const { tool } = report

  process.stdout.write(`MCP tool ${tool.name}\n`)
  process.stdout.write(`Source: ${tool.source} at ${formatLocation(tool.sourceLocation)}\n`)

  if (tool.operation.status === 'matched') {
    process.stdout.write(`Operation: ${tool.operation.id} (${tool.operation.kind})\n`)
    process.stdout.write(`Operation export: ${tool.operation.exportName}\n`)
    process.stdout.write(`Operation source: ${formatLocation(tool.operation.source)}\n`)
    process.stdout.write('Projections:\n')
    if (tool.operation.projections.length === 0) {
      process.stdout.write('  none\n')
    } else {
      for (const projection of tool.operation.projections) {
        process.stdout.write(
          `  ${projection.projection}: ${projection.exportName} at ${formatLocation(projection.source)}\n`,
        )
      }
    }

    process.stdout.write('Feature refs:\n')
    if (tool.operation.featureRefs.length === 0) {
      process.stdout.write('  none\n')
    } else {
      for (const feature of tool.operation.featureRefs) {
        process.stdout.write(
          `  ${feature.exportName} (${feature.name}) at ${formatLocation(feature.source)}\n`,
        )
      }
    }
    return
  }

  process.stdout.write(`Operation: ${tool.operation.status}\n`)
  process.stdout.write(`${tool.operation.message}\n`)
}

function renderPermissionReport(report: ExplainPermissionReport): void {
  const { permission } = report

  process.stdout.write(`Permission ${permission.key}\n`)
  process.stdout.write(`Label: ${permission.label}\n`)
  process.stdout.write(`Export: ${permission.exportName}\n`)
  process.stdout.write(`Source: ${formatLocation(permission.source)}\n`)
  if (permission.description) {
    process.stdout.write(`Description: ${permission.description}\n`)
  }
  process.stdout.write(`Projected: ${permission.projected ? 'yes' : 'no'}\n`)
  process.stdout.write(
    `Roles: ${permission.roles.length > 0 ? permission.roles.join(', ') : 'none'}\n`,
  )

  process.stdout.write('Inventories:\n')
  if (permission.inventories.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const inventory of permission.inventories) {
      process.stdout.write(`  ${inventory.exportName} at ${formatLocation(inventory.source)}\n`)
    }
  }

  process.stdout.write('Feature refs:\n')
  if (permission.featureRefs.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const feature of permission.featureRefs) {
      process.stdout.write(
        `  ${feature.exportName} (${feature.name}) at ${formatLocation(feature.source)}\n`,
      )
    }
  }
}

function renderFeatureReport(report: ExplainFeatureReport): void {
  const { feature } = report

  process.stdout.write(`Feature ${feature.name}\n`)
  process.stdout.write(`Export: ${feature.exportName}\n`)
  process.stdout.write(`Source: ${formatLocation(feature.source)}\n`)
  process.stdout.write(
    `Tenant tables: ${feature.tenantTables.length > 0 ? feature.tenantTables.join(', ') : 'none'}\n`,
  )
  process.stdout.write(
    `Shared tables: ${feature.sharedTables.length > 0 ? feature.sharedTables.join(', ') : 'none'}\n`,
  )

  process.stdout.write('Permissions:\n')
  if (feature.permissions.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const permission of feature.permissions) {
      process.stdout.write(
        `  ${permission.key}: ${permission.exportName} at ${formatLocation(permission.source)}\n`,
      )
    }
  }

  process.stdout.write('Operations:\n')
  if (feature.operations.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const operation of feature.operations) {
      process.stdout.write(`  ${operation.id} (${operation.kind})\n`)
      process.stdout.write(
        `    Projections: ${
          operation.projections.length > 0
            ? operation.projections
                .map((projection) => `${projection.projection}:${projection.exportName}`)
                .join(', ')
            : 'none'
        }\n`,
      )
      process.stdout.write(
        `    MCP tools: ${
          operation.mcpTools.length > 0
            ? operation.mcpTools.map((tool) => tool.name).join(', ')
            : 'none'
        }\n`,
      )
    }
  }

  if (feature.missingPermissionRefs.length > 0) {
    process.stdout.write(`Missing permission refs: ${feature.missingPermissionRefs.join(', ')}\n`)
  }
  if (feature.missingOperationRefs.length > 0) {
    process.stdout.write(`Missing operation refs: ${feature.missingOperationRefs.join(', ')}\n`)
  }
}

function renderFileReport(report: ExplainFileReport): void {
  const { file } = report

  process.stdout.write(`File ${file.path}\n`)
  process.stdout.write(`Trellis inventory: ${file.matched ? 'matched' : 'no facts'}\n`)

  process.stdout.write('Features:\n')
  if (file.features.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const feature of file.features) {
      process.stdout.write(
        `  ${feature.name}: ${feature.exportName} at ${formatLocation(feature.source)}\n`,
      )
    }
  }

  process.stdout.write('Permissions:\n')
  if (file.permissions.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const permission of file.permissions) {
      process.stdout.write(
        `  ${permission.key}: ${permission.exportName} at ${formatLocation(permission.source)}\n`,
      )
    }
  }

  process.stdout.write('Permission inventories:\n')
  if (file.permissionInventories.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const permissionInventory of file.permissionInventories) {
      process.stdout.write(
        `  ${permissionInventory.exportName} at ${formatLocation(permissionInventory.source)}\n`,
      )
    }
  }

  process.stdout.write('Operations:\n')
  if (file.operations.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const operation of file.operations) {
      process.stdout.write(
        `  ${operation.id} (${operation.exportName}, ${operation.kind}) at ${formatLocation(operation.source)}\n`,
      )
    }
  }

  process.stdout.write('Projections:\n')
  if (file.projections.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const projection of file.projections) {
      process.stdout.write(
        `  ${projection.projection}: ${projection.exportName} for ${projection.operationId} at ${formatLocation(projection.source)}\n`,
      )
    }
  }

  process.stdout.write('MCP tools:\n')
  if (file.mcpTools.length === 0) {
    process.stdout.write('  none\n')
  } else {
    for (const tool of file.mcpTools) {
      process.stdout.write(
        `  ${tool.name}: ${tool.source} at ${formatLocation(tool.sourceLocation)}\n`,
      )
    }
  }
}

function renderMissingReport(report: ExplainOperationMissingReport): void {
  process.stderr.write(`${report.error.message}\n`)
  if (report.error.availableOperationIds.length > 0) {
    process.stderr.write(`Available operations: ${report.error.availableOperationIds.join(', ')}\n`)
  }
}

function renderMissingToolReport(report: ExplainToolMissingReport): void {
  process.stderr.write(`${report.error.message}\n`)
  if (report.error.availableToolNames.length > 0) {
    process.stderr.write(`Available MCP tools: ${report.error.availableToolNames.join(', ')}\n`)
  }
}

function renderMissingPermissionReport(report: ExplainPermissionMissingReport): void {
  process.stderr.write(`${report.error.message}\n`)
  if (report.error.availablePermissionKeys.length > 0) {
    process.stderr.write(
      `Available permissions: ${report.error.availablePermissionKeys.join(', ')}\n`,
    )
  }
  process.stderr.write(`Try: ${report.error.suggestedCommand}\n`)
}

function renderMissingFeatureReport(report: ExplainFeatureMissingReport): void {
  process.stderr.write(`${report.error.message}\n`)
  if (report.error.availableFeatureNames.length > 0) {
    process.stderr.write(`Available features: ${report.error.availableFeatureNames.join(', ')}\n`)
  }
}

export const explainCommand = defineCommand({
  meta: {
    name: 'explain',
    description: 'Explain Trellis inventory-backed app concepts',
  },
  args: {
    topic: {
      type: 'positional',
      required: true,
      description: 'Concept to explain. Supported: app, feature, file, operation, tool, permission',
    },
    id: {
      type: 'positional',
      required: false,
      description: 'Identifier to explain',
    },
    cwd: {
      type: 'string',
      description: 'Path to the Nuxt app to inspect',
      valueHint: 'path',
    },
    json: {
      type: 'boolean',
      description: 'Print the explanation as JSON',
      default: false,
    },
    privacy: {
      type: 'string',
      description: 'Privacy mode for app reports: public, developer, or internal',
      default: 'public',
    },
    color: {
      type: 'boolean',
      description: 'Enable colored output',
      default: true,
    },
  },
  async run({ args }) {
    const topic = String(args.topic)
    if (
      topic !== 'app' &&
      topic !== 'feature' &&
      topic !== 'file' &&
      topic !== 'operation' &&
      topic !== 'tool' &&
      topic !== 'permission'
    ) {
      throw new Error(
        'Invalid explain topic. Use `trellis explain app`, `trellis explain feature <name>`, `trellis explain file <path>`, `trellis explain operation <id>`, `trellis explain tool <name>`, or `trellis explain permission <key>`.',
      )
    }

    const cwd = resolve(args.cwd || process.cwd())
    const project = inspectProject(cwd)
    const inventoryFacts = collectTrellisCliInventoryFacts(project)
    const inventory = collectTrellisCliInventory(project, inventoryFacts)
    const privacy = readPrivacy(args.privacy)

    if (topic === 'app') {
      if (args.id !== undefined) {
        throw new Error('`trellis explain app` does not accept an identifier.')
      }

      const report = createAppReport(cwd, inventory, privacy)
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      } else {
        renderAppReport(report)
      }

      return 0
    }

    if (args.id === undefined) {
      throw new Error(`trellis explain ${topic} requires an identifier.`)
    }

    const id = String(args.id)

    if (topic === 'file') {
      const report = createFileReport(cwd, inventory, id)
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      } else {
        renderFileReport(report)
      }

      return 0
    }

    if (topic === 'feature') {
      const feature = findFeature(inventory, id)

      if (!feature) {
        const report = createMissingFeatureReport(cwd, inventory, id)
        if (args.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
        } else {
          renderMissingFeatureReport(report)
        }
        process.exitCode = 1
        return 1
      }

      const report = createFeatureReport(cwd, inventory, feature)
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      } else {
        renderFeatureReport(report)
      }

      return 0
    }

    if (topic === 'permission') {
      const permission = inventory.permissions.definitions.find((entry) => entry.key === id)

      if (!permission) {
        const report = createMissingPermissionReport(cwd, inventory, id)
        if (args.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
        } else {
          renderMissingPermissionReport(report)
        }
        process.exitCode = 1
        return 1
      }

      const report = createPermissionReport(cwd, inventory, permission)
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      } else {
        renderPermissionReport(report)
      }

      return 0
    }

    if (topic === 'tool') {
      const tool = findTool(inventory, id)

      if (!tool) {
        const report = createMissingToolReport(cwd, inventory, id)
        if (args.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
        } else {
          renderMissingToolReport(report)
        }
        process.exitCode = 1
        return 1
      }

      const report = createToolReport(cwd, inventory, tool)
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      } else {
        renderToolReport(report)
      }

      return 0
    }

    const operationId = id
    const operation = findOperation(inventory, operationId)

    if (!operation) {
      const report = createMissingReport(cwd, inventory, operationId)
      if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
      } else {
        renderMissingReport(report)
      }
      process.exitCode = 1
      return 1
    }

    const report = createOperationReport(cwd, inventory, operation)
    if (args.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      renderOperationReport(report)
    }

    return 0
  },
})
