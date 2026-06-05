import { defineMcpApp } from '@lupinum/trellis/mcp'
import { defineMcpTool } from '@lupinum/trellis/mcp/advanced'
import { createWebhookHmacSignature } from '@lupinum/trellis/server'
import { defineEventHandler } from 'h3'

void defineMcpApp
void defineMcpTool
void createWebhookHmacSignature

export default defineEventHandler(() => ({ ok: true }))
