import { operation } from '@lupinum/trellis/app'
import { deny, requireAuth } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { createTodo } from '../../../shared/features/todos/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { AppIdentity } from '../../auth/appIdentity'
import { mutation, query } from '../../functions'

type TodoIdArgs = { id: Id<'todos'> }

type PersonalQueryCtx = QueryCtx & {
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}
type PersonalMutationCtx = MutationCtx & {
  appIdentity: () => Promise<NonNullable<AppIdentity>>
}

export const listTodosOp = operation.query({
  id: 'todos.list',
  args: {},
  handler: async (ctx: PersonalQueryCtx) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)

    return await ctx.db
      .query('todos')
      .withIndex('by_owner', (q) => q.eq('ownerId', appIdentity.userId))
      .order('desc')
      .collect()
  },
})

export const list = query.authenticated(listTodosOp)

export const createTodoOp = operation.mutation({
  id: 'todos.create',
  args: createTodo.args,
  handler: async (ctx: PersonalMutationCtx, args) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)

    return await ctx.db.insert('todos', {
      ownerId: appIdentity.userId,
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})

export const create = mutation.authenticated(createTodoOp)

export const toggleTodoOp = operation.mutation({
  id: 'todos.toggle',
  args: { id: v.id('todos') },
  load: async (ctx: PersonalMutationCtx, args: TodoIdArgs) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)
    const todo = await ctx.db.get(args.id)
    if (!todo || todo.ownerId !== appIdentity.userId) {
      throw deny('Todo not found.')
    }
    return { todo }
  },
  handler: async (ctx: MutationCtx, args: TodoIdArgs, { todo }) => {
    await ctx.db.patch(args.id, {
      completed: !todo.completed,
    })
  },
})

export const toggle = mutation.authenticated(toggleTodoOp)

export const removeTodoOp = operation.mutation({
  id: 'todos.remove',
  args: { id: v.id('todos') },
  load: async (ctx: PersonalMutationCtx, args: TodoIdArgs) => {
    const appIdentity = await ctx.appIdentity()
    requireAuth(appIdentity)
    const todo = await ctx.db.get(args.id)
    if (!todo || todo.ownerId !== appIdentity.userId) {
      throw deny('Todo not found.')
    }
    return { todo }
  },
  handler: async (ctx: MutationCtx, args: TodoIdArgs) => {
    await ctx.db.delete(args.id)
  },
})

export const remove = mutation.authenticated(removeTodoOp)
