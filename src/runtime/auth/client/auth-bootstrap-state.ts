import type { Ref } from 'vue'

import { useState } from '#app'

export type AuthBootstrapStatus = 'disabled' | 'not-installed' | 'pending' | 'ensured' | 'failed'

export interface AuthBootstrapRuntimeState {
  status: AuthBootstrapStatus
  mutationName: string | null
  error: string | null
  lastEnsuredTokenHash: string | null
}

const AUTH_BOOTSTRAP_RUNTIME_STATE_KEY = 'trellis:runtime:auth-bootstrap'

export function initialAuthBootstrapRuntimeState(): AuthBootstrapRuntimeState {
  return {
    status: 'not-installed',
    mutationName: null,
    error: null,
    lastEnsuredTokenHash: null,
  }
}

export function useAuthBootstrapRuntimeState(): Ref<AuthBootstrapRuntimeState> {
  return useState<AuthBootstrapRuntimeState>(
    AUTH_BOOTSTRAP_RUNTIME_STATE_KEY,
    initialAuthBootstrapRuntimeState,
  )
}

export function disableAuthBootstrapRuntimeState(): void {
  const state = useAuthBootstrapRuntimeState()
  state.value = {
    status: 'disabled',
    mutationName: null,
    error: null,
    lastEnsuredTokenHash: null,
  }
}

export function fingerprintAuthBootstrapToken(token: string): string {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash.toString(16).padStart(8, '0')
}

export function shouldWaitForAuthBootstrapToken(
  bootstrap: AuthBootstrapRuntimeState,
  token: string | null,
  options?: { required?: boolean },
): boolean {
  if (bootstrap.status === 'disabled' || bootstrap.status === 'failed') return false
  if (options?.required === true && bootstrap.status !== 'ensured') return true
  if (bootstrap.status === 'not-installed' && !bootstrap.mutationName) {
    return options?.required === true
  }
  if (!token) return true

  const tokenHash = fingerprintAuthBootstrapToken(token)
  return bootstrap.status !== 'ensured' || bootstrap.lastEnsuredTokenHash !== tokenHash
}
