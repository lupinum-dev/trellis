import type { Rules } from 'convex-helpers/server/rowLevelSecurity'
import type { GenericDataModel, TableNamesInDataModel } from 'convex/server'

import type { ServiceDefinitions } from '../auth/define-services.js'
import { deny } from '../auth/index.js'
import { getIdentityForwarding } from '../identity-forwarding/index.js'
import {
  getIdentityForwardingEnvelopeState,
  stripForwardedIdentityFields,
} from '../identity-forwarding/shared.js'
import {
  createDenialExplanation,
  stripObservationEnvelope,
  type ObservationEventInput,
} from '../observability/index.js'
import type { ActingFor } from './define-acting-for.js'
import { trellisOperationMetadataKey } from './define-operation.js'

type ObserveFn = (event: ObservationEventInput) => Promise<void>

type DataCtx = {
  db: unknown
}

type RuntimeRuleCtx<
  _DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = DataCtx & {
  caller: () => Promise<TCaller>
  actingFor: () => Promise<TActingFor | null>
  appIdentity: () => Promise<TActor | null>
  observe: ObserveFn
}

export type IsolationOptions<DataModel extends GenericDataModel> = {
  tables: Array<TableNamesInDataModel<DataModel>>
  sharedTables?: Array<TableNamesInDataModel<DataModel>>
  field?: string
}

type ServiceRuntimeOptions<DataModel extends GenericDataModel, TCaller> = {
  isolation?: IsolationOptions<DataModel>
  services?: ServiceDefinitions<TableNamesInDataModel<DataModel>, TCaller>
}

export type ServiceTargetMetadata = {
  identityForwardingFunctionRef?: string
  [trellisOperationMetadataKey]?: { id?: string }
}

export type ResolvedServiceAccess<DataModel extends GenericDataModel> = null | {
  serviceId: string
  access: 'restricted'
  tables: ReadonlySet<TableNamesInDataModel<DataModel>>
  tenant: 'global' | 'derived'
  workspaceId: unknown
}

export type ResolvedRules<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = {
  dbRules: Rules<RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>, DataModel> | null
  crossTenantRules: Rules<RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>, DataModel> | null
  serviceAccess: ResolvedServiceAccess<DataModel>
}

function safeObserve(observe: ObserveFn | undefined, event: Parameters<ObserveFn>[0]): void {
  try {
    void observe?.(event)
  } catch {
    // Observability must never break business logic.
  }
}

function stripTransportReservedArgs<TArgs extends Record<string, unknown>>(args: TArgs): TArgs {
  return stripForwardedIdentityFields(stripObservationEnvelope(args)) as TArgs
}

function hasWorkspaceId(value: unknown): value is { workspaceId?: unknown } {
  return typeof value === 'object' && value !== null && 'workspaceId' in value
}

export function getWorkspaceId(appIdentity: unknown): unknown {
  if (!hasWorkspaceId(appIdentity)) return undefined
  return appIdentity.workspaceId
}

function hasTenantScope(value: unknown): boolean {
  return value !== undefined && value !== null
}

function isServicePrincipal(value: unknown): value is { kind: 'service'; serviceId: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value as { kind?: unknown }).kind === 'service' &&
    typeof (value as { serviceId?: unknown }).serviceId === 'string'
  )
}

const serviceReplayModes = new Set([
  'none',
  'domain-idempotency',
  'jti-redemption',
  'operation-confirmation',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonBlankStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonBlankString)
}

