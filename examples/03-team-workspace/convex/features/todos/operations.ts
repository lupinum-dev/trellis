import {
  operation,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewValidator,
  workspaceScope,
} from '@lupinum/trellis/app'
import { requireRecord } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { deleteTodo } from '../../../shared/features/todos/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { canDeleteTodo } from './checks'
import { todoRead } from './permissions'

type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type TodoIdArgs = { id: Id<'todos'> }

export const removeTodoOp = operation.destructive({
  id: 'todos.remove',
  args: deleteTodo.args,
  returns: v.null(),
  scope: workspaceScope(),
  guard: todoRead,
  permission: todoRead,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('todos.remove'),
      targetId: v.id('todos'),
      affectedCounts: v.object({
        todos: v.number(),
      }),
    }),
  }),
  load: async (ctx: WorkspaceMutationCtx, args: TodoIdArgs): Promise<{ todo: Doc<'todos'> }> => {
    const todo = await ctx.db.get(args.id)
    requireRecord(todo, 'Todo')
    return { todo: todo as Doc<'todos'> }
  },
  authorize: {
    check: (_actor: AppIdentity, loaded: { todo: Doc<'todos'> }) => canDeleteTodo(loaded.todo),
  },
  preview: async (_ctx: WorkspaceMutationCtx, _args: TodoIdArgs, loaded: { todo: Doc<'todos'> }) =>
    operationPreview({
      summary: `Will permanently delete "${loaded.todo.title}"`,
      warnings: [operationIssue({ code: 'permanent-delete', message: 'This cannot be undone.' })],
      effects: [operationEffect({ kind: 'todos', summary: 'Todos deleted', count: 1 })],
      confirm: {
        operation: 'todos.remove',
        targetId: loaded.todo._id,
        affectedCounts: { todos: 1 },
      },
    }),
  handler: async (ctx: WorkspaceMutationCtx, args: TodoIdArgs) => {
    await ctx.db.delete(args.id)
    return null
  },
})
