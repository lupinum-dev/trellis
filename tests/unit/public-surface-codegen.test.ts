import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  extractPublicSurfaceCodegenMetadata,
  renderPublicSurfaceCodegenTypes,
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
        line: expect.any(Number),
        operationExportName: 'createTodoOp',
        operationId: 'todos.create',
        projection: 'execute',
      },
      {
        exportName: 'listTodos',
        file: 'convex/features/todos/domain.ts',
        line: expect.any(Number),
        operationExportName: 'listTodosOp',
        operationId: 'todos.list',
        projection: 'execute',
      },
      {
        exportName: 'removeTodo',
        file: 'convex/features/todos/domain.ts',
        line: expect.any(Number),
        operationExportName: 'removeTodoOp',
        operationId: 'todos.remove',
        projection: 'execute',
      },
      {
        exportName: 'previewRemoveTodo',
        file: 'convex/features/todos/domain.ts',
        line: expect.any(Number),
        operationExportName: 'removeTodoOp',
        operationId: 'todos.remove',
        projection: 'preview',
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
        line: expect.any(Number),
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        projection: 'execute',
      },
      {
        exportName: 'previewArchiveTask',
        file: 'convex/features/tasks/operations.ts',
        line: expect.any(Number),
        operationExportName: 'archiveTaskOp',
        operationId: 'tasks.archive',
        projection: 'preview',
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
})
