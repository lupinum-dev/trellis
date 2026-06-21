// AUTO-GENERATED. Do not edit.
import { defineOperationHandle } from '@lupinum/trellis/mcp'

import {
  mcpKeysTouchExecuteRef,
  mcpKeysValidateExecuteRef,
  todosCreateExecuteRef,
  todosListExecuteRef,
  workspacesCreateExecuteRef,
} from '../operation-refs'

const __touchMcpKeyHandleDescriptor = {
  _type: 'operation-descriptor',
  id: 'mcpKeys.touch',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'mcpKeys.touch'>

export const touchMcpKeyHandle = defineOperationHandle(__touchMcpKeyHandleDescriptor, {
  executeRef: mcpKeysTouchExecuteRef,
  executeOperation: 'mutation',
  runtimes: ['mcp'],
})

const __validateMcpKeyHandleDescriptor = {
  _type: 'operation-descriptor',
  id: 'mcpKeys.validate',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'mcpKeys.validate'>

export const validateMcpKeyHandle = defineOperationHandle(__validateMcpKeyHandleDescriptor, {
  executeRef: mcpKeysValidateExecuteRef,
  executeOperation: 'query',
  runtimes: ['mcp'],
})

const __createTodoHandleDescriptor = {
  _type: 'operation-descriptor',
  id: 'todos.create',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'todos.create'>

export const createTodoHandle = defineOperationHandle(__createTodoHandleDescriptor, {
  executeRef: todosCreateExecuteRef,
  executeOperation: 'mutation',
  runtimes: ['mcp'],
})

const __listTodosHandleDescriptor = {
  _type: 'operation-descriptor',
  id: 'todos.list',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'todos.list'>

export const listTodosHandle = defineOperationHandle(__listTodosHandleDescriptor, {
  executeRef: todosListExecuteRef,
  executeOperation: 'query',
  runtimes: ['mcp'],
})

const __createWorkspaceHandleDescriptor = {
  _type: 'operation-descriptor',
  id: 'workspaces.create',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'workspaces.create'>

export const createWorkspaceHandle = defineOperationHandle(__createWorkspaceHandleDescriptor, {
  executeRef: workspacesCreateExecuteRef,
  executeOperation: 'mutation',
  runtimes: ['mcp'],
})

export const operations = {
  byId: {
    'mcpKeys.touch': touchMcpKeyHandle,
    'mcpKeys.validate': validateMcpKeyHandle,
    'todos.create': createTodoHandle,
    'todos.list': listTodosHandle,
    'workspaces.create': createWorkspaceHandle,
  },
  ...{
    mcpkeys: {
      touch: touchMcpKeyHandle,
      validate: validateMcpKeyHandle,
    },
    todos: {
      create: createTodoHandle,
      list: listTodosHandle,
    },
    workspaces: {
      create: createWorkspaceHandle,
    },
  },
}
