// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:41cc94c9413c42ac87178338a7890f5717426ba53c7de4247633b907f8df8b0c',
  executeById: {
    'mcpKeys.create': 'features/mcpKeys/domain:create',
    'mcpKeys.list': 'features/mcpKeys/domain:list',
    'mcpKeys.revoke': 'features/mcpKeys/domain:revoke',
    'mcpKeys.touch': 'features/mcpKeys/domain:touch',
    'mcpKeys.validate': 'features/mcpKeys/domain:validate',
    'runbooks.bulkRemove': 'features/runbooks/domain:bulkRemove',
    'runbooks.create': 'features/runbooks/domain:create',
    'runbooks.create-from-webhook': 'features/runbooks/webhooks:createRunbookFromWebhookMutation',
    'runbooks.get-workspace': 'features/runbooks/domain:getWorkspace',
    'runbooks.list-workspace': 'features/runbooks/domain:listWorkspace',
    'runbooks.remove': 'features/runbooks/domain:remove',
    'runbooks.update': 'features/runbooks/domain:update',
    'runbooks.workspace-overview': 'features/runbooks/domain:workspaceOverview',
    'users.current': 'features/users/domain:getCurrentUser',
    'users.list-for-mcp-keys': 'features/users/domain:listWorkspaceUsersForMcpKeys',
    'workspaces.create': 'features/workspaces/domain:createWorkspaceMutation',
  },
  previewById: {
    'runbooks.bulkRemove': 'features/runbooks/domain:previewBulkRemove',
    'runbooks.remove': 'features/runbooks/domain:previewRemove',
  },
} as const satisfies OperationProjectionRegistry
