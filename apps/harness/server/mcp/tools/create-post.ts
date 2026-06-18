import { operations } from '#trellis/operations/mcp'

import { createPost } from '../../../shared/schemas/post'
import { resolveHarnessMcpAuth } from '../../support/mcp-auth-helpers'
import { tool } from '../runtime'

type CreatePostRespondCtx = {
  args: unknown
  result: unknown
  ok: (data: unknown, summary?: string) => unknown
}

export default tool.operation(operations.byId['posts.create'], {
  schema: createPost,
  enabled: async (ctx) => {
    const auth = await resolveHarnessMcpAuth(ctx.event)
    return !!auth?.workspaceId && ['owner', 'admin', 'member'].includes(auth.role)
  },
  meta: {
    name: 'create-post',
  },
  respond: ({ args, result, ok }: CreatePostRespondCtx) => {
    const request = args as { title: string }
    return ok({ id: result }, `Created post "${request.title}"`)
  },
})
