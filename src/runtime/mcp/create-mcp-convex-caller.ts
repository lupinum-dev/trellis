import type { H3Event } from 'h3'

import { resolvePermissionKey, type PermissionKeyHandle } from '../auth/define-permission.js'
import type {
  AnyActionFunction,
  AnyMutationFunction,
  AnyQueryFunction,
  FunctionLikeArgs,
  FunctionLikeReturnType,
} from '../convex/shared/convex-shared.js'
import type { ActingFor } from '../functions/define-acting-for.js'
import type { Subject } from '../functions/define-caller.js'
import { extractSubject } from '../identity-forwarding/shared.js'
import {
  serverConvexAction,
  serverConvexMutation,
  serverConvexQuery,
  transportProof,
  type TrustedTransportReplay,
} from '../server/index.js'

type ForwardedMcpCaller = { subject: Subject } & Record<string, unknown>

export type CreateMcpConvexCallerOptions<TCaller> = {
  caller: TCaller | null
  actingFor?: ActingFor | null
  isForwardedCaller?: (caller: TCaller) => boolean
  identityForwardingKey?: string
  identityForwardingKeyEnvAliases?: readonly string[]
}

export type McpConvexCallerOptions = {
  purpose?: 'operation-preview' | 'operation-execute'
  replay?: TrustedTransportReplay
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
    return {
      query: async <Query extends AnyQueryFunction>(
        fn: Query,
        args?: FunctionLikeArgs<Query>,
      ): Promise<FunctionLikeReturnType<Query>> =>
        await serverConvexQuery(event, fn, args ?? ({} as FunctionLikeArgs<Query>), {
          auth: 'none',
        }),
      mutation: async <Mutation extends AnyMutationFunction>(
        fn: Mutation,
        args?: FunctionLikeArgs<Mutation>,
      ): Promise<FunctionLikeReturnType<Mutation>> =>
        await serverConvexMutation(event, fn, args ?? ({} as FunctionLikeArgs<Mutation>), {
          auth: 'none',
        }),
      action: async <Action extends AnyActionFunction>(
        fn: Action,
        args?: FunctionLikeArgs<Action>,
      ): Promise<FunctionLikeReturnType<Action>> =>
        await serverConvexAction(event, fn, args ?? ({} as FunctionLikeArgs<Action>), {
          auth: 'none',
        }),
    }
  }

  if (!hasForwardableSubject(options.caller)) {
    throw new Error('createMcpConvexCaller() forwarded MCP callers must include subject.')
  }
  const forwardedCaller = options.caller as ForwardedMcpCaller

  const identityForwardingKey = resolveIdentityForwardingKey(
    options.identityForwardingKey,
    options.identityForwardingKeyEnvAliases,
  )

  const proof = (callOptions?: McpConvexCallerOptions) =>
    transportProof.mcp({
      caller: forwardedCaller,
      ...(options.actingFor ? { actingFor: options.actingFor } : {}),
      ...(identityForwardingKey ? { identityForwardingKey } : {}),
      ...(callOptions?.purpose ? { purpose: callOptions.purpose } : {}),
      ...(callOptions?.replay ? { replay: callOptions.replay } : {}),
    })

  return {
    query: async <Query extends AnyQueryFunction>(
      fn: Query,
      args?: FunctionLikeArgs<Query>,
      callOptions?: McpConvexCallerOptions,
    ): Promise<FunctionLikeReturnType<Query>> =>
      await serverConvexQuery(event, fn, args ?? ({} as FunctionLikeArgs<Query>), {
        auth: proof(callOptions),
      }),
    mutation: async <Mutation extends AnyMutationFunction>(
      fn: Mutation,
      args?: FunctionLikeArgs<Mutation>,
      callOptions?: McpConvexCallerOptions,
    ): Promise<FunctionLikeReturnType<Mutation>> =>
      await serverConvexMutation(event, fn, args ?? ({} as FunctionLikeArgs<Mutation>), {
        auth: proof(callOptions),
      }),
    action: async <Action extends AnyActionFunction>(
      fn: Action,
      args?: FunctionLikeArgs<Action>,
      callOptions?: McpConvexCallerOptions,
    ): Promise<FunctionLikeReturnType<Action>> =>
      await serverConvexAction(event, fn, args ?? ({} as FunctionLikeArgs<Action>), {
        auth: proof(callOptions),
      }),
  }
}

export function deniedMcpAccessSnapshot(
  permissions: readonly PermissionKeyHandle[],
): Record<string, boolean> {
  return Object.fromEntries(
    permissions.map((permission) => [resolvePermissionKey(permission), false]),
  )
}
