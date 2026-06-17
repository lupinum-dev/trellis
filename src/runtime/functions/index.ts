import type { Customization } from 'convex-helpers/server/customFunctions'
import { wrapDatabaseReader, wrapDatabaseWriter } from 'convex-helpers/server/rowLevelSecurity'
import type { Triggers } from 'convex-helpers/server/triggers'
import { addFieldsToValidator } from 'convex-helpers/validators'
import type {
  ActionBuilder,
  FunctionVisibility,
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
  TableNamesInDataModel,
} from 'convex/server'
import type { GenericValidator, Infer, ObjectType, PropertyValidators } from 'convex/values'
import { v } from 'convex/values'

import { defineAppIdentity, type DefaultAppIdentity } from '../auth/define-app-identity.js'
import type { authRequired } from '../auth/define-guard.js'
import type { ServiceDefinitions } from '../auth/define-services.js'
import { can, deny, type open } from '../auth/index.js'
import {
  getIdentityForwarding,
  setIdentityForwardingContext,
  type IdentityForwardingKeyInput,
} from '../identity-forwarding/index.js'
import {
  getIdentityForwardingEnvelopeState,
  hasForwardedIdentityFields,
  stripForwardedIdentityFields,
  identityForwardingValidators,
} from '../identity-forwarding/shared.js'
import {
  buildObservationEnvelopeValidators,
  createObservationEmitter,
  createDenialExplanation,
  type ObservationEventInput,
  type PartialObservationEvent,
  type TrellisObservabilityOptions,
  getObservationEnvelope,
  stripObservationEnvelope,
  toObservationContext,
} from '../observability/index.js'
import type { NoInfer, SerializableValue } from '../types/type-utils.js'
import {
  attachBackendQueryLanes,
  createAuthenticatedLaneBuilder,
  type TrellisBackendLane,
} from './backend-lanes.js'
import {
  createConfirmationToken,
  hashConfirmationValue,
  hashConfirmationToken,
  normalizeStoredConfirmationPayload,
  type StoredToolConfirmationRow,
  type ToolConfirmationPayload,
} from './confirmation-token.js'
import { defineActingFor, type ActingFor, type ActingForDefinition } from './define-acting-for.js'
import { defineCaller, type DefaultCaller, type CallerDefinition } from './define-caller.js'
import { buildStructuredBuilder } from './define-handler.js'
// Intentional 0.3.0 internal lane machinery: protected/custom guard support and
// the authRequired sentinel stay here to implement explicit authenticated,
// workspace, and custom protected lanes. They are not public first-reader API.
import type {
  StructuredCrossTenantCapability,
  StructuredGuard,
  StructuredHandlerDefinition,
  StructuredLoadedValue,
  StructuredPublicWriteCapability,
} from './define-handler.js'
import {
  getOperationMetadata,
  getOperationProjectionMetadata,
  isOperationPreviewEnvelope,
  trellisOperationMetadataKey,
  type TrellisOperationMetadata,
  type TrellisOperationProjectionMetadata,
  type OperationPreviewEnvelope,
} from './define-operation.js'
import { createPublicSafeDb } from './public-db.js'
import {
  assertServiceTargetAllowed,
  getWorkspaceId,
  resolveRules,
  wrapServiceDb,
  type IsolationOptions,
} from './service-access.js'
import { decorateDb, getInternalUnsafeDb } from './unsafe-db.js'
import { assertUnsafePermit, type TrellisUnsafePermit } from './unsafe-permit.js'

export type {
  StructuredCrossTenantCapability,
  StructuredGuard,
  StructuredHandlerDefinition,
  StructuredLoadedValue,
  StructuredPublicWriteCapability,
} from './define-handler.js'
export {
  defineOperationDescriptor,
  defineOperationMetadata,
  defineOperation,
  blockedOperationPreview,
  executeOperationRef,
  getOperationMetadata,
  isOperationPreviewEnvelope,
  operationEffect,
  operationIssue,
  operationPreview,
  operationPreviewEffectValidator,
  operationPreviewIssueValidator,
  operationPreviewValidator,
  previewOperationRef,
  projectOperationRef,
  transportExecuteOperationRef,
  implementOperation,
  previewOf,
  trellisOperationMetadataKey,
  trellisOperationProjectionMetadataKey,
} from './define-operation.js'
export type {
  InferOperationLoaded,
  InferOperationResult,
  InferOperationPreview,
  McpWriteSafety,
  OperationDescriptor,
  OperationDefinition,
  OperationMetadataDefinition,
  OperationPreviewEffect,
  OperationPreviewEnvelope,
  OperationPreviewIssue,
  OperationIdOf,
  OperationKind,
  OperationProjectionRef,
  OperationShape,
  TrellisOperationMetadata,
  TrellisOperationProjectionMetadata,
  ValidateOperationDefinition,
  ValidateOperationId,
  ValidateOperationProjectionRef,
} from './define-operation.js'
export { defineActingFor } from './define-acting-for.js'
export type { ActingFor, ActingForDefinition } from './define-acting-for.js'
export { defineCaller } from './define-caller.js'
export type { DefaultCaller, CallerDefinition } from './define-caller.js'
export { unsafe } from './unsafe-permit.js'
export type { TrellisUnsafePermit } from './unsafe-permit.js'

type DataCtx<DataModel extends GenericDataModel> =
  | GenericQueryCtx<DataModel>
  | GenericMutationCtx<DataModel>

type AnyCtx<DataModel extends GenericDataModel> = DataCtx<DataModel> | GenericActionCtx<DataModel>

export type CallerAccessor<TCaller> = () => Promise<TCaller>
export type ActingForAccessor<TActingFor> = () => Promise<TActingFor | null>
export type AppIdentityAccessor<TActor> = () => Promise<TActor | null>
type ObserveFn = (event: ObservationEventInput) => Promise<void>
type UnsafeDefinition = {
  permit: TrellisUnsafePermit
  id?: string
  identityForwardingFunctionRef?: string
  identityForwardingTransport?: 'server' | 'webhook' | 'mcp' | 'bridge'
}
type UnsafeArgsFor<TArgsValidator> = [TArgsValidator] extends [PropertyValidators]
  ? ObjectType<TArgsValidator>
  : [TArgsValidator] extends [GenericValidator]
    ? Infer<TArgsValidator>
    : Record<string, never>

