import { defineOperationDescriptor, operationPreviewValidator } from '@lupinum/trellis/backend'
import { v } from 'convex/values'

import { projectCreateKey, projectDeleteKey } from './permissions'

export const createProjectDescriptor = defineOperationDescriptor({
  id: 'projects.create',
  name: 'createProject',
  kind: 'safe',
  args: {
    title: v.string(),
  },
  permission: projectCreateKey,
  safety: 'bounded-write',
  returns: v.object({
    id: v.string(),
    title: v.string(),
  }),
})

export const deleteProjectDescriptor = defineOperationDescriptor({
  id: 'projects.delete',
  name: 'deleteProject',
  kind: 'destructive',
  args: {
    id: v.string(),
  },
  permission: projectDeleteKey,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      id: v.string(),
    }),
  }),
  returns: v.object({
    deleted: v.boolean(),
  }),
})
