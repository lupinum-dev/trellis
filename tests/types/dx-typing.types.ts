import type {
  FunctionReference,
  GenericDataModel,
  GenericQueryCtx,
  MutationBuilder,
  QueryBuilder,
} from 'convex/server'

import { defineTrellis, operation as appOperation, workspaceScope } from '../../src/runtime/app'
import { defineArgs } from '../../src/runtime/args'
import {
  definePermission,
  type PermissionKeyHandle,
  type AuthIdentity,
  enforce,
  can,
  deny,
  requireAuth,
  and,
} from '../../src/runtime/auth'
import type { PermissionKey } from '../../src/runtime/composables/configured-permissions'
import { createConfiguredPermissionsComposables } from '../../src/runtime/composables/configured-permissions'
import { createIdentityForwardingEnvelope } from '../../src/runtime/identity-forwarding'
import { createTestContext } from '../../src/runtime/testing'

type Assert<T extends true> = T
type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

type AppIdentity = { role: 'owner' | 'member'; userId: string; workspaceId: string } | null
type AppIdentityCheck = (appIdentity: AppIdentity) => boolean

const isOwner: AppIdentityCheck = (appIdentity: AppIdentity) =>
  !!appIdentity && appIdentity.role === 'owner'
const isMember: AppIdentityCheck = (appIdentity: AppIdentity) =>
  !!appIdentity && appIdentity.role === 'member'

const composed = and(isOwner, isMember)
const allowed = can({ role: 'owner', userId: 'u1', workspaceId: 't1' }, composed)
void allowed

const requiredAppIdentity = {} as AppIdentity
requireAuth(requiredAppIdentity)
type _requiredAppIdentity = Assert<IsEqual<typeof requiredAppIdentity, NonNullable<AppIdentity>>>

deny('Blocked', { source: 'dx-typing' })
enforce(null, 'Admin page', false)
createIdentityForwardingEnvelope({
  key: 'identity-forwarding-key-with-enough-entropy',
  keyId: 'default',
  iss: 'trellis://server',
  aud: 'trellis://convex',
  jti: 'typed-call',
  sub: 'user:u1',
  caller: { subject: 'user:u1' },
  transport: 'server',
  purpose: 'query',
  functionRef: 'tasks:list',
  args: {},
  ttlMs: 60_000,
})

type AccessContext = {
  role: 'owner' | 'member'
  plan: 'free' | 'pro'
  userId: string
  workspaceId: string
  displayName: string | null
  usage: { projects: { current: number } }
  can: Record<'task.create' | 'workspace.members', boolean>
}

const permissionQuery = {} as FunctionReference<
  'query',
  'public',
  Record<string, never>,
  AccessContext | null
>

const _auth = createConfiguredPermissionsComposables(permissionQuery, 'workspaces.getAccessContext')

const createTaskPermission = definePermission({
  key: 'task.create',
  check: true,
})

const deleteTaskPermission = definePermission({
  key: 'task.delete',
  check: true,
})

type UseAccessApi = ReturnType<typeof _auth.useAccess>
type GuardOptions = Parameters<typeof _auth.useAuthGuard>[0]
type _permissionKey = Assert<
  IsEqual<PermissionKey<AccessContext>, 'task.create' | 'workspace.members'>
>
type _ctxFromComposable = Assert<IsEqual<UseAccessApi['ctx']['value'], AccessContext | null>>
type _roleFromComposable = Assert<
  IsEqual<UseAccessApi['role']['value'], AccessContext['role'] | null>
>
type _planFromComposable = Assert<
  IsEqual<UseAccessApi['plan']['value'], AccessContext['plan'] | null>
>
type _ctxDisplayName = Assert<
  IsEqual<NonNullable<UseAccessApi['ctx']['value']>['displayName'], string | null>
>
type _ctxUsageCurrent = Assert<
  IsEqual<NonNullable<UseAccessApi['ctx']['value']>['usage']['projects']['current'], number>
>
type _canParameter = Assert<
  IsEqual<
    Parameters<UseAccessApi['can']>[0],
    PermissionKeyHandle<'task.create' | 'workspace.members'>
  >
>
type _guardPermissionKey = Assert<
  IsEqual<
    GuardOptions['permission'],
    PermissionKeyHandle<'task.create' | 'workspace.members'> | undefined
  >
>
type _guardCheck = Assert<
  IsEqual<GuardOptions['check'], ((ctx: AccessContext) => boolean) | undefined>
>

const _validGuardOptions: GuardOptions = {
  permission: createTaskPermission,
  check: (ctx) => ctx.usage.projects.current > 0,
}
void _validGuardOptions

// @ts-expect-error invalid recordAccess should not type-check
const _invalidGuardOptions: GuardOptions = { permission: deleteTaskPermission }
void _invalidGuardOptions

type GenericAccessContext = {
  userId: string | null
  workspaceId: string | null
  role: string | null
  can: Record<string, boolean>
}

const genericPermissionQuery = {} as FunctionReference<
  'query',
  'public',
  Record<string, never>,
  GenericAccessContext | null
>

const _genericAuth = createConfiguredPermissionsComposables(
  genericPermissionQuery,
  'auth.getAccessContext',
)

type GenericUseAccessApi = ReturnType<typeof _genericAuth.useAccess>
type GenericGuardOptions = Parameters<typeof _genericAuth.useAuthGuard>[0]
type _genericPermissionKey = Assert<IsEqual<PermissionKey<GenericAccessContext>, string>>
type _genericCanParameter = Assert<
  IsEqual<Parameters<GenericUseAccessApi['can']>[0], PermissionKeyHandle<string>>
>
type _genericGuardPermissionKey = Assert<
  IsEqual<GenericGuardOptions['permission'], PermissionKeyHandle<string> | undefined>
>

const _identity = {} as AuthIdentity | null
void _identity
const toolSchema = defineArgs({
  args: {},
})

const _createTaskOperation = appOperation.mutation({
  args: toolSchema.args,
  permission: createTaskPermission,
  handler: async (_ctx, _args, _loaded) => null,
})
void _createTaskOperation

type WorkspaceId = string & { readonly __tableName: 'workspaces' }
type WorkspaceActor = {
  kind: 'user'
  userId: string
  authKey: string
  role: 'owner'
  workspaceId: WorkspaceId
}
type WorkspaceOperationCtx = GenericQueryCtx<GenericDataModel> & {
  workspaceId: WorkspaceId
  appIdentity: () => Promise<WorkspaceActor>
}

const workspacePermission = definePermission({
  key: 'workspace.read',
  check: true,
})

const workspaceRuntime = defineTrellis(
  {
    query: {} as QueryBuilder<GenericDataModel, 'public'>,
    mutation: {} as MutationBuilder<GenericDataModel, 'public'>,
  },
  {
    appIdentity: async () => ({
      kind: 'user',
      userId: 'user_1',
      authKey: 'auth_1',
      role: 'owner',
      workspaceId: 'workspace_1' as WorkspaceId,
    }),
  },
)

const _brandedWorkspaceOperation = appOperation.query({
  id: 'workspace.branded',
  args: {},
  scope: workspaceScope(),
  permission: workspacePermission,
  handler: async (ctx: WorkspaceOperationCtx) => ctx.workspaceId,
})

workspaceRuntime.query.workspace(_brandedWorkspaceOperation)

const testContext = createTestContext({ schema: {} as never })
void testContext
