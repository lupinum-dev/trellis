import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('generated API surface docs', () => {
  it('documents the installer-driven Nuxt auto-imports and aliases', () => {
    const apiSurface = readFileSync(
      resolve(process.cwd(), 'apps/docs/content/docs/13.api-reference/7.api-surface.md'),
      'utf8',
    )

    expect(apiSurface).toContain('## Which API do I use?')
    expect(apiSurface).toContain('| `@lupinum/trellis/backend`')
    expect(apiSurface).toContain('| `useConvexQuery`')
    expect(apiSurface).toContain('| `useConvexUpload`')
    expect(apiSurface).toContain('| `useConvexAuth`')
    expect(apiSurface).toContain('| `useAuthGuard`')
    expect(apiSurface).toContain('| `serverConvexQuery`')
    expect(apiSurface).toContain('| `#trellis/api`')
    expect(apiSurface).toContain('| `#trellis/server`')
    expect(apiSurface).toContain('| `#trellis/mcp`')
    expect(apiSurface).toContain('| `<ConvexAuthenticated>`')
    expect(apiSurface).not.toContain('defineNuxtConfig')
  })

  it('documents functions without public custom RLS authoring', () => {
    const functionsReference = readFileSync(
      resolve(process.cwd(), 'apps/docs/content/docs/13.api-reference/3.functions.md'),
      'utf8',
    )

    expect(functionsReference).toContain('| `isolation`')
    expect(functionsReference).toContain('| `services`')
    expect(functionsReference).not.toContain('| `rls`')
    expect(functionsReference).toContain('Trellis has one public authorization model')
  })

  it('keeps beginner destructive-operation docs on the app operation builder', () => {
    const docs = [
      'apps/docs/content/docs/02.concepts/4.call-patterns.md',
      'apps/docs/content/docs/04.mutations/4.destructive-operations.md',
    ]

    for (const docPath of docs) {
      const content = readFileSync(resolve(process.cwd(), docPath), 'utf8')
      expect(content).toContain("from '@lupinum/trellis/app'")
      expect(content).toContain('operation.destructive({')
      expect(content).not.toContain('defineOperation({')
    }
  })
})
