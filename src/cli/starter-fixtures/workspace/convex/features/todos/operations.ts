import { operation, workspaceScope } from '@lupinum/trellis/app'

import { createTodo, listTodos } from '../../../shared/features/todos/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { todoCreate, workspaceRead } from './permissions'

type WorkspaceQueryCtx = QueryCtx & { workspaceId: Id<'workspaces'> }
type WorkspaceMutationCtx = MutationCtx & { workspaceId: Id<'workspaces'> }

export const listTodosOp = operation.query({
  id: 'todos.list',
  args: listTodos.args,
  scope: workspaceScope(),
  guard: workspaceRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    return await ctx.db
      .query('todos')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()
  },
})

export const createTodoOp = operation.mutation({
  id: 'todos.create',
  args: createTodo.args,
  scope: workspaceScope(),
  guard: todoCreate,
  handler: async (ctx: WorkspaceMutationCtx, args) => {
    return await ctx.db.insert('todos', {
      workspaceId: ctx.workspaceId,
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})
