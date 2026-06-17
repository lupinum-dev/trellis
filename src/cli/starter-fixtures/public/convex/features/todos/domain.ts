import { operation } from '@lupinum/trellis/app'
import { requireRecord } from '@lupinum/trellis/auth'
import { v } from 'convex/values'

import { createTodo, listTodos } from '../../../shared/features/todos/contract'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { mutation, query } from '../../functions'

type TodoIdArgs = { id: Id<'todos'> }

export const listTodosOp = operation.query({
  id: 'todos.list',
  args: listTodos.args,
  handler: async (ctx) => {
    return await ctx.db.query('todos').order('desc').collect()
  },
})

export const list = query.public({ ...listTodosOp, reads: ['todos'] })

export const createTodoOp = operation.publicMutation({
  id: 'todos.create',
  args: createTodo.args,
  publicWrite: {
    reason: 'The public starter intentionally lets anyone create demo todos.',
    tables: ['todos'],
    access: ({ db }) => {
      const writer = db as MutationCtx['db']
      return {
        create: async (title: string) =>
          await writer.insert('todos', {
            title,
            completed: false,
            createdAt: Date.now(),
          }),
      }
    },
  },
  handler: async (ctx, args) => {
    return await ctx.publicWrite.create(args.title)
  },
})

export const create = mutation.public(createTodoOp)

export const toggleTodoOp = operation.publicMutation({
  id: 'todos.toggle',
  args: { id: v.id('todos') },
  publicWrite: {
    reason: 'The public starter intentionally lets anyone update demo todos.',
    tables: ['todos'],
    access: ({ db }) => {
      const writer = db as MutationCtx['db']
      return {
        toggle: async (id: Id<'todos'>, completed: boolean) => {
          await writer.patch('todos', id, { completed })
        },
      }
    },
  },
  load: async (ctx, args: TodoIdArgs) => {
    const todo = await ctx.db.get('todos', args.id)
    requireRecord(todo, 'Todo')
    return { todo }
  },
  handler: async (ctx, args: TodoIdArgs, { todo }) => {
    await ctx.publicWrite.toggle(args.id, !todo.completed)
  },
})

export const toggle = mutation.public(toggleTodoOp)

export const removeTodoOp = operation.publicMutation({
  id: 'todos.remove',
  args: { id: v.id('todos') },
  publicWrite: {
    reason: 'The public starter intentionally lets anyone delete demo todos.',
    tables: ['todos'],
    access: ({ db }) => {
      const writer = db as MutationCtx['db']
      return {
        remove: async (id: Id<'todos'>) => {
          await writer.delete('todos', id)
        },
      }
    },
  },
  handler: async (ctx, args: TodoIdArgs) => {
    await ctx.publicWrite.remove(args.id)
  },
})

export const remove = mutation.public(removeTodoOp)
