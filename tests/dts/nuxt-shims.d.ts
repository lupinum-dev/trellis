type TrellisNuxtRuntimeConfig = {
  public: {
    convex?: {
      auth?: unknown
      query?: {
        server?: boolean
        subscribe?: boolean
      }
    }
  }
}

interface ImportMeta {
  readonly client: boolean
  readonly server: boolean
  readonly dev: boolean
}

type TrellisRouter = {
  push: (target: unknown) => Promise<void>
  currentRoute?: {
    value?: {
      path?: string
      fullPath?: string
    }
  }
}

type TrellisAsyncData<T, E> = Promise<TrellisAsyncData<T, E>> & {
  data: import('vue').Ref<T>
  error: import('vue').Ref<E | null>
  status: import('vue').Ref<'idle' | 'pending' | 'success' | 'error'>
  pending: import('vue').Ref<boolean>
  refresh: () => Promise<void>
  clear: () => void
}

declare module '#app' {
  export interface NuxtApp {
    $convex?: import('convex/browser').ConvexClient
    $router?: TrellisRouter
    payload: {
      data: Record<string, unknown>
    }
    hook: (event: string, callback: (...args: unknown[]) => unknown) => () => void
    callHook: (event: string, ...args: unknown[]) => Promise<void>
    provide: (name: string, value: unknown) => void
  }

  export function useNuxtApp(): NuxtApp
  export function useState<T>(key: string, init?: () => T): import('vue').Ref<T>
}

declare module '#imports' {
  export function computed<T>(getter: () => T): import('vue').ComputedRef<T>
  export function navigateTo(target: string): Promise<void> | void
  export function onScopeDispose(cleanup: () => void): void
  export function useAsyncData<T, E = Error>(
    key: string | import('vue').ComputedRef<string>,
    handler: () => Promise<T> | T,
    options?: Record<string, unknown>,
  ): TrellisAsyncData<T, E>
  export function useNuxtApp(): import('#app').NuxtApp
  export function useNuxtData<T>(key: string): { data: import('vue').Ref<T | null> }
  export function useRequestEvent(): { headers: { get: (name: string) => string | null } } | null
  export function useRoute(): { query: Record<string, string | string[] | undefined> }
  export function useRouter(): TrellisRouter
  export function useRuntimeConfig(): TrellisNuxtRuntimeConfig
  export function useState<T>(key: string, init?: () => T): import('vue').Ref<T>
  export function watch<T>(
    source: T,
    callback: (value: T, oldValue: T) => void,
    options?: Record<string, unknown>,
  ): () => void
}
