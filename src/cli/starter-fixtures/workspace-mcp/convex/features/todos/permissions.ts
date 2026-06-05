import { definePermission } from '@lupinum/trellis/auth'

import type { AccessIdentity } from '../../auth/appIdentity'
import type { Role } from '../../auth/caller'

const roleRank: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

function hasWorkspace(appIdentity: AccessIdentity | null): boolean {
  return !!appIdentity?.workspaceId
}

function hasMinimumRole(appIdentity: AccessIdentity | null, minimum: Role): boolean {
  if (!appIdentity?.workspaceId) return false
  return roleRank[appIdentity.role] >= roleRank[minimum]
}

export const workspaceRead = definePermission({
  key: 'workspace.read',
  check: hasWorkspace,
})

export const todoCreate = definePermission({
  key: 'todo.create',
  check: (appIdentity: AccessIdentity | null) => hasMinimumRole(appIdentity, 'member'),
})

export const todoPermissions = [workspaceRead, todoCreate] as const
