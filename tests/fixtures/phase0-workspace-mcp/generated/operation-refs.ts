// AUTO-GENERATED. Do not edit.
import { projectOperationRef } from '@lupinum/trellis/mcp'

import { api } from '../convex/_generated/api'
import {
  createProjectDescriptor,
  deleteProjectDescriptor,
} from '../shared/features/projects/operations'

export const projectsCreateExecuteRef = projectOperationRef(
  createProjectDescriptor,
  'execute',
  api.features.projects.domain.createProject,
  { functionRef: 'projects.create' },
)

export const projectsDeleteExecuteRef = projectOperationRef(
  deleteProjectDescriptor,
  'execute',
  api.features.projects.domain.deleteProject,
  { functionRef: 'projects.delete' },
)

export const projectsDeletePreviewRef = projectOperationRef(
  deleteProjectDescriptor,
  'preview',
  api.features.projects.domain.previewDeleteProject,
  {
    functionRef: 'projects.delete:preview',
    executeFunctionRef: 'projects.delete',
  },
)
