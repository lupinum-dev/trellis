import {
  definePermission,
  defineAccessContext,
  defineGuard,
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
