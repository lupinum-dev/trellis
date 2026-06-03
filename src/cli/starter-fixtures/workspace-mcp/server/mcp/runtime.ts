import { createMcpConvexCaller, defineMcpApp, deniedMcpAccessSnapshot } from '@lupinum/trellis/mcp'
import type { H3Event } from 'h3'
import type { WorkspaceCaller } from '~~/convex/auth/caller'
import { todoPermissions } from '~~/convex/features/todos'

import { api } from '#trellis/api'

const deniedTodoAccess = deniedMcpAccessSnapshot(todoPermissions)

type McpAuthContext = {
  id?: string
  userId?: string
}

function getMcpCaller(event: H3Event): WorkspaceCaller {
  const auth = event.context.mcpAuth as McpAuthContext | undefined
  if (!auth?.id || !auth.userId) {
    return { kind: 'anonymous', subject: 'system:anonymous' }
  }

  return {
    kind: 'agent',
    agentId: auth.id,
    subject: `agent:${auth.id}`,
    provider: 'mcp',
  }
}

export const mcpRuntime = defineMcpApp<WorkspaceCaller>({
  callConvex: async (event, { caller, actingFor }) =>
    createMcpConvexCaller(event, {
      caller,
      actingFor,
      isForwardedCaller: (candidate): candidate is Extract<WorkspaceCaller, { kind: 'agent' }> =>
        candidate.kind === 'agent',
    }),
  resolveCaller: async (event) => getMcpCaller(event),
  resolveAccess: async ({ caller, convex }) =>
    caller.kind === 'agent'
      ? ((await convex.query(api.permissions.context.getAccessContext, {}))?.can ??
        deniedTodoAccess)
      : deniedTodoAccess,
  callerKey: (caller) => (caller.kind === 'agent' ? `agent:${caller.agentId}` : caller.kind),
})

// Project root refs for tool files.
export const tool = mcpRuntime.tool
export default mcpRuntime
