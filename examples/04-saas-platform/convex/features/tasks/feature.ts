import { defineFeature } from '@lupinum/trellis/workspace'

import { removeTaskOp } from './operations'
import { taskPermissions } from './permissions'
import { taskTables } from './schema'

export const tasksFeature = defineFeature({
  name: 'tasks',
  schema: taskTables,
  permissions: taskPermissions,
  operations: [removeTaskOp],
})
