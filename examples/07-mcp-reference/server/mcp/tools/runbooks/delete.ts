import { executeOperationRef, previewOperationRef } from '@lupinum/trellis/mcp'
import { api } from '~~/convex/_generated/api'
import { removeRunbookOp } from '~~/convex/features/runbooks/operations'

import { tool } from '../../runtime'

export default tool.operation(removeRunbookOp, {
  execute: executeOperationRef(removeRunbookOp, api.features.runbooks.domain.remove),
  preview: previewOperationRef(removeRunbookOp, api.features.runbooks.domain.previewRemove),
  previewOperation: 'mutation',
  group: 'workspace',
  meta: {
    name: 'delete-runbook',
  },
})
