import { createProjectRef } from '../../../generated/operation-refs'
import { createProjectDescriptor } from '../../../shared/features/projects/operations'
import { tool } from '../runtime'

export default tool.operation(createProjectDescriptor, {
  execute: createProjectRef,
})
