import { defineMcpApp } from '@lupinum/trellis/mcp'

import type { MiniCmsPrincipal } from '../../shared/caller'
import { getCapabilitiesForPrincipal, getMcpCaller, type RecordAccessSnapshot } from './mcp-auth'

export const mcpRuntime = defineMcpApp<MiniCmsPrincipal, RecordAccessSnapshot>({
  resolveCaller: async (event) => getMcpCaller(event),
  resolveAccess: async ({ caller }) => getCapabilitiesForPrincipal(caller),
  callerKey: (caller) => {
    switch (caller.kind) {
      case 'anonymous':
        return 'anonymous'
      case 'user':
        return `auth:${caller.authKey}`
      case 'agent':
        return `agent:${caller.agentId}`
    }

    throw new Error('Unsupported MCP caller.')
  },
  scopeKey: () => 'global',
})

export const tool = mcpRuntime.tool
