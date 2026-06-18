// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:5f9e05540a49205698254c9e7768a1c90a5ee8e42da3c48d26e34898e2fb4bd1',
  executeById: {
    'todos.create': 'features/todos/domain:create',
    'todos.get': 'features/todos/domain:get',
    'todos.list': 'features/todos/domain:list',
    'todos.process-sync-webhook': 'features/todos/webhooks:processTodoSyncWebhookMutation',
    'todos.remove': 'features/todos/domain:remove',
    'todos.set-completed': 'features/todos/domain:setCompleted',
    'workspaces.create': 'features/workspaces/domain:createWorkspaceMutation',
  },
  previewById: {
    'todos.remove': 'features/todos/domain:previewRemove',
  },
} as const satisfies OperationProjectionRegistry
