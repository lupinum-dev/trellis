/**
 * Why this file exists:
 * The knowledge base appIdentity includes managerId for team hierarchy visibility, built from the
 * composable appIdentity primitive.
 */
import { defineAppIdentity } from '@lupinum/trellis/auth'
import type { Infer } from 'convex/values'

import type { DataModel, Id } from '../_generated/dataModel'
import type { roleValidator } from '../features/users'

type UserRole = Infer<typeof roleValidator>

type KnowledgeBaseActor = {
  kind: 'user'
  userId: Id<'users'>
  authKey: string
  role: UserRole
  workspaceId: Id<'workspaces'>
  managerId: Id<'users'> | undefined
  email?: string | null
  displayName?: string | null
}

const appIdentity = defineAppIdentity.fromAuth<DataModel>().extend({
  fields: async (_ctx, user) => ({
    role: user.role as UserRole,
    workspaceId: user.workspaceId as Id<'workspaces'> | undefined,
    managerId: user.managerId as Id<'users'> | undefined,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
  }),
})

export type AppIdentity = KnowledgeBaseActor

export async function getAppIdentity(
  ctx: Parameters<typeof appIdentity.resolve>[0],
): Promise<AppIdentity | null> {
  const resolved = await appIdentity.resolve(ctx)
  if (!resolved?.workspaceId) return null

  return {
    ...resolved,
    userId: resolved.userId as Id<'users'>,
    workspaceId: resolved.workspaceId,
    managerId: resolved.managerId,
    email: resolved.email ?? null,
    displayName: resolved.displayName ?? null,
  }
}
