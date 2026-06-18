import { addTemplate, addTypeTemplate, updateTemplates } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

import {
  extractPublicSurfaceCodegenMetadata,
  renderPublicSurfaceCodegenMetadata,
  renderPublicSurfaceCodegenTypes,
  shouldRefreshPublicSurfaceCodegen,
} from '../module-internals/public-surface-codegen.js'

interface InstallPublicSurfaceCodegenOptions {
  nuxt: Nuxt
}

export function installPublicSurfaceCodegen(options: InstallPublicSurfaceCodegenOptions): void {
  const { nuxt } = options

  const readPublicSurfaceMetadata = () => extractPublicSurfaceCodegenMetadata(nuxt.options.rootDir)

  addTypeTemplate({
    filename: 'types/trellis-public-surface.d.ts',
    write: true,
    getContents: () => renderPublicSurfaceCodegenTypes(readPublicSurfaceMetadata()),
  })

  addTemplate({
    filename: 'trellis/public-surface.json',
    write: true,
    getContents: () => renderPublicSurfaceCodegenMetadata(readPublicSurfaceMetadata()),
  })

  nuxt.hook('builder:watch', async (_event, path) => {
    if (!shouldRefreshPublicSurfaceCodegen(path)) return
    await updateTemplates()
  })
}
