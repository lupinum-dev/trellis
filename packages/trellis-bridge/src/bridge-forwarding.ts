import type { Subject } from '@lupinum/trellis/auth'
import {
  extractSubject,
  getIdentityForwardingKeyProductionIssue,
  hashForwardingArgs,
} from '@lupinum/trellis/backend'
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import type { FunctionReference } from 'convex/server'

declare const process:
  | {
      env?: Record<string, string | undefined>
    }
  | undefined

declare const crypto:
  | {
      randomUUID?: () => string
    }
  | undefined

type ComponentBridgeFunctionRef = FunctionReference<
  'query' | 'mutation' | 'action',
  'public' | 'internal'
>

const functionNameSymbol = Symbol.for('functionName')
const forwardingHeaderType = 'trellis-forwarding+jws'
const bridgeForwardingIssuer = 'trellis://server'
const bridgeForwardingAudience = 'trellis://convex'
const bridgeForwardingKeyId = 'default'
const bridgeForwardingTtlsMs = {
  query: 60_000,
  mutation: 30_000,
  action: 30_000,
  'operation-execute': 10_000,
} satisfies Record<BridgeForwardingPurpose, number>

type BridgeForwardingPurpose = 'query' | 'mutation' | 'action' | 'operation-execute'
export type IdentityForwardingKeyInput = string | ((args?: unknown) => string)

const textEncoder = new TextEncoder()
const base64UrlAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function utf8Bytes(input: string): Uint8Array {
  return textEncoder.encode(input)
}

function base64UrlEncodeBytes(input: Uint8Array): string {
  let output = ''
  for (let index = 0; index < input.length; index += 3) {
    const first = input[index] ?? 0
    const second = input[index + 1] ?? 0
    const third = input[index + 2] ?? 0
    const value = (first << 16) | (second << 8) | third

    output += base64UrlAlphabet[(value >> 18) & 63]
    output += base64UrlAlphabet[(value >> 12) & 63]
    if (index + 1 < input.length) output += base64UrlAlphabet[(value >> 6) & 63]
    if (index + 2 < input.length) output += base64UrlAlphabet[value & 63]
  }
  return output
}

function base64UrlEncode(input: string): string {
  return base64UrlEncodeBytes(utf8Bytes(input))
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null'

  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry ?? null)).join(',')}]`
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function signBridgeForwardingInput(input: string, key: string): string {
  return base64UrlEncodeBytes(hmac(sha256, utf8Bytes(key), utf8Bytes(input)))
}

function getBridgeReplayMode(operation: BridgeForwardingPurpose) {
  if (operation === 'query') return undefined
  if (operation === 'operation-execute') return 'operation-confirmation'
  return 'jti-redemption'
}

function withResolvedSubject(
  caller: unknown,
  subject: Subject,
): { subject: Subject } & Record<string, unknown> {
  if (typeof caller === 'object' && caller !== null && !Array.isArray(caller)) {
    return { ...(caller as Record<string, unknown>), subject }
  }

  return { subject }
}

function resolveBridgeCallerSubject(caller: unknown): Subject {
  if (
    typeof caller === 'object' &&
    caller !== null &&
    'kind' in caller &&
    (caller as { kind?: unknown }).kind === 'anonymous'
  ) {
    throw new Error('createComponentBridge() cannot forward an anonymous caller.')
  }

  const subject = extractSubject(caller)
  if (!subject) {
    throw new Error(
      'createComponentBridge() requires the resolved caller to include a canonical subject.',
    )
  }

  return subject
}

export function getRequiredBridgeIdentityForwardingKey(
  override?: IdentityForwardingKeyInput,
  args?: unknown,
): string {
  const overrideValue = typeof override === 'function' ? override(args) : override
  const identityForwardingKey =
    overrideValue?.trim() ||
    (typeof process !== 'undefined' ? process.env?.CONVEX_IDENTITY_FORWARDING_KEY?.trim() : '')
  if (!identityForwardingKey) {
    throw new Error('createComponentBridge() requires CONVEX_IDENTITY_FORWARDING_KEY to be set.')
  }
  const identityForwardingKeyIssue = getIdentityForwardingKeyProductionIssue(identityForwardingKey)
  if (identityForwardingKeyIssue) {
    throw new Error(identityForwardingKeyIssue)
  }

  return identityForwardingKey
}

export function getBridgeFunctionRef(
  ref: ComponentBridgeFunctionRef,
  explicitFunctionRef?: string,
): string {
  if (explicitFunctionRef?.trim()) return explicitFunctionRef.trim()

  try {
    const value = ref as unknown
    if (typeof value === 'string') return value
    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string | symbol, unknown>
      const symbolName = record[functionNameSymbol]
      if (typeof symbolName === 'string') return symbolName
      if (typeof record._path === 'string') return record._path
      if (typeof record.functionPath === 'string') return record.functionPath
    }
  } catch {
    // Fall through to the fail-closed error below.
  }

  throw new Error('createComponentBridge() requires an exact component function ref.')
}

function createBridgeJti(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `bridge-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export interface CreateBridgeForwardingEnvelopeOptions {
  identityForwardingKey: string
  caller: unknown
  operation: BridgeForwardingPurpose
  functionRef: string
  args: Record<string, unknown>
  signedArgs?: Record<string, unknown>
  jtiPrefix?: string
}

