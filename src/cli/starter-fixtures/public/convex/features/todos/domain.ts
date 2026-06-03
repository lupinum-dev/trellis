import { operation } from '@lupinum/trellis/app'
import { requireRecord } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { createTodo, listTodos } from '../../../shared/features/todos/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { mutation, query } from '../../functions'

type TodoIdArgs = { id: Id<'todos'> }

export const listTodosOp = operation.query({
  id: 'todos.list',
  args: listTodos.args,
  handler: async (ctx: QueryCtx) => {
    return await ctx.db.query('todos').order('desc').collect()
  },
})

export const list = query.public(listTodosOp)

export const createTodoOp = operation.mutation({
  id: 'todos.create',
  args: createTodo.args,
  handler: async (ctx: MutationCtx, args) => {
    return await ctx.db.insert('todos', {
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})

export const create = mutation.public(createTodoOp)

export const toggleTodoOp = operation.mutation({
  id: 'todos.toggle',
  args: { id: v.id('todos') },
  load: async (ctx: MutationCtx, args: TodoIdArgs) => {
    const todo = await ctx.db.get(args.id)
    requireRecord(todo, 'Todo')
    return { todo }
  },
  handler: async (ctx: MutationCtx, args: TodoIdArgs, { todo }) => {
    await ctx.db.patch(args.id, {
      completed: !todo.completed,
    })
  },
})

export const toggle = mutation.public(toggleTodoOp)

export const removeTodoOp = operation.mutation({
  id: 'todos.remove',
  args: { id: v.id('todos') },
  handler: async (ctx: MutationCtx, args: TodoIdArgs) => {
    await ctx.db.delete(args.id)
  },
})

export const remove = mutation.public(removeTodoOp)
