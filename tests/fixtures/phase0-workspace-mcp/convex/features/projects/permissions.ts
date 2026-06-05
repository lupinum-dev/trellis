import { definePermission } from '@lupinum/trellis/auth'

import { projectCreateKey, projectDeleteKey } from '../../../shared/features/projects/permissions'

export const projectCreate = definePermission({
  key: projectCreateKey.key,
  check: true,
})

export const projectDelete = definePermission({
  key: projectDeleteKey.key,
  check: true,
})
