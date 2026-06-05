import { operationPreview } from '@lupinum/trellis/backend'

import {
  createProjectDescriptor,
  deleteProjectDescriptor,
} from '../../../shared/features/projects/operations'
import { mutation, query } from '../../_generated/server'

export const previewDeleteProject = query({
  args: deleteProjectDescriptor.args,
  returns: deleteProjectDescriptor.previewReturns,
  handler: async (_ctx, args) =>
    operationPreview({
      summary: `Delete project ${args.id}`,
      confirm: {
        id: args.id,
      },
    }),
})

export const deleteProject = mutation({
  args: deleteProjectDescriptor.args,
  returns: deleteProjectDescriptor.returns,
  handler: async () => ({
    deleted: true,
  }),
})

export const createProject = mutation({
  args: createProjectDescriptor.args,
  returns: createProjectDescriptor.returns!,
  handler: async (_ctx, args) => ({
    id: `project:${args.title}`,
    title: args.title,
  }),
})
