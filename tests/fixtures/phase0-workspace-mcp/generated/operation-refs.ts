// AUTO-GENERATED. Do not edit.
import { projectOperationRef } from '@lupinum/trellis/mcp'

import { api } from '../convex/_generated/api'
import {
  createProjectDescriptor,
  deleteProjectDescriptor,
} from '../shared/features/projects/operations'

export const createProjectRef = projectOperationRef(
  createProjectDescriptor,
  'execute',
  api.features.projects.domain.createProject,
  { functionRef: 'features/projects/domain:createProject' },
)

export const deleteProjectRef = projectOperationRef(
  deleteProjectDescriptor,
  'execute',
  api.features.projects.domain.deleteProject,
  { functionRef: 'features/projects/domain:deleteProject' },
)

export const previewDeleteProjectRef = projectOperationRef(
  deleteProjectDescriptor,
  'preview',
  api.features.projects.domain.previewDeleteProject,
  {
    functionRef: 'features/projects/domain:previewDeleteProject',
    executeFunctionRef: 'features/projects/domain:deleteProject',
  },
)