export { trellisBackendLaneMetadataKey } from './backend-lanes.js'
export type { TrellisBackendLane } from './backend-lanes.js'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Declaration-merged registry seam.
export interface OperationsById {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Declaration-merged registry seam.
export interface OperationExecutionsById {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Declaration-merged registry seam.
export interface OperationPreviewsById {}

export interface RegisteredOperations {
  byId: OperationsById
}

export interface RegisteredOperationProjections {
  executeById: OperationExecutionsById
  previewById: OperationPreviewsById
}

export type RegisteredOperationId = Extract<keyof OperationsById, string>
export type RegisteredOperationDefinition<TId extends RegisteredOperationId> = OperationsById[TId]
export type RegisteredOperationExecution<TId extends RegisteredOperationId> =
  OperationExecutionsById[TId]
export type RegisteredOperationPreview<TId extends RegisteredOperationId> =
  OperationPreviewsById[TId]

type AvailableOperationProjection<TId extends RegisteredOperationId> =
  | (TId extends keyof OperationExecutionsById ? 'execute' : never)
  | (TId extends keyof OperationPreviewsById ? 'preview' : never)

export type ValidateRegisteredOperationId<TId extends string = string> =
  TId extends NoInfer<RegisteredOperationId> ? TId : never

export type ValidateOperationProjection<
  TId extends RegisteredOperationId,
  TProjection extends 'execute' | 'preview' = 'execute' | 'preview',
> = TProjection extends NoInfer<AvailableOperationProjection<TId>> ? TProjection : never

function safeObserve(observe: ObserveFn | undefined, event: Parameters<ObserveFn>[0]): void {
  try {
    void observe?.(event)
  } catch {
    // Observability must never break business logic, even if a caller swaps in a bad implementation.
  }
}

function stripTransportReservedArgs<TArgs extends Record<string, unknown>>(args: TArgs): TArgs {
  return stripForwardedIdentityFields(stripObservationEnvelope(args)) as TArgs
}

function omitDb<TCtx extends { db?: unknown }>(ctx: TCtx): Omit<TCtx, 'db'> {
  const { db: _db, ...rest } = ctx
  return rest
}

export type FunctionsCtxExtension<TCaller, TActingFor, TActor> = {
  caller: CallerAccessor<TCaller>
  actingFor: ActingForAccessor<TActingFor>
  appIdentity: AppIdentityAccessor<TActor>
  observe: ObserveFn
}

type QueryDbWithRuntime<DataModel extends GenericDataModel> = GenericQueryCtx<DataModel>['db']

type MutationDbWithRuntime<DataModel extends GenericDataModel> = GenericMutationCtx<DataModel>['db']

type PublicSafeDb<DataModel extends GenericDataModel> = Pick<
  GenericQueryCtx<DataModel>['db'],
  'get' | 'normalizeId' | 'query'
>

type AnyCtxWithRuntime<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = AnyCtx<DataModel> & FunctionsCtxExtension<TCaller, TActingFor, TActor>

type QueryCtxWithRuntime<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = Omit<GenericQueryCtx<DataModel>, 'db'> & {
  db: QueryDbWithRuntime<DataModel>
} & FunctionsCtxExtension<TCaller, TActingFor, TActor>

type MutationCtxWithRuntime<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = Omit<GenericMutationCtx<DataModel>, 'db'> & {
  db: MutationDbWithRuntime<DataModel>
} & FunctionsCtxExtension<TCaller, TActingFor, TActor>

type PublicQueryCtxWithRuntime<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = Omit<QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>, 'db'> & {
  db: PublicSafeDb<DataModel>
}

type SessionQueryCtxWithRuntime<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = Omit<QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>, 'db'>

type PublicMutationCtxWithRuntime<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = Omit<MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>, 'db'> & {
  db: PublicSafeDb<DataModel>
}

type ActionCtxWithRuntime<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = GenericActionCtx<DataModel> & FunctionsCtxExtension<TCaller, TActingFor, TActor>

type OnSuccessArgs<Ctx> = {
  ctx: Ctx
  args: Record<string, unknown>
  result: unknown
}

type ServiceAccessDefinition<DataModel extends GenericDataModel, TCaller> = ServiceDefinitions<
  TableNamesInDataModel<DataModel>,
  TCaller
>

type QueryCustomizationCtx<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = GenericQueryCtx<DataModel> & FunctionsCtxExtension<TCaller, TActingFor, TActor>

type MutationCustomizationCtx<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = GenericMutationCtx<DataModel> & FunctionsCtxExtension<TCaller, TActingFor, TActor>

type ActionCustomizationCtx<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = GenericActionCtx<DataModel> & FunctionsCtxExtension<TCaller, TActingFor, TActor>

type IdentityForwardingCustomizationExtra = {
  id?: string
  executeFunctionRef?: string
  identityForwardingFunctionRef?: string
  identityForwardingTransport?: 'server' | 'webhook' | 'mcp' | 'bridge'
  trellisBackendLane?: TrellisBackendLane
  publicReadTables?: readonly string[]
  crossTenant?: StructuredCrossTenantCapability<object, Record<string, unknown>, unknown>
  publicWrite?: StructuredPublicWriteCapability<object, Record<string, unknown>, unknown>
  [trellisOperationMetadataKey]?: TrellisOperationMetadata
}

type DestructiveConfirmationReader<DataModel extends GenericDataModel> = {
  query: (table: TableNamesInDataModel<DataModel>) => {
    withIndex: (
      indexName: string,
      callback: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
    ) => { unique: () => Promise<unknown> }
  }
}

type DestructiveOperationsDb<DataModel extends GenericDataModel> =
  DestructiveConfirmationReader<DataModel> & {
    insert: (table: TableNamesInDataModel<DataModel>, value: unknown) => Promise<unknown>
    patch: (id: unknown, value: unknown) => Promise<unknown>
  }

type TrustedReplayDb<DataModel extends GenericDataModel> = {
  query: (table: TableNamesInDataModel<DataModel>) => {
    withIndex: (
      indexName: string,
      callback: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
    ) => { unique: () => Promise<unknown> }
  }
  insert: (table: TableNamesInDataModel<DataModel>, value: unknown) => Promise<unknown>
  patch: (id: unknown, value: unknown) => Promise<unknown>
}

type TrustedReplayClaim<DataModel extends GenericDataModel> = {
  table: TableNamesInDataModel<DataModel>
  id: unknown
}

type Awaitable<T> = T | Promise<T>

type DestructivePreviewConfirmationOptions<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = {
  callerKey: (
    ctx: AnyCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    args: Record<string, unknown>,
    loaded: unknown,
  ) => Awaitable<string>
  scopeKey: (
    ctx: AnyCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    args: Record<string, unknown>,
    loaded: unknown,
  ) => Awaitable<string>
  ttlSeconds?: number
}

type TrustedReplayOptions<DataModel extends GenericDataModel> = {
  table: TableNamesInDataModel<DataModel>
  ttlSeconds?: number
}

type AppBuilders<
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  InternalQueryVisibility extends FunctionVisibility = 'internal',
  InternalMutationVisibility extends FunctionVisibility = 'internal',
  ActionVisibility extends FunctionVisibility = 'public',
> = {
  query: QueryBuilder<DataModel, QueryVisibility>
  mutation: MutationBuilder<DataModel, MutationVisibility>
  action?: ActionBuilder<DataModel, ActionVisibility>
  internalQuery?: QueryBuilder<DataModel, InternalQueryVisibility>
  internalMutation?: MutationBuilder<DataModel, InternalMutationVisibility>
}

export interface DefineTrellisOptions<
  DataModel extends GenericDataModel,
  TCaller = DefaultCaller,
  TActingFor extends ActingFor = ActingFor,
  TActor = DefaultAppIdentity,
> {
  caller?: CallerDefinition<AnyCtx<DataModel>, TCaller>
  actingFor?: ActingForDefinition<AnyCtx<DataModel>, TActingFor>
  appIdentity?: (
    ctx: AnyCtx<DataModel> &
      Pick<FunctionsCtxExtension<TCaller, TActingFor, TActor>, 'caller' | 'actingFor'>,
    args: Record<string, unknown>,
    caller: TCaller,
    actingFor: TActingFor | null,
  ) => Promise<TActor | null>
  isolation?: IsolationOptions<DataModel>
  services?: ServiceAccessDefinition<DataModel, TCaller>
  observability?: TrellisObservabilityOptions
  identityForwardingKey?: IdentityForwardingKeyInput
  destructiveOperations?: {
    confirmationTable: TableNamesInDataModel<DataModel>
    auditTable: TableNamesInDataModel<DataModel>
    previewConfirmation?: DestructivePreviewConfirmationOptions<
      DataModel,
      TCaller,
      TActingFor,
      TActor
    >
  }
  trustedReplay?: TrustedReplayOptions<DataModel>
  triggers?: Triggers<
    DataModel,
    GenericMutationCtx<DataModel> & FunctionsCtxExtension<TCaller, TActingFor, TActor>
  >
  onSuccess?: {
    query?: (
      args: OnSuccessArgs<AnyCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>>,
    ) => Promise<void> | void
    mutation?: (
      args: OnSuccessArgs<AnyCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>>,
    ) => Promise<void> | void
    action?: (
      args: OnSuccessArgs<AnyCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>>,
    ) => Promise<void> | void
  }
}

function validateIsolationOptions<DataModel extends GenericDataModel>(
  options: IsolationOptions<DataModel> | undefined,
): void {
  if (!options) return

  if (options.tables.length === 0) {
    throw new Error('isolation.tables must include at least one table.')
  }

  const seen = new Set<string>()
  for (const table of options.tables) {
    if (typeof table !== 'string' || table.trim().length === 0) {
      throw new Error('isolation.tables must only contain non-empty table names.')
    }
    if (seen.has(table)) {
      throw new Error(`isolation.tables contains a duplicate table: "${table}".`)
    }
    seen.add(table)
  }

  const seenGlobal = new Set<string>()
  for (const table of options.sharedTables ?? []) {
    if (typeof table !== 'string' || table.trim().length === 0) {
      throw new Error('isolation.sharedTables must only contain non-empty table names.')
    }
    if (seenGlobal.has(table)) {
      throw new Error(`isolation.sharedTables contains a duplicate table: "${table}".`)
    }
    if (seen.has(table)) {
      throw new Error(
        `isolation cannot classify table "${table}" as both tenant-scoped and global.`,
      )
    }
    seenGlobal.add(table)
  }

  if (options.field !== undefined && options.field.trim().length === 0) {
    throw new Error('isolation.field must be a non-empty string when provided.')
  }
}

function rejectRemovedCustomRlsOption(options: unknown): void {
  if (
    typeof options === 'object' &&
    options !== null &&
    Object.prototype.hasOwnProperty.call(options, 'rls')
  ) {
    throw new Error(
      'defineTrellis({ rls }) has been removed. Keep business authorization in guard/load/authorize/handler and use isolation/services for runtime guardrails.',
    )
  }
}

function requireUnsafePermit(
  definition: UnsafeDefinition | undefined,
  surface: string,
): TrellisUnsafePermit {
  const permit = definition?.permit
  assertUnsafePermit(permit, `${surface}({ permit })`)
  return permit
}

function requireNonEmptyReason(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context} requires a non-empty reason.`)
  }
  return value.trim()
}

function destructiveOperationsMisconfiguredError(
  operationId: string,
  safety: { confirmationTable: string; auditTable: string },
): Error {
  return new Error(
    `Destructive safety for operation "${operationId}" is misconfigured. Ensure table "${safety.confirmationTable}" exists with "tokenHash" and "jti" fields plus "by_token_hash" and "by_jti" indexes, and ensure audit table "${safety.auditTable}" exists before executing destructive operations.`,
  )
}

function getDestructiveConfirmationReader<DataModel extends GenericDataModel>(
  db: unknown,
  operationId: string,
  safety: { confirmationTable: string; auditTable: string },
): DestructiveConfirmationReader<DataModel> {
  if (
    !db ||
    typeof db !== 'object' ||
    !('query' in db) ||
    typeof (db as { query?: unknown }).query !== 'function'
  ) {
    throw destructiveOperationsMisconfiguredError(operationId, safety)
  }

  return db as DestructiveConfirmationReader<DataModel>
}

function getDestructiveOperationsDb<DataModel extends GenericDataModel>(
  db: unknown,
  operationId: string,
  safety: { confirmationTable: string; auditTable: string },
): DestructiveOperationsDb<DataModel> {
  const reader = getDestructiveConfirmationReader<DataModel>(db, operationId, safety)
  if (
    !('insert' in reader) ||
    typeof (reader as { insert?: unknown }).insert !== 'function' ||
    !('patch' in reader) ||
    typeof (reader as { patch?: unknown }).patch !== 'function'
  ) {
    throw destructiveOperationsMisconfiguredError(operationId, safety)
  }

  return reader as DestructiveOperationsDb<DataModel>
}

function trustedReplayMisconfiguredError(table: string): Error {
  return new Error(
    `Trusted replay is misconfigured. Ensure table "${table}" exists with "jti" and "state" fields plus "by_jti" and "by_expires_at" indexes before accepting trusted mutation/action forwarding.`,
  )
}

function getTrustedReplayDb<DataModel extends GenericDataModel>(
  db: unknown,
  options: TrustedReplayOptions<DataModel>,
): TrustedReplayDb<DataModel> {
  if (
    !db ||
    typeof db !== 'object' ||
    !('query' in db) ||
    typeof (db as { query?: unknown }).query !== 'function' ||
    !('insert' in db) ||
    typeof (db as { insert?: unknown }).insert !== 'function' ||
    !('patch' in db) ||
    typeof (db as { patch?: unknown }).patch !== 'function'
  ) {
    throw trustedReplayMisconfiguredError(String(options.table))
  }

  return db as TrustedReplayDb<DataModel>
}

function describeTrustedReplayState(row: unknown): string | undefined {
  if (!row || typeof row !== 'object') return undefined
  const state = (row as { state?: unknown }).state
  return typeof state === 'string' ? state : undefined
}

function getTrustedReplayId(row: unknown): string | undefined {
  if (!row || typeof row !== 'object') return undefined
  const id = (row as { _id?: unknown })._id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

function trustedReplayMatchesEnvelope(
  row: unknown,
  envelope: {
    functionRef: string
    purpose: string
    transport: string
    replayMode?: string
    argsHash: string
    subject: string
    issuer: string
    audience: string
  },
): boolean {
  if (!row || typeof row !== 'object') return false
  const replay = row as Record<string, unknown>
  return (
    replay.functionRef === envelope.functionRef &&
    replay.purpose === envelope.purpose &&
    replay.transport === envelope.transport &&
    replay.replayMode === envelope.replayMode &&
    replay.argsHash === envelope.argsHash &&
    replay.subject === envelope.subject &&
    replay.issuer === envelope.issuer &&
    replay.audience === envelope.audience
  )
}

function isTrustedWritePurpose(purpose: string): boolean {
  return purpose === 'mutation' || purpose === 'action'
}

function assertTrustedReplayModeMatchesPurpose(envelope: {
  purpose: string
  replayMode?: string
  replayKey?: string
  replayTarget?: string
  functionRef?: string
}): void {
  if (
    envelope.replayMode === 'operation-confirmation' &&
    envelope.purpose !== 'operation-execute'
  ) {
    throw deny(
      'Trusted identity forwarding operation-confirmation replay mode is only valid for operation-execute envelopes.',
      {
        source: 'identity-forwarding',
        category: 'auth',
      },
    )
  }
  if (
    envelope.replayMode === 'domain-idempotency' &&
    (typeof envelope.replayKey !== 'string' || typeof envelope.replayTarget !== 'string')
  ) {
    throw deny('Trusted domain-idempotency forwarding requires a signed replay key and target.', {
      source: 'identity-forwarding',
      category: 'auth',
    })
  }
  if (
    envelope.replayTarget !== undefined &&
    envelope.functionRef !== undefined &&
    envelope.replayTarget !== envelope.functionRef
  ) {
    throw deny('Trusted domain-idempotency forwarding target does not match the function ref.', {
      source: 'identity-forwarding',
      category: 'auth',
    })
  }
  if (
    envelope.purpose === 'action' &&
    envelope.replayMode !== undefined &&
    envelope.replayMode !== 'domain-idempotency'
  ) {
    throw deny('Trusted action forwarding only supports domain-owned idempotency replay.', {
      source: 'identity-forwarding',
      category: 'auth',
    })
  }
}

async function claimTrustedReplayJti<
  DataModel extends GenericDataModel,
  TCtx extends AnyCtx<DataModel>,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  ctx: TCtx,
  ctxWithIdentityForwarding: TCtx & Record<PropertyKey, unknown>,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
): Promise<TrustedReplayClaim<DataModel> | null> {
  const envelope = getIdentityForwardingEnvelopeState(ctxWithIdentityForwarding)
  if (!envelope) return null

  assertTrustedReplayModeMatchesPurpose(envelope)

  if (!envelope.replayMode) {
    if (isTrustedWritePurpose(envelope.purpose)) {
      throw deny('Trusted identity forwarding writes require replay behavior.', {
        source: 'identity-forwarding',
        category: 'auth',
      })
    }
    return null
  }

  if (
    envelope.replayMode === 'domain-idempotency' ||
    envelope.replayMode === 'operation-confirmation' ||
    typeof envelope.jti !== 'string'
  ) {
    return null
  }

  if (!options.trustedReplay) {
    throw deny('Trusted identity forwarding writes require defineTrellis({ trustedReplay }).', {
      source: 'identity-forwarding',
      category: 'auth',
    })
  }

  const db = 'db' in ctx ? (ctx as { db?: unknown }).db : undefined
  const replayDb = getTrustedReplayDb<DataModel>(
    getInternalUnsafeDb((db as object) ?? {}) ?? db,
    options.trustedReplay,
  )

  let existing: unknown
  try {
    existing = await replayDb
      .query(options.trustedReplay.table)
      .withIndex('by_jti', (q) => q.eq('jti', envelope.jti))
      .unique()
  } catch {
    throw trustedReplayMisconfiguredError(String(options.trustedReplay.table))
  }

  if (existing) {
    const state = describeTrustedReplayState(existing)
    if (state === 'failed') {
      const id = getTrustedReplayId(existing)
      if (!id || !trustedReplayMatchesEnvelope(existing, envelope)) {
        throw deny('Trusted identity forwarding replay JTI does not match the failed claim.', {
          source: 'identity-forwarding',
          category: 'auth',
        })
      }
      const now = Date.now()
      await replayDb.patch(id, {
        state: 'claimed',
        updatedAt: now,
        completedAt: undefined,
        failedAt: undefined,
        failure: undefined,
      })
      return { table: options.trustedReplay.table, id }
    }
    throw deny(
      state === 'claimed'
        ? 'Trusted identity forwarding replay JTI is already claimed.'
        : 'Trusted identity forwarding replay JTI has already been redeemed.',
      {
        source: 'identity-forwarding',
        category: 'auth',
      },
    )
  }

  const now = Date.now()
  const ttlSeconds = options.trustedReplay.ttlSeconds ?? 24 * 60 * 60
  const id = await replayDb.insert(options.trustedReplay.table, {
    jti: envelope.jti,
    functionRef: envelope.functionRef,
    purpose: envelope.purpose,
    transport: envelope.transport,
    replayMode: envelope.replayMode,
    argsHash: envelope.argsHash,
    subject: envelope.subject,
    issuer: envelope.issuer,
    audience: envelope.audience,
    state: 'claimed',
    createdAt: now,
    updatedAt: now,
    expiresAt: Math.max(envelope.expiresAt, now + ttlSeconds * 1000),
  })

  return { table: options.trustedReplay.table, id }
}

async function patchTrustedReplayClaim<DataModel extends GenericDataModel>(
  ctx: AnyCtx<DataModel>,
  claim: TrustedReplayClaim<DataModel> | null,
  state: 'completed' | 'failed',
  details?: Record<string, unknown>,
): Promise<void> {
  if (!claim) return
  const db = 'db' in ctx ? (ctx as { db?: unknown }).db : undefined
  const replayDb = getTrustedReplayDb<DataModel>(getInternalUnsafeDb((db as object) ?? {}) ?? db, {
    table: claim.table,
  })
  const now = Date.now()
  await replayDb.patch(claim.id, {
    state,
    updatedAt: now,
    ...(state === 'completed'
      ? { completedAt: now, failedAt: undefined, failure: undefined }
      : { failedAt: now, completedAt: undefined }),
    ...(state === 'failed' && details ? { failure: details } : {}),
  })
}

async function assertNoOperationExecuteEnvelopeReplay<
  DataModel extends GenericDataModel,
  TCtx extends AnyCtx<DataModel>,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  ctx: TCtx,
  ctxWithIdentityForwarding: TCtx & Record<PropertyKey, unknown>,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
): Promise<void> {
  const envelope = getIdentityForwardingEnvelopeState(ctxWithIdentityForwarding)
  if (envelope?.purpose !== 'operation-execute') return
  if (typeof envelope.jti !== 'string') return

  if (envelope.replayMode !== 'operation-confirmation') {
    throw deny(
      'Identity forwarding operation-execute envelopes require operation-confirmation replay mode.',
      {
        source: 'identity-forwarding',
        category: 'auth',
      },
    )
  }

  if (!options.destructiveOperations) {
    throw deny(
      'Identity forwarding operation-execute envelopes require destructive safety confirmation.',
      {
        source: 'identity-forwarding',
        category: 'auth',
      },
    )
  }

  const db = 'db' in ctx ? (ctx as { db?: unknown }).db : undefined
  if (!db || typeof db !== 'object') {
    throw deny('Identity forwarding operation-execute replay checks require database access.', {
      source: 'identity-forwarding',
      category: 'auth',
    })
  }

  const unsafeDb = getDestructiveConfirmationReader<DataModel>(
    getInternalUnsafeDb(db as object) ?? db,
    envelope.functionRef,
    options.destructiveOperations,
  )

  let existingConfirmation
  try {
    existingConfirmation = await unsafeDb
      .query(options.destructiveOperations.confirmationTable)
      .withIndex('by_jti', (q) => q.eq('jti', envelope.jti))
      .unique()
  } catch (error) {
    throw toDestructiveOperationsError(error, envelope.functionRef, options.destructiveOperations)
  }

  if (
    existingConfirmation &&
    typeof (existingConfirmation as { redeemedAt?: unknown }).redeemedAt === 'number'
  ) {
    throw deny('Identity forwarding operation-execute envelope has already been redeemed.', {
      source: 'identity-forwarding',
      category: 'auth',
    })
  }
}

type UnsafeQueryBuilder<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = <
  TArgsValidator extends PropertyValidators | GenericValidator | undefined,
  TReturnsValidator extends PropertyValidators | GenericValidator | undefined,
  TReturnValue = unknown,
>(
  definition: {
    args?: TArgsValidator
    returns?: TReturnsValidator
    handler: (ctx: GenericQueryCtx<DataModel>, args: UnsafeArgsFor<TArgsValidator>) => TReturnValue
  } & UnsafeDefinition,
) => RegisteredQuery<Visibility, UnsafeArgsFor<TArgsValidator>, TReturnValue>

type UnsafeMutationBuilder<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = <
  TArgsValidator extends PropertyValidators | GenericValidator | undefined,
  TReturnsValidator extends PropertyValidators | GenericValidator | undefined,
  TReturnValue = unknown,
>(
  definition: {
    args?: TArgsValidator
    returns?: TReturnsValidator
    handler: (
      ctx: GenericMutationCtx<DataModel>,
      args: UnsafeArgsFor<TArgsValidator>,
    ) => TReturnValue
  } & UnsafeDefinition,
) => RegisteredMutation<Visibility, UnsafeArgsFor<TArgsValidator>, TReturnValue>

type UnsafeActionBuilder<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = <
  TArgsValidator extends PropertyValidators | GenericValidator | undefined,
  TReturnsValidator extends PropertyValidators | GenericValidator | undefined,
  TReturnValue = unknown,
>(
  definition: {
    args?: TArgsValidator
    returns?: TReturnsValidator
    handler: (ctx: GenericActionCtx<DataModel>, args: UnsafeArgsFor<TArgsValidator>) => TReturnValue
  } & UnsafeDefinition,
) => RegisteredAction<Visibility, UnsafeArgsFor<TArgsValidator>, TReturnValue>

type UnsafeBuilder<TBuilder> =
  TBuilder extends QueryBuilder<infer DataModel, infer Visibility>
    ? UnsafeQueryBuilder<DataModel, Visibility>
    : TBuilder extends MutationBuilder<infer DataModel, infer Visibility>
      ? UnsafeMutationBuilder<DataModel, Visibility>
      : TBuilder extends ActionBuilder<infer DataModel, infer Visibility>
        ? UnsafeActionBuilder<DataModel, Visibility>
        : TBuilder

function wrapUnsafeBuilder<TBuilder extends (...args: never[]) => unknown>(
  builder: TBuilder,
  label: string,
): UnsafeBuilder<TBuilder> {
  if (typeof builder !== 'function') return builder

  return ((definition: unknown) => {
    const permit = requireUnsafePermit(definition as UnsafeDefinition | undefined, label)
    const maybeDefinition =
      definition && typeof definition === 'object'
        ? (definition as Record<string, unknown>)
        : undefined
    const originalHandler = maybeDefinition?.handler

    const wrappedDefinition =
      maybeDefinition && typeof originalHandler === 'function'
        ? {
            ...maybeDefinition,
            handler: async (ctx: { observe?: ObserveFn }, ...args: unknown[]) => {
              safeObserve(ctx.observe, {
                name: 'unsafe.handler.used',
                status: 'success',
                details: {
                  kind: permit.kind,
                  reason: permit.reason,
                  reviewBy: permit.reviewBy,
                  scope: permit.scope,
                  surface: label,
                },
              })
              return await (originalHandler as (...args: unknown[]) => unknown)(ctx, ...args)
            },
          }
        : definition

    return (builder as unknown as (definition: unknown) => unknown)(wrappedDefinition)
  }) as unknown as UnsafeBuilder<TBuilder>
}

function describePrincipalKind(caller: unknown): string {
  if (caller && typeof caller === 'object') {
    const kind = (caller as { kind?: unknown }).kind
    if (typeof kind === 'string') return kind
  }
  return 'resolved'
}

function describeActorKind(appIdentity: unknown): string {
  if (appIdentity && typeof appIdentity === 'object') {
    const role = (appIdentity as { role?: unknown }).role
    if (typeof role === 'string') return role
    if (getWorkspaceId(appIdentity) !== undefined) return 'workspace'
  }
  return appIdentity == null ? 'missing' : 'resolved'
}

type StructuredQueryBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TGuard extends StructuredGuard<Awaited<ReturnType<TCtx['caller']>>, TActor>,
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: StructuredHandlerDefinition<
    TCtx,
    Awaited<ReturnType<TCtx['caller']>>,
    Awaited<ReturnType<TCtx['actingFor']>>,
    TActor,
    TGuard,
    TArgsValidator,
    TLoaded,
    TResult,
    TCrossTenant,
    TPublicWrite
  >,
) => RegisteredQuery<Visibility, ObjectType<TArgsValidator>, TResult>

type PublicStructuredQueryBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
  TReadTable extends string = string,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof open,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never; reads: readonly TReadTable[] },
) => RegisteredQuery<Visibility, ObjectType<TArgsValidator>, TResult>

type SessionStructuredQueryBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof open,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never; reads?: never },
) => RegisteredQuery<Visibility, ObjectType<TArgsValidator>, TResult>

type AuthenticatedStructuredQueryBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof authRequired,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never },
) => RegisteredQuery<Visibility, ObjectType<TArgsValidator>, TResult>

type StructuredMutationBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TGuard extends StructuredGuard<Awaited<ReturnType<TCtx['caller']>>, TActor>,
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: StructuredHandlerDefinition<
    TCtx,
    Awaited<ReturnType<TCtx['caller']>>,
    Awaited<ReturnType<TCtx['actingFor']>>,
    TActor,
    TGuard,
    TArgsValidator,
    TLoaded,
    TResult,
    TCrossTenant,
    TPublicWrite
  >,
) => RegisteredMutation<Visibility, ObjectType<TArgsValidator>, TResult>

type PublicStructuredMutationBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof open,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never },
) => RegisteredMutation<Visibility, ObjectType<TArgsValidator>, TResult>

type AuthenticatedStructuredMutationBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof authRequired,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never },
) => RegisteredMutation<Visibility, ObjectType<TArgsValidator>, TResult>

type StructuredTransportMutationBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TGuard extends StructuredGuard<Awaited<ReturnType<TCtx['caller']>>, TActor>,
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: StructuredHandlerDefinition<
    TCtx,
    Awaited<ReturnType<TCtx['caller']>>,
    Awaited<ReturnType<TCtx['actingFor']>>,
    TActor,
    TGuard,
    TArgsValidator,
    TLoaded,
    TResult,
    TCrossTenant,
    TPublicWrite
  >,
) => RegisteredMutation<Visibility, ObjectType<TArgsValidator>, TResult>

type AuthenticatedStructuredTransportMutationBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof authRequired,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never },
) => RegisteredMutation<Visibility, ObjectType<TArgsValidator>, TResult>

type TransportMutationWithBackendLanes<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = StructuredTransportMutationBuilder<TCtx, Visibility, TActor> & {
  authenticated: AuthenticatedStructuredTransportMutationBuilder<TCtx, Visibility, TActor>
}

type StructuredActionBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TGuard extends StructuredGuard<Awaited<ReturnType<TCtx['caller']>>, TActor>,
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: StructuredHandlerDefinition<
    TCtx,
    Awaited<ReturnType<TCtx['caller']>>,
    Awaited<ReturnType<TCtx['actingFor']>>,
    TActor,
    TGuard,
    TArgsValidator,
    TLoaded,
    TResult,
    TCrossTenant,
    TPublicWrite
  >,
) => RegisteredAction<Visibility, ObjectType<TArgsValidator>, TResult>

type PublicStructuredActionBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof open,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never },
) => RegisteredAction<Visibility, ObjectType<TArgsValidator>, TResult>

type AuthenticatedStructuredActionBuilder<
  TCtx extends {
    caller: () => Promise<unknown>
    actingFor: () => Promise<unknown | null>
  },
  Visibility extends FunctionVisibility,
  TActor,
> = <
  TArgsValidator extends PropertyValidators,
  TLoaded extends StructuredLoadedValue = undefined,
  TCrossTenant = undefined,
  TPublicWrite = undefined,
  TResult = unknown,
>(
  definition: Omit<
    StructuredHandlerDefinition<
      TCtx,
      Awaited<ReturnType<TCtx['caller']>>,
      Awaited<ReturnType<TCtx['actingFor']>>,
      TActor,
      typeof authRequired,
      TArgsValidator,
      TLoaded,
      TResult,
      TCrossTenant,
      TPublicWrite
    >,
    'guard'
  > & { guard?: never },
) => RegisteredAction<Visibility, ObjectType<TArgsValidator>, TResult>

type RuntimeBundle<
  DataModel extends GenericDataModel,
  TCtx extends AnyCtx<DataModel>,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = {
  caller: CallerAccessor<TCaller>
  actingFor: ActingForAccessor<TActingFor>
  appIdentity: AppIdentityAccessor<TActor>
  ctxWithIdentityForwarding: TCtx & Record<PropertyKey, unknown>
  baseCtx: TCtx & FunctionsCtxExtension<TCaller, TActingFor, TActor>
}

function resolveCaller<DataModel extends GenericDataModel, TCaller>(
  callerDefinition: CallerDefinition<AnyCtx<DataModel>, TCaller> | undefined,
): CallerDefinition<AnyCtx<DataModel>, TCaller> {
  return (callerDefinition ?? defineCaller.fromAuth<DataModel>()) as CallerDefinition<
    AnyCtx<DataModel>,
    TCaller
  >
}

function resolveActingFor<DataModel extends GenericDataModel, TActingFor extends ActingFor>(
  delegationDefinition: ActingForDefinition<AnyCtx<DataModel>, TActingFor> | undefined,
): ActingForDefinition<AnyCtx<DataModel>, TActingFor> {
  return (delegationDefinition ?? defineActingFor.none<DataModel>()) as ActingForDefinition<
    AnyCtx<DataModel>,
    TActingFor
  >
}

function resolveActor<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  actorResolver:
    | ((
        ctx: AnyCtx<DataModel> &
          Pick<FunctionsCtxExtension<TCaller, TActingFor, TActor>, 'caller' | 'actingFor'>,
        args: Record<string, unknown>,
        caller: TCaller,
        actingFor: TActingFor | null,
      ) => Promise<TActor | null>)
    | undefined,
): (
  ctx: AnyCtx<DataModel> &
    Pick<FunctionsCtxExtension<TCaller, TActingFor, TActor>, 'caller' | 'actingFor'>,
  args: Record<string, unknown>,
  caller: TCaller,
  actingFor: TActingFor | null,
) => Promise<TActor | null> {
  return (actorResolver ??
    (async (ctx) => await defineAppIdentity.fromAuth<DataModel>().resolve(ctx))) as (
    ctx: AnyCtx<DataModel> &
      Pick<FunctionsCtxExtension<TCaller, TActingFor, TActor>, 'caller' | 'actingFor'>,
    args: Record<string, unknown>,
    caller: TCaller,
    actingFor: TActingFor | null,
  ) => Promise<TActor | null>
}

async function createContextWithRuntime<
  DataModel extends GenericDataModel,
  TCtx extends AnyCtx<DataModel>,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  ctx: TCtx,
  args: Record<string, unknown>,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
  principalResolver: CallerDefinition<AnyCtx<DataModel>, TCaller>,
  delegationResolver: ActingForDefinition<AnyCtx<DataModel>, TActingFor>,
  actorResolver: (
    ctx: TCtx & Pick<FunctionsCtxExtension<TCaller, TActingFor, TActor>, 'caller' | 'actingFor'>,
    args: Record<string, unknown>,
    caller: TCaller,
    actingFor: TActingFor | null,
  ) => Promise<TActor | null>,
  extra?: IdentityForwardingCustomizationExtra,
): Promise<RuntimeBundle<DataModel, TCtx, TCaller, TActingFor, TActor>> {
  const rawAppArgs = stripObservationEnvelope(args)
  const observationEnvelope = getObservationEnvelope(args)
  if (
    Object.prototype.hasOwnProperty.call(rawAppArgs, '_trellisForwarding') &&
    !extra?.identityForwardingFunctionRef
  ) {
    throw deny('Signed identity forwarding requires exact `id` metadata on the target handler.', {
      source: 'identity-forwarding',
      category: 'auth',
    })
  }
  const ctxWithIdentityForwarding = { ...ctx } as TCtx & Record<PropertyKey, unknown>
  setIdentityForwardingContext(ctxWithIdentityForwarding, rawAppArgs, {
    expectedKeyOverride: options.identityForwardingKey,
    expectedTransport: extra?.identityForwardingTransport ?? 'server',
    ...(extra?.identityForwardingFunctionRef
      ? { expectedFunctionRef: extra.identityForwardingFunctionRef }
      : {}),
  })
  await assertNoOperationExecuteEnvelopeReplay(ctx, ctxWithIdentityForwarding, options)
  const identityForwarding = getIdentityForwarding(ctxWithIdentityForwarding)
  if (!identityForwarding && hasForwardedIdentityFields(rawAppArgs)) {
    throw deny(
      'Forwarded identity fields are only allowed on verified identity forwarding paths.',
      {
        source: 'identity-forwarding',
        category: 'auth',
      },
    )
  }
  const appArgs = stripForwardedIdentityFields(rawAppArgs)
  const observeRuntime = createObservationEmitter(options.observability, {
    transport: 'convex',
    ...toObservationContext(observationEnvelope),
  })
  const observe: ObserveFn = async (event) => {
    await observeRuntime.emit({
      ...event,
      transport: event.transport ?? 'convex',
      originTransport: event.originTransport ?? observationEnvelope?.originTransport,
    } as PartialObservationEvent)
  }

  let callerPromise: Promise<TCaller> | null = null
  const caller: CallerAccessor<TCaller> = async () => {
    callerPromise ??= Promise.resolve(
      principalResolver.resolve(ctxWithIdentityForwarding, appArgs),
    ).then(async (value) => {
      await observe({
        name: 'caller.resolved',
        status: 'success',
        principalKind: describePrincipalKind(value),
      })
      return value
    })
    return await callerPromise
  }

  let delegationPromise: Promise<TActingFor | null> | null = null
  const actingFor: ActingForAccessor<TActingFor> = async () => {
    delegationPromise ??= Promise.resolve(
      delegationResolver.resolve(ctxWithIdentityForwarding, appArgs),
    )
    return await delegationPromise
  }

  const ctxWithCaller = {
    ...ctxWithIdentityForwarding,
    caller,
    actingFor,
    observe,
  } as TCtx &
    Pick<FunctionsCtxExtension<TCaller, TActingFor, TActor>, 'caller' | 'actingFor' | 'observe'>

  await assertServiceTargetAllowed(ctxWithCaller, options, extra)

  let actorPromise: Promise<TActor | null> | null = null
  const appIdentity: AppIdentityAccessor<TActor> = async () => {
    actorPromise ??= actorResolver(ctxWithCaller, appArgs, await caller(), await actingFor()).then(
      async (value) => {
        await observe({
          name: value == null ? 'appIdentity.missing' : 'appIdentity.resolved',
          status: value == null ? 'skip' : 'success',
          actorKind: describeActorKind(value),
          workspaceId:
            typeof getWorkspaceId(value) === 'string'
              ? (getWorkspaceId(value) as string)
              : undefined,
        })
        return value
      },
    )
    return await actorPromise
  }

  return {
    caller,
    actingFor,
    appIdentity,
    ctxWithIdentityForwarding,
    baseCtx: {
      ...ctxWithCaller,
      appIdentity,
      observe,
    } as TCtx & FunctionsCtxExtension<TCaller, TActingFor, TActor>,
  }
}

function createOnSuccessHandler<Ctx>(
  handler: ((args: OnSuccessArgs<Ctx>) => Promise<void> | void) | undefined,
  ctx: Ctx,
): ((payload: { args: Record<string, unknown>; result: unknown }) => Promise<void>) | undefined {
  if (!handler) return undefined

  return async ({ args, result }) => {
    await handler({
      ctx,
      args: stripTransportReservedArgs(args),
      result,
    })
  }
}

function trustedReplayFailureDetails(error: unknown): Record<string, unknown> {
  return error instanceof Error ? { message: error.message } : { message: String(error) }
}

function createReplayAwareOnSuccess<
  DataModel extends GenericDataModel,
  TCtx extends AnyCtx<DataModel>,
>(
  ctx: TCtx,
  replayClaim: TrustedReplayClaim<DataModel> | null,
  onSuccess:
    | ((payload: { args: Record<string, unknown>; result: unknown }) => Promise<void>)
    | undefined,
): ((payload: { args: Record<string, unknown>; result: unknown }) => Promise<void>) | undefined {
  if (!replayClaim && !onSuccess) return undefined

  return async (payload) => {
    await patchTrustedReplayClaim(ctx, replayClaim, 'completed')
    if (onSuccess) await onSuccess(payload)
  }
}

function createReplayAwareOnError<
  DataModel extends GenericDataModel,
  TCtx extends AnyCtx<DataModel>,
>(
  ctx: TCtx,
  replayClaim: TrustedReplayClaim<DataModel> | null,
): ((payload: { args: Record<string, unknown>; error: unknown }) => Promise<void>) | undefined {
  if (!replayClaim) return undefined

  return async ({ error }) => {
    await patchTrustedReplayClaim(ctx, replayClaim, 'failed', trustedReplayFailureDetails(error))
  }
}

function requireCapabilityTables(value: unknown, label: string): ReadonlySet<string> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must include at least one table.`)
  }

  const tables = new Set<string>()
  for (const table of value) {
    if (typeof table !== 'string' || table.trim().length === 0) {
      throw new Error(`${label} must contain non-empty table names.`)
    }
    const normalized = table.trim()
    if (tables.has(normalized)) {
      throw new Error(`${label} contains a duplicate table: "${normalized}".`)
    }
    tables.add(normalized)
  }
  return tables
}

