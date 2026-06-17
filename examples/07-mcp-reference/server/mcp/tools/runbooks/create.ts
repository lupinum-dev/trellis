import { executeOperationRef } from '@lupinum/trellis/mcp'
import { createRunbookOp } from '~~/convex/features/runbooks/domain'
import { runbookCreate } from '~~/convex/features/runbooks/permissions'
import { createRunbook } from '~~/shared/features/runbooks/contract'

import { api } from '#trellis/api'

import { tool } from '../../runtime'

export default tool.operation(createRunbookOp, {
  schema: createRunbook,
  execute: executeOperationRef(createRunbookOp, api.features.runbooks.domain.create),
  permission: runbookCreate,
  group: 'workspace',
  maxItems: { field: 'tags', limit: 6 },
  middleware: async (args, ctx, next) => {
    const request = args as { content: string }
    if (!request.content.trim().startsWith('# ')) {
      return ctx.error('validation', 'Runbook content must start with a markdown heading.')
    }
    return await next()
  },
  meta: {
    name: 'create-runbook',
  },
})
