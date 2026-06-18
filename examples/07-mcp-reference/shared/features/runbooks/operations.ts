import { defineOperationDescriptor, operationPreviewValidator } from '@lupinum/trellis/backend'
import { v } from 'convex/values'

import {
  bulkDeleteRunbooks,
  createRunbook,
  deleteRunbook,
  getRunbook,
  listRunbooks,
  updateRunbook,
} from './contract'
import {
  runbookBulkDeleteKey,
  runbookCreateKey,
  runbookDeleteKey,
  runbookReadKey,
} from './permissions'

export const listWorkspaceRunbooksDescriptor = defineOperationDescriptor({
  id: 'runbooks.list-workspace',
  args: listRunbooks.args,
  permission: runbookReadKey,
})

export const getWorkspaceRunbookDescriptor = defineOperationDescriptor({
  id: 'runbooks.get-workspace',
  args: getRunbook.args,
  permission: runbookReadKey,
})

export const createRunbookDescriptor = defineOperationDescriptor({
  id: 'runbooks.create',
  args: createRunbook.args,
  permission: runbookCreateKey,
  safety: 'bounded-write',
})

export const updateRunbookDescriptor = defineOperationDescriptor({
  id: 'runbooks.update',
  args: updateRunbook.args,
  permission: runbookCreateKey,
  safety: 'bounded-write',
})

export const removeRunbookDescriptor = defineOperationDescriptor({
  id: 'runbooks.remove',
  kind: 'destructive',
  args: deleteRunbook.args,
  returns: v.null(),
  permission: runbookDeleteKey,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('runbooks.remove'),
      targetId: v.id('runbooks'),
      affectedCounts: v.object({
        runbooks: v.number(),
      }),
    }),
  }),
})

export const bulkRemoveRunbooksDescriptor = defineOperationDescriptor({
  id: 'runbooks.bulkRemove',
  kind: 'destructive',
  args: bulkDeleteRunbooks.args,
  returns: v.object({
    deleted: v.number(),
    skipped: v.array(
      v.object({
        id: v.string(),
        reason: v.string(),
      }),
    ),
    total: v.number(),
  }),
  permission: runbookBulkDeleteKey,
  safety: 'destructive-write',
  previewReturns: operationPreviewValidator({
    confirm: v.object({
      operation: v.literal('runbooks.bulkRemove'),
      targetIds: v.array(v.id('runbooks')),
      affectedCounts: v.object({
        runbooks: v.number(),
      }),
    }),
  }),
})

export const workspaceOverviewDescriptor = defineOperationDescriptor({
  id: 'runbooks.workspace-overview',
  args: listRunbooks.args,
  permission: runbookReadKey,
})
