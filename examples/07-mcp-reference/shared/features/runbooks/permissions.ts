import { definePermissionKey } from '@lupinum/trellis/auth'

export const runbookReadKey = definePermissionKey({
  key: 'runbook.read',
  label: 'Read runbooks',
})

export const runbookCreateKey = definePermissionKey({
  key: 'runbook.create',
  label: 'Create runbook',
})

export const runbookDeleteKey = definePermissionKey({
  key: 'runbook.delete',
  label: 'Delete own runbook',
})

export const runbookPublishKey = definePermissionKey({
  key: 'runbook.publish',
  label: 'Publish runbook',
})

export const runbookBulkDeleteKey = definePermissionKey({
  key: 'runbook.bulkDelete',
  label: 'Bulk delete runbooks',
})
