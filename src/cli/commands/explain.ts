import { resolve } from 'node:path'

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

function renderMissingReport(report: ExplainOperationMissingReport): void {
  process.stderr.write(`${report.error.message}\n`)
  if (report.error.availableOperationIds.length > 0) {
    process.stderr.write(`Available operations: ${report.error.availableOperationIds.join(', ')}\n`)
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

export const explainCommand = defineCommand({
  meta: {
    name: 'explain',
    description: 'Explain Trellis inventory-backed app concepts',
  },
  args: {
    topic: {
      type: 'positional',
      required: true,
      description: 'Concept to explain. Supported: app, operation, permission',
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
    if (topic !== 'app' && topic !== 'operation' && topic !== 'permission') {
      throw new Error(
        'Invalid explain topic. Use `trellis explain app`, `trellis explain operation <id>`, or `trellis explain permission <key>`.',
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
