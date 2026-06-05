import type { ActingFor } from '@lupinum/trellis/backend'
import { createMcpConvexCaller, defineMcpApp } from '@lupinum/trellis/mcp'
import type { H3Event } from 'h3'

import type { InternalHarnessCaller } from '../../convex/auth/caller'
import {
  commentCreatePermission,
  mcpKeyManagePermission,
  postDeletePermission,
  postPublishPermission,
  postUpdatePermission,
  type InternalHarnessPermissionKey,
} from '../../convex/auth/permissions'
import { trellisObservability } from '../../observability.config'
import { resolveHarnessMcpAuth } from '../support/mcp-auth-helpers'

type McpAuthContext = {
  keyId?: string
  role?: 'owner' | 'admin' | 'member' | 'viewer'
  workspaceId?: string
  userId?: string
}

async function getMcpCaller(event: H3Event): Promise<InternalHarnessCaller> {
  const auth = (await resolveHarnessMcpAuth(event)) as McpAuthContext | null
  if (!auth?.keyId || !auth.userId || !auth.role) {
    return { kind: 'anonymous', subject: 'system:anonymous' }
  }

  return {
    kind: 'agent',
    agentId: auth.userId,
    userId: auth.userId,
    subject: `agent:${auth.userId}`,
    role: auth.role,
    ...(auth.workspaceId ? { workspaceId: auth.workspaceId } : {}),
    provider: 'mcp',
  }
}

function toForwardedHarnessCaller(caller: InternalHarnessCaller) {
  if (caller.kind !== 'agent') {
    return caller
  }

  return {
    kind: 'agent' as const,
    agentId: caller.agentId,
    userId: caller.userId ?? caller.agentId,
    subject: caller.subject,
    role: caller.role,
    ...(caller.workspaceId ? { workspaceId: caller.workspaceId } : {}),
    provider: 'mcp' as const,
  }
}

export const mcpRuntime = defineMcpApp<
  InternalHarnessCaller,
  Record<InternalHarnessPermissionKey, boolean>,
  ActingFor
>({
  callConvex: async (event, { caller, actingFor }) =>
    createMcpConvexCaller(event, {
      caller: toForwardedHarnessCaller(caller),
      actingFor,
      isForwardedCaller: (candidate) => candidate.kind === 'agent',
    }) as never,
  resolveCaller: async (event) => await getMcpCaller(event),
  resolveActingFor: async ({ event }) => {
    const auth = (await resolveHarnessMcpAuth(event)) as McpAuthContext | null
    if (!auth?.userId) return null

    return {
      subject: `user:${auth.userId}`,
    }
  },
  resolveAccess: async ({ caller }) => ({
    [commentCreatePermission.key]:
      caller.kind === 'agent' && ['owner', 'admin', 'member', 'viewer'].includes(caller.role),
    [mcpKeyManagePermission.key]:
      caller.kind === 'agent' && ['owner', 'admin'].includes(caller.role),
    [postDeletePermission.key]:
      caller.kind === 'agent' && ['owner', 'admin', 'member'].includes(caller.role),
    [postPublishPermission.key]:
      caller.kind === 'agent' && ['owner', 'admin'].includes(caller.role),
    [postUpdatePermission.key]:
      caller.kind === 'agent' && ['owner', 'admin', 'member'].includes(caller.role),
  }),
  callerKey: (caller) =>
    caller.kind === 'agent' ? `agent:${caller.agentId}:${caller.role}` : caller.kind,
  scopeKey: ({ caller }) =>
    caller.kind === 'agent' && caller.workspaceId ? caller.workspaceId : 'global',
  observability: trellisObservability,
})

export const tool = mcpRuntime.tool
export default mcpRuntime
