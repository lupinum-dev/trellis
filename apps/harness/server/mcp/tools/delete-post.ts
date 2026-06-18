import { operations } from '#trellis/operations/mcp'

import { tool } from '../runtime'

type DeletePostRespondCtx = {
  args: unknown
  ok: (data: unknown, summary?: string) => unknown
}

export default tool.operation(operations.byId['posts.remove'], {
  meta: {
    name: 'delete-post',
  },
  respond: ({ args, ok }: DeletePostRespondCtx) => {
    const request = args as { id: string }
    return ok({ deleted: true, id: request.id })
  },
})
