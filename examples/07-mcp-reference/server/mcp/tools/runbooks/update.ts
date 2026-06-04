import { executeOperationRef } from '@lupinum/trellis/backend'
import type { Id } from '~~/convex/_generated/dataModel'
import { runbookCreate } from '~~/convex/features/runbooks/permissions'
import { updateRunbookOp } from '~~/convex/features/runbooks/domain'
import { updateRunbook } from '~~/shared/features/runbooks/contract'

import { api } from '#trellis/api'

import { tool } from '../../runtime'

export default tool.operation(updateRunbookOp, {
  schema: updateRunbook,
  execute: executeOperationRef(updateRunbookOp, api.features.runbooks.domain.update),
  permission: runbookCreate,
  group: 'workspace',
  middleware: async (args, ctx, next) => {
    const request = args as {
      id: Id<'runbooks'>
      title?: string
      summary?: string
      content?: string
      visibility?: string
      tags?: string[]
    }
    if (
      request.title === undefined &&
      request.summary === undefined &&
      request.content === undefined &&
      request.visibility === undefined &&
      request.tags === undefined
    ) {
      return ctx.error('validation', 'Provide at least one field to update.')
    }

    const existing = await ctx.query(api.features.runbooks.domain.getWorkspace, { id: request.id })
    if (!existing) {
      return ctx.error('not_found', `Runbook "${request.id}" not found.`)
    }

    return await next()
  },
  meta: {
    name: 'update-runbook',
  },
})
