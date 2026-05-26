type MaybePromise<T> = T | Promise<T>

/**
 * `global` services are table-restricted but row-unscoped.
 * `derived` services are table-restricted and row-scoped to a tenant derived
 * from the call arguments.
 */
export type ServiceTenantMode = 'global' | 'derived'

export type RestrictedServiceAccess<TTableName extends string = string, TCaller = unknown> = {
  /** Explicit table allow-list for this service caller. */
  tables: TTableName[]
} & (
  | {
      /**
       * Allow the configured tables without tenant row filtering. This does not
       * grant access to unlisted tables.
       */
      tenant: 'global'
    }
  | {
      /** Apply tenant row filtering using the tenant id returned by `deriveTenant`. */
      tenant: 'derived'
      deriveTenant: (ctx: {
        caller: TCaller
        args: Record<string, unknown>
      }) => MaybePromise<string | null | undefined>
    }
)

export type ServiceDefinition<TTableName extends string = string, TCaller = unknown> =
  | {
      access: 'unrestricted'
    }
  | {
      access: RestrictedServiceAccess<TTableName, TCaller>
    }

export type ServiceDefinitions<TTableName extends string = string, TCaller = unknown> = Record<
  string,
  ServiceDefinition<TTableName, TCaller>
>

export function defineServices<
  TTableName extends string = string,
  TCaller = unknown,
  TServices extends ServiceDefinitions<TTableName, TCaller> = ServiceDefinitions<
    TTableName,
    TCaller
  >,
>(services: TServices): TServices {
  return services
}
