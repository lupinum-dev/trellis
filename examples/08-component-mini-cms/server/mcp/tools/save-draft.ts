import { executeOperationRef } from '@lupinum/trellis/mcp'

import { api } from '#trellis/api'

import { saveDraftOp } from '../../../convex/components/miniCms/features/pages/domain'
import { saveDraftPermission } from '../../../convex/features/pages/permissions'
import { saveDraft } from '../../../shared/features/pages/contract'
import { tool } from '../../lib/mcp-runtime'

export default tool.operation(saveDraftOp, {
  schema: saveDraft,
  execute: executeOperationRef(saveDraftOp, api.features.pages.domain.save),
  permission: saveDraftPermission,
  group: 'pages',
  meta: {
    name: 'save-draft',
    description: 'Update the draft body, title, or slug of an existing page.',
  },
})
