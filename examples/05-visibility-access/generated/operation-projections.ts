// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:8a0ae9adf06b394ab9fdeaefd52b9800a88cfaea172cccc82bc63d9a6137773e',
  executeById: {
    'articles.create': 'features/articles/domain:create',
    'articles.list': 'features/articles/domain:list',
    'articles.mark-completed': 'features/articles/domain:markCompleted',
    'articles.publish': 'features/articles/domain:publish',
    'articles.seed-demo': 'features/articles/domain:seed',
    'articles.view': 'features/articles/domain:view',
    'articles.view-shared': 'features/articles/domain:viewShared',
    'knowledgeBases.create': 'features/knowledgeBases/domain:create',
    'knowledgeBases.enroll': 'features/knowledgeBases/domain:enroll',
    'knowledgeBases.enroll-by-email': 'features/knowledgeBases/domain:enrollByEmail',
    'knowledgeBases.get': 'features/knowledgeBases/domain:get',
    'knowledgeBases.list': 'features/knowledgeBases/domain:list',
    'knowledgeBases.publish': 'features/knowledgeBases/domain:publish',
    'shareTokens.create': 'features/articles/domain:createShareToken',
    'shareTokens.revoke': 'features/articles/domain:revokeShareToken',
    'workspaces.create': 'features/workspaces/domain:createWorkspaceMutation',
  },
  previewById: {
    'shareTokens.revoke': 'features/articles/domain:previewRevokeShareToken',
  },
} as const satisfies OperationProjectionRegistry
