import { createHmac, timingSafeEqual } from 'node:crypto'

import { createError, readRawBody, type H3Event } from 'h3'

function toUtf8Buffer(value: string): Buffer {
  return Buffer.from(value, 'utf8')
}

function singleHeader(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function readEventHeader(event: H3Event, name: string): string | string[] | undefined {
  const normalized = name.toLowerCase()
  const value = event.node?.req?.headers?.[normalized]
  if (typeof value === 'string' || Array.isArray(value)) return value
  if (event.headers && typeof event.headers.get === 'function') {
    return event.headers.get(name) ?? undefined
  }
  return undefined
}

function safeEqualString(left: string, right: string): boolean {
  const leftBuffer = toUtf8Buffer(left)
  const rightBuffer = toUtf8Buffer(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export type WebhookHmacVerificationOptions = {
  signature: string | string[] | undefined
  timestamp: string | string[] | undefined
  deliveryId: string | string[] | undefined
  secret: string
  rawBody: string | Uint8Array
  nowMs?: number
  toleranceMs?: number
}

const DEFAULT_WEBHOOK_HMAC_TOLERANCE_MS = 5 * 60 * 1000

function normalizeTimestampMs(timestamp: string): number | null {
  if (!/^\d+$/.test(timestamp)) return null
  const value = Number(timestamp)
  if (!Number.isSafeInteger(value)) return null
  return value < 10_000_000_000 ? value * 1000 : value
}

function hmacPayload(options: {
  timestamp: string
  deliveryId: string
  rawBody: string | Uint8Array
}): Buffer {
  const body =
    typeof options.rawBody === 'string'
      ? toUtf8Buffer(options.rawBody)
      : Buffer.from(options.rawBody)
  return Buffer.concat([
    toUtf8Buffer(options.timestamp),
    toUtf8Buffer('.'),
    toUtf8Buffer(options.deliveryId),
    toUtf8Buffer('.'),
    body,
  ])
}

export function createWebhookHmacSignature(options: {
  secret: string
  timestamp: string
  deliveryId: string
  rawBody: string | Uint8Array
}): string {
  const digest = createHmac('sha256', options.secret).update(hmacPayload(options)).digest('hex')
  return `sha256=${digest}`
}

export function isWebhookHmacSignatureValid(options: WebhookHmacVerificationOptions): boolean {
  const signature = singleHeader(options.signature)
  const timestamp = singleHeader(options.timestamp)
  const deliveryId = singleHeader(options.deliveryId)
  if (!signature || !timestamp || !deliveryId || !deliveryId.trim() || !options.secret.trim()) {
    return false
  }

  const timestampMs = normalizeTimestampMs(timestamp)
  if (timestampMs === null) return false
  const nowMs = options.nowMs ?? Date.now()
  if (Math.abs(nowMs - timestampMs) > (options.toleranceMs ?? DEFAULT_WEBHOOK_HMAC_TOLERANCE_MS)) {
    return false
  }

  const expected = createWebhookHmacSignature({
    secret: options.secret,
    timestamp,
    deliveryId,
    rawBody: options.rawBody,
  })
  return safeEqualString(signature, expected)
}

export type VerifiedHmacWebhookDelivery<TBody> = {
  id: string
  body: TBody
  rawBody: string
  timestamp: string
  signature: string
}

export type VerifyHmacWebhookDeliveryOptions<TBody> = {
  secret: string
  parse: (rawBody: string) => TBody | Promise<TBody>
  signatureHeader?: string
  timestampHeader?: string
  deliveryIdHeader?: string
  nowMs?: number
  toleranceMs?: number
}

export async function verifyHmacWebhookDelivery<TBody>(
  event: H3Event,
  options: VerifyHmacWebhookDeliveryOptions<TBody>,
): Promise<VerifiedHmacWebhookDelivery<TBody>> {
  if (!options.secret.trim()) {
    throw createError({ statusCode: 500, message: 'Webhook HMAC secret must be configured.' })
  }

  const rawBody = await readRawBody(event)
  if (rawBody === undefined || rawBody === null || rawBody.length === 0) {
    throw createError({ statusCode: 400, message: 'Webhook body is required.' })
  }

  const signatureHeader = options.signatureHeader ?? 'x-signature'
  const timestampHeader = options.timestampHeader ?? 'x-timestamp'
  const deliveryIdHeader = options.deliveryIdHeader ?? 'x-delivery-id'
  const signature = readEventHeader(event, signatureHeader)
  const timestamp = readEventHeader(event, timestampHeader)
  const deliveryId = readEventHeader(event, deliveryIdHeader)

  if (
    !isWebhookHmacSignatureValid({
      signature,
      timestamp,
      deliveryId,
      secret: options.secret,
      rawBody,
      ...(options.nowMs !== undefined ? { nowMs: options.nowMs } : {}),
      ...(options.toleranceMs !== undefined ? { toleranceMs: options.toleranceMs } : {}),
    })
  ) {
    throw createError({ statusCode: 401, message: 'Invalid signature' })
  }

  const id = singleHeader(deliveryId)
  const timestampValue = singleHeader(timestamp)
  const signatureValue = singleHeader(signature)
  if (!id || !timestampValue || !signatureValue) {
    throw createError({ statusCode: 401, message: 'Invalid signature' })
  }

  return {
    id,
    rawBody,
    timestamp: timestampValue,
    signature: signatureValue,
    body: await options.parse(rawBody),
  }
}