function assertServiceContractConfigured(serviceId: string, service: unknown): void {
  if (!isRecord(service) || !isRecord(service.metadata)) {
    throw deny(`Service "${serviceId}" must declare service contract metadata.`, {
      source: 'service-access',
      category: 'auth',
    })
  }

  const metadata = service.metadata
  const missing = [
    ['source', metadata.source],
    ['purpose', metadata.purpose],
    ['auditEvent', metadata.auditEvent],
    ['auditTable', metadata.auditTable],
    ['auditCorrelationId', metadata.auditCorrelationId],
  ]
    .filter(([, value]) => !isNonBlankString(value))
    .map(([field]) => field)

  if (missing.length > 0) {
    throw deny(
      `Service "${serviceId}" must declare non-empty service metadata: ${missing.join(', ')}.`,
      {
        source: 'service-access',
        category: 'auth',
      },
    )
  }

  if (!isNonBlankString(metadata.replayMode) || !serviceReplayModes.has(metadata.replayMode)) {
    throw deny(`Service "${serviceId}" must declare a valid replay mode.`, {
      source: 'service-access',
      category: 'auth',
    })
  }

  if (typeof metadata.actingFor !== 'boolean') {
    throw deny(`Service "${serviceId}" must declare whether actingFor evidence is allowed.`, {
      source: 'service-access',
      category: 'auth',
    })
  }

  if (
    (metadata.allowedOperations !== undefined &&
      !isNonBlankStringArray(metadata.allowedOperations)) ||
    (metadata.allowedFunctionRefs !== undefined &&
      !isNonBlankStringArray(metadata.allowedFunctionRefs))
  ) {
    throw deny(
      `Service "${serviceId}" allowed operation ids and function refs must be non-empty strings.`,
      {
        source: 'service-access',
        category: 'auth',
      },
    )
  }

  const allowedOperations = metadata.allowedOperations ?? []
  const allowedFunctionRefs = metadata.allowedFunctionRefs ?? []
  if (allowedOperations.length === 0 && allowedFunctionRefs.length === 0) {
    throw deny(
      `Service "${serviceId}" must declare at least one allowed operation id or function ref in service metadata.`,
      {
        source: 'service-access',
        category: 'auth',
      },
    )
  }
}

function getServiceError(serviceId: string, table: string): Error {
  return new Error(`Service "${serviceId}" has no access to table "${table}".`)
}

function assertServiceTableAccess<DataModel extends GenericDataModel>(
  access: ResolvedServiceAccess<DataModel>,
  table: string,
  observe?: ObserveFn,
): void {
  if (!access) return
  if (!access.tables.has(table as TableNamesInDataModel<DataModel>)) {
    safeObserve(observe, {
      name: 'service.access.denied',
      status: 'deny',
      serviceId: access.serviceId,
      reasonCode: 'service.access.denied',
      details: {
        table,
        explanation: createDenialExplanation({
          reasonCode: 'service.access.denied',
          decision: 'service',
          message: `Service "${access.serviceId}" cannot access table "${table}".`,
          policy: table,
          suggestedAction: 'contact_admin',
        }),
      },
    })
    throw getServiceError(access.serviceId, table)
  }
  safeObserve(observe, {
    name: 'service.access.checked',
    status: 'success',
    serviceId: access.serviceId,
    details: { table },
  })
}

export function wrapServiceDb<TDb extends object, DataModel extends GenericDataModel>(
  db: TDb,
  access: ResolvedServiceAccess<DataModel>,
  observe?: ObserveFn,
): TDb {
  if (!access) return db

  return new Proxy(db, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver)
      if (typeof original !== 'function') return original

      if (prop === 'query') {
        return (table: TableNamesInDataModel<DataModel>) => {
          assertServiceTableAccess(access, String(table), observe)
          return original.call(target, table)
        }
      }

      if (prop === 'insert') {
        return (table: TableNamesInDataModel<DataModel>, value: unknown) => {
          assertServiceTableAccess(access, String(table), observe)
          return original.call(target, table, value)
        }
      }

      if (prop === 'get') {
        return (table: TableNamesInDataModel<DataModel>, id: unknown) => {
          assertServiceTableAccess(access, String(table), observe)
          return original.call(target, table, id)
        }
      }

      if (prop === 'patch' || prop === 'replace' || prop === 'delete') {
        return (tableOrId: unknown, idOrValue?: unknown, maybeValue?: unknown) => {
          if (prop === 'delete' && typeof tableOrId === 'string' && idOrValue !== undefined) {
            assertServiceTableAccess(access, tableOrId, observe)
            return original.call(target, tableOrId, idOrValue)
          }
          if (prop !== 'delete' && typeof tableOrId === 'string' && maybeValue !== undefined) {
            assertServiceTableAccess(access, tableOrId, observe)
            return original.call(target, tableOrId, idOrValue, maybeValue)
          }
          throw new Error(
            `Service "${access.serviceId}" cannot use id-only ${String(prop)} through a table-restricted DB facade.`,
          )
        }
      }

      return original.bind(target)
    },
  }) as TDb
}

