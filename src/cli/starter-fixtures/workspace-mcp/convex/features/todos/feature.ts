import { defineFeature } from '@lupinum/trellis/workspace'

import {
  createTodoDescriptor,
  listTodosDescriptor,
} from '../../../shared/features/todos/operations'
import { todoPermissions } from './permissions'
import { todosTables } from './schema'

export const todosFeature = defineFeature({
  name: 'todos',
  schema: todosTables,
  permissions: todoPermissions,
  operations: [listTodosDescriptor, createTodoDescriptor],
})