function assertCapabilityTableAccess(
  tables: ReadonlySet<string>,
  table: string,
  reason: string,
  observe: ObserveFn,
  capability: string,
  eventName: 'db.cross_tenant.used' | 'db.public_write.used',
): void {
  if (!tables.has(table)) {
    throw new Error(`${capability} capability does not allow table "${table}".`)
  }
  safeObserve(observe, {
    name: eventName,
    status: 'success',
    details: {
      reason,
      table,
    },
  })
}

function createCrossTenantDb<TDb extends object>(input: {
  db: TDb
  mode: 'read' | 'write'
  reason: string
  tables: ReadonlySet<string>
  observe: ObserveFn
  capability: string
  eventName: 'db.cross_tenant.used' | 'db.public_write.used'
}): TDb {
  const readOnlyWriteError = () =>
    new Error(
      `${input.capability} capability is read-only. Use an operation-backed write capability.`,
    )

  const reader = {
    get: async (table: string, id: unknown) => {
      assertCapabilityTableAccess(
        input.tables,
        table,
        input.reason,
        input.observe,
        input.capability,
        input.eventName,
      )
      return await (input.db as { get: (table: string, id: unknown) => unknown }).get(table, id)
    },
    normalizeId: (table: string, id: unknown) => {
      assertCapabilityTableAccess(
        input.tables,
        table,
        input.reason,
        input.observe,
        input.capability,
        input.eventName,
      )
      return (input.db as { normalizeId?: (table: string, id: unknown) => unknown }).normalizeId?.(
        table,
        id,
      )
    },
    query: (table: string) => {
      assertCapabilityTableAccess(
        input.tables,
        table,
        input.reason,
        input.observe,
        input.capability,
        input.eventName,
      )
      return (input.db as { query: (table: string) => unknown }).query(table)
    },
    insert: async (table: string, value: unknown) => {
      if (input.mode !== 'write') throw readOnlyWriteError()
      assertCapabilityTableAccess(
        input.tables,
        table,
        input.reason,
        input.observe,
        input.capability,
        input.eventName,
      )
      return await (input.db as { insert: (table: string, value: unknown) => unknown }).insert(
        table,
        value,
      )
    },
    patch: async (tableOrId: unknown, idOrValue: unknown, maybeValue?: unknown) => {
      if (input.mode !== 'write') throw readOnlyWriteError()
      if (maybeValue !== undefined && typeof tableOrId === 'string') {
        assertCapabilityTableAccess(
          input.tables,
          tableOrId,
          input.reason,
          input.observe,
          input.capability,
          input.eventName,
        )
        return await (
          input.db as { patch: (table: string, id: unknown, value: unknown) => unknown }
        ).patch(tableOrId, idOrValue, maybeValue)
      }
      void idOrValue
      throw new Error(
        `${input.capability} capability cannot use id-only patch through a table-restricted DB facade.`,
      )
    },
    replace: async (tableOrId: unknown, idOrValue: unknown, maybeValue?: unknown) => {
      if (input.mode !== 'write') throw readOnlyWriteError()
      if (maybeValue !== undefined && typeof tableOrId === 'string') {
        assertCapabilityTableAccess(
          input.tables,
          tableOrId,
          input.reason,
          input.observe,
          input.capability,
          input.eventName,
        )
        return await (
          input.db as { replace: (table: string, id: unknown, value: unknown) => unknown }
        ).replace(tableOrId, idOrValue, maybeValue)
      }
      void idOrValue
      throw new Error(
        `${input.capability} capability cannot use id-only replace through a table-restricted DB facade.`,
      )
    },
    delete: async (tableOrId: unknown, maybeId?: unknown) => {
      if (input.mode !== 'write') throw readOnlyWriteError()
      if (maybeId !== undefined && typeof tableOrId === 'string') {
        assertCapabilityTableAccess(
          input.tables,
          tableOrId,
          input.reason,
          input.observe,
          input.capability,
          input.eventName,
        )
        return await (input.db as { delete: (table: string, id: unknown) => unknown }).delete(
          tableOrId,
          maybeId,
        )
      }
      throw new Error(
        `${input.capability} capability cannot use id-only delete through a table-restricted DB facade.`,
      )
    },
  }

  return reader as TDb
}