function createServiceScopeRule<TDoc extends Record<string, unknown>>(
  field: string,
  workspaceId: unknown,
) {
  return async (ctx: unknown, doc: TDoc) => {
    const documentWorkspaceId = doc[field as keyof TDoc]

    if (
      hasTenantScope(workspaceId) &&
      hasTenantScope(documentWorkspaceId) &&
      documentWorkspaceId === workspaceId
    ) {
      return true
    }

    if (process.env.NODE_ENV === 'production') {
      safeObserve((ctx as { observe?: ObserveFn }).observe, {
        name: 'rls.denied',
        status: 'deny',
        reasonCode: 'service.access.denied',
        details: {
          field,
          expectedWorkspaceId: workspaceId,
          actualWorkspaceId: documentWorkspaceId,
          explanation: createDenialExplanation({
            reasonCode: 'service.access.denied',
            decision: 'service',
            message: 'Service tenant scope denied access to this document.',
            policy: field,
            workspaceId: typeof workspaceId === 'string' ? workspaceId : undefined,
            suggestedAction: 'contact_admin',
          }),
        },
      })
      return false
    }

    throw new Error(
      `Service scope denied access.\nExpected: ${String(workspaceId)}\nReason: ${field} ${String(documentWorkspaceId)}`,
    )
  }
}

function createIsolationRule<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
  TDoc extends Record<string, unknown>,
>(field: string) {
  return async (ctx: RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>, doc: TDoc) => {
    const appIdentityWorkspaceId = getWorkspaceId(await ctx.appIdentity())
    const documentWorkspaceId = doc[field as keyof TDoc]

    if (
      hasTenantScope(appIdentityWorkspaceId) &&
      hasTenantScope(documentWorkspaceId) &&
      documentWorkspaceId === appIdentityWorkspaceId
    ) {
      return true
    }

    if (process.env.NODE_ENV === 'production') {
      await ctx.observe({
        name: 'rls.denied',
        status: 'deny',
        reasonCode: 'rls.denied',
        details: {
          field,
          appIdentityWorkspaceId,
          documentWorkspaceId,
          explanation: createDenialExplanation({
            reasonCode: 'rls.denied',
            decision: 'rls',
            message: 'Isolation denied access to this document.',
            policy: field,
            workspaceId:
              typeof appIdentityWorkspaceId === 'string' ? appIdentityWorkspaceId : undefined,
            suggestedAction: 'switch_tenant',
          }),
        },
      })
      return false
    }

    throw new Error(
      `Document belongs to a different isolation scope.\nAppIdentity: ${String(appIdentityWorkspaceId)}\nReason: ${field} ${String(documentWorkspaceId)}`,
    )
  }
}

function buildIsolationRules<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  options: IsolationOptions<DataModel> | undefined,
): Rules<RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>, DataModel> {
  const rules = {} as Rules<RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>, DataModel>
  if (!options) return rules

  const field = options.field ?? 'workspaceId'

  for (const table of options.tables) {
    const tenantRule = createIsolationRule<
      DataModel,
      TCaller,
      TActingFor,
      TActor,
      Record<string, unknown>
    >(field)
    rules[table] = {
      read: tenantRule,
      modify: tenantRule,
      insert: tenantRule,
    }
  }

  return rules
}

async function resolveServiceAccess<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  ctx: RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>,
  args: Record<string, unknown>,
  options: ServiceRuntimeOptions<DataModel, TCaller>,
): Promise<ResolvedServiceAccess<DataModel>> {
  const caller = await ctx.caller()
  if (!isServicePrincipal(caller)) return null

  const service = options.services?.[caller.serviceId]
  if (!service) {
    throw new Error(
      `Service "${caller.serviceId}" is not configured in defineTrellis({ services }).`,
    )
  }

  if (typeof service.access !== 'object' || service.access === null) {
    throw new Error(
      `Service "${caller.serviceId}" must declare restricted access with explicit tables and tenant scope.`,
    )
  }
  assertServiceContractConfigured(caller.serviceId, service)

  if (!isNonBlankStringArray(service.access.tables) || service.access.tables.length === 0) {
    throw deny(`Service "${caller.serviceId}" must declare at least one allowed table.`, {
      source: 'service-access',
      category: 'auth',
    })
  }

  if (service.access.tenant !== 'global' && service.access.tenant !== 'derived') {
    throw deny(`Service "${caller.serviceId}" must declare a valid tenant scope.`, {
      source: 'service-access',
      category: 'auth',
    })
  }
  if (service.access.tenant === 'derived' && typeof service.access.deriveTenant !== 'function') {
    throw deny(`Service "${caller.serviceId}" must declare deriveTenant for derived access.`, {
      source: 'service-access',
      category: 'auth',
    })
  }

  const workspaceId =
    service.access.tenant === 'derived'
      ? await service.access.deriveTenant({
          caller,
          args: stripTransportReservedArgs(args),
        })
      : null

  if (service.access.tenant === 'derived' && !isNonBlankString(workspaceId)) {
    throw deny(`Service "${caller.serviceId}" could not resolve a derived tenant scope.`, {
      source: 'service-access',
      category: 'auth',
    })
  }

  return {
    serviceId: caller.serviceId,
    access: 'restricted',
    tables: new Set(service.access.tables),
    tenant: service.access.tenant,
    workspaceId,
  }
}

