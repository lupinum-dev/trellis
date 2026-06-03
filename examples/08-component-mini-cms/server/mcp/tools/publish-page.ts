import { previewOperationRef, transportExecuteOperationRef } from '@lupinum/trellis/backend'

import { api } from '../../../convex/_generated/api'
import { publishPageOp } from '../../../convex/components/miniCms/features/pages/operations'
import { tool } from '../../lib/mcp-runtime'

export default tool.operation(publishPageOp, {
  execute: transportExecuteOperationRef(publishPageOp, api.features.pages.domain.publishAction),
  preview: previewOperationRef(publishPageOp, api.features.pages.domain.previewPublish),
  executeOperation: 'action',
  confirmationMode: 'transport',
  group: 'pages',
  meta: {
    name: 'publish-page',
    description: 'Publish the selected draft page to the public site.',
  },
})
