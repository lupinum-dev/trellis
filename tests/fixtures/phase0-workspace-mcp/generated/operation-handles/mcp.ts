// AUTO-GENERATED. Do not edit.
import { defineOperationHandle } from '@lupinum/trellis/mcp'

import {
  createProjectDescriptor,
  deleteProjectDescriptor,
} from '../../shared/features/projects/operations'
import {
  createProjectRef,
  executeDeleteProjectRef,
  previewDeleteProjectRef,
} from '../operation-refs'

export const createProjectHandle = defineOperationHandle(createProjectDescriptor, {
  executeRef: createProjectRef,
  runtimes: ['mcp', 'testing'],
})

export const deleteProjectHandle = defineOperationHandle(deleteProjectDescriptor, {
  executeRef: executeDeleteProjectRef,
  previewRef: previewDeleteProjectRef,
  runtimes: ['mcp', 'testing'],
})

export const operations = {
  byId: {
    'projects.create': createProjectHandle,
    'projects.delete': deleteProjectHandle,
  },
  ...{
    projects: {
      create: createProjectHandle,
      delete: deleteProjectHandle,
    },
  },
} as const
