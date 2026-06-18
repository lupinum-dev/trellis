import { defineFeature } from '@lupinum/trellis/workspace'

import {
  bulkRemoveRunbooksDescriptor,
  createRunbookDescriptor,
  getWorkspaceRunbookDescriptor,
  listWorkspaceRunbooksDescriptor,
  removeRunbookDescriptor,
  updateRunbookDescriptor,
  workspaceOverviewDescriptor,
} from '../../../shared/features/runbooks/operations'
import { runbookPermissions } from './permissions'
import { runbookTables } from './schema'

export const runbooksFeature = defineFeature({
  name: 'runbooks',
  schema: runbookTables,
  permissions: runbookPermissions,
  operations: [
    listWorkspaceRunbooksDescriptor,
    getWorkspaceRunbookDescriptor,
    createRunbookDescriptor,
    updateRunbookDescriptor,
    removeRunbookDescriptor,
    bulkRemoveRunbooksDescriptor,
    workspaceOverviewDescriptor,
  ],
})
