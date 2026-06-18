import { definePermissionKey } from '@lupinum/trellis/auth'

export const workspaceReadKey = definePermissionKey({
  key: 'workspace.read',
  label: 'Read workspace data',
})

export const todoCreateKey = definePermissionKey({
  key: 'todo.create',
  label: 'Create todos',
})