async function resolveCrossTenantCapability<
  TCtx extends object,
  TArgs extends Record<string, unknown>,
>(input: {
  capability: StructuredCrossTenantCapability<TCtx, TArgs, unknown> | undefined
  ctx: TCtx
  args: TArgs
  db: object
  observe: ObserveFn
  operationMetadata?: TrellisOperationMetadata
}): Promise<unknown> {
  if (!input.capability) return undefined

  const reason = requireNonEmptyReason(input.capability.reason, 'crossTenant.reason')
  const tables = requireCapabilityTables(input.capability.tables, 'crossTenant.tables')
  const mode = input.capability.mode ?? 'read'
  if (mode !== 'read' && mode !== 'write') {
    throw new Error('crossTenant.mode must be "read" or "write".')
  }
  if (mode === 'write' && !input.operationMetadata?.id) {
    throw new Error('crossTenant write capabilities require an operation-backed handler with `id`.')
  }

  return await input.capability.access({
    ctx: input.ctx,
    args: input.args,
    db: createCrossTenantDb({
      db: input.db,
      mode,
      reason,
      tables,
      observe: input.observe,
      capability: 'crossTenant',
      eventName: 'db.cross_tenant.used',
    }) as never,
  })
}

async function resolvePublicWriteCapability<
  TCtx extends object,
  TArgs extends Record<string, unknown>,
