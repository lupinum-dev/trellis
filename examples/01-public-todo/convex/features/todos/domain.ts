import { operation } from '@lupinum/trellis/app'
import { requireRecord } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { createTodo } from '../../../shared/features/todos/contract'
import type { Id } from '../../_generated/dataModel'
import { mutation, query } from '../../functions'

type TodoIdArgs = { id: Id<'todos'> }

export const listTodosOp = operation.query({
  id: 'todos.list',
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('todos').order('desc').collect()
  },
})

export const list = query.public(listTodosOp)

export const createTodoOp = operation.publicMutation({
  id: 'todos.create',
  args: createTodo.args,
  publicWrite: {
    reason: 'Public todo demo allows anonymous todo creation.',
    tables: ['todos'],
    access: ({ db, args }) => ({
      createTodo: async () =>
        await db.insert('todos', {
          title: args.title,
          completed: false,
          createdAt: Date.now(),
        }),
    }),
  },
  handler: async (ctx) => {
    return await ctx.publicWrite.createTodo()
  },
})

export const create = mutation.public(createTodoOp)

export const toggleTodoOp = operation.publicMutation({
  id: 'todos.toggle',
  args: { id: v.id('todos') },
  publicWrite: {
    reason: 'Public todo demo allows anonymous todo completion updates.',
    tables: ['todos'],
    access: ({ db, args }) => ({
      loadTodo: async () => await db.get(args.id),
      setCompleted: async (completed: boolean) => await db.patch(args.id, { completed }),
    }),
  },
  load: async (ctx) => {
    const todo = await ctx.publicWrite.loadTodo()
    requireRecord(todo, 'Todo')
    return { todo }
  },
  handler: async (ctx, _args: TodoIdArgs, { todo }) => {
    await ctx.publicWrite.setCompleted(!todo.completed)
  },
})

export const toggle = mutation.public(toggleTodoOp)

export const removeTodoOp = operation.publicMutation({
  id: 'todos.remove',
  args: { id: v.id('todos') },
  publicWrite: {
    reason: 'Public todo demo allows anonymous todo deletion.',
    tables: ['todos'],
    access: ({ db, args }) => ({
      removeTodo: async () => await db.delete(args.id),
    }),
  },
  handler: async (ctx) => {
    await ctx.publicWrite.removeTodo()
  },
})

export const remove = mutation.public(removeTodoOp)
