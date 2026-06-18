// AUTO-GENERATED. Do not edit.
import { projectOperationRef } from '@lupinum/trellis/mcp'

import { api } from '../convex/_generated/api'
import { createTodoDescriptor, listTodosDescriptor } from '../shared/features/todos/operations'

export const todosCreateExecuteRef = projectOperationRef(
  createTodoDescriptor,
  'execute',
  api.features.todos.domain.create,
  { functionRef: 'features/todos/domain:create' },
)

export const todosListExecuteRef = projectOperationRef(
  listTodosDescriptor,
  'execute',
  api.features.todos.domain.list,
  { functionRef: 'features/todos/domain:list' },
)
