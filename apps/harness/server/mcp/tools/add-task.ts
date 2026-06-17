import { executeOperationRef } from '@lupinum/trellis/mcp'

import { api } from '../../../convex/_generated/api'
import { addTaskOp } from '../../../convex/tasks'
import { addTask } from '../../../shared/schemas/task'
import { resolveHarnessMcpAuth } from '../../support/mcp-auth-helpers'
import { tool } from '../runtime'

const harnessApi = api as any

export default tool.operation(addTaskOp, {
  schema: addTask,
  execute: executeOperationRef(addTaskOp, harnessApi.tasks.add),
  enabled: async (ctx) => {
    const auth = await resolveHarnessMcpAuth(ctx.event)
    return !!auth?.workspaceId
  },
  meta: {
    name: 'add-task',
  },
  respond: ({ args, result, ok }) => {
    const request = args as { title: string }
    return ok({ id: result }, `Added task "${request.title}"`)
  },
})
