import { defineOperationDescriptor } from '@lupinum/trellis/backend'

import { createTodo, listTodos } from './contract'
import { todoCreateKey, workspaceReadKey } from './permissions'

export const listTodosDescriptor = defineOperationDescriptor({
  id: 'todos.list',
  args: listTodos.args,
  permission: workspaceReadKey,
})

export const createTodoDescriptor = defineOperationDescriptor({
  id: 'todos.create',
  args: createTodo.args,
  permission: todoCreateKey,
  safety: 'bounded-write',
})
