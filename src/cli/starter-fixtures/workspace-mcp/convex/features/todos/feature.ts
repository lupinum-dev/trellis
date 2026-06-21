import { defineFeature } from '@lupinum/trellis/workspace'

import { createTodoOperation, listTodosOperation } from './operations'
import { todoPermissions } from './permissions'
import { todosTables } from './schema'

export const todosFeature = defineFeature({
  name: 'todos',
  schema: todosTables,
  permissions: todoPermissions,
  operations: [listTodosOperation, createTodoOperation],
})
