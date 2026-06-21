import { defineFeature } from '@lupinum/trellis/workspace'

import {
  bulkRemoveRunbooksOp,
  createRunbookOp,
  getWorkspaceRunbookOp,
  listWorkspaceRunbooksOp,
  removeRunbookOp,
  updateRunbookOp,
  workspaceOverviewOp,
} from './operations'
import { runbookPermissions } from './permissions'
import { runbookTables } from './schema'

export const runbooksFeature = defineFeature({
  name: 'runbooks',
  schema: runbookTables,
  permissions: runbookPermissions,
  operations: [
    listWorkspaceRunbooksOp,
    getWorkspaceRunbookOp,
    createRunbookOp,
    updateRunbookOp,
    removeRunbookOp,
    bulkRemoveRunbooksOp,
    workspaceOverviewOp,
  ],
})
