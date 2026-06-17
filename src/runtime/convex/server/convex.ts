import type { H3Event } from 'h3'
import { useEvent, useRuntimeConfig } from 'nitropack/runtime'

import { resolveRequestAuthToken } from '../../auth/server/auth-resolver.js'
import type { ActingFor } from '../../functions/define-acting-for.js'
import type { Subject } from '../../functions/define-caller.js'
import type {
  IdentityForwardingPurpose,
  IdentityForwardingTransport,
} from '../../identity-forwarding/envelope.js'
import {
  createIdentityForwardingEnvelopeArgs,
  extractSubject,
  getIdentityForwardingKeyProductionIssue,
  hasForwardedIdentityFields,
  isAnonymousCallerLike,
  stripForwardedIdentityFields,
} from '../../identity-forwarding/shared.js'
import {
  getEventObservationState,
  sanitizeCorrelationId,
  type EventObservationState,
} from '../../observability/envelope.js'
import { createRuntimeObserver } from '../../observability/runtime-observer.js'
import { ConvexCallError, toConvexError } from '../../utils/call-result.js'
import type { ConvexServerAuthMode } from '../../utils/types.js'
import {
  parseConvexResponse,
  getFunctionName,
  type AnyActionFunction,
  type AnyConvexFunction,
  type AnyMutationFunction,
  type AnyQueryFunction,
  type FunctionLikeArgs,
  type FunctionLikeReturnType,
} from '../shared/convex-shared.js'
import { normalizeConvexRuntimeConfig } from '../shared/runtime-config.js'
import { fetchWithTimeout } from './http.js'

type ConvexOperationType = 'query' | 'mutation' | 'action'
type ServerConvexHelperName = 'serverConvexQuery' | 'serverConvexMutation' | 'serverConvexAction'
type ServerConvexAuthLabel = ConvexServerAuthMode | 'transport-proof'

const transportProofBrand = Symbol('trellis.transportProof')

export type TrustedTransportReplay =
  | {
      mode: 'domain-idempotency'
      key: string
      target?: string
    }
  | {
      mode: 'jti-redemption'
      jti: string
    }
  | {
      mode: 'operation-confirmation'
      jti: string
    }

export type TrustedTransportProof = {
  readonly [transportProofBrand]: true
  readonly transport: Extract<IdentityForwardingTransport, 'server' | 'webhook' | 'mcp'>
  readonly caller: { subject: Subject } & Record<string, unknown>
  readonly actingFor?: ActingFor
  readonly identityForwardingKey?: string
  readonly purpose?: IdentityForwardingPurpose
  readonly replay?: TrustedTransportReplay
}

export type TrustedTransportProofInput = {
  caller: { subject: Subject } & Record<string, unknown>
  actingFor?: ActingFor
  identityForwardingKey?: string
  purpose?: IdentityForwardingPurpose
  replay?: TrustedTransportReplay
}

interface ServerConvexErrorContext {
  helper: ServerConvexHelperName
  operation: ConvexOperationType
  functionPath: string
  convexUrl?: string
  authMode: ServerConvexAuthLabel
}

function readEventHeader(event: H3Event, name: string): string | undefined {
  if (event.headers && typeof event.headers.get === 'function') {
    return event.headers.get(name) ?? undefined
  }

  const nodeHeaders = event.node?.req?.headers as Record<string, unknown> | undefined
  const key = name.toLowerCase()
  const value = nodeHeaders?.[key]
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.find((entry): entry is string => typeof entry === 'string')
  return undefined
}

export interface ServerConvexOptions {
  /**
   * Auth policy for this call.
   * - 'auto': use session cookie when available (default)
   * - 'required': throw when auth token cannot be resolved
   * - 'none': never attach auth
   * - transportProof.*(...): inject verifier-produced identity forwarding proof args
   */
  auth?: ConvexServerAuthMode | TrustedTransportProof
  /**
   * Explicit auth token override. When provided, skips auto resolution.
   */
  authToken?: string
}

