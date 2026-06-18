// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:ebd08f9f7d8e39dfbd5976d37b18928487f767930704d15aa82010b7b0281f04',
  executeById: {
    'projects.create': 'features/projects/domain:createProject',
    'projects.delete': 'features/projects/domain:deleteProject',
  },
  previewById: {
    'projects.delete': 'features/projects/domain:previewDeleteProject',
  },
} as const satisfies OperationProjectionRegistry
