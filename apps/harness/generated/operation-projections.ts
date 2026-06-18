// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:8a6685529b5bc02e7756a396176518ebc20988c78fe6aa63d6bc84ac808fe198',
  executeById: {
    'comments.create': 'comments:create',
    'mcp-keys.create': 'mcpKeys:create',
    'mcp-keys.revoke': 'mcpKeys:revoke',
    'notes.add': 'notes:add',
    'posts.create': 'posts:create',
    'posts.publish': 'posts:publish',
    'posts.remove': 'posts:removeWithConfirmation',
    'posts.remove.direct': 'posts:remove',
    'posts.update': 'posts:update',
    'tasks.add': 'tasks:add',
  },
  previewById: {
    'posts.remove': 'posts:previewRemove',
  },
} as const satisfies OperationProjectionRegistry
