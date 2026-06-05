import { definePermission, buildPermissionMatrix } from '@lupinum/trellis/auth'

import type { Doc } from '../../_generated/dataModel'
import type { AppIdentity } from '../../auth/appIdentity'

type Role = Doc<'users'>['role']

const roleRank: Record<Role, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
}

function hasWorkspace(appIdentity: AppIdentity): boolean {
  return !!appIdentity?.workspaceId
}

function hasMinimumRole(appIdentity: AppIdentity, minimum: Role): boolean {
  if (!appIdentity?.workspaceId) return false
  return roleRank[appIdentity.role] >= roleRank[minimum]
}

export const todoRead = definePermission({
  key: 'todo.read',
  label: 'Read todos',
  roles: ['owner', 'admin', 'member', 'viewer'],
  check: hasWorkspace,
})

export const todoCreate = definePermission({
  key: 'todo.create',
  label: 'Create todo',
  roles: ['owner', 'admin', 'member'],
  check: (appIdentity: AppIdentity) => hasMinimumRole(appIdentity, 'member'),
})

export const todoPermissions = [todoRead, todoCreate] as const
export const todoPermissionMatrix = buildPermissionMatrix(todoPermissions)
