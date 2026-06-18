import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildOperationHandleBindingsFromRegistry,
  buildOperationRefBindingsFromRegistry,
  buildOperationRegistry,
  renderOperationRegistryGeneratedFiles,
} from '../../src/module-internals/operation-registry-codegen'
import { extractPublicSurfaceCodegenMetadata } from '../../src/module-internals/public-surface-codegen'

function createFixture(files: Record<string, string>) {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'trellis-operation-registry-codegen-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = resolve(rootDir, relativePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, contents, 'utf8')
  }
  return rootDir
}

describe('operation registry codegen', () => {
  it('derives registry projections from canonical lane exports', () => {
    const rootDir = createFixture({
      'convex/features/tasks/operations.ts': `
        import { defineOperation, operationPreview } from '@lupinum/trellis/backend'
        import { mutation, query } from '../../functions'
        import { taskArchivePermission } from './permissions'

        export const listTasksOp = defineOperation({
          id: 'tasks.list',
          kind: 'safe',
          args: {},
          permission: taskArchivePermission,
          handler: async () => [],
        })

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          name: 'archiveTask',
          kind: 'destructive',
          args: {},
          permission: taskArchivePermission,
          preview: async () => operationPreview({ summary: 'Archive task', confirm: { id: 'task_1' } }),
          handler: async () => null,
        })

        export const listTasks = query.workspace(listTasksOp)
        export const archiveTask = mutation.workspace(archiveTaskOp)
        export const previewArchiveTask = mutation.workspace.preview(archiveTaskOp)
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)
    const registry = buildOperationRegistry(metadata)

    expect(registry.operations).toEqual([
      {
        id: 'tasks.archive',
        exportName: 'archiveTaskOp',
        file: 'convex/features/tasks/operations.ts',
        kind: 'destructive',
        line: expect.any(Number),
        name: 'archiveTask',
        execute: {
          apiPath: ['features', 'tasks', 'operations', 'archiveTask'],
          exportName: 'archiveTask',
          file: 'convex/features/tasks/operations.ts',
          functionKind: 'mutation',
          functionRef: 'features/tasks/operations:archiveTask',
          line: expect.any(Number),
          projection: 'execute',
        },
        preview: {
          apiPath: ['features', 'tasks', 'operations', 'previewArchiveTask'],
          exportName: 'previewArchiveTask',
          file: 'convex/features/tasks/operations.ts',
          functionKind: 'mutation',
          functionRef: 'features/tasks/operations:previewArchiveTask',
          line: expect.any(Number),
          projection: 'preview',
        },
      },
      {
        id: 'tasks.list',
        exportName: 'listTasksOp',
        file: 'convex/features/tasks/operations.ts',
        kind: 'safe',
        line: expect.any(Number),
        execute: {
          apiPath: ['features', 'tasks', 'operations', 'listTasks'],
          exportName: 'listTasks',
          file: 'convex/features/tasks/operations.ts',
          functionKind: 'query',
          functionRef: 'features/tasks/operations:listTasks',
          line: expect.any(Number),
          projection: 'execute',
        },
      },
    ])

    expect(buildOperationRefBindingsFromRegistry(registry)).toEqual([
      {
        apiPath: ['features', 'tasks', 'operations', 'archiveTask'],
        descriptorName: 'archiveTaskOp',
        exportName: 'tasksArchiveExecuteRef',
        projection: 'execute',
      },
      {
        apiPath: ['features', 'tasks', 'operations', 'previewArchiveTask'],
        descriptorName: 'archiveTaskOp',
        exportName: 'tasksArchivePreviewRef',
        projection: 'preview',
      },
      {
        apiPath: ['features', 'tasks', 'operations', 'listTasks'],
        descriptorName: 'listTasksOp',
        exportName: 'tasksListExecuteRef',
        projection: 'execute',
      },
    ])

    expect(buildOperationHandleBindingsFromRegistry(registry)).toEqual([
      {
        descriptorName: 'archiveTaskOp',
        executeOperation: 'mutation',
        executeRefName: 'tasksArchiveExecuteRef',
        exportName: 'archiveTaskHandle',
        operationKind: 'destructive',
        operationId: 'tasks.archive',
        operationName: 'archiveTask',
        previewOperation: 'mutation',
        previewRefName: 'tasksArchivePreviewRef',
      },
      {
        descriptorName: 'listTasksOp',
        executeOperation: 'query',
        executeRefName: 'tasksListExecuteRef',
        exportName: 'listTasksHandle',
        operationKind: 'safe',
        operationId: 'tasks.list',
      },
    ])
  })

  it('fails duplicate operation ids before generating registry output', () => {
    const rootDir = createFixture({
      'convex/features/tasks/operations.ts': `
        import { defineOperation } from '@lupinum/trellis/backend'

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          kind: 'safe',
          args: {},
          handler: async () => null,
        })

        export const removeTaskOp = defineOperation({
          id: 'tasks.archive',
          kind: 'safe',
          args: {},
          handler: async () => null,
        })
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(() => buildOperationRegistry(metadata)).toThrow(/Duplicate operation id "tasks.archive"/)
  })

  it('fails destructive operations without canonical preview projections', () => {
    const rootDir = createFixture({
      'convex/features/tasks/operations.ts': `
        import { defineOperation, operationPreview } from '@lupinum/trellis/backend'
        import { mutation } from '../../functions'

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          kind: 'destructive',
          args: {},
          preview: async () => operationPreview({ summary: 'Archive task', confirm: { id: 'task_1' } }),
          handler: async () => null,
        })

        export const archiveTask = mutation.workspace(archiveTaskOp)
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(() => buildOperationRegistry(metadata)).toThrow(
      /Destructive operation "tasks.archive" requires exactly one preview projection/,
    )
  })

  it('fails when scanner diagnostics report unsupported projection syntax', () => {
    const rootDir = createFixture({
      'convex/features/tasks/operations.ts': `
        import { defineOperation } from '@lupinum/trellis/backend'
        import { mutation } from '../../functions'

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          kind: 'safe',
          args: {},
          handler: async () => null,
        })

        const workspaceMutation = mutation.workspace
        export const aliasArchiveTask = workspaceMutation(archiveTaskOp)
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(metadata.diagnostics).toHaveLength(1)
    expect(() => buildOperationRegistry(metadata)).toThrow(
      /Cannot build operation registry with unsupported projection syntax/,
    )
  })

  it('renders operation refs and handles from shared descriptors plus scanned projections', () => {
    const rootDir = createFixture({
      'shared/features/tasks/operations.ts': `
        import { defineOperationDescriptor, operationPreviewValidator } from '@lupinum/trellis/backend'
        import { v } from 'convex/values'

        export const listTasksOp = defineOperationDescriptor({
          id: 'tasks.list',
          kind: 'safe',
          args: {},
          returns: v.array(v.object({ id: v.string() })),
        })

        export const archiveTaskOp = defineOperationDescriptor({
          id: 'tasks.archive',
          name: 'archiveTask',
          kind: 'destructive',
          args: { id: v.string() },
          previewReturns: operationPreviewValidator({
            confirm: v.object({ id: v.string() }),
          }),
          returns: v.object({ archived: v.boolean() }),
        })
      `,
      'convex/features/tasks/domain.ts': `
        import { mutation, query } from '../../functions'
        import { archiveTaskOp, listTasksOp } from '../../../shared/features/tasks/operations'

        export const listTasks = query.workspace(listTasksOp)
        export const archiveTask = mutation.workspace(archiveTaskOp)
        export const previewArchiveTask = mutation.workspace.preview(archiveTaskOp)
      `,
    })

    const registry = buildOperationRegistry(extractPublicSurfaceCodegenMetadata(rootDir))
    const rendered = renderOperationRegistryGeneratedFiles(registry, {
      apiImport: '../../convex/_generated/api',
      defineOperationHandleImport: '@lupinum/trellis/mcp',
      operationHandlesPath: '.trellis/generated/operation-handles/mcp.ts',
      operationProjectionsPath: '.trellis/generated/operation-projections.ts',
      operationRefsPath: '.trellis/generated/operation-refs.ts',
      projectOperationRefImport: '@lupinum/trellis/mcp',
      runtimes: ['mcp', 'testing'],
    })
    const byPath = new Map(rendered.map((file) => [file.path, file.content]))

    expect(byPath.get('.trellis/generated/operation-refs.ts')).toContain(
      "from '../../shared/features/tasks/operations'",
    )
    expect(byPath.get('.trellis/generated/operation-refs.ts')).toContain(
      'api.features.tasks.domain.archiveTask',
    )
    expect(byPath.get('.trellis/generated/operation-refs.ts')).toContain(
      "{ functionRef: 'features/tasks/domain:archiveTask' }",
    )
    expect(byPath.get('.trellis/generated/operation-refs.ts')).toContain(
      "functionRef: 'features/tasks/domain:previewArchiveTask'",
    )
    expect(byPath.get('.trellis/generated/operation-refs.ts')).toContain(
      "executeFunctionRef: 'features/tasks/domain:archiveTask'",
    )
    expect(byPath.get('.trellis/generated/operation-handles/mcp.ts')).toContain(
      "from '../../../shared/features/tasks/operations'",
    )
    expect(byPath.get('.trellis/generated/operation-handles/mcp.ts')).toContain(
      "from '../operation-refs'",
    )
    expect(byPath.get('.trellis/generated/operation-handles/mcp.ts')).toContain(
      "runtimes: ['mcp', 'testing']",
    )
    expect(byPath.get('.trellis/generated/operation-handles/mcp.ts')).toContain(
      "executeOperation: 'mutation'",
    )
    expect(byPath.get('.trellis/generated/operation-handles/mcp.ts')).toContain(
      "previewOperation: 'mutation'",
    )
    expect(byPath.get('.trellis/generated/operation-handles/mcp.ts')).toContain(
      "executeOperation: 'query'",
    )
    expect(byPath.get('.trellis/generated/operation-handles/mcp.ts')).not.toContain(
      'convex/features/tasks/domain',
    )
    expect(byPath.get('.trellis/generated/operation-projections.ts')).toContain(
      "import type { OperationProjectionRegistry } from '@lupinum/trellis/app'",
    )
    expect(byPath.get('.trellis/generated/operation-projections.ts')).toContain(
      "fingerprint: 'sha256:",
    )
    expect(byPath.get('.trellis/generated/operation-projections.ts')).toContain(
      "'tasks.archive': 'features/tasks/domain:archiveTask'",
    )
    expect(byPath.get('.trellis/generated/operation-projections.ts')).toContain(
      "'tasks.archive': 'features/tasks/domain:previewArchiveTask'",
    )
    expect(byPath.get('.trellis/generated/operation-projections.ts')).toContain(
      'satisfies OperationProjectionRegistry',
    )
  })

  it('maps implemented operation projections back to shared descriptors', () => {
    const rootDir = createFixture({
      'shared/features/tasks/operations.ts': `
        import { defineOperationDescriptor } from '@lupinum/trellis/backend'

        export const archiveTaskDescriptor = defineOperationDescriptor({
          id: 'tasks.archive',
          kind: 'safe',
          args: {},
        })
      `,
      'convex/features/tasks/operations.ts': `
        import { implementOperation } from '@lupinum/trellis/backend'
        import { archiveTaskDescriptor } from '../../../shared/features/tasks/operations'

        export const archiveTaskOperation = implementOperation(archiveTaskDescriptor, {
          handler: async () => null,
        })
      `,
      'convex/features/tasks/domain.ts': `
        import { mutation } from '../../functions'
        import { archiveTaskOperation } from './operations'

        export const archiveTask = mutation.workspace(archiveTaskOperation)
      `,
    })

    const registry = buildOperationRegistry(extractPublicSurfaceCodegenMetadata(rootDir))

    expect(registry.operations).toEqual([
      {
        id: 'tasks.archive',
        exportName: 'archiveTaskDescriptor',
        file: 'shared/features/tasks/operations.ts',
        kind: 'safe',
        line: expect.any(Number),
        execute: {
          apiPath: ['features', 'tasks', 'domain', 'archiveTask'],
          exportName: 'archiveTask',
          file: 'convex/features/tasks/domain.ts',
          functionKind: 'mutation',
          functionRef: 'features/tasks/domain:archiveTask',
          line: expect.any(Number),
          projection: 'execute',
        },
      },
    ])
  })

  it('renders package-root testing handles without runtime-importing operation implementations', () => {
    const rootDir = createFixture({
      'src/entries/publish.ts': `
        import { defineOperation, previewOf } from '@lupinum/trellis/backend'
        import { callerMutation, callerTransportMutation } from '../functions'

        export const publishEntryOperation = defineOperation({
          id: 'ginko-cms.publish-entry',
          name: 'publish-entry',
          kind: 'destructive',
          args: {},
          handler: async () => ({ published: true }),
          preview: async () => ({ confirmation: { token: 'confirm', expiresAt: 1 } }),
        })

        export const publishEntryOperationExecute = callerMutation.protected({
          ...publishEntryOperation,
        })
        export const publishEntryTransportExecute = callerTransportMutation({
          ...publishEntryOperation,
          id: 'entries/publish:publishEntryTransportExecute',
        })
        export const previewPublishEntryOperation = callerMutation.protected(
          Object.assign(previewOf(publishEntryOperation), {
            id: 'editor:previewPublishEntryOperation',
          }),
        )
      `,
      'src/functions.ts': `
        export const callerMutation = { protected: (definition: unknown) => definition }
        export const callerTransportMutation = (definition: unknown) => definition
      `,
    })

    const registry = buildOperationRegistry(
      extractPublicSurfaceCodegenMetadata(rootDir, {
        operationInclude: ['src/**/*.ts'],
        projectionRoots: [
          { name: 'callerMutation', functionKind: 'mutation', supportsPreview: true },
        ],
        ignoredProjectionRoots: ['callerTransportMutation'],
      }),
      { convexSourceRoot: 'src' },
    )
    const rendered = renderOperationRegistryGeneratedFiles(registry, {
      apiImport: '../_generated/api',
      defineOperationHandleImport: '@lupinum/trellis/mcp',
      descriptorMode: 'generated-metadata',
      operationDescriptorTypeImport: '@lupinum/trellis/backend',
      operationHandlesPath: 'src/generated/operation-handles/testing.ts',
      operationRefsPath: 'src/generated/operation-refs.ts',
      projectOperationRefImport: '@lupinum/trellis/mcp',
      runtimes: ['testing'],
    })
    const byPath = new Map(rendered.map((file) => [file.path, file.content]))

    expect(registry.operations).toEqual([
      {
        id: 'ginko-cms.publish-entry',
        exportName: 'publishEntryOperation',
        file: 'src/entries/publish.ts',
        kind: 'destructive',
        line: expect.any(Number),
        name: 'publish-entry',
        execute: {
          apiPath: ['entries', 'publish', 'publishEntryOperationExecute'],
          exportName: 'publishEntryOperationExecute',
          file: 'src/entries/publish.ts',
          functionKind: 'mutation',
          functionRef: 'entries/publish:publishEntryOperationExecute',
          line: expect.any(Number),
          projection: 'execute',
        },
        preview: {
          apiPath: ['entries', 'publish', 'previewPublishEntryOperation'],
          exportName: 'previewPublishEntryOperation',
          file: 'src/entries/publish.ts',
          functionKind: 'mutation',
          functionRef: 'entries/publish:previewPublishEntryOperation',
          line: expect.any(Number),
          projection: 'preview',
        },
      },
    ])
    expect(byPath.get('src/generated/operation-refs.ts')).toContain(
      'api.entries.publish.publishEntryOperationExecute',
    )
    expect(byPath.get('src/generated/operation-refs.ts')).not.toContain(
      'publishEntryTransportExecute',
    )
    expect(byPath.get('src/generated/operation-handles/testing.ts')).toContain(
      "id: 'ginko-cms.publish-entry'",
    )
    expect(byPath.get('src/generated/operation-handles/testing.ts')).toContain(
      "kind: 'destructive'",
    )
    expect(byPath.get('src/generated/operation-handles/testing.ts')).toContain(
      "runtimes: ['testing']",
    )
    expect(byPath.get('src/generated/operation-handles/testing.ts')).not.toContain(
      "from '../../entries/publish'",
    )
  })
})
