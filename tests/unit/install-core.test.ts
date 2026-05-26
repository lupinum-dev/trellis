import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import type { Nuxt } from '@nuxt/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installCoreTrellis } from '../../src/installers/core'

const { addImportsMock, addPluginMock, addServerImportsMock, addTemplateMock } = vi.hoisted(() => ({
  addImportsMock: vi.fn(),
  addPluginMock: vi.fn(),
  addServerImportsMock: vi.fn(),
  addTemplateMock: vi.fn(({ filename }: { filename: string }) => ({
    dst: `.nuxt/${filename}`,
  })),
}))

vi.mock('@nuxt/kit', () => ({
  addImports: addImportsMock,
  addPlugin: addPluginMock,
  addServerImports: addServerImportsMock,
  addTemplate: addTemplateMock,
}))

function createFixture() {
  const rootDir = mkdtempSync(resolve(tmpdir(), 'trellis-install-core-'))
  mkdirSync(resolve(rootDir, 'runtime'), { recursive: true })
  return rootDir
}

function createResolver(rootDir: string) {
  return {
    resolve: (...segments: string[]) =>
      resolve(rootDir, ...segments.map((segment) => segment.replace(/^\.\//u, ''))),
  }
}

function createNuxt(rootDir: string): Nuxt {
  return {
    options: {
      rootDir,
      srcDir: rootDir,
      buildDir: resolve(rootDir, '.nuxt'),
      alias: {},
    },
    hook: vi.fn(),
  } as unknown as Nuxt
}

describe('installCoreTrellis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps source runtime plugin paths when built files are absent', () => {
    const rootDir = createFixture()

    installCoreTrellis({
      nuxt: createNuxt(rootDir),
      resolver: createResolver(rootDir) as never,
    })

    expect(addPluginMock).toHaveBeenNthCalledWith(1, {
      src: resolve(rootDir, 'runtime/plugin.server'),
      mode: 'server',
    })
    expect(addPluginMock).toHaveBeenNthCalledWith(2, resolve(rootDir, 'runtime/plugin.client'))
  })

  it('uses built runtime plugin files when they exist', () => {
    const rootDir = createFixture()
    writeFileSync(resolve(rootDir, 'runtime/plugin.server.js'), '', 'utf8')
    writeFileSync(resolve(rootDir, 'runtime/plugin.client.js'), '', 'utf8')

    installCoreTrellis({
      nuxt: createNuxt(rootDir),
      resolver: createResolver(rootDir) as never,
    })

    expect(addPluginMock).toHaveBeenNthCalledWith(1, {
      src: resolve(rootDir, 'runtime/plugin.server.js'),
      mode: 'server',
    })
    expect(addPluginMock).toHaveBeenNthCalledWith(2, resolve(rootDir, 'runtime/plugin.client.js'))
  })
})