function requireNonEmptyProofString(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} must be a non-empty string.`)
  return trimmed
}

function normalizeReplay(replay: TrustedTransportReplay): TrustedTransportReplay {
  if (replay.mode === 'domain-idempotency') {
    return {
      mode: 'domain-idempotency',
      key: requireNonEmptyProofString(replay.key, 'domainIdempotency.key'),
      ...(replay.target
        ? { target: requireNonEmptyProofString(replay.target, 'domainIdempotency.target') }
        : {}),
    }
  }
  if (replay.mode === 'jti-redemption') {
    return {
      mode: 'jti-redemption',
      jti: requireNonEmptyProofString(replay.jti, 'jtiRedemption.jti'),
    }
  }
  if (replay.mode === 'operation-confirmation') {
    return {
      mode: 'operation-confirmation',
      jti: requireNonEmptyProofString(replay.jti, 'operationConfirmation.jti'),
    }
  }
  throw new Error('Unknown trusted transport replay mode.')
}

function createTransportProof(
  transport: TrustedTransportProof['transport'],
  input: TrustedTransportProofInput,
): TrustedTransportProof {
  return {
    [transportProofBrand]: true,
    transport,
    caller: input.caller,
    ...(input.actingFor ? { actingFor: input.actingFor } : {}),
    ...(input.identityForwardingKey ? { identityForwardingKey: input.identityForwardingKey } : {}),
    ...(input.purpose ? { purpose: input.purpose } : {}),
    ...(input.replay ? { replay: normalizeReplay(input.replay) } : {}),
  }
}

export function domainIdempotency(input: {
  key: string
  target?: string | AnyConvexFunction
}): TrustedTransportReplay {
  const target =
    typeof input.target === 'string'
      ? input.target
      : input.target === undefined
        ? undefined
        : getFunctionName(input.target)
  return {
    mode: 'domain-idempotency',
    key: requireNonEmptyProofString(input.key, 'domainIdempotency.key'),
    ...(target ? { target: requireNonEmptyProofString(target, 'domainIdempotency.target') } : {}),
  }
}

export function jtiRedemption(input: { jti: string }): TrustedTransportReplay {
  return {
    mode: 'jti-redemption',
    jti: requireNonEmptyProofString(input.jti, 'jtiRedemption.jti'),
  }
}

export function operationConfirmation(input: { jti: string }): TrustedTransportReplay {
  return {
    mode: 'operation-confirmation',
    jti: requireNonEmptyProofString(input.jti, 'operationConfirmation.jti'),
  }
}

export const transportProof = {
  server: (input: TrustedTransportProofInput): TrustedTransportProof =>
    createTransportProof('server', input),
  webhook: (input: TrustedTransportProofInput): TrustedTransportProof =>
    createTransportProof('webhook', input),
  mcp: (input: TrustedTransportProofInput): TrustedTransportProof =>
    createTransportProof('mcp', input),
}

function isTransportProof(value: unknown): value is TrustedTransportProof {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { [transportProofBrand]?: unknown })[transportProofBrand] === true
  )
}

function normalizeServerAuth(auth: ServerConvexOptions['auth'] | undefined): {
  authMode: ServerConvexAuthLabel
  proof?: TrustedTransportProof
} {
  if (auth === undefined) return { authMode: 'auto' }
  if (isTransportProof(auth)) return { authMode: 'transport-proof', proof: auth }
  if (auth === 'auto' || auth === 'required' || auth === 'none') return { authMode: auth }
  throw new Error('Server Convex trusted calls require a verifier-produced transport proof.')
}

function getHelperName(operationType: ConvexOperationType): ServerConvexHelperName {
  if (operationType === 'query') return 'serverConvexQuery'
  if (operationType === 'mutation') return 'serverConvexMutation'
  return 'serverConvexAction'
}

function toServerConvexError(
  error: unknown,
  context: ServerConvexErrorContext,
  phase: 'auth' | 'request',
): ConvexCallError {
  const base = toConvexError(error)
  const prefix =
    phase === 'auth'
      ? `Failed to resolve auth for ${context.functionPath} (auth: ${context.authMode}).`
      : `Request failed for ${context.functionPath} via ${context.convexUrl}/api/${context.operation}.`
  return new ConvexCallError(`[${context.helper}] ${prefix} ${base.message}`, {
    ...context,
    code: base.code,
    status: base.status,
    category: base.category !== 'unknown' ? base.category : undefined,
    issues: base.issues,
    cause: base,
  })
}

function createServerConvexError(
  message: string,
  context: ServerConvexErrorContext,
): ConvexCallError {
  return new ConvexCallError(`[${context.helper}] ${message}`, context)
}

function validateForwardedCaller(caller: unknown): Subject {
  if (!caller || typeof caller !== 'object' || isAnonymousCallerLike(caller)) {
    throw new Error('Identity forwarding requires a non-anonymous forwarded `caller`.')
  }

  const subject = extractSubject(caller)
  if (!subject) {
    throw new Error('Identity forwarding requires forwarded `caller.subject`.')
  }

  return subject
}

function validateForwardedActingFor(actingFor: unknown): Subject {
  const subject = extractSubject(actingFor)
  if (!subject) {
    throw new Error('Identity forwarding requires forwarded `actingFor.subject`.')
  }

  return subject
}

function resolveTransportProofPurpose(
  proof: TrustedTransportProof,
  operationType: ConvexOperationType,
  functionPath: string,
): IdentityForwardingPurpose {
  const purpose = proof.purpose ?? operationType
  if (purpose === operationType) return purpose

  if (purpose === 'operation-preview') {
    return purpose
  }
  if (
    (operationType === 'mutation' || operationType === 'action') &&
    purpose === 'operation-execute'
  ) {
    return purpose
  }

  throw new Error(
    `Transport proof purpose "${purpose}" is not valid for ${operationType} ${functionPath}.`,
  )
}

function getReplayJti(replay: TrustedTransportReplay | undefined): string | undefined {
  if (!replay) return undefined
  if (replay.mode === 'jti-redemption' || replay.mode === 'operation-confirmation') {
    return replay.jti
  }
  return undefined
}

function getReplayKey(replay: TrustedTransportReplay | undefined): string | undefined {
  return replay?.mode === 'domain-idempotency' ? replay.key : undefined
}

function getReplayTarget(replay: TrustedTransportReplay | undefined): string | undefined {
  return replay?.mode === 'domain-idempotency' ? replay.target : undefined
}

function assertReplayMatchesPurpose(
  replay: TrustedTransportReplay | undefined,
  purpose: IdentityForwardingPurpose,
  functionPath: string,
): void {
  if (replay?.mode === 'operation-confirmation' && purpose !== 'operation-execute') {
    throw new Error(
      `Transport proof operation-confirmation replay is only valid for operation-execute calls to ${functionPath}.`,
    )
  }
}

async function resolveAuthToken(
  event: H3Event,
  options:
    | {
        auth?: ConvexServerAuthMode
        authToken?: string
      }
    | undefined,
): Promise<string | undefined> {
  const config = normalizeConvexRuntimeConfig(useRuntimeConfig(event).public.convex)
  return await resolveRequestAuthToken(event, config, options)
}

async function executeConvexOperation<Fn extends AnyConvexFunction>(
  event: H3Event,
  operationType: ConvexOperationType,
  functionPath: string,
  args: FunctionLikeArgs<Fn> | undefined,
  options?: ServerConvexOptions,
): Promise<FunctionLikeReturnType<Fn>> {
  const runtimeConfig = useRuntimeConfig(event)
  const convexConfig = normalizeConvexRuntimeConfig(runtimeConfig.public.convex)
  const convexUrl = convexConfig.url
  const { authMode, proof: authProof } = normalizeServerAuth(options?.auth)
  const errorContext: ServerConvexErrorContext = {
    helper: getHelperName(operationType),
    operation: operationType,
    functionPath,
    convexUrl,
    authMode,
  }

  if (!convexUrl) {
    throw createServerConvexError(
      `Convex URL not configured for ${functionPath}. Set \`convex.url\` in \`nuxt.config.ts\` or provide \`CONVEX_URL\` / \`NUXT_PUBLIC_CONVEX_URL\`.`,
      errorContext,
    )
  }

  const requestId = crypto.randomUUID()
  const correlationHeader =
    convexConfig.observability.correlation.header || 'x-trellis-correlation-id'
  const eventContext = ((event.context as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >
  ;(event as { context?: Record<string, unknown> }).context = eventContext
  const observationState = getEventObservationState(eventContext)
  const correlationId =
    sanitizeCorrelationId(readEventHeader(event, correlationHeader)) ||
    sanitizeCorrelationId(observationState.correlationId) ||
    convexConfig.observability.correlation.generate()
  const originTransport =
    observationState.originTransport === 'browser' || observationState.originTransport === 'mcp'
      ? observationState.originTransport
      : 'nuxt-server'
  eventContext.__trellis = {
    correlationId,
    originTransport,
    requestId,
  } satisfies EventObservationState

  const logger = createRuntimeObserver(
    runtimeConfig.public.convex ?? {},
    {
      transport: 'nuxt-server',
      originTransport,
      correlationId,
      requestId,
      handler: functionPath,
    },
    {
      method: 'POST',
      path: `/api/${operationType}`,
    },
  )
  const startTime = Date.now()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const rawRequestArgs: FunctionLikeArgs<Fn> | Record<string, unknown> = args ?? {}
  let requestArgs: FunctionLikeArgs<Fn> | Record<string, unknown> = rawRequestArgs

  const logSuccess = (duration: number) => {
    if (operationType === 'query') {
      logger.query({ name: functionPath, event: 'update', args })
    } else if (operationType === 'mutation') {
      logger.mutation({ name: functionPath, event: 'success', args, duration })
    } else {
      logger.action({ name: functionPath, event: 'success', duration })
    }
  }

  const logError = (err: Error, duration: number) => {
    if (operationType === 'query') {
      logger.query({ name: functionPath, event: 'error', args, error: err })
    } else if (operationType === 'mutation') {
      logger.mutation({ name: functionPath, event: 'error', args, duration, error: err })
    } else {
      logger.action({ name: functionPath, event: 'error', duration, error: err })
    }
  }
  let authToken: string | undefined
  if (authProof) {
    if (options?.authToken) {
      throw createServerConvexError(
        `Transport proof auth for ${functionPath} cannot be combined with \`authToken\`.`,
        errorContext,
      )
    }
    if (operationType !== 'query' && !authProof.replay) {
      throw createServerConvexError(
        `Transport proof ${operationType} calls for ${functionPath} require replay metadata.`,
        errorContext,
      )
    }

    validateForwardedCaller(authProof.caller)
    if (authProof.actingFor) validateForwardedActingFor(authProof.actingFor)

    const purpose = resolveTransportProofPurpose(authProof, operationType, functionPath)
    assertReplayMatchesPurpose(authProof.replay, purpose, functionPath)
    const identityForwardingKey =
      authProof.identityForwardingKey ?? process.env.CONVEX_IDENTITY_FORWARDING_KEY
    if (!identityForwardingKey) {
      throw createServerConvexError(
        `Transport proof auth for ${functionPath} requires \`CONVEX_IDENTITY_FORWARDING_KEY\` or a proof identityForwardingKey.`,
        errorContext,
      )
    }
    const identityForwardingKeyIssue =
      getIdentityForwardingKeyProductionIssue(identityForwardingKey)
    if (identityForwardingKeyIssue) {
      throw createServerConvexError(identityForwardingKeyIssue, errorContext)
    }

    const trustedAppArgs = stripForwardedIdentityFields(requestArgs as Record<string, unknown>)
    requestArgs = createIdentityForwardingEnvelopeArgs({
      args: trustedAppArgs,
      caller: authProof.caller,
      ...(authProof.actingFor ? { actingFor: authProof.actingFor } : {}),
      functionRef: functionPath,
      operation: operationType,
      purpose,
      ...(getReplayJti(authProof.replay) ? { jti: getReplayJti(authProof.replay) } : {}),
      ...(authProof.replay ? { replayMode: authProof.replay.mode } : {}),
      ...(getReplayKey(authProof.replay) ? { replayKey: getReplayKey(authProof.replay) } : {}),
      ...(authProof.replay?.mode === 'domain-idempotency'
        ? { replayTarget: getReplayTarget(authProof.replay) ?? functionPath }
        : getReplayTarget(authProof.replay)
          ? { replayTarget: getReplayTarget(authProof.replay) }
          : {}),
      key: identityForwardingKey,
      transport: authProof.transport,
    }) as FunctionLikeArgs<Fn>
  } else {
    if (hasForwardedIdentityFields(rawRequestArgs)) {
      throw createServerConvexError(
        `Forwarded identity fields are only allowed with transport proof auth for ${functionPath}.`,
        errorContext,
      )
    }

    requestArgs = stripForwardedIdentityFields(rawRequestArgs)

    try {
      authToken = await resolveAuthToken(
        event,
        options
          ? {
              ...(authMode === 'transport-proof' ? {} : { auth: authMode }),
              ...(options.authToken ? { authToken: options.authToken } : {}),
            }
          : undefined,
      )
    } catch (error) {
      const err = toServerConvexError(error, errorContext, 'auth')
      const duration = Date.now() - startTime
      logError(err, duration)
      logger.emitSummary({
        status: 'error',
        durationMs: duration,
        details: { phase: 'auth', message: err.message },
      })
      throw err
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }
  }

  try {
    const response = await fetchWithTimeout(`${convexUrl}/api/${operationType}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        path: functionPath,
        args: requestArgs,
      }),
    })

    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      const err = new Error(
        `Unexpected response type: ${contentType}. Expected JSON from ${convexUrl}/api/${operationType}.`,
      )
      ;(err as Error & { status?: number }).status = response.status
      throw err
    }

    const json = await response.json()
    const result = parseConvexResponse<FunctionLikeReturnType<Fn>>(json)

    const duration = Date.now() - startTime
    logSuccess(duration)
    logger.emitSummary({ status: 'success', durationMs: duration })

    return result
  } catch (error) {
    const err = toServerConvexError(error, errorContext, 'request')
    const duration = Date.now() - startTime
    logError(err, duration)
    logger.emitSummary({
      status: 'error',
      durationMs: duration,
      details: { phase: 'request', message: err.message },
    })
    throw err
  }
}

function resolveServerEvent(
  event: H3Event | undefined,
  helper: ServerConvexHelperName,
  operation: ConvexOperationType,
  functionPath: string,
): H3Event {
  if (event) return event
  try {
    const currentEvent = useEvent()
    if (currentEvent) {
      return currentEvent
    }
  } catch (resolveError) {
    // useEvent() throws when Nitro async request context is unavailable.
    // Preserve the original error as cause for debugging unexpected failures.
    throw new ConvexCallError(
      `[${helper}] No H3 event available for ${functionPath}. Pass the event explicitly or call this helper inside a Nitro request context.`,
      { helper, operation, functionPath, authMode: 'auto', cause: resolveError },
    )
  }

  throw new ConvexCallError(
    `[${helper}] No H3 event available for ${functionPath}. Pass the event explicitly or call this helper inside a Nitro request context.`,
    { helper, operation, functionPath, authMode: 'auto' },
  )
}

function isH3EventLike(value: unknown): value is H3Event {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  // H3Event has __is_event__ marker. Fall back to node.req+node.res for mocks.
  return (
    '__is_event__' in record ||
    (typeof record.node === 'object' &&
      record.node !== null &&
      'req' in (record.node as Record<string, unknown>) &&
      'res' in (record.node as Record<string, unknown>))
  )
}

function parseServerConvexArgs<Fn extends AnyConvexFunction>(
  operationType: ConvexOperationType,
  input: [
    H3Event | Fn,
    Fn | FunctionLikeArgs<Fn> | undefined,
    FunctionLikeArgs<Fn> | ServerConvexOptions | undefined,
    ServerConvexOptions | undefined,
  ],
): {
  event: H3Event
  fn: Fn
  args: FunctionLikeArgs<Fn> | undefined
  options: ServerConvexOptions | undefined
} {
  const [first, second, third, fourth] = input
  const helper = getHelperName(operationType)

  if (isH3EventLike(first)) {
    return {
      event: first,
      fn: second as Fn,
      args: third as FunctionLikeArgs<Fn> | undefined,
      options: fourth,
    }
  }

  const fn = first as Fn
  const functionPath = getFunctionName(fn)
  return {
    event: resolveServerEvent(undefined, helper, operationType, functionPath),
    fn,
    args: second as FunctionLikeArgs<Fn> | undefined,
    options: third as ServerConvexOptions | undefined,
  }
}

export async function serverConvexQuery<Query extends AnyQueryFunction>(
  eventOrQuery: H3Event | Query,
  queryOrArgs?: Query | FunctionLikeArgs<Query>,
  args?: FunctionLikeArgs<Query>,
  options?: ServerConvexOptions,
): Promise<FunctionLikeReturnType<Query>> {
  const parsed = parseServerConvexArgs<Query>('query', [
    eventOrQuery,
    queryOrArgs as Query | FunctionLikeArgs<Query> | undefined,
    args,
    options,
  ])
  const functionPath = getFunctionName(parsed.fn)
  return await executeConvexOperation<Query>(
    parsed.event,
    'query',
    functionPath,
    parsed.args,
    parsed.options,
  )
}

export async function serverConvexMutation<Mutation extends AnyMutationFunction>(
  eventOrMutation: H3Event | Mutation,
  mutationOrArgs?: Mutation | FunctionLikeArgs<Mutation>,
  args?: FunctionLikeArgs<Mutation>,
  options?: ServerConvexOptions,
): Promise<FunctionLikeReturnType<Mutation>> {
  const parsed = parseServerConvexArgs<Mutation>('mutation', [
    eventOrMutation,
    mutationOrArgs as Mutation | FunctionLikeArgs<Mutation> | undefined,
    args,
    options,
  ])
  const functionPath = getFunctionName(parsed.fn)
  return await executeConvexOperation<Mutation>(
    parsed.event,
    'mutation',
    functionPath,
    parsed.args,
    parsed.options,
  )
}

export async function serverConvexAction<Action extends AnyActionFunction>(
  eventOrAction: H3Event | Action,
  actionOrArgs?: Action | FunctionLikeArgs<Action>,
  args?: FunctionLikeArgs<Action>,
  options?: ServerConvexOptions,
): Promise<FunctionLikeReturnType<Action>> {
  const parsed = parseServerConvexArgs<Action>('action', [
    eventOrAction,
    actionOrArgs as Action | FunctionLikeArgs<Action> | undefined,
    args,
    options,
  ])
  const functionPath = getFunctionName(parsed.fn)
  return await executeConvexOperation<Action>(
    parsed.event,
    'action',
    functionPath,
    parsed.args,
    parsed.options,
  )
}
