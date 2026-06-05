import { defineAppInventory } from '@lupinum/trellis/workspace'

import { projectsFeature } from './features/projects/feature'

export const appInventory = defineAppInventory({
  features: [projectsFeature] as const,
})
