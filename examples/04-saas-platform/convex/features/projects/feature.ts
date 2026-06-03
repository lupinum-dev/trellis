import { defineFeature } from '@lupinum/trellis/workspace'

import { archiveProjectOp } from './operations'
import { projectPermissions } from './permissions'
import { projectTables } from './schema'

export const projectsFeature = defineFeature({
  name: 'projects',
  schema: projectTables,
  permissions: projectPermissions,
  operations: [archiveProjectOp],
})
