import { executeOperationRef, previewOperationRef } from '@lupinum/trellis/backend'
import { api } from '~~/convex/_generated/api'
import { bulkRemoveRunbooksOp } from '~~/convex/features/runbooks/operations'

import { tool } from '../../runtime'

export default tool.operation(bulkRemoveRunbooksOp, {
  execute: executeOperationRef(bulkRemoveRunbooksOp, api.features.runbooks.domain.bulkRemove),
  preview: previewOperationRef(
    bulkRemoveRunbooksOp,
    api.features.runbooks.domain.previewBulkRemove,
  ),
  previewOperation: 'mutation',
  group: 'workspace',
  tags: ['bulk', 'dangerous'],
  meta: {
    name: 'bulk-delete-runbooks',
  },
  rateLimit: { max: 5, window: '1m' },
  maxItems: { field: 'ids', limit: 10 },
})
