import { operations } from '../../../generated/operation-handles/mcp'
import { tool } from '../runtime'

export default tool.operation(operations.projects.delete, {
  confirmationMode: 'transport',
  previewOperation: 'mutation',
})
