import { defineAppIdentity } from '@lupinum/trellis/auth'
/**
 * Why this file differs from the later tenant-scoped examples:
 * Example 02 is still auth-only. It still resolves app identity through the local `users` table so
 * todo rows never store provider subjects or auth keys as user ids.
 */

import type { DataModel, Id } from '../_generated/dataModel'

export type AppIdentity = { kind: 'user'; userId: Id<'users'>; authKey: string } | null

const appIdentity = defineAppIdentity.fromAuth<DataModel>()

export async function getAppIdentity(
  ctx: Parameters<typeof appIdentity.resolve>[0],
): Promise<AppIdentity> {
  const resolved = await appIdentity.resolve(ctx)
  if (!resolved) return null

  return {
    kind: 'user',
    userId: resolved.userId as Id<'users'>,
    authKey: resolved.authKey,
  }
}
