// AUTO-GENERATED. Do not edit.
import { defineOperationHandle } from '@lupinum/trellis/mcp'

import { createTodoDescriptor, listTodosDescriptor } from '../../shared/features/todos/operations'
import { todosCreateExecuteRef, todosListExecuteRef } from '../operation-refs'

export const createTodoHandle = defineOperationHandle(createTodoDescriptor, {
  executeRef: todosCreateExecuteRef,
  executeOperation: 'mutation',
  runtimes: ['mcp', 'testing'],
})

export const listTodosHandle = defineOperationHandle(listTodosDescriptor, {
  executeRef: todosListExecuteRef,
  executeOperation: 'query',
  runtimes: ['mcp', 'testing'],
})

export const operations = {
  byId: {
    'todos.create': createTodoHandle,
    'todos.list': listTodosHandle,
  },
  ...{
    todos: {
      create: createTodoHandle,
      list: listTodosHandle,
    },
  },
}
