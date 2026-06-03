import type { H3Event } from 'h3'

import { resolvePermissionKey, type PermissionKeyHandle } from '../auth/define-permission.js'
import type { ActingFor } from '../functions/define-acting-for.js'
import type { Subject } from '../functions/define-caller.js'
import { extractSubject } from '../identity-forwarding/shared.js'
import { createServerConvexCaller } from '../server/index.js'

type ForwardedMcpCaller = { subject: Subject } & Record<string, unknown>

export type CreateMcpConvexCallerOptions<TCaller> = {
  caller: TCaller | null
  actingFor?: ActingFor | null
  isForwardedCaller?: (caller: TCaller) => boolean
  identityForwardingKey?: string
  identityForwardingKeyEnvAliases?: readonly string[]
}

function hasForwardableSubject(caller: unknown): caller is ForwardedMcpCaller {
  return (
    typeof caller === 'object' &&
    caller !== null &&
    typeof (caller as { subject?: unknown }).subject === 'string' &&
    extractSubject(caller) === (caller as { subject: string }).subject
  )
}

function defaultIsForwardedCaller(caller: unknown): boolean {
  if (typeof caller !== 'object' || caller === null) return false
  return (caller as { kind?: unknown }).kind !== 'anonymous'
}

function assertServerOnlyAlias(alias: string): string {
  const trimmed = alias.trim()
  if (!trimmed) {
    throw new Error('createMcpConvexCaller() identity forwarding key aliases must be non-empty.')
  }
  if (/^(?:NUXT_PUBLIC_|PUBLIC_)/.test(trimmed)) {
    throw new Error('createMcpConvexCaller() identity forwarding key aliases must be server-only.')
  }
  return trimmed
}

function resolveIdentityForwardingKey(
  explicitKey: string | undefined,
  aliases: readonly string[] | undefined,
): string | undefined {
  const normalizedAliases = (aliases ?? []).map(assertServerOnlyAlias)
  if (explicitKey?.trim()) return explicitKey
  if (process.env.CONVEX_IDENTITY_FORWARDING_KEY?.trim()) {
    return process.env.CONVEX_IDENTITY_FORWARDING_KEY
  }

  for (const alias of normalizedAliases) {
    const key = process.env[alias]
    if (key?.trim()) return key
  }

  return undefined
}

export function createMcpConvexCaller<TCaller>(
  event: H3Event,
  options: CreateMcpConvexCallerOptions<TCaller>,
) {
  const shouldForward =
    options.caller !== null &&
    (options.isForwardedCaller
      ? options.isForwardedCaller(options.caller)
      : defaultIsForwardedCaller(options.caller))

  if (!shouldForward) {
    if (options.actingFor) {
      throw new Error('createMcpConvexCaller() cannot set actingFor for an anonymous MCP caller.')
    }
    return createServerConvexCaller(event, { auth: 'none' })
  }

  if (!hasForwardableSubject(options.caller)) {
    throw new Error('createMcpConvexCaller() forwarded MCP callers must include subject.')
  }

  const identityForwardingKey = resolveIdentityForwardingKey(
    options.identityForwardingKey,
    options.identityForwardingKeyEnvAliases,
  )

  return createServerConvexCaller(event, {
    auth: 'trusted',
    caller: options.caller,
    ...(options.actingFor ? { actingFor: options.actingFor } : {}),
    ...(identityForwardingKey ? { identityForwardingKey } : {}),
  })
}

export function deniedMcpAccessSnapshot(
  permissions: readonly PermissionKeyHandle[],
): Record<string, boolean> {
  return Object.fromEntries(
    permissions.map((permission) => [resolvePermissionKey(permission), false]),
  )
}
