import { defineComponent } from 'convex/server'
import { v } from 'convex/values'

const component = defineComponent('miniCms', {
  env: {
    CONVEX_IDENTITY_FORWARDING_KEY: v.string(),
  },
})

export default component
