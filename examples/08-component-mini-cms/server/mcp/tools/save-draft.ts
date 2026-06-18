import { operations } from '#trellis/operations/mcp'

import { saveDraftPermission } from '../../../convex/features/pages/permissions'
import { saveDraft } from '../../../shared/features/pages/contract'
import { tool } from '../../lib/mcp-runtime'

export default tool.operation(operations.pages.saveDraft, {
  schema: saveDraft,
  permission: saveDraftPermission,
  group: 'pages',
  meta: {
    name: 'save-draft',
    description: 'Update the draft body, title, or slug of an existing page.',
  },
})
