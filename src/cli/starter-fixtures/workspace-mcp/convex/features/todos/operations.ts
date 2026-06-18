import { workspaceScope } from '@lupinum/trellis/app'
import { implementOperation } from '@lupinum/trellis/backend'

import {
  createTodoDescriptor,
  listTodosDescriptor,
} from '../../../shared/features/todos/operations'
import type { Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { todoCreate, workspaceRead } from './permissions'

type WorkspaceQueryCtx = QueryCtx & { workspaceId: Id<'workspaces'> }
type WorkspaceMutationCtx = MutationCtx & { workspaceId: Id<'workspaces'> }

export const listTodosOperation = implementOperation(listTodosDescriptor, {
  scope: workspaceScope(),
  permission: workspaceRead,
  handler: async (ctx: WorkspaceQueryCtx) => {
    return await ctx.db
      .query('todos')
      .withIndex('by_workspace', (q) => q.eq('workspaceId', ctx.workspaceId))
      .order('desc')
      .collect()
  },
})

export const createTodoOperation = implementOperation(createTodoDescriptor, {
  scope: workspaceScope(),
  permission: todoCreate,
  handler: async (ctx: WorkspaceMutationCtx, args) => {
    return await ctx.db.insert('todos', {
      workspaceId: ctx.workspaceId,
      title: args.title,
      completed: false,
      createdAt: Date.now(),
    })
  },
})
