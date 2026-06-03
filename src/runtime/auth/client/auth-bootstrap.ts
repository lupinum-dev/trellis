import type { FunctionReference } from 'convex/server'
import { watch } from 'vue'

import { useNuxtApp } from '#imports'

import { toErrorMessage } from '../../utils/value-helpers.js'
import { useConvexAuthController } from '../internal/useConvexAuthController.js'
import {
  fingerprintAuthBootstrapToken,
  useAuthBootstrapRuntimeState,
  type AuthBootstrapStatus,
} from './auth-bootstrap-state.js'

export function setupConfiguredAuthBootstrap<TMutation extends FunctionReference<'mutation'>>(
  mutationRef: TMutation,
  configuredMutationName: string,
): void {
  if (import.meta.server) return

  const nuxtApp = useNuxtApp()
  const auth = useConvexAuthController()
  const state = useAuthBootstrapRuntimeState()
  let lastEnsuredToken: string | null = null
  let activeBootstrapRequestId = 0
  const setState = (input: {
    status: AuthBootstrapStatus
    error: string | null
    token: string | null
  }) => {
    state.value = {
      status: input.status,
      mutationName: configuredMutationName,
      error: input.error,
      lastEnsuredTokenHash:
        input.status === 'ensured' && input.token
          ? fingerprintAuthBootstrapToken(input.token)
          : state.value.lastEnsuredTokenHash,
    }
  }

  state.value = {
    status: 'not-installed',
    mutationName: configuredMutationName,
    error: null,
    lastEnsuredTokenHash: null,
  }

  watch(
    [auth.isAuthenticated, auth.token],
    async ([authenticated, token]) => {
      const requestId = ++activeBootstrapRequestId
      if (!authenticated || !token) {
        lastEnsuredToken = null
        setState({ status: 'not-installed', error: null, token: null })
        return
      }

      if (lastEnsuredToken === token) {
        setState({ status: 'ensured', error: null, token })
        return
      }

      if (!nuxtApp.$convex || typeof nuxtApp.$convex.mutation !== 'function') {
        setState({
          status: 'failed',
          error: 'Convex client is not initialized.',
          token: null,
        })
        return
      }

      setState({ status: 'pending', error: null, token: null })

      try {
        await nuxtApp.$convex.mutation(mutationRef, {} as never)
        if (requestId !== activeBootstrapRequestId) {
          return
        }
        lastEnsuredToken = token
        setState({ status: 'ensured', error: null, token })
      } catch (error) {
        if (requestId !== activeBootstrapRequestId) {
          return
        }
        setState({
          status: 'failed',
          error: toErrorMessage(error),
          token: null,
        })
      }
    },
    { immediate: true },
  )
}
