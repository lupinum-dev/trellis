import { operations } from '#trellis/operations/mcp'

import { createComment } from '../../../shared/schemas/comment'
import { resolveHarnessMcpAuth } from '../../support/mcp-auth-helpers'
import { tool } from '../runtime'

type CreateCommentRespondCtx = {
  args: unknown
  result: unknown
  ok: (data: unknown, summary?: string) => unknown
}

export default tool.operation(operations.byId['comments.create'], {
  schema: createComment,
  enabled: async (ctx) => {
    const auth = await resolveHarnessMcpAuth(ctx.event)
    return !!auth?.workspaceId
  },
  meta: {
    name: 'create-comment',
  },
  respond: ({ args, result, ok }: CreateCommentRespondCtx) => {
    const request = args as { postId: string }
    return ok({ id: result, postId: request.postId }, `Added comment to post ${request.postId}`)
  },
})
