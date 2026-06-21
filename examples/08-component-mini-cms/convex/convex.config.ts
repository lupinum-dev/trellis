import betterAuth from '@convex-dev/better-auth/convex.config'
import { defineApp } from 'convex/server'
import { v } from 'convex/values'

import miniCms from './components/miniCms/convex.config.js'

const app = defineApp({
  env: {
    CONVEX_IDENTITY_FORWARDING_KEY: v.string(),
  },
})

app.use(betterAuth, { name: 'betterAuth' })
app.use(miniCms, {
  name: 'miniCms',
  env: {
    CONVEX_IDENTITY_FORWARDING_KEY: app.env.CONVEX_IDENTITY_FORWARDING_KEY,
  },
})

export default app
