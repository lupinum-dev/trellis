import { operations } from '#trellis/operations/mcp'

import { addTask } from '../../../shared/schemas/task'
import { resolveHarnessMcpAuth } from '../../support/mcp-auth-helpers'
import { tool } from '../runtime'

type AddTaskRespondCtx = {
  args: unknown
  result: unknown
  ok: (data: unknown, summary?: string) => unknown
}

export default tool.operation(operations.byId['tasks.add'], {
  schema: addTask,
  enabled: async (ctx) => {
    const auth = await resolveHarnessMcpAuth(ctx.event)
    return !!auth?.workspaceId
  },
  meta: {
    name: 'add-task',
  },
  respond: ({ args, result, ok }: AddTaskRespondCtx) => {
    const request = args as { title: string }
    return ok({ id: result }, `Added task "${request.title}"`)
  },
})
