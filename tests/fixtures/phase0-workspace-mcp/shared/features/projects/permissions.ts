import { definePermissionKey } from '@lupinum/trellis/auth'

export const projectCreateKey = definePermissionKey({
  key: 'projects.create',
  label: 'Create projects',
})

export const projectDeleteKey = definePermissionKey({
  key: 'projects.delete',
  label: 'Delete projects',
})
