import { operations } from '#trellis/operations/mcp'

import { tool } from '../../runtime'

export default tool.operation(operations.runbooks.create, {
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
