import { resolve } from 'node:path'

import { defineCommand } from 'citty'

import {
  collectTrellisCliInventory,
  collectTrellisCliInventoryFacts,
  type TrellisCliInventory,
  type TrellisCliInventorySourceLocation,
} from '../lib/inventory.js'
import { inspectProject } from '../lib/project.js'

interface PermissionMatrixReport {
  schemaVersion: 1
  cwd: string
  permissions: Array<{
    key: string
    exportName: string
    label: string
    description?: string
    roles: string[]
    source: TrellisCliInventorySourceLocation
    inventories: string[]
    features: string[]
  }>
}

function buildPermissionMatrixReport(
  cwd: string,
  inventory: TrellisCliInventory,
): PermissionMatrixReport {
  return {
    schemaVersion: 1,
    cwd,
    permissions: inventory.permissions.definitions
      .filter((permission) => permission.projected)
      .map((permission) => ({
        key: permission.key,
        exportName: permission.exportName,
        label: permission.label ?? permission.key,
        ...(permission.description ? { description: permission.description } : {}),
        roles: permission.roles,
        source: permission.source,
        inventories: inventory.permissions.inventories
          .filter((entry) => entry.permissions.includes(permission.exportName))
          .map((entry) => entry.exportName),
        features: inventory.features
          .filter((feature) => feature.permissionRefs.includes(permission.exportName))
          .map((feature) => feature.name),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  }
}

function formatLocation(location: TrellisCliInventorySourceLocation): string {
  return `${location.path}:${location.line}`
}

function renderMatrix(report: PermissionMatrixReport): void {
  if (report.permissions.length === 0) {
    process.stdout.write('No projected permissions found.\n')
    return
  }

  for (const permission of report.permissions) {
    process.stdout.write(`${permission.key}\n`)
    process.stdout.write(`  Label: ${permission.label}\n`)
    process.stdout.write(`  Export: ${permission.exportName}\n`)
    process.stdout.write(`  Source: ${formatLocation(permission.source)}\n`)
    process.stdout.write(
      `  Roles: ${permission.roles.length > 0 ? permission.roles.join(', ') : 'none'}\n`,
    )
    process.stdout.write(
      `  Inventories: ${
        permission.inventories.length > 0 ? permission.inventories.join(', ') : 'none'
      }\n`,
    )
    process.stdout.write(
      `  Features: ${permission.features.length > 0 ? permission.features.join(', ') : 'none'}\n`,
    )
    if (permission.description) {
      process.stdout.write(`  Description: ${permission.description}\n`)
    }
  }
}

const permissionsMatrixCommand = defineCommand({
  meta: {
    name: 'matrix',
    description: 'Print the static Trellis permission matrix',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Path to the Nuxt app to inspect',
      valueHint: 'path',
    },
    json: {
      type: 'boolean',
      description: 'Print the matrix as JSON',
      default: false,
    },
    color: {
      type: 'boolean',
      description: 'Enable colored output',
      default: true,
    },
  },
  async run({ args }) {
    const cwd = resolve(args.cwd || process.cwd())
    const project = inspectProject(cwd)
    const inventoryFacts = collectTrellisCliInventoryFacts(project)
    const inventory = collectTrellisCliInventory(project, inventoryFacts)
    const report = buildPermissionMatrixReport(cwd, inventory)

    if (args.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    } else {
      renderMatrix(report)
    }

    return 0
  },
})

export const permissionsCommand = defineCommand({
  meta: {
    name: 'permissions',
    description: 'Inspect Trellis permission inventory',
  },
  subCommands: {
    matrix: permissionsMatrixCommand,
  },
})
