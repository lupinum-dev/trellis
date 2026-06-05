import {
  blockedOperationPreview,
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  previewOf,
  workspaceScope,
  type InferOperationResult,
  type WorkspaceScopeDefinition,
} from '@lupinum/trellis/app'
import { v } from 'convex/values'
import { expectTypeOf } from 'vitest'

// Intentional 0.3.0 public type boundary coverage: old protected-lane guard
// shapes appear only as negative app-operation assertions.

const _listTodos = operation.query({
  id: 'todos.list',
  args: {},
  handler: async () => [{ title: 'Ship 0.3' }],
})

expectTypeOf<InferOperationResult<typeof _listTodos>>().toEqualTypeOf<
  {
    title: string
  }[]
>()

const _createTodo = operation.mutation({
  id: 'todos.create',
  args: { title: v.string() },
  permission: 'todos.create',
  handler: async () => ({ created: true as const }),
})

expectTypeOf<InferOperationResult<typeof _createTodo>>().toEqualTypeOf<{
  created: true
}>()

const _removeTodo = operation.destructive({
  id: 'todos.remove',
  args: { id: v.string() },
  permission: 'todos.remove',
  safety: 'destructive-write',
  preview: async () => ({
    allowed: true as const,
    summary: 'Remove todo',
    effects: [],
    blockers: [],
    confirm: { id: 'todo_1' },
  }),
  handler: async () => ({ removed: true as const }),
})

expectTypeOf<InferOperationResult<typeof _removeTodo>>().toEqualTypeOf<{
  removed: true
}>()

previewOf(_removeTodo)

operationPreview({
  summary: 'Remove todo',
  effects: [operationEffect({ kind: 'delete', summary: 'Delete todo' })],
  warnings: [operationIssue({ code: 'permanent-delete', message: 'This cannot be undone.' })],
  confirm: { id: 'todo_1' },
})

operationPreviewValidator({ confirm: v.object({ id: v.string() }) })

blockedOperationPreview({
  summary: 'Cannot remove todo',
  blockers: [operationIssue({ code: 'missing-access', message: 'Missing access.' })],
  confirm: { id: 'todo_1' },
})

const scope = workspaceScope()
expectTypeOf<typeof scope>().toEqualTypeOf<WorkspaceScopeDefinition<'workspaceId'>>()

// @ts-expect-error workspaceScope is fixed to ctx.workspaceId.
workspaceScope({ field: 'organizationId' })

operation.query({
  id: 'todos.listByWorkspace',
  args: {},
  scope,
  permission: 'todos.read',
  handler: async (ctx: { workspaceId: string }) => ctx.workspaceId,
})

operation.destructive({
  id: 'todos.removeScoped',
  args: { id: v.string() },
  scope,
  permission: 'todos.remove',
  safety: 'destructive-write',
  preview: async () => ({
    allowed: true as const,
    summary: 'Remove todo',
    effects: [],
    blockers: [],
    confirm: { id: 'todo_1' },
  }),
  handler: async () => ({ removed: true as const }),
})

operation.mutation({
  id: 'todos.rename',
  args: { id: v.string(), title: v.string() },
  permission: 'todos.rename',
  safety: 'bounded-write',
  handler: async () => null,
})

operation.query({
  id: 'todos.invalidQuery',
  args: {},
  // @ts-expect-error query operations must not opt into destructive metadata.
  kind: 'destructive',
  handler: async () => null,
})

// @ts-expect-error destructive operations require safety metadata.
operation.destructive({
  id: 'todos.invalidDestructive',
  args: {},
  permission: 'todos.remove',
  preview: async () => ({
    allowed: true as const,
    summary: 'Invalid',
    effects: [],
    blockers: [],
    confirm: {},
  }),
  handler: async () => null,
})

// @ts-expect-error destructive operations require preview metadata.
operation.destructive({
  id: 'todos.invalidDestructivePreview',
  args: {},
  permission: 'todos.remove',
  safety: 'destructive-write',
  handler: async () => null,
})

operation.query({
  id: 'todos.invalidGuard',
  args: {},
  // @ts-expect-error app operations do not accept protected-lane guards.
  guard: true,
  handler: async () => null,
})
