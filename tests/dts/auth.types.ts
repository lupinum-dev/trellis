import {
  definePermission,
  defineAccessContext,
  defineGuard,
  defineServices,
  explainPermission,
} from '@lupinum/trellis/auth'
import { expectTypeOf } from 'vitest'

const readPermission = definePermission({
  key: 'task.read',
  check: true,
})

const publishPermission = definePermission({
  key: 'task.publish',
  check: true,
  project: false,
})

const _accessContext = defineAccessContext({
  id: 'tests.accessContext',
  permissions: [readPermission, publishPermission] as const,
  resolve: async (_ctx: { caller: { userId: string } }) => ({
    userId: 'user_1',
    workspaceId: 'workspace_1',
    role: 'owner' as const,
  }),
  extend: (_ctx, appIdentity) => ({
    displayName: appIdentity.userId,
  }),
})

type AccessContextResult = Awaited<ReturnType<typeof _accessContext.handler>>

type ExpectedAccessContext = {
  userId: string | null
  workspaceId: string | null
  role: string | null
  can: {
    'task.read': boolean
  }
  displayName: string
}

expectTypeOf<AccessContextResult>().toMatchTypeOf<ExpectedAccessContext | null>()
expectTypeOf<NonNullable<AccessContextResult>>().toMatchTypeOf<ExpectedAccessContext>()

const ownsTask = defineGuard<{ userId: string }>({
  label: 'ownsTask',
  check: (caller) => caller.userId === 'user_1',
  explain: ({ decision }) => (decision === 'allowed' ? 'Owns task.' : 'Does not own task.'),
})

const deletePermission = definePermission({
  key: 'task.delete',
  check: ownsTask,
})

const explanation = explainPermission({ userId: 'user_1' }, deletePermission)

expectTypeOf(explanation.decision).toMatchTypeOf<'allowed' | 'denied'>()
expectTypeOf(explanation.check.checks).toMatchTypeOf<readonly unknown[]>()

defineServices({
  sync: {
    metadata: {
      source: 'verifiedWebhook',
      purpose: 'sync',
      allowedFunctionRefs: ['events:sync'],
      replayMode: 'domain-idempotency',
      actingFor: false,
      auditEvent: 'sync.processed',
      auditTable: 'events',
      auditCorrelationId: 'args.deliveryId',
    },
    access: {
      tables: ['events'],
      tenant: 'global',
    },
  },
})

defineServices({
  sync: {
    metadata: {
      source: 'verifiedWebhook',
      purpose: 'sync',
      allowedFunctionRefs: ['events:sync'],
      replayMode: 'domain-idempotency',
      actingFor: false,
      auditEvent: 'sync.processed',
      auditTable: 'events',
      auditCorrelationId: 'args.deliveryId',
    },
    // @ts-expect-error service access must be table-restricted
    access: 'unrestricted',
  },
})

defineServices({
  sync: {
    // @ts-expect-error service metadata must name an audit/idempotency table
    metadata: {
      source: 'verifiedWebhook',
      purpose: 'sync',
      allowedFunctionRefs: ['events:sync'],
      replayMode: 'domain-idempotency',
      actingFor: false,
      auditEvent: 'sync.processed',
      auditCorrelationId: 'args.deliveryId',
    },
    access: {
      tables: ['events'],
      tenant: 'global',
    },
  },
})

defineServices({
  sync: {
    // @ts-expect-error service metadata must allow at least one operation id or function ref
    metadata: {
      source: 'verifiedWebhook',
      purpose: 'sync',
      replayMode: 'domain-idempotency',
      actingFor: false,
      auditEvent: 'sync.processed',
      auditTable: 'events',
      auditCorrelationId: 'args.deliveryId',
    },
    access: {
      tables: ['events'],
      tenant: 'global',
    },
  },
})