export interface CreateBridgeForwardingArgsOptions {
  signedArgs?: Record<string, unknown>
}

/**
 * Sign an identity-forwarding envelope using the bridge-standard issuer,
 * audience, key id, and TTLs. Bridge consumers (e.g. CLI tools that call
 * the Convex component with a deploy-key caller) should use this
 * instead of constructing envelopes themselves so the signing parameters
 * stay single-sourced.
 */
export function createBridgeForwardingEnvelope(
  options: CreateBridgeForwardingEnvelopeOptions,
): string {
  const subject = resolveBridgeCallerSubject(options.caller)
  const jti = options.jtiPrefix ? `${options.jtiPrefix}-${createBridgeJti()}` : createBridgeJti()
  const purpose = options.operation
  const replayMode = getBridgeReplayMode(options.operation)
  const keyId =
    (typeof process !== 'undefined' ? process.env?.CONVEX_IDENTITY_FORWARDING_KEY_ID : '') ||
    bridgeForwardingKeyId
  const now = Date.now()
  const signedArgs = options.signedArgs ?? options.args
  const payload = {
    v: 1,
    kid: keyId,
    iss: bridgeForwardingIssuer,
    aud: bridgeForwardingAudience,
    jti,
    sub: subject,
    caller: withResolvedSubject(options.caller, subject),
    transport: 'bridge',
    purpose,
    ...(replayMode ? { replayMode } : {}),
    functionRef: options.functionRef,
    argsHash: hashForwardingArgs(signedArgs),
    issuedAt: now,
    expiresAt: now + bridgeForwardingTtlsMs[options.operation],
  }
  const header = {
    alg: 'HS256',
    kid: keyId,
    typ: forwardingHeaderType,
    v: 1,
  }
  const signingInput = `${base64UrlEncode(canonicalJson(header))}.${base64UrlEncode(
    canonicalJson(payload),
  )}`

  return `${signingInput}.${signBridgeForwardingInput(signingInput, options.identityForwardingKey)}`
}

function createBridgeIdentityForwardingFields(
  args: Record<string, unknown>,
  caller: unknown,
  identityForwardingKey: IdentityForwardingKeyInput | undefined,
  operation: BridgeForwardingPurpose,
  component: ComponentBridgeFunctionRef,
  explicitFunctionRef?: string,
  options?: CreateBridgeForwardingArgsOptions,
) {
  const functionRef = getBridgeFunctionRef(component, explicitFunctionRef)
  const key = getRequiredBridgeIdentityForwardingKey(identityForwardingKey, args)

  return {
    _trellisForwarding: createBridgeForwardingEnvelope({
      identityForwardingKey: key,
      caller,
      args,
      signedArgs: options?.signedArgs,
      operation,
      functionRef,
    }),
  }
}

export function createBridgeForwardingArgs(
  args: Record<string, unknown>,
  caller: unknown,
  identityForwardingKey: IdentityForwardingKeyInput | undefined,
  operation: BridgeForwardingPurpose,
  component: ComponentBridgeFunctionRef,
  explicitFunctionRef?: string,
  options?: CreateBridgeForwardingArgsOptions,
): Record<string, unknown> {
  if (
    typeof caller === 'object' &&
    caller !== null &&
    'kind' in caller &&
    (caller as { kind?: unknown }).kind === 'anonymous'
  ) {
    return args
  }

  return {
    ...args,
    ...createBridgeIdentityForwardingFields(
      args,
      caller,
      identityForwardingKey,
      operation,
      component,
      explicitFunctionRef,
      options,
    ),
  }
}
