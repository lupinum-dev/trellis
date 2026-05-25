import { defineMcpApp } from '@lupinum/trellis/mcp'
import { defineTool } from '@lupinum/trellis/mcp/advanced'
import { createWebhookHmacSignature } from '@lupinum/trellis/server'
import { defineEventHandler } from 'h3'

void defineMcpApp
void defineTool
void createWebhookHmacSignature

export default defineEventHandler(() => ({ ok: true }))
