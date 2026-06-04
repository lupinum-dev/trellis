import { executeOperationRef } from '@lupinum/trellis/backend'
import { todoCreate } from '~~/convex/features/todos'
import { createTodoOp } from '~~/convex/features/todos/operations'
import { createTodo } from '~~/shared/features/todos/contract'

import { api } from '#trellis/api'

import { tool } from '../runtime'

export default tool.operation(createTodoOp, {
  schema: createTodo,
  execute: executeOperationRef(createTodoOp, api.features.todos.domain.create),
  permission: todoCreate,
  meta: {
    name: 'create-todo',
  },
})
