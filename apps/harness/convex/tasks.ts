import { implementOperation } from '@lupinum/trellis/backend'

import { addTaskDescriptor } from '../shared/schemas/task'
import { mutation } from './functions'

export const addTaskOp = implementOperation(addTaskDescriptor, {
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
