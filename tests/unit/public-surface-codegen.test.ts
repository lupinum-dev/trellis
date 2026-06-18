import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  extractPublicSurfaceCodegenMetadata,
  renderPublicSurfaceCodegenTypes,
  shouldRefreshPublicSurfaceCodegen,
} from '../../src/module-internals/public-surface-codegen'

function createFixture(files: Record<string, string>) {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'trellis-public-surface-codegen-'))
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = resolve(rootDir, relativePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, contents, 'utf8')
  }
  return rootDir
}

describe('public surface codegen', () => {
  it('extracts beginner app operations and projections', () => {
    const rootDir = createFixture({
      'convex/features/todos/domain.ts': `
        import { operation, operationPreview, previewOf } from '@lupinum/trellis/app'
        import { mutation, query } from '../../functions'

        export const listTodosOp = operation.query({
          id: 'todos.list',
          args: {},
          reads: ['todos'],
          handler: async () => [],
        })

        export const removeTodoOp = operation.destructive({
          id: 'todos.remove',
          safety: 'destructive-write',
          args: {},
          preview: async () => operationPreview({ summary: 'Remove todo', confirm: { id: 'todo_1' } }),
          handler: async () => null,
        })

        export const createTodoOp = operation.publicMutation({
          id: 'todos.create',
          args: {},
          publicWrite: {
            reason: 'Public todo starter allows anonymous todo creation.',
            tables: ['todos'],
            access: () => ({}),
          },
          handler: async () => null,
        })

        export const listTodos = query.public(listTodosOp)
        export const createTodo = mutation.public(createTodoOp)
        export const removeTodo = mutation.authenticated(removeTodoOp)
        export const previewRemoveTodo = mutation.authenticated(previewOf(removeTodoOp))
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(metadata.operations).toEqual([
      {
        exportName: 'createTodoOp',
        file: 'convex/features/todos/domain.ts',
        id: 'todos.create',
        kind: 'safe',
        line: expect.any(Number),
      },
      {
        exportName: 'listTodosOp',
        file: 'convex/features/todos/domain.ts',
        id: 'todos.list',
        kind: 'safe',
        line: expect.any(Number),
      },
      {
        exportName: 'removeTodoOp',
        file: 'convex/features/todos/domain.ts',
        id: 'todos.remove',
        kind: 'destructive',
        line: expect.any(Number),
      },
    ])

    expect(metadata.projections).toEqual([
      {
        exportName: 'createTodo',
        file: 'convex/features/todos/domain.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'createTodoOp',
        operationId: 'todos.create',
        projection: 'execute',
        targetFunctionRef: 'todos.create',
      },
      {
        exportName: 'listTodos',
        file: 'convex/features/todos/domain.ts',
        functionKind: 'query',
        line: expect.any(Number),
        operationExportName: 'listTodosOp',
        operationId: 'todos.list',
        projection: 'execute',
        targetFunctionRef: 'todos.list',
      },
      {
        exportName: 'removeTodo',
        file: 'convex/features/todos/domain.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'removeTodoOp',
        operationId: 'todos.remove',
        projection: 'execute',
        targetFunctionRef: 'todos.remove',
      },
      {
        exportName: 'previewRemoveTodo',
        file: 'convex/features/todos/domain.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'removeTodoOp',
        operationId: 'todos.remove',
        projection: 'preview',
        targetFunctionRef: 'todos.remove:preview',
      },
    ])
  }, 15_000)

  it('extracts explicit host bridge projections while ignoring component internals by default', () => {
    const rootDir = createFixture({
      'shared/features/pages/operations.ts': `
        import { defineOperationDescriptor } from '@lupinum/trellis/backend'

        export const publishPageDescriptor = defineOperationDescriptor({
          id: 'pages.publish',
          kind: 'destructive',
          args: {},
          previewReturns: {},
        })

        export const saveDraftDescriptor = defineOperationDescriptor({
          id: 'pages.save-draft',
          args: {},
        })
      `,
      'convex/components/miniCms/features/pages/domain.ts': `
        import { implementOperation } from '@lupinum/trellis/backend'
        import { mutation } from '../../../functions'
        import { publishPageDescriptor, saveDraftDescriptor } from '../../../../../shared/features/pages/operations'

        export const publishPageOp = implementOperation(publishPageDescriptor, {
          preview: async () => null,
          handler: async () => null,
        })
        export const saveDraftOp = implementOperation(saveDraftDescriptor, {
          handler: async () => null,
        })

        export const publish = mutation.authenticated(publishPageOp)
        export const save = mutation.authenticated(saveDraftOp)
      `,
      'convex/features/pages/domain.ts': `
        import { executeOperationRef, previewOperationRef } from '@lupinum/trellis/backend'
        import { action, mutation, query } from '../../functions'
        import { publishPageDescriptor, saveDraftDescriptor } from '../../../shared/features/pages/operations'

        const saveProjection = mutation.public({
          id: 'features/pages/domain:save',
          args: {},
          handler: async () => null,
        })

        export const save = executeOperationRef(saveDraftDescriptor, saveProjection, {
          functionRef: 'features/pages/domain:save',
        }) as typeof saveProjection

        const publishActionProjection = action.public({
          id: 'features/pages/domain:publishAction',
          args: {},
          handler: async () => null,
        })

        export const publishAction = executeOperationRef(
          publishPageDescriptor,
          publishActionProjection,
          { functionRef: 'features/pages/domain:publishAction' },
        ) as typeof publishActionProjection

        const previewPublishProjection = query.public({
          id: 'features/pages/domain:previewPublish',
          reads: [],
          args: {},
          handler: async () => null,
        })

        export const previewPublish = previewOperationRef(
          publishPageDescriptor,
          previewPublishProjection,
          {
            functionRef: 'features/pages/domain:previewPublish',
            executeFunctionRef: 'features/pages/domain:publishAction',
          },
        ) as typeof previewPublishProjection
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(metadata.diagnostics).toEqual([])
    expect(metadata.operations).toEqual([
      {
        exportName: 'publishPageDescriptor',
        file: 'shared/features/pages/operations.ts',
        id: 'pages.publish',
        kind: 'destructive',
        line: expect.any(Number),
      },
      {
        exportName: 'saveDraftDescriptor',
        file: 'shared/features/pages/operations.ts',
        id: 'pages.save-draft',
        kind: 'safe',
        line: expect.any(Number),
      },
    ])
    expect(metadata.projections).toEqual([
      {
        exportName: 'publishAction',
        file: 'convex/features/pages/domain.ts',
        functionKind: 'action',
        line: expect.any(Number),
        operationExportName: 'publishPageDescriptor',
        operationId: 'pages.publish',
        projection: 'execute',
        targetFunctionRef: 'features/pages/domain:publishAction',
      },
      {
        exportName: 'previewPublish',
        file: 'convex/features/pages/domain.ts',
        functionKind: 'query',
        line: expect.any(Number),
        operationExportName: 'publishPageDescriptor',
        operationId: 'pages.publish',
        projection: 'preview',
        targetFunctionRef: 'features/pages/domain:previewPublish',
      },
      {
        exportName: 'save',
        file: 'convex/features/pages/domain.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'saveDraftDescriptor',
        operationId: 'pages.save-draft',
        projection: 'execute',
        targetFunctionRef: 'features/pages/domain:save',
      },
    ])
  }, 15_000)

  it('extracts operations, projections, and MCP tool metadata', () => {
    const rootDir = createFixture({
      'convex/features/tasks/operations.ts': `
        import { defineOperation, operationPreview, previewOf } from '@lupinum/trellis/backend'
        import { mutation } from '../../functions'
        import { taskArchivePermission } from './permissions'

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          name: 'archiveTask',
          kind: 'destructive',
          args: {},
          permission: taskArchivePermission,
          preview: async () => operationPreview({ summary: 'Archive task', confirm: { id: 'task_1' } }),
          handler: async () => null,
        })

        export const archiveTask = mutation.workspace(archiveTaskOp)
        export const previewArchiveTask = mutation.workspace(previewOf(archiveTaskOp))
      `,
      'server/mcp/tools/tasks/archive-task.ts': `
        import { archiveTaskOp, archiveTask, previewArchiveTask } from '~/convex/features/tasks/operations'
        import { tool } from '../../runtime'

        export default tool.operation(archiveTaskOp, {
          execute: archiveTask,
          preview: previewArchiveTask,
          meta: {
            name: 'archive-task',
          },
        })
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(metadata.operations).toEqual([
      {
        exportName: 'archiveTaskOp',
        file: 'convex/features/tasks/operations.ts',
        id: 'tasks.archive',
        kind: 'destructive',
        line: expect.any(Number),
        name: 'archiveTask',
      },
    ])

    expect(metadata.projections).toEqual([
      {
        exportName: 'archiveTask',
        file: 'convex/features/tasks/operations.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        projection: 'execute',
        targetFunctionRef: 'tasks.archive',
      },
      {
        exportName: 'previewArchiveTask',
        file: 'convex/features/tasks/operations.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        projection: 'preview',
        targetFunctionRef: 'tasks.archive:preview',
      },
    ])

    expect(metadata.tools).toEqual([
      {
        file: 'server/mcp/tools/tasks/archive-task.ts',
        line: expect.any(Number),
        name: 'archive-task',
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        source: 'operation',
      },
    ])
  }, 15_000)

  it('extracts canonical lane preview projections', () => {
    const rootDir = createFixture({
      'convex/features/tasks/operations.ts': `
        import { defineOperation, operationPreview } from '@lupinum/trellis/backend'
        import { mutation, query } from '../../functions'
        import { taskArchivePermission } from './permissions'

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          name: 'archiveTask',
          kind: 'destructive',
          args: {},
          permission: taskArchivePermission,
          preview: async () => operationPreview({ summary: 'Archive task', confirm: { id: 'task_1' } }),
          handler: async () => null,
        })

        export const removeTaskOp = defineOperation({
          id: 'tasks.remove',
          kind: 'destructive',
          args: {},
          permission: taskArchivePermission,
          preview: async () => operationPreview({ summary: 'Remove task', confirm: { id: 'task_2' } }),
          handler: async () => null,
        })

        export const archiveTask = mutation.workspace(archiveTaskOp)
        export const previewArchiveTask = mutation.workspace.preview(archiveTaskOp)
        export const removeTask = mutation.authenticated(removeTaskOp)
        export const previewRemoveTask = mutation.authenticated.preview(removeTaskOp)

        const workspaceMutation = mutation.workspace
        const selectedOperation = archiveTaskOp
        export const aliasArchiveTask = workspaceMutation(archiveTaskOp)
        export const aliasPreviewArchiveTask = workspaceMutation.preview(archiveTaskOp)
        export const dynamicArchiveTask = mutation.workspace(selectedOperation)
        export const queryPreviewArchiveTask = query.workspace.preview(archiveTaskOp)
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(metadata.projections).toEqual([
      {
        exportName: 'archiveTask',
        file: 'convex/features/tasks/operations.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        projection: 'execute',
        targetFunctionRef: 'tasks.archive',
      },
      {
        exportName: 'previewArchiveTask',
        file: 'convex/features/tasks/operations.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        projection: 'preview',
        targetFunctionRef: 'tasks.archive:preview',
      },
      {
        exportName: 'removeTask',
        file: 'convex/features/tasks/operations.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'removeTaskOp',
        operationId: 'tasks.remove',
        projection: 'execute',
        targetFunctionRef: 'tasks.remove',
      },
      {
        exportName: 'previewRemoveTask',
        file: 'convex/features/tasks/operations.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'removeTaskOp',
        operationId: 'tasks.remove',
        projection: 'preview',
        targetFunctionRef: 'tasks.remove:preview',
      },
    ])
  }, 15_000)

  it('prefers operation executeFunctionRef over execute projection id overrides', () => {
    const rootDir = createFixture({
      'src/entries/publish.ts': `
        import { defineOperation, previewOf } from '@lupinum/trellis/backend'
        import { callerMutation } from '../functions'

        export const rollbackVersionOperation = defineOperation({
          id: 'ginko-cms.rollback-version',
          name: 'rollback-version',
          kind: 'destructive',
          executeFunctionRef: 'entries/publish:rollbackVersionOperationExecute',
          args: {},
          handler: async () => ({ rolledBack: true }),
          preview: async () => ({ confirmation: { token: 'confirm', expiresAt: 1 } }),
        })

        export const rollbackVersionOperationExecute = callerMutation.protected({
          ...rollbackVersionOperation,
          id: 'ginko-cms.rollback-version',
        })
        export const previewRollbackVersionOperation = callerMutation.protected(
          Object.assign(previewOf(rollbackVersionOperation), {
            id: 'editor:previewRollbackVersionOperation',
          }),
        )
      `,
      'src/functions.ts': `
        export const callerMutation = { protected: (definition: unknown) => definition }
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir, {
      operationInclude: ['src/**/*.ts'],
      projectionRoots: [
        { name: 'callerMutation', functionKind: 'mutation', supportsPreview: true },
      ],
    })

    expect(metadata.projections).toEqual([
      {
        exportName: 'rollbackVersionOperationExecute',
        file: 'src/entries/publish.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'rollbackVersionOperation',
        operationId: 'ginko-cms.rollback-version',
        projection: 'execute',
        targetFunctionRef: 'entries/publish:rollbackVersionOperationExecute',
      },
      {
        exportName: 'previewRollbackVersionOperation',
        file: 'src/entries/publish.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'rollbackVersionOperation',
        operationId: 'ginko-cms.rollback-version',
        projection: 'preview',
        targetFunctionRef: 'editor:previewRollbackVersionOperation',
      },
    ])
  }, 15_000)

  it('reports unsupported operation projection syntax', () => {
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

        export const removeTaskOp = defineOperation({
          id: 'tasks.remove',
          kind: 'safe',
          args: {},
          handler: async () => null,
        })

        export const archiveTask = mutation.workspace(archiveTaskOp)

        const workspaceMutation = mutation.workspace
        const selectedOperation = archiveTaskOp
        declare const condition: boolean
        export const aliasArchiveTask = workspaceMutation(archiveTaskOp)
        export const dynamicArchiveTask = mutation.workspace(selectedOperation)
        export const conditionalArchiveTask = condition
          ? mutation.workspace(archiveTaskOp)
          : mutation.workspace(removeTaskOp)
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(metadata.projections).toEqual([
      {
        exportName: 'archiveTask',
        file: 'convex/features/tasks/operations.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        projection: 'execute',
        targetFunctionRef: 'tasks.archive',
      },
    ])
    expect(metadata.diagnostics).toEqual([
      {
        code: 'unsupported-projection-call',
        exportName: 'aliasArchiveTask',
        file: 'convex/features/tasks/operations.ts',
        line: expect.any(Number),
        message: expect.stringContaining('Use a direct lane call'),
      },
      {
        code: 'unsupported-projection-operation-reference',
        exportName: 'dynamicArchiveTask',
        file: 'convex/features/tasks/operations.ts',
        line: expect.any(Number),
        message: expect.stringContaining('Pass the operation export directly'),
      },
      {
        code: 'unsupported-projection-conditional',
        exportName: 'conditionalArchiveTask',
        file: 'convex/features/tasks/operations.ts',
        line: expect.any(Number),
        message: expect.stringContaining('Conditional operation projections are unsupported'),
      },
    ])
  }, 15_000)

  it('reports unsupported re-exported operation projections', () => {
    const rootDir = createFixture({
      'convex/features/tasks/local.ts': `
        import { defineOperation } from '@lupinum/trellis/backend'
        import { mutation } from '../../functions'

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          kind: 'safe',
          args: {},
          handler: async () => null,
        })

        const archiveTask = mutation.workspace(archiveTaskOp)
        export { archiveTask }
      `,
      'convex/features/tasks/domain.ts': `
        import { defineOperation } from '@lupinum/trellis/backend'
        import { mutation } from '../../functions'

        export const removeTaskOp = defineOperation({
          id: 'tasks.remove',
          kind: 'safe',
          args: {},
          handler: async () => null,
        })

        export const removeTask = mutation.workspace(removeTaskOp)
      `,
      'convex/features/tasks/index.ts': `
        export { removeTask } from './domain'
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)

    expect(metadata.projections).toEqual([
      {
        exportName: 'removeTask',
        file: 'convex/features/tasks/domain.ts',
        functionKind: 'mutation',
        line: expect.any(Number),
        operationExportName: 'removeTaskOp',
        operationId: 'tasks.remove',
        projection: 'execute',
        targetFunctionRef: 'tasks.remove',
      },
    ])
    expect(metadata.diagnostics).toEqual([
      {
        code: 'unsupported-projection-re-export',
        exportName: 'removeTask',
        file: 'convex/features/tasks/index.ts',
        line: expect.any(Number),
        message: expect.stringContaining('Re-exported operation projection'),
      },
      {
        code: 'unsupported-projection-re-export',
        exportName: 'archiveTask',
        file: 'convex/features/tasks/local.ts',
        line: expect.any(Number),
        message: expect.stringContaining('Re-exported operation projection'),
      },
    ])
  }, 15_000)

  it('renders additive module augmentation types for generated operation and tool maps', () => {
    const rootDir = createFixture({
      'convex/features/tasks/operations.ts': `
        import { defineOperation, operationPreview, previewOf } from '@lupinum/trellis/backend'
        import { mutation } from '../../functions'
        import { taskArchivePermission } from './permissions'

        export const archiveTaskOp = defineOperation({
          id: 'tasks.archive',
          kind: 'destructive',
          args: {},
          permission: taskArchivePermission,
          preview: async () => operationPreview({ summary: 'Archive task', confirm: { id: 'task_1' } }),
          handler: async () => null,
        })

        export const archiveTask = mutation.workspace(archiveTaskOp)
        export const previewArchiveTask = mutation.workspace(previewOf(archiveTaskOp))
      `,
      'server/mcp/tools/tasks/archive-task.ts': `
        import { archiveTaskOp, archiveTask, previewArchiveTask } from '~/convex/features/tasks/operations'
        import { tool } from '../../runtime'

        export default tool.operation(archiveTaskOp, {
          execute: archiveTask,
          preview: previewArchiveTask,
          meta: { name: 'archive-task' },
        })
      `,
    })

    const metadata = extractPublicSurfaceCodegenMetadata(rootDir)
    const types = renderPublicSurfaceCodegenTypes(metadata)

    expect(types).toContain(`import '@lupinum/trellis/backend'`)
    expect(types).toContain(`import '@lupinum/trellis/mcp'`)
    expect(types).toContain(`declare module '@lupinum/trellis/backend'`)
    expect(types).toContain('interface OperationsById')
    expect(types).toContain('"tasks.archive": typeof __trellisOperation0')
    expect(types).toContain('interface OperationExecutionsById')
    expect(types).toContain('interface OperationPreviewsById')
    expect(types).toContain(`declare module '@lupinum/trellis/mcp'`)
    expect(types).toContain('interface ToolsByName')
    expect(types).toContain('"archive-task": typeof __trellisTool0')
  })

  it('refreshes public-surface codegen for shared operation descriptors', () => {
    expect(shouldRefreshPublicSurfaceCodegen('shared/features/tasks/operations.ts')).toBe(true)
    expect(shouldRefreshPublicSurfaceCodegen('convex/features/tasks/domain.ts')).toBe(true)
    expect(shouldRefreshPublicSurfaceCodegen('server/mcp/tools/archive-task.ts')).toBe(true)
    expect(shouldRefreshPublicSurfaceCodegen('server/mcp/_runtime.ts')).toBe(false)
  })
})
