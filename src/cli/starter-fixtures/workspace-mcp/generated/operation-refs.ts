// AUTO-GENERATED. Do not edit.
import { projectOperationRef } from '@lupinum/trellis/mcp'

import { api } from '../convex/_generated/api'

const __touchMcpKeyOpDescriptor = {
  _type: 'operation-descriptor',
  id: 'mcpKeys.touch',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'mcpKeys.touch'>

const __validateMcpKeyOpDescriptor = {
  _type: 'operation-descriptor',
  id: 'mcpKeys.validate',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'mcpKeys.validate'>

const __createTodoOperationDescriptor = {
  _type: 'operation-descriptor',
  id: 'todos.create',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'todos.create'>

const __listTodosOperationDescriptor = {
  _type: 'operation-descriptor',
  id: 'todos.list',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'todos.list'>

const __createWorkspaceOpDescriptor = {
  _type: 'operation-descriptor',
  id: 'workspaces.create',
  kind: 'safe',
  args: {},
} as unknown as import('@lupinum/trellis/backend').OperationDescriptor<'workspaces.create'>

export const mcpKeysTouchExecuteRef = projectOperationRef(
  __touchMcpKeyOpDescriptor,
  'execute',
  api.features.mcpKeys.domain.touch,
  { functionRef: 'features/mcpKeys/domain:touch' },
)

export const mcpKeysValidateExecuteRef = projectOperationRef(
  __validateMcpKeyOpDescriptor,
  'execute',
  api.features.mcpKeys.domain.validate,
  { functionRef: 'features/mcpKeys/domain:validate' },
)

export const todosCreateExecuteRef = projectOperationRef(
  __createTodoOperationDescriptor,
  'execute',
  api.features.todos.domain.create,
  { functionRef: 'features/todos/domain:create' },
)

export const todosListExecuteRef = projectOperationRef(
  __listTodosOperationDescriptor,
  'execute',
  api.features.todos.domain.list,
  { functionRef: 'features/todos/domain:list' },
)

export const workspacesCreateExecuteRef = projectOperationRef(
  __createWorkspaceOpDescriptor,
  'execute',
  api.features.workspaces.domain.createWorkspaceMutation,
  { functionRef: 'features/workspaces/domain:createWorkspaceMutation' },
)