>(input: {
  capability: StructuredPublicWriteCapability<TCtx, TArgs, unknown> | undefined
  ctx: TCtx
  args: TArgs
  db: object
  observe: ObserveFn
  lane?: TrellisBackendLane
  operationMetadata?: TrellisOperationMetadata
}): Promise<unknown> {
  if (!input.capability) return undefined

  if (input.lane !== 'public') {
    throw new Error('publicWrite capabilities are only valid on public mutation handlers.')
  }
  const operationId = input.operationMetadata?.id
  if (!operationId) {
    throw new Error('publicWrite capabilities require an operation-backed handler with `id`.')
  }
  const reason = requireNonEmptyReason(input.capability.reason, 'publicWrite.reason')
  const tables = requireCapabilityTables(input.capability.tables, 'publicWrite.tables')

  return await input.capability.access({
    ctx: input.ctx,
    args: input.args,
    db: createCrossTenantDb({
      db: input.db,
      mode: 'write',
      reason,
      tables,
      observe: input.observe,
      capability: 'publicWrite',
      eventName: 'db.public_write.used',
    }) as never,
  })
}

function stripConfirmationToken(args: Record<string, unknown>): Record<string, unknown> {
  return stripObservationEnvelope(
    Object.fromEntries(Object.entries(args).filter(([key]) => key !== '_confirmationToken')),
  )
}

function getConfirmationToken(args: Record<string, unknown>): string | undefined {
  return typeof args._confirmationToken === 'string' ? args._confirmationToken : undefined
}

function isDestructivePreviewPayload(value: unknown): value is OperationPreviewEnvelope<{
  [key: string]: SerializableValue
}> {
  return isOperationPreviewEnvelope(value)
}

async function hashPreviewVersion(version: SerializableValue | undefined): Promise<string | null> {
  return version === undefined ? null : await hashConfirmationValue(version)
}

function getDestructivePreviewExecutePath(
  metadata: TrellisOperationMetadata,
  projectionMetadata: TrellisOperationProjectionMetadata | null,
): string {
  const executePath = projectionMetadata?.executeFunctionRef
  if (!executePath) {
    throw new Error(
      `Destructive operation "${metadata.id ?? metadata.name ?? 'unknown'}" preview confirmation requires the operation definition to provide executeFunctionRef for the execute function.`,
    )
  }
  return executePath
}

function getExecuteFunctionRef(definition: unknown): string | undefined {
  return typeof (definition as { executeFunctionRef?: unknown }).executeFunctionRef === 'string'
    ? (definition as { executeFunctionRef: string }).executeFunctionRef
    : undefined
}

function getDestructivePreviewPath(
  definition: { id?: string; identityForwardingFunctionRef?: string },
  projectionMetadata: TrellisOperationProjectionMetadata | null,
): string {
  return (
    definition.identityForwardingFunctionRef ??
    projectionMetadata?.functionRef ??
    definition.id ??
    'preview'
  )
}

function getStoredConfirmationId(row: StoredToolConfirmationRow): unknown {
  if (row._id === undefined) {
    throw new Error('Stored destructive confirmation row is missing "_id".')
  }
  return row._id
}

function confirmationTokenInvalidError(): Error {
  return new Error('Invalid or expired confirmation token. Preview again before executing.')
}

function assertStoredConfirmationMatches(input: {
  payload: ToolConfirmationPayload
  metadata: TrellisOperationMetadata
  executePath?: string
  callerKey: string
  scopeKey: string
}): void {
  if (input.payload.operationId !== input.metadata.id) {
    throw new Error(
      `Confirmation token targets operation "${input.payload.operationId}", not "${input.metadata.id}".`,
    )
  }
  if (input.executePath && input.payload.executePath !== input.executePath) {
    throw new Error(
      `Confirmation token targets execute path "${input.payload.executePath}", not "${input.executePath}".`,
    )
  }
  if (input.payload.callerKey !== input.callerKey) {
    throw new Error('Confirmation token no longer matches this caller. Preview again.')
  }
  if (input.payload.scopeKey !== input.scopeKey) {
    throw new Error('Confirmation token no longer matches this scope. Preview again.')
  }
}

async function attachDestructivePreviewConfirmation<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(input: {
  ctx: AnyCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>
  args: Record<string, unknown>
  loaded: unknown
  metadata: TrellisOperationMetadata
  projectionMetadata: TrellisOperationProjectionMetadata | null
  definition: { id?: string; identityForwardingFunctionRef?: string }
  previewResult: unknown
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>
}): Promise<unknown> {
  const confirmationOptions = input.options.destructiveOperations?.previewConfirmation
  if (!confirmationOptions) return input.previewResult
  if (!isDestructivePreviewPayload(input.previewResult)) return input.previewResult
  if (input.previewResult.allowed === false || input.previewResult.blockers.length > 0) {
    return input.previewResult
  }

  const ttlSeconds = confirmationOptions.ttlSeconds ?? 5 * 60
  const now = Date.now()
  const executePath = getDestructivePreviewExecutePath(input.metadata, input.projectionMetadata)
  const previewPath = getDestructivePreviewPath(input.definition, input.projectionMetadata)
  const [callerKey, scopeKey, argsHash, previewHash, versionHash] = await Promise.all([
    confirmationOptions.callerKey(input.ctx, input.args, input.loaded),
    confirmationOptions.scopeKey(input.ctx, input.args, input.loaded),
    hashConfirmationValue(input.args),
    hashConfirmationValue(input.previewResult.confirm),
    hashPreviewVersion(input.previewResult.version),
  ])
  const token = createConfirmationToken()
  const tokenHash = await hashConfirmationToken(token)
  const operationId = input.metadata.id
  if (!operationId) {
    throw new Error('Destructive preview confirmation requires `operation.id`.')
  }
  const db = 'db' in input.ctx ? (input.ctx as { db?: unknown }).db : undefined
  const unsafeDb = getDestructiveOperationsDb<DataModel>(
    getInternalUnsafeDb((db as object) ?? {}) ?? db,
    operationId,
    input.options.destructiveOperations!,
  )

  try {
    await unsafeDb.insert(input.options.destructiveOperations!.confirmationTable, {
      tokenHash,
      jti: tokenHash,
      operationId,
      executePath,
      previewPath,
      callerKey,
      scopeKey,
      argsHash,
      previewHash,
      ...(versionHash ? { versionHash } : {}),
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
    })
  } catch (error) {
    throw toDestructiveOperationsError(error, operationId, input.options.destructiveOperations!)
  }

  return {
    ...input.previewResult,
    confirmation: {
      token,
      expiresAt: now + ttlSeconds * 1000,
    },
  }
}

function toDestructiveOperationsError(
  error: unknown,
  operationId: string,
  safety: { confirmationTable: string; auditTable: string },
): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error))
  }

  if (
    /by_token_hash|by_jti|missing.*index|does not exist|unknown table|unknown index|schema|is not a function/i.test(
      error.message,
    )
  ) {
    return destructiveOperationsMisconfiguredError(operationId, safety)
  }

  return error
}

function createQueryCustomization<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
): Customization<
  GenericQueryCtx<DataModel>,
  PropertyValidators,
  QueryCustomizationCtx<DataModel, TCaller, TActingFor, TActor>,
  Record<string, never>,
  IdentityForwardingCustomizationExtra
> {
  const callerDefinition = resolveCaller(options.caller)
  const delegationDefinition = resolveActingFor(options.actingFor)
  const actorResolver = resolveActor(options.appIdentity)
  const principalArgs: PropertyValidators = {
    ...identityForwardingValidators,
    ...buildObservationEnvelopeValidators(),
  }

  return {
    args: principalArgs,
    input: async (ctx, args, extra) => {
      if (extra.publicWrite) {
        throw new Error('publicWrite capabilities are only valid on public mutation handlers.')
      }
      const { baseCtx, ctxWithIdentityForwarding } = await createContextWithRuntime(
        ctx,
        args,
        options,
        callerDefinition,
        delegationDefinition,
        actorResolver,
        extra,
      )
      const { dbRules, crossTenantRules, serviceAccess } = await resolveRules(
        baseCtx,
        args,
        options,
      )
      const rawDb = ctx.db
      const serviceDb = wrapServiceDb(rawDb, serviceAccess, baseCtx.observe)
      const scopedDb = dbRules ? wrapDatabaseReader(baseCtx, serviceDb, dbRules) : serviceDb
      const publicReadTables = extra.publicReadTables
      if (extra.trellisBackendLane === 'public' && !publicReadTables) {
        throw new Error('public query handlers require `reads` with explicit table names.')
      }
      const db =
        extra.trellisBackendLane === 'public'
          ? createPublicSafeDb(scopedDb, publicReadTables ?? [])
          : extra.trellisBackendLane === 'session'
            ? undefined
            : scopedDb
      const crossTenantDb = crossTenantRules
        ? wrapDatabaseReader(baseCtx, serviceDb, crossTenantRules)
        : serviceDb
      const crossTenant = await resolveCrossTenantCapability({
        capability: extra.crossTenant,
        ctx: baseCtx,
        args: stripTransportReservedArgs(args),
        db: crossTenantDb,
        observe: baseCtx.observe,
        operationMetadata: extra[trellisOperationMetadataKey],
      })
      const ctxBase =
        extra.trellisBackendLane === 'session'
          ? omitDb(baseCtx)
          : (baseCtx as unknown as QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>)
      const finalCtx: QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor> = {
        ...ctxBase,
        ...(db === undefined ? {} : { db: decorateDb(db, rawDb) }),
        ...(crossTenant === undefined ? {} : { crossTenant }),
      } as QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>
      const replayClaim = await claimTrustedReplayJti(ctx, ctxWithIdentityForwarding, options)

      return {
        ctx: finalCtx,
        args: {},
        onSuccess: createReplayAwareOnSuccess(
          ctx,
          replayClaim,
          createOnSuccessHandler(options.onSuccess?.query, finalCtx),
        ),
        onError: createReplayAwareOnError(ctx, replayClaim),
      }
    },
  }
}

function createMutationCustomization<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
): Customization<
  GenericMutationCtx<DataModel>,
  PropertyValidators,
  MutationCustomizationCtx<DataModel, TCaller, TActingFor, TActor>,
  Record<string, never>,
  IdentityForwardingCustomizationExtra
> {
  const callerDefinition = resolveCaller(options.caller)
  const delegationDefinition = resolveActingFor(options.actingFor)
  const actorResolver = resolveActor(options.appIdentity)
  const principalArgs: PropertyValidators = {
    ...identityForwardingValidators,
    ...buildObservationEnvelopeValidators(),
  }

  return {
    args: principalArgs,
    input: async (ctx, args, extra) => {
      const { baseCtx, ctxWithIdentityForwarding } = await createContextWithRuntime(
        ctx,
        args,
        options,
        callerDefinition,
        delegationDefinition,
        actorResolver,
        extra,
      )
      const { dbRules, crossTenantRules, serviceAccess } = await resolveRules(
        baseCtx,
        args,
        options,
      )
      const rawDb = ctx.db
      const serviceDb = wrapServiceDb(rawDb, serviceAccess, baseCtx.observe)
      const scopedDb = dbRules ? wrapDatabaseWriter(baseCtx, serviceDb, dbRules) : serviceDb
      let db = extra.trellisBackendLane === 'public' ? createPublicSafeDb(scopedDb, []) : scopedDb
      let crossTenantDb = crossTenantRules
        ? wrapDatabaseWriter(baseCtx, serviceDb, crossTenantRules)
        : serviceDb

      if (options.triggers) {
        db = options.triggers.wrapDB({
          ...(baseCtx as unknown as MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>),
          db,
        }).db
        crossTenantDb = options.triggers.wrapDB({
          ...(baseCtx as unknown as MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>),
          db: crossTenantDb,
        }).db
      }

      const crossTenant = await resolveCrossTenantCapability({
        capability: extra.crossTenant,
        ctx: baseCtx,
        args: stripTransportReservedArgs(args),
        db: crossTenantDb,
        observe: baseCtx.observe,
        operationMetadata: extra[trellisOperationMetadataKey],
      })
      const publicWrite = await resolvePublicWriteCapability({
        capability: extra.publicWrite,
        ctx: baseCtx,
        args: stripTransportReservedArgs(args),
        db: crossTenantDb,
        observe: baseCtx.observe,
        lane: extra.trellisBackendLane,
        operationMetadata: extra[trellisOperationMetadataKey],
      })
      const finalCtx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor> = {
        ...(baseCtx as unknown as MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>),
        db: decorateDb(db, rawDb),
        ...(crossTenant === undefined ? {} : { crossTenant }),
        ...(publicWrite === undefined ? {} : { publicWrite }),
      }
      const replayClaim = await claimTrustedReplayJti(ctx, ctxWithIdentityForwarding, options)

      return {
        ctx: finalCtx,
        args: {},
        onSuccess: createReplayAwareOnSuccess(
          ctx,
          replayClaim,
          createOnSuccessHandler(options.onSuccess?.mutation, finalCtx),
        ),
        onError: createReplayAwareOnError(ctx, replayClaim),
      }
    },
  }
}

