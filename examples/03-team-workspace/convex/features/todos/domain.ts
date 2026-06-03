import { operation, previewOf, workspaceScope } from '@lupinum/trellis/app'
import { requireRecord } from '@lupinum/trellis/auth'

import {
  createTodo,
  deleteTodo,
  listTodos,
  setTodoCompleted,
} from '../../../shared/features/todos/contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'
import { canUpdateTodo } from './checks'
import { removeTodoOp } from './operations'
import { todoCreate, todoRead } from './permissions'
import { todoCapabilities } from './recordAccess'

type WorkspaceQueryCtx = QueryCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type WorkspaceMutationCtx = MutationCtx & {
  workspaceId: Id<'workspaces'>
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}

function requireWorkspaceActor<
  TActor extends { userId: Id<'users'>; workspaceId?: Id<'workspaces'> | null },
>(appIdentity: TActor | null): TActor {
  if (!appIdentity?.workspaceId)
    throw new Error('Current appIdentity is not assigned to a workspace.')
  return appIdentity
}

function requireWorkspaceTenant(appIdentity: { workspaceId?: Id<'workspaces'> | null } | null) {
  if (!appIdentity?.workspaceId)
    throw new Error('Current appIdentity is not assigned to a workspace.')
  return appIdentity.workspaceId
}

export const listTodosOp = operation.query({
  id: 'todos.list',
  args: listTodos.args,
  scope: workspaceScope(),
  guard: todoRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    const appIdentity = requireWorkspaceActor(await ctx.appIdentity())
    const todos = await ctx.db
      .query('todos')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()

    return todoCapabilities.attach(appIdentity, todos)
  },
})

export const list = query.protected(listTodosOp)

export const getTodoOp = operation.query({
  id: 'todos.get',
  args: deleteTodo.args,
  scope: workspaceScope(),
  guard: todoRead,
  load: async (ctx: WorkspaceQueryCtx, args) => {
    const todo = await ctx.db.get(args.id as Id<'todos'>)
    requireRecord(todo, 'Todo')
    return { todo: todo as Doc<'todos'> }
  },
  handler: async (ctx: WorkspaceQueryCtx, _args, { todo }) => {
    return todoCapabilities.attach(await ctx.appIdentity(), todo)
  },
})

export const get = query.protected(getTodoOp)

export const createTodoOp = operation.mutation({
  id: 'todos.create',
  args: createTodo.args,
  scope: workspaceScope(),
  guard: todoCreate,
  handler: async (ctx: WorkspaceMutationCtx, args) => {
    const appIdentity = requireWorkspaceActor(await ctx.appIdentity())

    return ctx.db.insert('todos', {
      title: args.title,
      completed: false,
      ownerId: appIdentity.userId,
      workspaceId: ctx.workspaceId,
      createdAt: Date.now(),
    })
  },
})

export const create = mutation.protected(createTodoOp)

export const setTodoCompletedOp = operation.mutation({
  id: 'todos.set-completed',
  args: setTodoCompleted.args,
  scope: workspaceScope(),
  guard: todoRead,
  load: async (ctx: WorkspaceMutationCtx, args) => {
    const todo = await ctx.db.get(args.id as Id<'todos'>)
    requireRecord(todo, 'Todo')
    return { todo: todo as Doc<'todos'> }
  },
  authorize: {
    check: (_actor: AppIdentity, { todo }: { todo: Doc<'todos'> }) => canUpdateTodo(todo),
  },
  handler: async (ctx: WorkspaceMutationCtx, args) => {
    await ctx.db.patch(args.id, {
      completed: args.completed,
    })
  },
})

export const setCompleted = mutation.protected(setTodoCompletedOp)

export const previewRemove = mutation.protected(previewOf(removeTodoOp))
export const remove = mutation.protected(removeTodoOp)
