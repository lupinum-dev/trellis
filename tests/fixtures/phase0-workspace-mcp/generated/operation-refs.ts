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
  { functionRef: 'features/projects/domain:createProject' },
)

export const projectsDeleteExecuteRef = projectOperationRef(
  deleteProjectDescriptor,
  'execute',
  api.features.projects.domain.deleteProject,
  { functionRef: 'features/projects/domain:deleteProject' },
)

export const projectsDeletePreviewRef = projectOperationRef(
  deleteProjectDescriptor,
  'preview',
  api.features.projects.domain.previewDeleteProject,
  {
    functionRef: 'features/projects/domain:previewDeleteProject',
    executeFunctionRef: 'features/projects/domain:deleteProject',
  },
)