function createActionCustomization<
  DataModel extends GenericDataModel,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
): Customization<
  GenericActionCtx<DataModel>,
  PropertyValidators,
  ActionCustomizationCtx<DataModel, TCaller, TActingFor, TActor>,
  Record<string, never>,
  IdentityForwardingCustomizationExtra
> {
  const callerDefinition = resolveCaller(options.caller)
  const delegationDefinition = resolveActingFor(options.actingFor)
  const actorResolver = resolveActor(options.appIdentity)
  const principalArgs: PropertyValidators = {
    ...identityForwardingValidators,
    ...buildObservationEnvelopeValidators(),
  }

  return {
    args: principalArgs,
    input: async (ctx, args, extra) => {
      const { baseCtx, ctxWithIdentityForwarding } = await createContextWithRuntime(
        ctx,
        args,
        options,
        callerDefinition,
        delegationDefinition,
        actorResolver,
        extra,
      )
      const finalCtx = baseCtx as unknown as ActionCtxWithRuntime<
        DataModel,
        TCaller,
        TActingFor,
        TActor
      >
      const replayClaim = await claimTrustedReplayJti(ctx, ctxWithIdentityForwarding, options)

      return {
        ctx: finalCtx,
        args: {},
        onSuccess: createReplayAwareOnSuccess(
          ctx,
          replayClaim,
          createOnSuccessHandler(options.onSuccess?.action, finalCtx),
        ),
        onError: createReplayAwareOnError(ctx, replayClaim),
      }
    },
  }
}

type CustomFunctionDefinition = {
  args?: PropertyValidators
  returns?: PropertyValidators | GenericValidator
  handler?: (ctx: unknown, args: Record<string, unknown>) => unknown
  [key: string]: unknown
}

type FullArgsCustomizationResult<
  TCtx,
  TCustomCtx extends object,
  TCustomArgs extends Record<string, unknown>,
> = {
  ctx: TCustomCtx
  args: TCustomArgs
  onSuccess?: (obj: {
    ctx: TCtx
    args: Record<string, unknown>
    result: unknown
  }) => void | Promise<void>
  onError?: (obj: {
    ctx: TCtx
    args: Record<string, unknown>
    error: unknown
  }) => void | Promise<void>
}

type FullArgsCustomization<
  TCtx,
  TCustomCtx extends object,
  TCustomArgs extends Record<string, unknown>,
  TExtra extends object,
> = {
  args?: PropertyValidators
  input?: (
    ctx: TCtx,
    args: Record<string, unknown>,
    extra: TExtra,
  ) =>
    | Promise<FullArgsCustomizationResult<TCtx, TCustomCtx, TCustomArgs>>
    | FullArgsCustomizationResult<TCtx, TCustomCtx, TCustomArgs>
}

function omitKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const omitted = new Set(keys)
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)))
}

function createFullArgsCustomBuilder<
  TBuilder extends (...args: never[]) => unknown,
  TCtx,
  TCustomCtx extends object,
  TCustomArgs extends Record<string, unknown>,
  TExtra extends object,
>(
  builder: TBuilder,
  customization: FullArgsCustomization<TCtx, TCustomCtx, TCustomArgs, TExtra>,
): TBuilder {
  const inputArgs = customization.args ?? {}
  const inputKeys = Object.keys(inputArgs)
  const customInput: NonNullable<
    FullArgsCustomization<TCtx, TCustomCtx, TCustomArgs, TExtra>['input']
  > =
    customization.input ??
    (async () =>
      ({ ctx: {}, args: {} }) as FullArgsCustomizationResult<TCtx, TCustomCtx, TCustomArgs>)

  return ((definition: CustomFunctionDefinition) => {
    const { args, handler = definition as unknown, returns, ...extra } = definition
    if (!args) {
      if (inputKeys.length > 0) {
        throw new Error(
          'If you are using a custom function with arguments for the input customization, you must declare the arguments for the function too.',
        )
      }

      return (builder as unknown as (definition: CustomFunctionDefinition) => unknown)({
        returns,
        handler: async (ctx: unknown, rawArgs: Record<string, unknown>) => {
          const added = await customInput(ctx as TCtx, rawArgs, extra as TExtra)
          const baseCtx =
            (extra as IdentityForwardingCustomizationExtra).trellisBackendLane === 'session'
              ? omitDb(ctx as { db?: unknown })
              : (ctx as object)
          const finalCtx = { ...baseCtx, ...added.ctx }
          const finalArgs = { ...rawArgs, ...added.args }
          try {
            const result = await (
              handler as (ctx: unknown, args: Record<string, unknown>) => unknown
            )(finalCtx, finalArgs)
            if (added.onSuccess) {
              await added.onSuccess({ ctx: ctx as TCtx, args: rawArgs, result })
            }
            return result
          } catch (error) {
            if (added.onError) {
              await added.onError({ ctx: ctx as TCtx, args: rawArgs, error })
            }
            throw error
          }
        },
      })
    }

    return (builder as unknown as (definition: CustomFunctionDefinition) => unknown)({
      args: addFieldsToValidator(args, inputArgs) as unknown as PropertyValidators,
      returns,
      handler: async (ctx: unknown, allArgs: Record<string, unknown>) => {
        const added = await customInput(ctx as TCtx, allArgs, extra as TExtra)
        const appArgs = omitKeys(allArgs, inputKeys)
        const baseCtx =
          (extra as IdentityForwardingCustomizationExtra).trellisBackendLane === 'session'
            ? omitDb(ctx as { db?: unknown })
            : (ctx as object)
        const finalCtx = { ...baseCtx, ...added.ctx }
        const finalArgs = { ...appArgs, ...added.args }
        try {
          const result = await (
            handler as (ctx: unknown, args: Record<string, unknown>) => unknown
          )(finalCtx, finalArgs)
          if (added.onSuccess) {
            await added.onSuccess({ ctx: ctx as TCtx, args: appArgs, result })
          }
          return result
        } catch (error) {
          if (added.onError) {
            await added.onError({ ctx: ctx as TCtx, args: appArgs, error })
          }
          throw error
        }
      },
    })
  }) as unknown as TBuilder
}

type ExplicitUnsafeRuntime<
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  InternalQueryVisibility extends FunctionVisibility,
  InternalMutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
> = {
  query: UnsafeBuilder<QueryBuilder<DataModel, QueryVisibility>>
  mutation: UnsafeBuilder<MutationBuilder<DataModel, MutationVisibility>>
  action?: UnsafeBuilder<ActionBuilder<DataModel, ActionVisibility>>
  internalQuery?: UnsafeBuilder<QueryBuilder<DataModel, InternalQueryVisibility>>
  internalMutation?: UnsafeBuilder<MutationBuilder<DataModel, InternalMutationVisibility>>
}

type ForwardingBuilderRuntime<
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  InternalQueryVisibility extends FunctionVisibility,
  InternalMutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
> = {
  query: QueryBuilder<DataModel, QueryVisibility>
  mutation: MutationBuilder<DataModel, MutationVisibility>
  action?: ActionBuilder<DataModel, ActionVisibility>
  internal: {
    query?: QueryBuilder<DataModel, InternalQueryVisibility>
    mutation?: MutationBuilder<DataModel, InternalMutationVisibility>
  }
}

type QueryWithBackendLanes<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = {
  public: PublicStructuredQueryBuilder<
    PublicQueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor,
    TableNamesInDataModel<DataModel>
  >
  session: SessionStructuredQueryBuilder<
    SessionQueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  authenticated: AuthenticatedStructuredQueryBuilder<
    QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  workspace: AuthenticatedStructuredQueryBuilder<
    QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  protected: StructuredQueryBuilder<
    QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  unsafe: UnsafeBuilder<QueryBuilder<DataModel, Visibility>>
}

type MutationWithBackendLanes<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = {
  public: PublicStructuredMutationBuilder<
    PublicMutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  authenticated: AuthenticatedStructuredMutationBuilder<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  workspace: AuthenticatedStructuredMutationBuilder<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  protected: StructuredMutationBuilder<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  unsafe: UnsafeBuilder<MutationBuilder<DataModel, Visibility>>
}

type ActionWithBackendLanes<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = {
  public: PublicStructuredActionBuilder<
    ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  authenticated: AuthenticatedStructuredActionBuilder<
    ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  workspace: AuthenticatedStructuredActionBuilder<
    ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  protected: StructuredActionBuilder<
    ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
  unsafe: UnsafeBuilder<ActionBuilder<DataModel, Visibility>>
}

type TrellisBackendRuntime<
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  InternalQueryVisibility extends FunctionVisibility,
  InternalMutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
> = {
  query: QueryWithBackendLanes<DataModel, QueryVisibility, TCaller, TActingFor, TActor>
  mutation: MutationWithBackendLanes<DataModel, MutationVisibility, TCaller, TActingFor, TActor>
  transportMutation: TransportMutationWithBackendLanes<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    MutationVisibility,
    TActor
  >
  action?: ActionWithBackendLanes<DataModel, ActionVisibility, TCaller, TActingFor, TActor>
  internalQuery?: QueryWithBackendLanes<
    DataModel,
    InternalQueryVisibility,
    TCaller,
    TActingFor,
    TActor
  >
  internalMutation?: MutationWithBackendLanes<
    DataModel,
    InternalMutationVisibility,
    TCaller,
    TActingFor,
    TActor
  >
  internalTransportMutation?: TransportMutationWithBackendLanes<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    InternalMutationVisibility,
    TActor
  >
  unsafe: ExplicitUnsafeRuntime<
    DataModel,
    QueryVisibility,
    MutationVisibility,
    InternalQueryVisibility,
    InternalMutationVisibility,
    ActionVisibility
  >
}

function buildUnsafeFunctions<
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  InternalQueryVisibility extends FunctionVisibility,
  InternalMutationVisibility extends FunctionVisibility,
  ActionVisibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor = ActingFor,
  TActor = DefaultAppIdentity,
>(
  builders: AppBuilders<
    DataModel,
    QueryVisibility,
    MutationVisibility,
    InternalQueryVisibility,
    InternalMutationVisibility,
    ActionVisibility
  >,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor> = {},
): ForwardingBuilderRuntime<
  DataModel,
  QueryVisibility,
  MutationVisibility,
  InternalQueryVisibility,
  InternalMutationVisibility,
  ActionVisibility
> {
  rejectRemovedCustomRlsOption(options)
  validateIsolationOptions(options.isolation)

  if (!!builders.internalQuery !== !!builders.internalMutation) {
    throw new Error(
      'defineTrellis(...) requires both internalQuery and internalMutation when either internal builder is provided.',
    )
  }

  const queryCustomization = createQueryCustomization(options)
  const mutationCustomization = createMutationCustomization(options)
  const actionCustomization = createActionCustomization(options)

  const unsafeQuery = createFullArgsCustomBuilder(builders.query, queryCustomization)
  const unsafeMutation = createFullArgsCustomBuilder(builders.mutation, mutationCustomization)
  const unsafeAction = builders.action
    ? createFullArgsCustomBuilder(builders.action, actionCustomization)
    : undefined
  const unsafeInternalQuery = builders.internalQuery
    ? createFullArgsCustomBuilder(builders.internalQuery, queryCustomization)
    : undefined
  const unsafeInternalMutation = builders.internalMutation
    ? createFullArgsCustomBuilder(builders.internalMutation, mutationCustomization)
    : undefined

  return {
    query: unsafeQuery,
    mutation: unsafeMutation,
    action: unsafeAction,
    internal: {
      query: unsafeInternalQuery,
      mutation: unsafeInternalMutation,
    },
  }
}

function buildStructuredQueryRuntime<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  builder: unknown,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
): StructuredQueryBuilder<
  QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
  Visibility,
  TActor
