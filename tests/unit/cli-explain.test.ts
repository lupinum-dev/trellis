import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { stripVTControlCharacters } from 'node:util'

import { describe, expect, it, vi } from 'vitest'

const repoRoot = process.cwd()
const cliEntry = resolve(repoRoot, 'dist/cli.mjs')

vi.setConfig({ testTimeout: 30_000 })

type ExplainOperationReport = {
  schemaVersion: 1
  cwd: string
  operation: {
    id: string
    exportName: string
    kind: 'safe' | 'destructive'
    source: { path: string; line: number }
    projections: Array<{
      operationId: string
      exportName: string
      projection: 'preview' | 'execute'
      source: { path: string; line: number }
    }>
    mcpTools: {
      status: 'none' | 'matched'
      tools: Array<{
        name: string
        source: 'tool' | 'operation' | 'defineTool'
        sourceLocation: { path: string; line: number }
        operationId?: string
        operationExportName?: string
      }>
      message?: string
    }
    featureRefs: Array<{
      exportName: string
      name: string
      file: string
      source: { path: string; line: number }
    }>
  }
}

type ExplainMissingReport = {
  schemaVersion: 1
  cwd: string
  error: {
    code: 'operation-not-found' | 'no-operations'
    message: string
    availableOperationIds: string[]
  }
}

type ExplainPermissionReport = {
  schemaVersion: 1
  cwd: string
  permission: {
    key: string
    exportName: string
    label: string
    description?: string
    roles: string[]
    projected: boolean
    source: { path: string; line: number }
    inventories: Array<{
      exportName: string
      file: string
      source: { path: string; line: number }
    }>
    featureRefs: Array<{
      exportName: string
      name: string
      file: string
      source: { path: string; line: number }
    }>
  }
}

type ExplainPermissionMissingReport = {
  schemaVersion: 1
  cwd: string
  error: {
    code: 'permission-not-found' | 'no-permissions'
    message: string
    availablePermissionKeys: string[]
    suggestedCommand: string
  }
}

type PermissionMatrixReport = {
  schemaVersion: 1
  cwd: string
  permissions: Array<{
    key: string
    exportName: string
    label: string
    description?: string
    roles: string[]
    source: { path: string; line: number }
    inventories: string[]
    features: string[]
  }>
}

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
  })
}

function createTempDir(prefix: string): string {
  return mkdtempSync(resolve(tmpdir(), prefix))
}

function parseJsonOutput<T>(output: string): T {
  return JSON.parse(stripVTControlCharacters(output)) as T
}

function createPublicApp(): string {
  const cwd = createTempDir('trellis-explain-')
  const result = runCli(['init', 'demo', '--template', 'public', '--cwd', cwd], repoRoot)
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  expect(result.status, output).toBe(0)
  return resolve(cwd, 'demo')
}

