import type { Id } from '~~/convex/_generated/dataModel'

import { api } from '#trellis/api'
import { operations } from '#trellis/operations/mcp'

import { tool } from '../../runtime'

export default tool.operation(operations.runbooks.update, {
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
