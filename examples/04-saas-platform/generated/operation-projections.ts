// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:59744ee3116f7e69d07ca20e1bdcc411bf80165c95f7db427f51c75408e1e181',
  executeById: {
    'comments.create': 'features/comments/domain:create',
    'comments.list-by-task': 'features/comments/domain:listByTask',
    'members.list': 'features/members/domain:list',
    'projects.archive': 'features/projects/domain:archive',
    'projects.create': 'features/projects/domain:create',
    'projects.export': 'features/projects/domain:exportProjects',
    'projects.get': 'features/projects/domain:get',
    'projects.list': 'features/projects/domain:list',
    'tasks.assign': 'features/tasks/domain:assign',
    'tasks.bulk-update-status': 'features/tasks/domain:bulkUpdateStatus',
    'tasks.create': 'features/tasks/domain:create',
    'tasks.get': 'features/tasks/domain:get',
    'tasks.list-by-project': 'features/tasks/domain:listByProject',
    'tasks.list-for-export': 'features/tasks/domain:listForExport',
    'tasks.move-to-column': 'features/tasks/domain:moveToColumn',
    'tasks.remove': 'features/tasks/domain:remove',
    'workspaces.create': 'features/workspaces/domain:createWorkspaceMutation',
  },
  previewById: {
    'projects.archive': 'features/projects/domain:previewArchiveProject',
    'tasks.remove': 'features/tasks/domain:previewRemoveTask',
  },
} as const satisfies OperationProjectionRegistry
