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
import { open } from '@lupinum/trellis/auth'
import { v } from 'convex/values'
import { expectTypeOf } from 'vitest'

const _listTodos = operation.query({
  id: 'todos.list',
  args: {},
  guard: open,
  handler: async () => [{ title: 'Ship 0.2' }],
})

expectTypeOf<InferOperationResult<typeof _listTodos>>().toEqualTypeOf<
  {
    title: string
  }[]
>()

const _createTodo = operation.mutation({
  id: 'todos.create',
  args: { title: v.string() },
  guard: open,
  handler: async () => ({ created: true as const }),
})

expectTypeOf<InferOperationResult<typeof _createTodo>>().toEqualTypeOf<{
  created: true
}>()

const _removeTodo = operation.destructive({
  id: 'todos.remove',
  args: { id: v.string() },
  guard: open,
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

// @ts-expect-error workspaceScope is fixed to ctx.workspaceId in 0.2.
workspaceScope({ field: 'organizationId' })

operation.query({
  id: 'todos.listByWorkspace',
  args: {},
  scope,
  guard: open,
  handler: async (ctx: { workspaceId: string }) => ctx.workspaceId,
})

operation.destructive({
  id: 'todos.removeScoped',
  args: { id: v.string() },
  scope,
  guard: open,
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
  guard: open,
  safety: 'bounded-write',
  handler: async () => null,
})

operation.query({
  id: 'todos.invalidQuery',
  args: {},
  guard: open,
  // @ts-expect-error query operations must not opt into destructive metadata.
  kind: 'destructive',
  handler: async () => null,
})

// @ts-expect-error destructive operations require safety metadata.
operation.destructive({
  id: 'todos.invalidDestructive',
  args: {},
  guard: open,
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
  guard: open,
  safety: 'destructive-write',
  handler: async () => null,
})
