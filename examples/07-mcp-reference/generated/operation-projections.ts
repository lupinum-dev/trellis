// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:30b117be98c12ae3060438cc4d7f95cde2537c1fa11c7e5d944aeee77ece95b5',
  executeById: {
    'mcpKeys.create': 'mcpKeys.create',
    'mcpKeys.list': 'mcpKeys.list',
    'mcpKeys.revoke': 'mcpKeys.revoke',
    'mcpKeys.touch': 'mcpKeys.touch',
    'mcpKeys.validate': 'mcpKeys.validate',
    'runbooks.bulkRemove': 'runbooks.bulkRemove',
    'runbooks.create': 'runbooks.create',
    'runbooks.create-from-webhook': 'runbooks.create-from-webhook',
    'runbooks.get-workspace': 'runbooks.get-workspace',
    'runbooks.list-workspace': 'runbooks.list-workspace',
    'runbooks.remove': 'runbooks.remove',
    'runbooks.update': 'runbooks.update',
    'runbooks.workspace-overview': 'runbooks.workspace-overview',
    'users.current': 'users.current',
    'users.list-for-mcp-keys': 'users.list-for-mcp-keys',
    'workspaces.create': 'workspaces.create',
  },
  previewById: {
    'runbooks.bulkRemove': 'runbooks.bulkRemove:preview',
    'runbooks.remove': 'runbooks.remove:preview',
  },
} as const satisfies OperationProjectionRegistry
