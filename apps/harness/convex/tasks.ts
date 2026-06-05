import { operation } from '@lupinum/trellis/app'

import { addTask } from '../shared/schemas/task'
import { mutation } from './functions'

export const addTaskOp = operation.mutation({
  id: 'tasks.add',
  args: addTask.args,
  identityForwardingTransport: 'mcp',
  handler: async (ctx, args) => {
    const appIdentity = await ctx.appIdentity()

    return await ctx.db.insert('tasks', {
      userId: appIdentity.userId,
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})

export const add = mutation.authenticated(addTaskOp)
