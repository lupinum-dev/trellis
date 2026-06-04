// Advanced MCP surface.
//
// The blessed first-reader Trellis MCP lanes are `defineMcpApp` and the
// `mcp.tool.{query,mutation,operation}` factories returned by it. They cover
// the common cases: a Convex ref backs the tool and Trellis owns auth,
// preview, confirmation, tenant binding, and result envelope shape.
//
// This surface is for toolkit-level resources, prompts, and custom
// non-Convex orchestration. It is not an app-write path.
export { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'
