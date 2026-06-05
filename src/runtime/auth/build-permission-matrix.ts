import { resolvePermissionLabel, type ErasedPermissionDefinition } from './define-permission.js'

export type PermissionMatrixRow<TKey extends string = string> = {
  key: TKey
  label: string
  roles: readonly string[]
  description?: string
}

export function buildPermissionMatrix<
  TPermissions extends readonly ErasedPermissionDefinition<string>[],
>(permissions: TPermissions): PermissionMatrixRow<Extract<TPermissions[number]['key'], string>>[] {
  const ownerByKey = new Map<string, number>()
  for (const [index, permission] of permissions.entries()) {
    const owner = ownerByKey.get(permission.key)
    if (owner !== undefined) {
      throw new Error(
        `buildPermissionMatrix(...) received duplicate permission key "${permission.key}" at indexes ${owner} and ${index}.`,
      )
    }
    ownerByKey.set(permission.key, index)
  }

  return permissions
    .filter((permission) => permission.project !== false)
    .map((permission) => ({
      key: permission.key,
      label: resolvePermissionLabel(permission),
      roles: permission.roles ?? [],
      ...(permission.description ? { description: permission.description } : {}),
    })) as PermissionMatrixRow<Extract<TPermissions[number]['key'], string>>[]
}
