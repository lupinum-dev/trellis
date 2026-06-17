import { defineAppIdentity } from '@lupinum/trellis/auth'

import type { DataModel, Id } from '../_generated/dataModel'

export type AppIdentity = {
  kind: 'user'
  userId: Id<'users'>
  authKey: string
  role: string
} | null

const appIdentity = defineAppIdentity.fromAuth<DataModel>()

export async function getAppIdentity(
  ctx: Parameters<typeof appIdentity.resolve>[0],
): Promise<AppIdentity> {
  const resolved = await appIdentity.resolve(ctx)
  if (!resolved) return null

  return { ...resolved, userId: resolved.userId as Id<'users'> }
}
