import type { Ref } from 'vue'
import { watch } from 'vue'

import { useState } from '#app'

import { useAuthBootstrapRuntimeState } from '../auth/client/auth-bootstrap-state.js'
import type { AuthBootstrapState, AccessContextState } from './types.js'

export type PermissionDevtoolsState = AccessContextState
export type AuthBootstrapDevtoolsState = AuthBootstrapState

const PERMISSIONS_STATE_KEY = 'trellis:devtools:permissions'
const AUTH_BOOTSTRAP_STATE_KEY = 'trellis:devtools:auth-bootstrap'

export function usePermissionDevtoolsState(): Ref<PermissionDevtoolsState> {
  return useState<PermissionDevtoolsState>(PERMISSIONS_STATE_KEY, () => ({
    queryName: null,
    pending: false,
    ready: false,
    ctx: null,
    inventory: [],
    error: null,
  }))
}

export function useAuthBootstrapDevtoolsState(): Ref<AuthBootstrapDevtoolsState> {
  const runtimeState = useAuthBootstrapRuntimeState()
  const devtoolsState = useState<AuthBootstrapDevtoolsState>(AUTH_BOOTSTRAP_STATE_KEY, () => ({
    mutationName: runtimeState.value.mutationName,
    pending: runtimeState.value.status === 'pending',
    ensured: runtimeState.value.status === 'ensured',
    error: runtimeState.value.error,
  }))

  watch(
    runtimeState,
    (state) => {
      devtoolsState.value = {
        mutationName: state.mutationName,
        pending: state.status === 'pending',
        ensured: state.status === 'ensured',
        error: state.error,
      }
    },
    { immediate: true, deep: true },
  )

  return devtoolsState
}