function writeAppFile(appRoot: string, relativePath: string, source: string): void {
  const fullPath = resolve(appRoot, relativePath)
  mkdirSync(resolve(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, source)
}

function addOperationFixture(appRoot: string): void {
  writeAppFile(
    appRoot,
    'convex/features/tasks/permissions.ts',
    `
import { buildPermissionMatrix, definePermission, open } from '@lupinum/trellis/auth'

export const taskArchivePermission = definePermission({
  key: 'tasks.archive',
  label: 'Archive tasks',
  description: 'Allows archiving tasks.',
  roles: ['owner'],
  check: open,
})

export const taskInternalPermission = definePermission({
  key: 'tasks.internal',
  label: 'Internal task maintenance',
  project: false,
  check: open,
})

export const taskPermissions = [taskArchivePermission, taskInternalPermission] as const
export const taskPermissionMatrix = buildPermissionMatrix(taskPermissions)
`.trimStart(),
  )
  writeAppFile(
    appRoot,
    'convex/features/tasks/operations.ts',
    `
import { defineOperation, operationPreview, previewOf } from '@lupinum/trellis/backend'
import { mutation, query } from '../../functions'

export const archiveTaskOp = defineOperation({
  id: 'tasks.archive',
  name: 'archiveTask',
  kind: 'destructive',
  args: {},
  guard: true,
  preview: async () => operationPreview({ summary: 'Archive task', confirm: { id: 'task_1' } }),
  handler: async () => null,
})

export const archiveTask = mutation.protected(archiveTaskOp)
export const previewArchiveTask = query.protected(previewOf(archiveTaskOp))
`.trimStart(),
  )
  writeAppFile(
    appRoot,
    'convex/features/tasks/feature.ts',
    `
import { defineFeature } from '@lupinum/trellis/backend'
import { archiveTaskOp } from './operations'
import { taskArchivePermission } from './permissions'

export const tasksFeature = defineFeature({
  name: 'tasks',
  permissions: [taskArchivePermission],
  operations: [archiveTaskOp],
})
`.trimStart(),
  )
  writeAppFile(
    appRoot,
    'server/mcp/tools/archive-task.ts',
    `
import { archiveTaskOp, archiveTask, previewArchiveTask } from '~/convex/features/tasks/operations'
import { tool } from '../runtime'

export default tool.operation(archiveTaskOp, {
  execute: archiveTask,
  preview: previewArchiveTask,
  meta: {
    name: 'archive-task',
  },
})
`.trimStart(),
  )
}

describe('CLI explain', () => {
  it('explains an operation as versioned JSON from inventory', () => {
    const appRoot = createPublicApp()
    addOperationFixture(appRoot)

    const result = runCli(
      ['explain', 'operation', 'tasks.archive', '--json', '--cwd', appRoot],
      repoRoot,
    )
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    const report = parseJsonOutput<ExplainOperationReport>(result.stdout)
    const serialized = JSON.stringify(report)

    expect(result.status, output).toBe(0)
    expect(report).toMatchObject({
      schemaVersion: 1,
      cwd: appRoot,
      operation: {
        id: 'tasks.archive',
        exportName: 'archiveTaskOp',
        kind: 'destructive',
        source: {
          path: 'convex/features/tasks/operations.ts',
          line: expect.any(Number),
        },
        projections: expect.arrayContaining([
          expect.objectContaining({
            operationId: 'tasks.archive',
            exportName: 'archiveTask',
            projection: 'execute',
          }),
          expect.objectContaining({
            operationId: 'tasks.archive',
            exportName: 'previewArchiveTask',
            projection: 'preview',
          }),
        ]),
        mcpTools: {
          status: 'matched',
          tools: [
            expect.objectContaining({
              name: 'archive-task',
              operationId: 'tasks.archive',
              source: 'operation',
            }),
          ],
        },
        featureRefs: [
          expect.objectContaining({
            exportName: 'tasksFeature',
            name: 'tasks',
            file: 'convex/features/tasks/feature.ts',
          }),
        ],
      },
    })
    expect(serialized).not.toContain('Archive task')
    expect(serialized).not.toContain('task_1')
  }, 30_000)

  it('renders a human-readable operation explanation', () => {
    const appRoot = createPublicApp()
    addOperationFixture(appRoot)

    const result = runCli(['explain', 'operation', 'tasks.archive', '--cwd', appRoot], repoRoot)
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

    expect(result.status, output).toBe(0)
    expect(result.stdout).toContain('Operation tasks.archive')
    expect(result.stdout).toContain('Kind: destructive')
    expect(result.stdout).toContain('Export: archiveTaskOp')
    expect(result.stdout).toContain('preview: previewArchiveTask')
    expect(result.stdout).toContain('execute: archiveTask')
    expect(result.stdout).toContain('tasksFeature (tasks)')
    expect(result.stdout).toContain('archive-task: operation-backed')
  })

  it('fails clearly for an unknown operation and lists available ids', () => {
    const appRoot = createPublicApp()
    addOperationFixture(appRoot)

    const result = runCli(
      ['explain', 'operation', 'tasks.missing', '--json', '--cwd', appRoot],
      repoRoot,
    )
    const report = parseJsonOutput<ExplainMissingReport>(result.stdout)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1)
    expect(report).toMatchObject({
      schemaVersion: 1,
      cwd: appRoot,
      error: {
        code: 'operation-not-found',
        message: 'Operation "tasks.missing" was not found in inventory.',
        availableOperationIds: expect.arrayContaining(['tasks.archive']),
      },
    })
  })

  it('reports when no operations exist', () => {
    const appRoot = createTempDir('trellis-explain-empty-')

    const result = runCli(
      ['explain', 'operation', 'tasks.archive', '--json', '--cwd', appRoot],
      repoRoot,
    )
    const report = parseJsonOutput<ExplainMissingReport>(result.stdout)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1)
    expect(report.error).toEqual({
      code: 'no-operations',
      message: 'No operations were found in inventory.',
      availableOperationIds: [],
    })
  })

  it('explains a permission as versioned JSON from inventory', () => {
    const appRoot = createPublicApp()
    addOperationFixture(appRoot)

    const result = runCli(
      ['explain', 'permission', 'tasks.archive', '--json', '--cwd', appRoot],
      repoRoot,
    )
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    const report = parseJsonOutput<ExplainPermissionReport>(result.stdout)

    expect(result.status, output).toBe(0)
    expect(report).toMatchObject({
      schemaVersion: 1,
      cwd: appRoot,
      permission: {
        key: 'tasks.archive',
        exportName: 'taskArchivePermission',
        label: 'Archive tasks',
        description: 'Allows archiving tasks.',
        roles: ['owner'],
        projected: true,
        source: {
          path: 'convex/features/tasks/permissions.ts',
          line: expect.any(Number),
        },
        inventories: [
          expect.objectContaining({
            exportName: 'taskPermissions',
            file: 'convex/features/tasks/permissions.ts',
          }),
        ],
        featureRefs: [
          expect.objectContaining({
            exportName: 'tasksFeature',
            name: 'tasks',
            file: 'convex/features/tasks/feature.ts',
          }),
        ],
      },
    })
  }, 30_000)

  it('renders a human-readable permission explanation', () => {
    const appRoot = createPublicApp()
    addOperationFixture(appRoot)

    const result = runCli(['explain', 'permission', 'tasks.archive', '--cwd', appRoot], repoRoot)
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`

    expect(result.status, output).toBe(0)
    expect(result.stdout).toContain('Permission tasks.archive')
    expect(result.stdout).toContain('Label: Archive tasks')
    expect(result.stdout).toContain('Export: taskArchivePermission')
    expect(result.stdout).toContain('Roles: owner')
    expect(result.stdout).toContain('taskPermissions')
    expect(result.stdout).toContain('tasksFeature (tasks)')
  })

  it('fails clearly for an unknown permission and points to the matrix', () => {
    const appRoot = createPublicApp()
    addOperationFixture(appRoot)

    const result = runCli(
      ['explain', 'permission', 'tasks.missing', '--json', '--cwd', appRoot],
      repoRoot,
    )
    const report = parseJsonOutput<ExplainPermissionMissingReport>(result.stdout)

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1)
    expect(report).toEqual({
      schemaVersion: 1,
      cwd: appRoot,
      error: {
        code: 'permission-not-found',
        message: 'Permission "tasks.missing" was not found in inventory.',
        availablePermissionKeys: ['tasks.archive', 'tasks.internal'],
        suggestedCommand: 'trellis permissions matrix',
      },
    })
  })

  it('prints the static projected permission matrix', () => {
    const appRoot = createPublicApp()
    addOperationFixture(appRoot)

    const result = runCli(['permissions', 'matrix', '--json', '--cwd', appRoot], repoRoot)
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
    const report = parseJsonOutput<PermissionMatrixReport>(result.stdout)

    expect(result.status, output).toBe(0)
    expect(report.permissions).toEqual([
      expect.objectContaining({
        key: 'tasks.archive',
        exportName: 'taskArchivePermission',
        label: 'Archive tasks',
        description: 'Allows archiving tasks.',
        roles: ['owner'],
        inventories: ['taskPermissions'],
        features: ['tasks'],
      }),
    ])
    expect(JSON.stringify(report)).not.toContain('tasks.internal')
  })

  it('does not add permissions explain as a second explain surface', () => {
    const appRoot = createPublicApp()

    const result = runCli(['permissions', 'explain', 'tasks.archive', '--cwd', appRoot], repoRoot)

    expect(result.status).not.toBe(0)
  })
})