export async function assertServiceTargetAllowed<DataModel extends GenericDataModel, TCaller>(
  ctx: Pick<RuntimeRuleCtx<DataModel, TCaller, ActingFor, unknown>, 'caller'>,
  options: ServiceRuntimeOptions<DataModel, TCaller>,
  extra: ServiceTargetMetadata | undefined,
): Promise<void> {
  const caller = await ctx.caller()
  if (!isServicePrincipal(caller)) return

  const service = options.services?.[caller.serviceId]
  if (!service) {
    throw new Error(
      `Service "${caller.serviceId}" is not configured in defineTrellis({ services }).`,
    )
  }
  assertServiceContractConfigured(caller.serviceId, service)

  const targetFunctionRef = extra?.identityForwardingFunctionRef
  const targetOperationId = extra?.[trellisOperationMetadataKey]?.id
  const allowedFunctionRefs = service.metadata.allowedFunctionRefs ?? []
  const allowedOperations = service.metadata.allowedOperations ?? []
  const envelope = getIdentityForwardingEnvelopeState(ctx)
  const identityForwarding = getIdentityForwarding(ctx)

  if (identityForwarding?.delegationSubject && service.metadata.actingFor === false) {
    throw deny(`Service "${caller.serviceId}" is not allowed to carry actingFor evidence.`, {
      source: 'service-access',
      category: 'auth',
    })
  }

  const actualReplayMode = envelope?.replayMode ?? 'none'
  if (service.metadata.replayMode !== actualReplayMode) {
    throw deny(
      `Service "${caller.serviceId}" requires replay mode "${service.metadata.replayMode}", not "${actualReplayMode}".`,
      {
        source: 'service-access',
        category: 'auth',
      },
    )
  }

  if (targetFunctionRef && allowedFunctionRefs.includes(targetFunctionRef)) return
  if (targetOperationId && allowedOperations.includes(targetOperationId)) return

  const targetDescription = targetOperationId
    ? `operation "${targetOperationId}"`
    : targetFunctionRef
      ? `function "${targetFunctionRef}"`
      : 'a handler without identityForwardingFunctionRef or operation metadata'

  throw deny(`Service "${caller.serviceId}" is not allowed to call ${targetDescription}.`, {
    source: 'service-access',
    category: 'auth',
  })
}

function buildServiceRules<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  access: ResolvedServiceAccess<DataModel>,
  options: IsolationOptions<DataModel> | undefined,
): Rules<RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>, DataModel> {
  const rules = {} as Rules<RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>, DataModel>
  if (!access) return rules
  if (access.tenant !== 'derived') return rules

  const field = options?.field ?? 'workspaceId'

  for (const table of access.tables) {
    const scopeRule = createServiceScopeRule<Record<string, unknown>>(field, access.workspaceId)
    rules[table] = {
      read: scopeRule,
      modify: scopeRule,
      insert: scopeRule,
    }
  }

  return rules
}

export async function resolveRules<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  ctx: RuntimeRuleCtx<DataModel, TCaller, TActingFor, TActor>,
  args: Record<string, unknown>,
  options: ServiceRuntimeOptions<DataModel, TCaller>,
): Promise<ResolvedRules<DataModel, TCaller, TActingFor, TActor>> {
  const tenantRules = buildIsolationRules<DataModel, TCaller, TActingFor, TActor>(options.isolation)
  const serviceAccess = await resolveServiceAccess(ctx, stripTransportReservedArgs(args), options)
  const serviceRules = buildServiceRules<DataModel, TCaller, TActingFor, TActor>(
    serviceAccess,
    options.isolation,
  )

  const isService = serviceAccess !== null
  const dbRules = isService ? serviceRules : tenantRules
  const crossTenantRules = serviceRules

  return {
    dbRules: Object.keys(dbRules).length > 0 ? dbRules : null,
    crossTenantRules: Object.keys(crossTenantRules).length > 0 ? crossTenantRules : null,
    serviceAccess,
  }
}
