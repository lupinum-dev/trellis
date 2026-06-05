import { implementOperation, operationPreview } from '@lupinum/trellis/backend'

import {
  createProjectDescriptor,
  deleteProjectDescriptor,
} from '../../../shared/features/projects/operations'
import { projectCreate, projectDelete } from './permissions'

export const createProjectOperation = implementOperation(createProjectDescriptor, {
  permission: projectCreate,
  handler: async (_ctx, args) => ({
    id: `project:${args.title}`,
    title: args.title,
  }),
})

export const deleteProjectOperation = implementOperation(deleteProjectDescriptor, {
  permission: projectDelete,
  preview: async () =>
    operationPreview({
      summary: 'Delete project',
      confirm: {
        id: 'project-1',
      },
    }),
  handler: async () => ({
    deleted: true,
  }),
})
