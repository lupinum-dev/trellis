// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:a809535cb1aef5bd2fac59ab61cdeb3381988d9f341895ed9ccc36096133c32a',
  executeById: {
    'comments.create': 'comments.create',
    'comments.list-by-task': 'comments.list-by-task',
    'members.list': 'members.list',
    'projects.archive': 'projects.archive',
    'projects.create': 'projects.create',
    'projects.export': 'projects.export',
    'projects.get': 'projects.get',
    'projects.list': 'projects.list',
    'tasks.assign': 'tasks.assign',
    'tasks.bulk-update-status': 'tasks.bulk-update-status',
    'tasks.create': 'tasks.create',
    'tasks.get': 'tasks.get',
    'tasks.list-by-project': 'tasks.list-by-project',
    'tasks.list-for-export': 'tasks.list-for-export',
    'tasks.move-to-column': 'tasks.move-to-column',
    'tasks.remove': 'tasks.remove',
    'workspaces.create': 'workspaces.create',
  },
  previewById: {
    'projects.archive': 'projects.archive:preview',
    'tasks.remove': 'tasks.remove:preview',
  },
} as const satisfies OperationProjectionRegistry
