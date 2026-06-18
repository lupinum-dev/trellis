// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:b6ae2d085ca872b2d9ed51438200fce6778a4c27aa2c55920526f5f453820225',
  executeById: {
    'mcpKeys.touch': 'features/mcpKeys/domain:touch',
    'mcpKeys.validate': 'features/mcpKeys/domain:validate',
    'todos.create': 'features/todos/domain:create',
    'todos.list': 'features/todos/domain:list',
    'workspaces.create': 'features/workspaces/domain:createWorkspaceMutation',
  },
  previewById: {},
} as const satisfies OperationProjectionRegistry
