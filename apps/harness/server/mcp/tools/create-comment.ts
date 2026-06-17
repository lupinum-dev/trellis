import { executeOperationRef } from '@lupinum/trellis/mcp'

import { api } from '../../../convex/_generated/api'
import { createCommentOp } from '../../../convex/comments'
import { createComment } from '../../../shared/schemas/comment'
import { resolveHarnessMcpAuth } from '../../support/mcp-auth-helpers'
import { tool } from '../runtime'

const harnessApi = api as any

export default tool.operation(createCommentOp, {
  schema: createComment,
  execute: executeOperationRef(createCommentOp, harnessApi.comments.create),
  enabled: async (ctx) => {
    const auth = await resolveHarnessMcpAuth(ctx.event)
    return !!auth?.workspaceId
  },
  meta: {
    name: 'create-comment',
  },
  respond: ({ args, result, ok }) => {
    const request = args as { postId: string }
    return ok({ id: result, postId: request.postId }, `Added comment to post ${request.postId}`)
  },
})
