import { defineFeature } from '@lupinum/trellis/workspace'

import { bulkRemoveRunbooksOp, removeRunbookOp } from './operations'
import { runbookPermissions } from './permissions'
import { runbookTables } from './schema'

export const runbooksFeature = defineFeature({
  name: 'runbooks',
  schema: runbookTables,
  permissions: runbookPermissions,
  operations: [removeRunbookOp, bulkRemoveRunbooksOp],
})
