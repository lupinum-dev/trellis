import { subject } from '@lupinum/trellis/auth'
import type { ActingFor } from '@lupinum/trellis/backend'
import type { H3Event } from 'h3'
import type { McpReferencePrincipal } from '~~/convex/auth/caller'
import type { McpReferencePermissionKey } from '~~/convex/features'
import { mcpManage as mcpManagePermission } from '~~/convex/features/mcpKeys/permissions'
import { runbookPermissions } from '~~/convex/features/runbooks/permissions'

import { api } from '#trellis/api'
import { defineMcpApp, deniedMcpAccessSnapshot } from '#trellis/mcp'
import { requireDelegationBinding } from '#trellis/server'

import { mcpRateLimitStore } from '../utils/mcp-rate-limit-store'

type McpAuthContext = {
  keyId?: string
  workspaceId?: string
  userId?: string
}

type RecordAccessSnapshot = Record<McpReferencePermissionKey, boolean>
const deniedReferenceAccess = deniedMcpAccessSnapshot([
  ...runbookPermissions,
  mcpManagePermission,
]) as RecordAccessSnapshot

function getMcpCaller(event: H3Event): McpReferencePrincipal {
  const auth = event.context.mcpAuth as McpAuthContext | undefined
  if (!auth?.keyId || !auth.userId) {
    return { kind: 'anonymous', subject: 'system:anonymous' }
  }

  // The MCP key identifies the real caller. Do not collapse it into the user.
  return {
    kind: 'agent',
    agentId: auth.keyId,
    subject: subject.agent(auth.keyId),
    provider: 'mcp',
  }
}

async function getMcpDelegation(event: H3Event): Promise<ActingFor | null> {
  const auth = event.context.mcpAuth as McpAuthContext | undefined
  if (!auth?.keyId || !auth.userId || !auth.workspaceId) return null

  return requireDelegationBinding({
    serviceId: auth.keyId,
    targetUserId: auth.userId,
    workspaceId: auth.workspaceId,
    purpose: 'mcp-session',
    grantSource: 'mcp-key-binding',
    grantId: auth.keyId,
    expiresAt: Date.now() + 5 * 60 * 1000,
    reason: 'Validated MCP bearer key binding',
  })
}

type McpRuntimeContext = {
  workspaceId: string
}

export const mcpRuntime = defineMcpApp<
  McpReferencePrincipal,
  RecordAccessSnapshot,
  ActingFor,
  McpRuntimeContext
>({
  rateLimitStore: mcpRateLimitStore,
  resolveCaller: async (event) => getMcpCaller(event),
  resolveActingFor: async ({ event }) => getMcpDelegation(event),
  resolveAccess: async ({ caller, convex }) => {
    if (caller.kind !== 'agent') {
      // Keep anonymous and non-agent callers on an empty recordAccess baseline.
      return deniedReferenceAccess
    }

    const permissions = await convex.query(api.permissions.context.getAccessContext, {})

    // RecordAccess come from the delegated user context, not from the MCP key itself.
    return permissions?.can ?? deniedReferenceAccess
  },
  runtime: ({ event }) => {
    const auth = event.context.mcpAuth as McpAuthContext | undefined

    return {
      workspaceId: auth?.workspaceId ?? 'global',
    }
  },
  callerKey: (caller) => (caller.kind === 'agent' ? subject.agent(caller.agentId) : caller.kind),
  scopeKey: ({ runtime }) => runtime.workspaceId,
})

export const tool = mcpRuntime.tool
export default mcpRuntime
