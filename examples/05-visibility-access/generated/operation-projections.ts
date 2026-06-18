// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:a4d67b1bc0c4740fd9aecca708054ae843cb9eedd64eadf6cc5f3d44310d269b',
  executeById: {
    'articles.create': 'articles.create',
    'articles.list': 'articles.list',
    'articles.mark-completed': 'articles.mark-completed',
    'articles.publish': 'articles.publish',
    'articles.seed-demo': 'articles.seed-demo',
    'articles.view': 'articles.view',
    'articles.view-shared': 'articles.view-shared',
    'knowledgeBases.create': 'knowledgeBases.create',
    'knowledgeBases.enroll': 'knowledgeBases.enroll',
    'knowledgeBases.enroll-by-email': 'knowledgeBases.enroll-by-email',
    'knowledgeBases.get': 'knowledgeBases.get',
    'knowledgeBases.list': 'knowledgeBases.list',
    'knowledgeBases.publish': 'knowledgeBases.publish',
    'shareTokens.create': 'shareTokens.create',
    'shareTokens.revoke': 'shareTokens.revoke',
    'workspaces.create': 'workspaces.create',
  },
  previewById: {
    'shareTokens.revoke': 'shareTokens.revoke:preview',
  },
} as const satisfies OperationProjectionRegistry
