type MaybePromise<T> = T | Promise<T>

/**
 * `global` services are table-restricted but row-unscoped.
 * `derived` services are table-restricted and row-scoped to a tenant derived
 * from the call arguments.
 */
export type ServiceTenantMode = 'global' | 'derived'
export type ServiceReplayMode =
  | 'none'
  | 'domain-idempotency'
  | 'jti-redemption'
  | 'operation-confirmation'

type ServiceTargetAllowList =
  | {
      /** Backend operation ids this service is allowed to invoke. */
      allowedOperations: string[]
      /** Backend function refs this service is allowed to invoke. */
      allowedFunctionRefs?: string[]
    }
  | {
      /** Backend operation ids this service is allowed to invoke. */
      allowedOperations?: string[]
      /** Backend function refs this service is allowed to invoke. */
      allowedFunctionRefs: string[]
    }

export type ServiceContractMetadata<TTableName extends string = string> = ServiceTargetAllowList & {
  /** Issuer/source for this service, for example `verifiedWebhook` or `scheduledTask`. */
  source: string
  /** Narrow purpose this service is allowed to perform. */
  purpose: string
  /** Replay behavior required for service writes. */
  replayMode: ServiceReplayMode
  /** Whether this service may carry backend-revalidated acting-for evidence. */
  actingFor: boolean
  /** Audit event emitted or represented by this service workflow. */
  auditEvent: string
  /** Durable table that stores service audit/idempotency evidence. */
  auditTable: TTableName
  /** Field/path used as the audit correlation id. */
  auditCorrelationId: string
}

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

export type ServiceDefinition<TTableName extends string = string, TCaller = unknown> = {
  access: RestrictedServiceAccess<TTableName, TCaller>
  metadata: ServiceContractMetadata<TTableName>
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
