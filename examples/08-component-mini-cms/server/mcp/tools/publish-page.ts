import { operations } from '#trellis/operations/mcp'

import { publishPagePermission } from '../../../convex/features/pages/permissions'
import { publishPage } from '../../../shared/features/pages/contract'
import { tool } from '../../lib/mcp-runtime'

export default tool.operation(operations.pages.publish, {
  schema: publishPage,
  permission: publishPagePermission,
  confirmationMode: 'transport',
  group: 'pages',
  meta: {
    name: 'publish-page',
    description: 'Publish the selected draft page to the public site.',
  },
})
