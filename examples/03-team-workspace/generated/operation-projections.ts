// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:ae936269ffa500ed8f32ff3245d71283b250690e781a84ab4149eb1f54f62a5a',
  executeById: {
    'todos.create': 'todos.create',
    'todos.get': 'todos.get',
    'todos.list': 'todos.list',
    'todos.process-sync-webhook': 'todos.process-sync-webhook',
    'todos.remove': 'todos.remove',
    'todos.set-completed': 'todos.set-completed',
    'workspaces.create': 'workspaces.create',
  },
  previewById: {
    'todos.remove': 'todos.remove:preview',
  },
} as const satisfies OperationProjectionRegistry