> {
  const structured = buildStructuredBuilder<
    QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    TCaller,
    TActingFor,
    TActor,
    never
  >(builder as never)

  return ((definition) => {
    const metadata = getOperationMetadata(definition as never)
    const projectionMetadata = getOperationProjectionMetadata(definition as never)
    if (metadata.kind !== 'destructive' || projectionMetadata?.projection !== 'preview') {
      return structured(definition as never)
    }

    if (!metadata.id) {
      throw new Error('query(previewOf(op)) requires `operation.id` for destructive operations.')
    }

    if (options.destructiveOperations?.previewConfirmation) {
      throw new Error(
        `query(previewOf(op)) for destructive operation "${metadata.id}" cannot issue confirmation tokens. Register the preview with mutation(previewOf(op)) so Trellis can store confirmation state.`,
      )
    }

    const originalHandler = definition.handler as (
      ctx: QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      args: Record<string, unknown>,
      loaded: unknown,
    ) => Promise<unknown> | unknown

    const transformed = {
      ...definition,
      handler: async (
        ctx: QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
        args: Record<string, unknown>,
        loaded: unknown,
      ) => {
        const previewResult = await originalHandler(ctx, args, loaded)
        return await attachDestructivePreviewConfirmation({
          ctx,
          args,
          loaded,
          metadata,
          projectionMetadata,
          definition,
          previewResult,
          options,
        })
      },
    }

    return structured(transformed as never)
  }) as StructuredQueryBuilder<
    QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
}

function buildStructuredMutationRuntime<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  builder: unknown,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor>,
): StructuredMutationBuilder<
  MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
  Visibility,
  TActor
> {
  const structured = buildStructuredBuilder<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    TCaller,
    TActingFor,
    TActor,
    never
  >(builder as never)

  return ((definition) => {
    const metadata = getOperationMetadata(definition as never)
    const projectionMetadata = getOperationProjectionMetadata(definition as never)
    if (metadata.kind !== 'destructive') {
      return structured(definition as never)
    }

    if (!metadata.id) {
      throw new Error('mutation(op) requires `operation.id` for destructive operations.')
    }
    const operationId = metadata.id

    if (projectionMetadata?.projection === 'preview') {
      const originalHandler = definition.handler as (
        ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
        args: Record<string, unknown>,
        loaded: unknown,
      ) => Promise<unknown> | unknown

      const transformed = {
        ...definition,
        handler: async (
          ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          args: Record<string, unknown>,
          loaded: unknown,
        ) => {
          const previewResult = await originalHandler(ctx, args, loaded)
          return await attachDestructivePreviewConfirmation({
            ctx,
            args,
            loaded,
            metadata,
            projectionMetadata,
            definition,
            previewResult,
            options,
          })
        },
      }

      return structured(transformed as never)
    }

    if (!('preview' in definition) || typeof definition.preview !== 'function') {
      throw new Error(
        `mutation(op) for destructive operation "${metadata.id}" requires preview(...) so Trellis can bind confirmation to previewed state.`,
      )
    }

    if (!options.destructiveOperations) {
      throw new Error(
        `defineTrellis({ destructiveOperations }) is required before registering destructive operation "${metadata.id}".`,
      )
    }

    const preview = (
      definition as {
        preview: (
          ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          args: Record<string, unknown>,
          loaded: unknown,
        ) => Promise<unknown> | unknown
      }
    ).preview
    const originalLoad = definition.load as
      | ((
          ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          args: Record<string, unknown>,
        ) => Promise<unknown> | unknown)
      | undefined
    const originalAuthorize = definition.authorize as
      | {
          label?: string
          check: (
            appIdentity: unknown,
            loaded: unknown,
            args: unknown,
            ctx: unknown,
          ) => Promise<unknown> | unknown
        }
      | undefined
    const originalHandler = definition.handler as (
      ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      args: Record<string, unknown>,
      loaded: unknown,
    ) => Promise<unknown> | unknown
    const safety = options.destructiveOperations

    const transformed = {
      ...definition,
      ...(getExecuteFunctionRef(definition)
        ? {
            identityForwardingFunctionRef: getExecuteFunctionRef(definition)!,
          }
        : projectionMetadata?.functionRef
          ? { identityForwardingFunctionRef: projectionMetadata.functionRef }
          : definition.id
            ? { identityForwardingFunctionRef: definition.id }
            : {}),
      ...(definition.identityForwardingTransport
        ? { identityForwardingTransport: definition.identityForwardingTransport }
        : {}),
      args: {
        ...definition.args,
        _confirmationToken: v.optional(v.string()),
      },
      load: originalLoad
        ? async (
            ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
            rawArgs: Record<string, unknown>,
          ) => {
            if (getConfirmationToken(rawArgs)) {
              return undefined
            }

            return await originalLoad(ctx, stripConfirmationToken(rawArgs))
          }
        : undefined,
      authorize: originalAuthorize
        ? {
            ...originalAuthorize,
            check: async (
              appIdentity: unknown,
              loaded: unknown,
              rawArgs: Record<string, unknown>,
              ctx: unknown,
            ) => {
              if (getConfirmationToken(rawArgs)) {
                return true
              }

              return await originalAuthorize.check(
                appIdentity,
                loaded,
                stripConfirmationToken(rawArgs),
                ctx,
              )
            },
          }
        : undefined,
      handler: async (
        ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
        rawArgs: Record<string, unknown>,
        _loaded: unknown,
      ) => {
        const confirmationToken = getConfirmationToken(rawArgs)
        const executeArgs = stripConfirmationToken(rawArgs)

        if (!confirmationToken) {
          await ctx.observe({
            name: 'operation.confirm.missing',
            status: 'deny',
            operation: operationId,
            reasonCode: 'tool.confirmation_mismatch',
            details: {
              explanation: createDenialExplanation({
                reasonCode: 'tool.confirmation_mismatch',
                decision: 'destructive_confirm',
                message: 'Destructive operation execution requires a confirmation token.',
                suggestedAction: 'retry_with_confirmation',
              }),
            },
          })
          throw new Error(
            'Destructive operation requires confirmation. Preview again before executing.',
          )
        }

        await ctx.observe({
          name: 'operation.preview.started',
          status: 'success',
          operation: operationId,
        })

        const confirmationOptions = safety.previewConfirmation
        if (!confirmationOptions) {
          throw new TypeError(
            `Destructive operation "${operationId}" requires defineTrellis({ destructiveOperations.previewConfirmation }) to redeem stored confirmation tokens.`,
          )
        }

        const unsafeDb = getDestructiveOperationsDb<DataModel>(
          getInternalUnsafeDb(ctx.db) ?? ctx.db,
          operationId,
          safety,
        )

        const tokenHash = await hashConfirmationToken(confirmationToken)
        let payload: StoredToolConfirmationRow | null
        try {
          payload = normalizeStoredConfirmationPayload(
            await unsafeDb
              .query(safety.confirmationTable)
              .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
              .unique(),
          )
        } catch (error) {
          throw toDestructiveOperationsError(error, operationId, safety)
        }

        if (!payload || payload.expiresAt <= Date.now()) {
          throw confirmationTokenInvalidError()
        }
        if (typeof payload.redeemedAt === 'number') {
          throw new TypeError('Confirmation token has already been redeemed.')
        }
        if (payload.operationId !== operationId) {
          throw new Error(
            `Confirmation token targets operation "${payload.operationId}", not "${operationId}".`,
          )
        }
        const executePath = getExecuteFunctionRef(definition) ?? projectionMetadata?.functionRef
        if (executePath && payload.executePath !== executePath) {
          throw new Error(
            `Confirmation token targets execute path "${payload.executePath}", not "${executePath}".`,
          )
        }
        const forwardingEnvelope = getIdentityForwardingEnvelopeState(ctx)
        if (
          forwardingEnvelope?.purpose === 'operation-execute' &&
          typeof forwardingEnvelope.jti === 'string' &&
          forwardingEnvelope.jti !== payload.jti
        ) {
          throw new Error(
            'Identity forwarding operation-execute envelope does not match the confirmation token.',
          )
        }

        const argsHash = await hashConfirmationValue(executeArgs)
        if (payload.argsHash !== argsHash) {
          await ctx.observe({
            name: 'operation.confirm.drifted',
            status: 'deny',
            operation: operationId,
            reasonCode: 'tool.confirmation_mismatch',
            details: {
              cause: 'args_mismatch',
              explanation: createDenialExplanation({
                reasonCode: 'tool.confirmation_mismatch',
                decision: 'destructive_confirm',
                message: 'Confirmation token no longer matches the destructive request arguments.',
                suggestedAction: 'retry_with_confirmation',
              }),
            },
          })
          throw new Error(
            'Confirmation token no longer matches this destructive request. Preview again before executing.',
          )
        }

        const freshLoaded = originalLoad ? await originalLoad(ctx, executeArgs) : undefined

        if (originalAuthorize) {
          const appIdentity = await ctx.appIdentity()
          const authorization = await originalAuthorize.check(
            appIdentity,
            freshLoaded,
            executeArgs,
            ctx,
          )
          if (!can(appIdentity, authorization as never)) {
            deny(`Forbidden: ${originalAuthorize.label ?? 'Access denied'}`)
          }
        }

        const [callerKey, scopeKey] = await Promise.all([
          confirmationOptions.callerKey(ctx, executeArgs, freshLoaded),
          confirmationOptions.scopeKey(ctx, executeArgs, freshLoaded),
        ])
        assertStoredConfirmationMatches({
          payload,
          metadata,
          executePath,
          callerKey,
          scopeKey,
        })

        const previewResult = await preview(ctx, executeArgs, freshLoaded)
        if (!isDestructivePreviewPayload(previewResult)) {
          throw new Error(
            `Destructive operation "${operationId}" preview must return an OperationPreviewEnvelope with allowed, summary, blockers, warnings, effects, and a non-empty plain-object confirm payload.`,
          )
        }
        await ctx.observe({
          name: 'operation.preview.completed',
          status: 'success',
          operation: operationId,
        })

        if (previewResult.allowed === false || previewResult.blockers.length > 0) {
          await ctx.observe({
            name: 'operation.confirm.drifted',
            status: 'deny',
            operation: operationId,
            reasonCode: 'tool.confirmation_mismatch',
            details: {
              cause: 'preview_blocked',
              explanation: createDenialExplanation({
                reasonCode: 'tool.confirmation_mismatch',
                decision: 'destructive_confirm',
                message: 'Previewed state is now blocked and can no longer be executed.',
                suggestedAction: 'retry_with_confirmation',
              }),
            },
          })
          throw new Error('Previewed state is blocked and can no longer be executed.')
        }

        const previewHash = await hashConfirmationValue(previewResult.confirm)
        if (payload.previewHash !== previewHash) {
          await ctx.observe({
            name: 'operation.confirm.drifted',
            status: 'deny',
            operation: operationId,
            reasonCode: 'tool.confirmation_mismatch',
            details: {
              cause: 'preview_mismatch',
              explanation: createDenialExplanation({
                reasonCode: 'tool.confirmation_mismatch',
                decision: 'destructive_confirm',
                message: 'Previewed state changed before confirmation completed.',
                suggestedAction: 'retry_with_confirmation',
              }),
            },
          })
          throw new Error(
            'Previewed state changed before confirmation. Preview again before executing.',
          )
        }
        if ((payload.versionHash ?? null) !== (await hashPreviewVersion(previewResult.version))) {
          await ctx.observe({
            name: 'operation.confirm.drifted',
            status: 'deny',
            operation: operationId,
            reasonCode: 'tool.confirmation_mismatch',
            details: {
              cause: 'preview_version_mismatch',
              explanation: createDenialExplanation({
                reasonCode: 'tool.confirmation_mismatch',
                decision: 'destructive_confirm',
                message: 'Preview version changed before confirmation completed.',
                suggestedAction: 'retry_with_confirmation',
              }),
            },
          })
          throw new Error(
            'Preview version changed before confirmation. Preview again before executing.',
          )
        }
        await ctx.observe({
          name: 'operation.confirm.validated',
          status: 'success',
          operation: operationId,
        })

        const now = Date.now()
        try {
          await unsafeDb.patch(getStoredConfirmationId(payload), { redeemedAt: now })
        } catch (error) {
          throw toDestructiveOperationsError(error, operationId, safety)
        }

        try {
          const result = await originalHandler(ctx, executeArgs, freshLoaded)

          try {
            await unsafeDb.insert(safety.auditTable, {
              operationId: payload.operationId,
              jti: payload.jti,
              callerKey: payload.callerKey,
              scopeKey: payload.scopeKey,
              argsHash,
              previewHash,
              executedAt: now,
              executePath: payload.executePath,
            })
          } catch (error) {
            throw toDestructiveOperationsError(error, operationId, safety)
          }

          await ctx.observe({
            name: 'operation.execute.completed',
            status: 'success',
            operation: operationId,
          })

          return result
        } catch (error) {
          await ctx.observe({
            name: 'operation.execute.failed',
            status: 'error',
            operation: operationId,
            reasonCode: 'operation.execute.failed',
            details:
              error instanceof Error
                ? {
                    message: error.message,
                    explanation: createDenialExplanation({
                      reasonCode: 'operation.execute.failed',
                      decision: 'destructive_confirm',
                      message: error.message,
                      suggestedAction: 'contact_admin',
                    }),
                  }
                : undefined,
          })
          throw error
        }
      },
    }

    return structured(transformed as never)
  }) as StructuredMutationBuilder<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
}

