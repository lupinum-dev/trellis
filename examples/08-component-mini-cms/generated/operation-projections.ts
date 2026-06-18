// AUTO-GENERATED. Do not edit.
import type { OperationProjectionRegistry } from '@lupinum/trellis/app'

export const operationProjectionRegistry = {
  fingerprint: 'sha256:9816ccf2b094dac0959dd0012bd8423cd5135bd599ca77a601dc5bbadc58be6d',
  executeById: {
    'pages.create': 'features/pages/domain:create',
    'pages.get-published': 'features/pages/domain:getPublished',
    'pages.list-draft': 'features/pages/domain:listDraft',
    'pages.list-published': 'features/pages/domain:listPublished',
    'pages.list-studio': 'features/pages/domain:listStudio',
    'pages.publish': 'features/pages/domain:publishAction',
    'pages.save-draft': 'features/pages/domain:save',
  },
  previewById: {
    'pages.publish': 'features/pages/domain:previewPublish',
  },
} as const satisfies OperationProjectionRegistry
