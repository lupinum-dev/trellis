import { executeOperationRef } from '@lupinum/trellis/mcp'

import { api } from '#trellis/api'

import { createPageOp } from '../../../convex/components/miniCms/features/pages/domain'
import { createPagePermission } from '../../../convex/features/pages/permissions'
import { createPage } from '../../../shared/features/pages/contract'
import { tool } from '../../lib/mcp-runtime'

export default tool.operation(createPageOp, {
  schema: createPage,
  execute: executeOperationRef(createPageOp, api.features.pages.domain.create),
  permission: createPagePermission,
  group: 'pages',
  meta: {
    name: 'create-page',
    description: 'Create a new draft page in the local component CMS.',
  },
})