function buildStructuredTransportMutationRuntime<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
  TCaller,
  TActingFor extends ActingFor,
  TActor,
>(
  builder: unknown,
): TransportMutationWithBackendLanes<
  MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
  Visibility,
  TActor
> {
  const structured = buildStructuredBuilder<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    TCaller,
    TActingFor,
    TActor,
    never
  >(builder as never)

  const transportMutation = ((definition) => {
    const metadata = getOperationMetadata(definition as never)
    const projectionMetadata = getOperationProjectionMetadata(definition as never)
    if (metadata.kind !== 'destructive') {
      return structured(definition as never)
    }

    if (!metadata.id) {
      throw new Error('transportMutation(op) requires `operation.id` for destructive operations.')
    }
    const operationId = metadata.id

    const originalLoad = definition.load as
      | ((
          ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          args: Record<string, unknown>,
        ) => Promise<unknown> | unknown)
      | undefined
    const originalAuthorize = definition.authorize as
      | {
          label?: string
          check: (
            appIdentity: unknown,
            loaded: unknown,
            args: unknown,
            ctx: unknown,
          ) => Promise<unknown> | unknown
        }
      | undefined
    const originalHandler = definition.handler as (
      ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      args: Record<string, unknown>,
      loaded: unknown,
    ) => Promise<unknown> | unknown

    const transformed = {
      ...definition,
      ...(getExecuteFunctionRef(definition)
        ? {
            identityForwardingFunctionRef: getExecuteFunctionRef(definition)!,
          }
        : projectionMetadata?.functionRef
          ? { identityForwardingFunctionRef: projectionMetadata.functionRef }
          : definition.id
            ? { identityForwardingFunctionRef: definition.id }
            : {}),
      ...(definition.identityForwardingTransport
        ? { identityForwardingTransport: definition.identityForwardingTransport }
        : {}),
      load: originalLoad
        ? async (
            ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
            rawArgs: Record<string, unknown>,
          ) => await originalLoad(ctx, stripConfirmationToken(rawArgs))
        : undefined,
      authorize: originalAuthorize
        ? {
            ...originalAuthorize,
            check: async (
              appIdentity: unknown,
              loaded: unknown,
              rawArgs: Record<string, unknown>,
              ctx: unknown,
            ) =>
              await originalAuthorize.check(
                appIdentity,
                loaded,
                stripConfirmationToken(rawArgs),
                ctx,
              ),
          }
        : undefined,
      handler: async (
        ctx: MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
        rawArgs: Record<string, unknown>,
        loaded: unknown,
      ) => {
        const forwardingEnvelope = getIdentityForwardingEnvelopeState(ctx)
        if (
          forwardingEnvelope?.purpose !== 'operation-execute' ||
          typeof forwardingEnvelope.jti !== 'string' ||
          forwardingEnvelope.jti.length === 0
        ) {
          throw new Error(
            'Destructive transport mutation requires a trusted operation-execute forwarding envelope.',
          )
        }

        const executeArgs = stripConfirmationToken(rawArgs)

        try {
          const result = await originalHandler(ctx, executeArgs, loaded)
          await ctx.observe({
            name: 'operation.execute.completed',
            status: 'success',
            operation: operationId,
            transport: 'mcp',
          })
          return result
        } catch (error) {
          await ctx.observe({
            name: 'operation.execute.failed',
            status: 'error',
            operation: operationId,
            transport: 'mcp',
            reasonCode: 'operation.execute.failed',
            details:
              error instanceof Error
                ? {
                    message: error.message,
                    explanation: createDenialExplanation({
                      reasonCode: 'operation.execute.failed',
                      decision: 'destructive_confirm',
                      message: error.message,
                      suggestedAction: 'contact_admin',
                    }),
                  }
                : undefined,
          })
          throw error
        }
      },
    }

    return structured(transformed as never)
  }) as StructuredTransportMutationBuilder<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >

  return Object.assign(transportMutation, {
    authenticated: createAuthenticatedLaneBuilder(transportMutation as never),
  }) as TransportMutationWithBackendLanes<
    MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
    Visibility,
    TActor
  >
}

function buildTrellisRuntime<
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  InternalQueryVisibility extends FunctionVisibility = 'internal',
  InternalMutationVisibility extends FunctionVisibility = 'internal',
  TCaller = DefaultCaller,
  TActingFor extends ActingFor = ActingFor,
  TActor = DefaultAppIdentity,
  ActionVisibility extends FunctionVisibility = 'public',
>(
  builders: AppBuilders<
    DataModel,
    QueryVisibility,
    MutationVisibility,
    InternalQueryVisibility,
    InternalMutationVisibility,
    ActionVisibility
  >,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor> = {},
) {
  const unsafe = buildUnsafeFunctions(builders, options)
  const structured = {
    query: buildStructuredQueryRuntime<DataModel, QueryVisibility, TCaller, TActingFor, TActor>(
      unsafe.query,
      options,
    ),
    mutation: buildStructuredMutationRuntime<
      DataModel,
      MutationVisibility,
      TCaller,
      TActingFor,
      TActor
    >(unsafe.mutation, options),
    transportMutation: buildStructuredTransportMutationRuntime<
      DataModel,
      MutationVisibility,
      TCaller,
      TActingFor,
      TActor
    >(unsafe.mutation),
  }

  const structuredInternal =
    unsafe.internal.query && unsafe.internal.mutation
      ? {
          query: buildStructuredQueryRuntime<
            DataModel,
            InternalQueryVisibility,
            TCaller,
            TActingFor,
            TActor
          >(unsafe.internal.query, options),
          mutation: buildStructuredMutationRuntime<
            DataModel,
            InternalMutationVisibility,
            TCaller,
            TActingFor,
            TActor
          >(unsafe.internal.mutation, options),
          transportMutation: buildStructuredTransportMutationRuntime<
            DataModel,
            InternalMutationVisibility,
            TCaller,
            TActingFor,
            TActor
          >(unsafe.internal.mutation),
        }
      : undefined

  const action = unsafe.action
    ? (buildStructuredBuilder<
        ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
        TCaller,
        TActingFor,
        TActor,
        typeof unsafe.action
      >(unsafe.action) as StructuredActionBuilder<
        ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
        ActionVisibility,
        TActor
      >)
    : undefined

  const explicitUnsafe = {
    query: wrapUnsafeBuilder(unsafe.query, 'unsafe.query'),
    mutation: wrapUnsafeBuilder(unsafe.mutation, 'unsafe.mutation'),
    ...(unsafe.action ? { action: wrapUnsafeBuilder(unsafe.action, 'unsafe.action') } : {}),
    ...(unsafe.internal.query
      ? {
          internalQuery: wrapUnsafeBuilder(unsafe.internal.query, 'unsafe.internalQuery'),
        }
      : {}),
    ...(unsafe.internal.mutation
      ? {
          internalMutation: wrapUnsafeBuilder(unsafe.internal.mutation, 'unsafe.internalMutation'),
        }
      : {}),
  }

  const queryWithLanes = attachBackendQueryLanes(
    structured.query as never,
    explicitUnsafe.query as never,
  ) as unknown as {
    public: PublicStructuredQueryBuilder<
      PublicQueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      QueryVisibility,
      TActor,
      TableNamesInDataModel<DataModel>
    >
    session: SessionStructuredQueryBuilder<
      SessionQueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      QueryVisibility,
      TActor
    >
    authenticated: AuthenticatedStructuredQueryBuilder<
      QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      QueryVisibility,
      TActor
    >
    workspace: AuthenticatedStructuredQueryBuilder<
      QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      QueryVisibility,
      TActor
    >
    protected: typeof structured.query
    unsafe: typeof explicitUnsafe.query
  }
  const mutationWithLanes = attachBackendQueryLanes(
    structured.mutation as never,
    explicitUnsafe.mutation as never,
  ) as unknown as {
    public: PublicStructuredMutationBuilder<
      PublicMutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      MutationVisibility,
      TActor
    >
    authenticated: AuthenticatedStructuredMutationBuilder<
      MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      MutationVisibility,
      TActor
    >
    workspace: AuthenticatedStructuredMutationBuilder<
      MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
      MutationVisibility,
      TActor
    >
    protected: typeof structured.mutation
    unsafe: typeof explicitUnsafe.mutation
  }
  const internalQueryWithLanes = structuredInternal?.query
    ? (attachBackendQueryLanes(
        structuredInternal.query as never,
        explicitUnsafe.internalQuery as never,
      ) as unknown as {
        public: PublicStructuredQueryBuilder<
          PublicQueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          InternalQueryVisibility,
          TActor,
          TableNamesInDataModel<DataModel>
        >
        session: SessionStructuredQueryBuilder<
          SessionQueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          InternalQueryVisibility,
          TActor
        >
        authenticated: AuthenticatedStructuredQueryBuilder<
          QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          InternalQueryVisibility,
          TActor
        >
        workspace: AuthenticatedStructuredQueryBuilder<
          QueryCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          InternalQueryVisibility,
          TActor
        >
        protected: typeof structuredInternal.query
        unsafe: NonNullable<typeof explicitUnsafe.internalQuery>
      })
    : undefined
  const internalMutationWithLanes = structuredInternal?.mutation
    ? (attachBackendQueryLanes(
        structuredInternal.mutation as never,
        explicitUnsafe.internalMutation as never,
      ) as unknown as {
        public: PublicStructuredMutationBuilder<
          PublicMutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          InternalMutationVisibility,
          TActor
        >
        authenticated: AuthenticatedStructuredMutationBuilder<
          MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          InternalMutationVisibility,
          TActor
        >
        workspace: AuthenticatedStructuredMutationBuilder<
          MutationCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
          InternalMutationVisibility,
          TActor
        >
        protected: typeof structuredInternal.mutation
        unsafe: NonNullable<typeof explicitUnsafe.internalMutation>
      })
    : undefined
  const actionWithLanes =
    action && explicitUnsafe.action
      ? (attachBackendQueryLanes(action as never, explicitUnsafe.action as never) as unknown as {
          public: PublicStructuredActionBuilder<
            ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
            ActionVisibility,
            TActor
          >
          authenticated: AuthenticatedStructuredActionBuilder<
            ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
            ActionVisibility,
            TActor
          >
          workspace: AuthenticatedStructuredActionBuilder<
            ActionCtxWithRuntime<DataModel, TCaller, TActingFor, TActor>,
            ActionVisibility,
            TActor
          >
          protected: typeof action
          unsafe: typeof explicitUnsafe.action
        })
      : undefined

  return {
    query: queryWithLanes,
    mutation: mutationWithLanes,
    transportMutation: structured.transportMutation,
    ...(actionWithLanes ? { action: actionWithLanes } : {}),
    ...(structuredInternal && internalQueryWithLanes && internalMutationWithLanes
      ? {
          internalQuery: internalQueryWithLanes,
          internalMutation: internalMutationWithLanes,
          internalTransportMutation: structuredInternal.transportMutation,
        }
      : {}),
    unsafe: explicitUnsafe,
  }
}

/**
 * Build the protected Trellis backend runtime for a caller-first app.
 *
 * This is the canonical backend seam for Trellis apps. It exposes the protected
 * builders directly and keeps unsafe builder access as an explicit escape hatch.
 */
export function defineTrellis<
  DataModel extends GenericDataModel,
  QueryVisibility extends FunctionVisibility,
  MutationVisibility extends FunctionVisibility,
  InternalQueryVisibility extends FunctionVisibility = 'internal',
  InternalMutationVisibility extends FunctionVisibility = 'internal',
  TCaller = DefaultCaller,
  TActingFor extends ActingFor = ActingFor,
  TActor = DefaultAppIdentity,
  ActionVisibility extends FunctionVisibility = 'public',
>(
  builders: AppBuilders<
    DataModel,
    QueryVisibility,
    MutationVisibility,
    InternalQueryVisibility,
    InternalMutationVisibility,
    ActionVisibility
  >,
  options: DefineTrellisOptions<DataModel, TCaller, TActingFor, TActor> = {},
): TrellisBackendRuntime<
  DataModel,
  QueryVisibility,
  MutationVisibility,
  InternalQueryVisibility,
  InternalMutationVisibility,
  ActionVisibility,
  TCaller,
  TActingFor,
  TActor
> {
  const runtime = buildTrellisRuntime(builders, options)

  return {
    query: runtime.query,
    mutation: runtime.mutation,
    transportMutation: runtime.transportMutation,
    ...(runtime.action ? { action: runtime.action } : {}),
    ...(runtime.internalQuery
      ? {
          internalQuery: runtime.internalQuery,
          internalMutation: runtime.internalMutation,
          internalTransportMutation: runtime.internalTransportMutation,
        }
      : {}),
    unsafe: runtime.unsafe,
  }
}
