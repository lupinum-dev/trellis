import { operations } from '#trellis/operations/mcp'

import { createPagePermission } from '../../../convex/features/pages/permissions'
import { createPage } from '../../../shared/features/pages/contract'
import { tool } from '../../lib/mcp-runtime'

export default tool.operation(operations.pages.create, {
  schema: createPage,
  permission: createPagePermission,
  group: 'pages',
  meta: {
    name: 'create-page',
    description: 'Create a new draft page in the local component CMS.',
  },
})
