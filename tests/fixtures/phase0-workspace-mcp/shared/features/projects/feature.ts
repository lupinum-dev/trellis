import { defineFeature } from '@lupinum/trellis/workspace'

import { createProjectDescriptor, deleteProjectDescriptor } from './operations'

export const projectsFeature = defineFeature({
  name: 'projects',
  operations: [createProjectDescriptor, deleteProjectDescriptor] as const,
})
