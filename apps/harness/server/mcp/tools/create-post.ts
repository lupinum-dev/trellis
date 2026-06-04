import { executeOperationRef } from '@lupinum/trellis/backend'

import { api } from '../../../convex/_generated/api'
import { createPostOp } from '../../../convex/posts'
import { createPost } from '../../../shared/schemas/post'
import { resolveHarnessMcpAuth } from '../../support/mcp-auth-helpers'
import { tool } from '../runtime'

const harnessApi = api as any

export default tool.operation(createPostOp, {
  schema: createPost,
  execute: executeOperationRef(createPostOp, harnessApi.posts.create),
  enabled: async (ctx) => {
    const auth = await resolveHarnessMcpAuth(ctx.event)
    return !!auth?.workspaceId && ['owner', 'admin', 'member'].includes(auth.role)
  },
  meta: {
    name: 'create-post',
  },
  respond: ({ args, result, ok }) => {
    const request = args as { title: string }
    return ok({ id: result }, `Created post "${request.title}"`)
  },
})
