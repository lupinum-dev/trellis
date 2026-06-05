import { z } from 'zod'

import { defineMcpTool } from '#trellis/mcp/advanced'

export default defineMcpTool({
  name: 'create-task',
  inputSchema: {
    title: z.string(),
  },
  handler: async ({ title }) => title,
})
