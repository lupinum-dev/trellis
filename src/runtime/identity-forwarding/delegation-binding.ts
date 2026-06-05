import { getSubjectKind, subject, type Subject } from '../auth/index.js'
import type { ActingFor } from '../functions/define-acting-for.js'

export type DelegationBinding = ActingFor & {
  grantSource: string
  issuer: string
  serviceId: string
  targetUserId: string
  workspaceId: string
  purpose: string
  expiresAt: number
  grantId?: string
  revocationVersion?: string | number
}

export type RequireDelegationBindingOptions = {
  serviceId: string
  targetUserId: string
  workspaceId: string
  purpose: string
  grantSource: string
  issuer?: string
  grantId?: string
  expiresAt: number
  revocationVersion?: string | number
  reason?: string
  grantedBy?: Subject
  now?: number
}

export type DelegationBindingExpectation = {
  serviceId?: string
  targetUserId?: string
  workspaceId?: string
  purpose?: string
  grantSource?: string
  issuer?: string
  revocationVersion?: string | number
  now?: number
}

function requireNonBlank(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a non-empty string.`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${label} must be a non-empty string.`)
  }
  return trimmed
}

function requireOptionalNonBlank(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined
  return requireNonBlank(value, label)
}

function requireValidExpiresAt(value: unknown, label: string, now: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer timestamp.`)
  }
  if (value <= now) {
    throw new Error(`${label} must be in the future.`)
  }
  return value
}

function requireCanonicalSubject(value: unknown, label: string): Subject {
  const subjectValue = requireNonBlank(value, label) as Subject
  if (getSubjectKind(subjectValue) === null) {
    throw new Error(`${label} must be a canonical subject.`)
  }
  return subjectValue
}

function requireMatching(
  value: string | number,
  expected: string | number | undefined,
  label: string,
) {
  if (expected !== undefined && value !== expected) {
    throw new Error(`Delegation binding ${label} does not match the expected value.`)
  }
}

export function requireDelegationBinding(
  options: RequireDelegationBindingOptions,
): DelegationBinding {
  const now = options.now ?? Date.now()
  const serviceId = requireNonBlank(options.serviceId, 'delegation.serviceId')
  const targetUserId = requireNonBlank(options.targetUserId, 'delegation.targetUserId')
  const workspaceId = requireNonBlank(options.workspaceId, 'delegation.workspaceId')
  const purpose = requireNonBlank(options.purpose, 'delegation.purpose')
  const grantSource = requireNonBlank(options.grantSource, 'delegation.grantSource')
  const issuer = requireNonBlank(options.issuer ?? 'trellis://server', 'delegation.issuer')
  const grantId = requireOptionalNonBlank(options.grantId, 'delegation.grantId')
  const expiresAt = requireValidExpiresAt(options.expiresAt, 'delegation.expiresAt', now)

  if (options.grantedBy && getSubjectKind(options.grantedBy) === null) {
    throw new Error('delegation.grantedBy must be a canonical subject when provided.')
  }

  return {
    subject: subject.user(targetUserId),
    reason:
      options.reason ??
      `${serviceId} may act for user ${targetUserId} in workspace ${workspaceId} for ${purpose}`,
    ...(options.grantedBy ? { grantedBy: options.grantedBy } : {}),
    grantSource,
    issuer,
    serviceId,
    targetUserId,
    workspaceId,
    purpose,
    expiresAt,
    ...(grantId ? { grantId } : {}),
    ...(options.revocationVersion !== undefined
      ? { revocationVersion: options.revocationVersion }
      : {}),
  }
}

export function assertDelegationBinding(
  value: unknown,
  expected: DelegationBindingExpectation = {},
): DelegationBinding {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Delegation binding must be an object.')
  }

  const binding = value as Record<string, unknown>
  const targetUserId = requireNonBlank(binding.targetUserId, 'delegation.targetUserId')
  const subjectValue = requireCanonicalSubject(binding.subject, 'delegation.subject')
  if (subjectValue !== subject.user(targetUserId)) {
    throw new Error('Delegation binding subject must match the target user.')
  }

  const serviceId = requireNonBlank(binding.serviceId, 'delegation.serviceId')
  const workspaceId = requireNonBlank(binding.workspaceId, 'delegation.workspaceId')
  const purpose = requireNonBlank(binding.purpose, 'delegation.purpose')
  const grantSource = requireNonBlank(binding.grantSource, 'delegation.grantSource')
  const issuer = requireNonBlank(binding.issuer, 'delegation.issuer')
  const expiresAt = requireValidExpiresAt(
    binding.expiresAt,
    'delegation.expiresAt',
    expected.now ?? Date.now(),
  )
  const grantId = requireOptionalNonBlank(binding.grantId, 'delegation.grantId')
  const reason = requireOptionalNonBlank(binding.reason, 'delegation.reason')
  const grantedBy =
    binding.grantedBy === undefined
      ? undefined
      : requireCanonicalSubject(binding.grantedBy, 'delegation.grantedBy')
  const revocationVersion = binding.revocationVersion as string | number | undefined

  if (
    revocationVersion !== undefined &&
    typeof revocationVersion !== 'string' &&
    typeof revocationVersion !== 'number'
  ) {
    throw new Error('delegation.revocationVersion must be a string or number when provided.')
  }

  requireMatching(serviceId, expected.serviceId, 'serviceId')
  requireMatching(targetUserId, expected.targetUserId, 'targetUserId')
  requireMatching(workspaceId, expected.workspaceId, 'workspaceId')
  requireMatching(purpose, expected.purpose, 'purpose')
  requireMatching(grantSource, expected.grantSource, 'grantSource')
  requireMatching(issuer, expected.issuer, 'issuer')
  requireMatching(revocationVersion ?? '', expected.revocationVersion, 'revocationVersion')

  return {
    subject: subjectValue,
    ...(reason ? { reason } : {}),
    ...(grantedBy ? { grantedBy } : {}),
    grantSource,
    issuer,
    serviceId,
    targetUserId,
    workspaceId,
    purpose,
    expiresAt,
    ...(grantId ? { grantId } : {}),
    ...(revocationVersion !== undefined ? { revocationVersion } : {}),
  }
}
