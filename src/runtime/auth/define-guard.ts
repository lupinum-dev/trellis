export type Check<P = unknown> = (caller: P) => boolean
export type AnyCheck<P = unknown> = Check<P> | boolean

export type GuardKind = 'base' | 'and' | 'or' | 'not' | 'auth_required'
export type GuardDecision = 'allowed' | 'denied'

export type GuardExplanation = {
  label: string
  kind: GuardKind | 'check' | 'boolean'
  decision: GuardDecision
  reason: string
  error?: {
    name: string
    message: string
  }
  checks: GuardExplanation[]
}

export type GuardExplain<P = unknown> = (context: {
  caller: P
  decision: GuardDecision
  allowed: boolean
}) => string

export type Guard<P = unknown> = Check<P> & {
  _type: 'guard'
  kind: GuardKind
  label: string
  checks: ReadonlyArray<AnyCheck<P>>
  explain?: GuardExplain<P>
  and: (...checks: Array<AnyCheck<P>>) => Guard<P>
  or: (...checks: Array<AnyCheck<P>>) => Guard<P>
  not: () => Guard<P>
}

export type OpenGuard = Guard<unknown> & {
  _open: true
}

export type AuthRequiredGuard = Guard<unknown> & {
  _authRequired: true
  and: (...checks: Array<AnyCheck<unknown>>) => never
  or: (...checks: Array<AnyCheck<unknown>>) => never
  not: () => never
}

function describeInvalidCheckResult(value: unknown): string {
  if (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  ) {
    return 'Promise'
  }

  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

export function runCheck<P>(caller: P, check: AnyCheck<P>): boolean {
  const result = typeof check === 'function' ? (check as Check<P>)(caller) : check

  if (result !== true && result !== false) {
    throw new TypeError(
      `[trellis] Authorization checks must return a boolean. Received ${describeInvalidCheckResult(result)}.`,
    )
  }

  return result
}

export function isGuard<P = unknown>(value: unknown): value is Guard<P> {
  return (
    typeof value === 'function' &&
    value !== null &&
    (value as { _type?: unknown })._type === 'guard'
  )
}

export function isOpenGuard(value: unknown): value is OpenGuard {
  return isGuard(value) && (value as { _open?: unknown })._open === true
}

export function isAuthRequiredGuard(value: unknown): value is AuthRequiredGuard {
  return isGuard(value) && (value as { _authRequired?: unknown })._authRequired === true
}

function describeCheck<P>(check: AnyCheck<P>): string {
  if (isGuard(check)) return check.label
  if (typeof check === 'boolean') return String(check)
  return '(unnamed check)'
}

function toDecision(allowed: boolean): GuardDecision {
  return allowed ? 'allowed' : 'denied'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function getErrorName(error: unknown): string {
  if (error instanceof Error) return error.name
  return 'Error'
}

function evaluateCheck<P>(caller: P, check: AnyCheck<P>): { allowed: boolean; error?: unknown } {
  try {
    return { allowed: runCheck(caller, check) }
  } catch (error) {
    return { allowed: false, error }
  }
}

function explainFallback(label: string, decision: GuardDecision, error?: unknown): string {
  if (error) return `${label} threw while evaluating.`
  return decision === 'allowed' ? `${label} allowed access.` : `${label} denied access.`
}

function explainBoolean<P>(caller: P, check: boolean): GuardExplanation {
  const decision = toDecision(check)
  return {
    label: String(check),
    kind: 'boolean',
    decision,
    reason: explainFallback(String(check), decision),
    checks: [],
  }
}

export function explainCheck<P>(caller: P, check: AnyCheck<P>): GuardExplanation {
  if (typeof check === 'boolean') return explainBoolean(caller, check)

  if (!isGuard<P>(check)) {
    const result = evaluateCheck(caller, check)
    const decision = toDecision(result.allowed)
    return {
      label: '(unnamed check)',
      kind: 'check',
      decision,
      reason: explainFallback('(unnamed check)', decision, result.error),
      ...(result.error
        ? {
            error: {
              name: getErrorName(result.error),
              message: getErrorMessage(result.error),
            },
          }
        : {}),
      checks: [],
    }
  }

  const childExplanations = check.checks.map((child) => explainCheck(caller, child))
  const result = evaluateCheck(caller, check)
  const decision = toDecision(result.allowed)
  const reason =
    check.explain?.({ caller, decision, allowed: result.allowed }) ??
    explainFallback(check.label, decision, result.error)

  return {
    label: check.label,
    kind: check.kind,
    decision,
    reason,
    ...(result.error
      ? {
          error: {
            name: getErrorName(result.error),
            message: getErrorMessage(result.error),
          },
        }
      : {}),
    checks: childExplanations,
  }
}

function createGuard<P>(
  label: string,
  evaluate: Check<P>,
  kind: GuardKind,
  checks: ReadonlyArray<AnyCheck<P>>,
  explain?: GuardExplain<P>,
): Guard<P> {
  const guard = ((caller: P) => evaluate(caller)) as Guard<P>

  guard._type = 'guard'
  guard.kind = kind
  guard.label = label
  guard.checks = checks
  if (explain) guard.explain = explain
  guard.and = (...nextChecks) =>
    createGuard(
      [label, ...nextChecks.map(describeCheck)].join(' && '),
      (caller) => runCheck(caller, guard) && nextChecks.every((check) => runCheck(caller, check)),
      'and',
      [guard, ...nextChecks],
    )
  guard.or = (...nextChecks) =>
    createGuard(
      [label, ...nextChecks.map(describeCheck)].join(' || '),
      (caller) => runCheck(caller, guard) || nextChecks.some((check) => runCheck(caller, check)),
      'or',
      [guard, ...nextChecks],
    )
  guard.not = () =>
    createGuard(`not ${label}`, (caller) => !runCheck(caller, guard), 'not', [guard])

  return guard
}

export function defineGuard<P>(label: string, check: AnyCheck<P>): Guard<P>
export function defineGuard<P>(options: {
  label: string
  check: AnyCheck<P>
  explain?: GuardExplain<P>
}): Guard<P>
export function defineGuard<P>(
  labelOrOptions:
    | string
    | {
        label: string
        check: AnyCheck<P>
        explain?: GuardExplain<P>
      },
  check?: AnyCheck<P>,
): Guard<P> {
  const options =
    typeof labelOrOptions === 'string'
      ? { label: labelOrOptions, check: check as AnyCheck<P> }
      : labelOrOptions

  return createGuard(
    options.label,
    (caller) => runCheck(caller, options.check),
    'base',
    [options.check],
    options.explain,
  )
}

export const open = Object.assign(defineGuard<unknown>('open', true), {
  _open: true as const,
}) as OpenGuard

/**
 * Sentinel guard for pre-appIdentity authenticated flows.
 *
 * The boolean check here is intentionally inert. Enforcement happens in the
 * structured handler runtime via `requireAuth(...)`, not through `runCheck(...)`.
 */
export const authRequired = Object.assign(defineGuard<unknown>('authRequired', true), {
  _authRequired: true as const,
  kind: 'auth_required' as const,
  and: () => {
    throw new Error('authRequired is a caller gate and cannot be composed with and().')
  },
  or: () => {
    throw new Error('authRequired is a caller gate and cannot be composed with or().')
  },
  not: () => {
    throw new Error('authRequired is a caller gate and cannot be negated.')
  },
}) as AuthRequiredGuard
