import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import {
  renderOperationHandlesModule,
  type OperationHandleBindingInput,
} from './operation-handle-codegen.js'
import {
  renderOperationRefsModule,
  type OperationRefBindingInput,
} from './operation-ref-codegen.js'
import {
  buildOperationRegistry,
  renderOperationRegistryGeneratedFiles,
} from './operation-registry-codegen.js'
import { extractPublicSurfaceCodegenMetadata } from './public-surface-codegen.js'

export type StarterOperationRefsGeneratedFile = {
  kind: 'operationRefs'
  path: string
  projectOperationRefImport: string
  apiImport: string
  descriptorImport: string
  descriptors: readonly string[]
  refs: readonly OperationRefBindingInput[]
}

export type StarterOperationHandlesGeneratedFile = {
  kind: 'operationHandles'
  path: string
  defineOperationHandleImport: string
  descriptorImport: string
  refsImport: string
  descriptors: readonly string[]
  refs: readonly string[]
  handles: readonly OperationHandleBindingInput[]
}

export type StarterOperationRegistryGeneratedFile = {
  kind: 'operationRegistry'
  operationRefsPath: string
  operationHandlesPath: string
  projectOperationRefImport: string
  defineOperationHandleImport: string
  apiImport: string
  runtimes?: readonly ('client' | 'server' | 'mcp' | 'testing' | 'internal')[]
}

export type StarterGeneratedFile =
  | StarterOperationRefsGeneratedFile
  | StarterOperationHandlesGeneratedFile
  | StarterOperationRegistryGeneratedFile

export interface StarterFixtureManifest {
  name: string
  description?: string
  include: readonly string[]
  exclude: readonly string[]
  generated?: readonly StarterGeneratedFile[]
}

export interface RenderedStarterFile {
  path: string
  content: string
}

export function renderStarterGeneratedFiles(
  manifest: StarterFixtureManifest,
  rootDir?: string,
): RenderedStarterFile[] {
  return (manifest.generated ?? []).flatMap((file) => {
    if (file.kind === 'operationRegistry') {
      if (!rootDir) {
        throw new Error('operationRegistry generated files require a fixture rootDir.')
      }
      return renderOperationRegistryGeneratedFiles(
        buildOperationRegistry(extractPublicSurfaceCodegenMetadata(rootDir)),
        file,
      )
    }

    if (file.kind === 'operationHandles') {
      return {
        path: file.path,
        content: renderOperationHandlesModule(file),
      }
    }

    return {
      path: file.path,
      content: renderOperationRefsModule(file),
    }
  })
}

function toManifestPath(path: string): string {
  return path.split(sep).join('/')
}

function matchesPattern(path: string, pattern: string): boolean {
  const deepFileMatch = pattern.match(/^(.+)\/\*\*\/\*(\.[^/]+)$/)
  if (deepFileMatch) {
    const prefix = deepFileMatch[1]
    const suffix = deepFileMatch[2]
    if (!prefix || !suffix) return false
    return path.startsWith(`${prefix}/`) && path.endsWith(suffix)
  }

  if (pattern.endsWith('/**')) {
    return path.startsWith(pattern.slice(0, -3))
  }

  return path === pattern
}

function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(path, pattern))
}

function includeSearchRoots(patterns: readonly string[]): string[] {
  const roots = new Set<string>()
  for (const pattern of patterns) {
    const wildcardIndex = pattern.indexOf('*')
    if (wildcardIndex === -1) {
      const slashIndex = pattern.lastIndexOf('/')
      roots.add(slashIndex === -1 ? pattern : pattern.slice(0, slashIndex))
      continue
    }

    const prefix = pattern.slice(0, wildcardIndex).replace(/\/+$/u, '')
    roots.add(prefix || '.')
  }
  return [...roots]
}

function collectFiles(rootDir: string, searchRoot: string): string[] {
  const absoluteRoot = join(rootDir, searchRoot)
  if (!existsSync(absoluteRoot)) return []
  const stats = statSync(absoluteRoot)
  if (stats.isFile()) return [toManifestPath(searchRoot)]
  if (!stats.isDirectory()) return []

  const files: string[] = []
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      files.push(toManifestPath(relative(rootDir, absolutePath)))
    }
  }
  walk(absoluteRoot)
  return files
}

export function renderStarterFixtureFiles(
  rootDir: string,
  manifest: StarterFixtureManifest,
): RenderedStarterFile[] {
  const generated = new Map(
    renderStarterGeneratedFiles(manifest, rootDir).map((file) => [file.path, file]),
  )
  const selected = new Set<string>()

  for (const searchRoot of includeSearchRoots(manifest.include)) {
    for (const path of collectFiles(rootDir, searchRoot)) {
      if (!matchesAny(path, manifest.include)) continue
      if (matchesAny(path, manifest.exclude)) continue
      selected.add(path)
    }
  }

  for (const path of generated.keys()) {
    if (!matchesAny(path, manifest.include)) continue
    if (matchesAny(path, manifest.exclude)) continue
    selected.add(path)
  }

  return [...selected]
    .sort((left, right) => left.localeCompare(right))
    .map((path) => ({
      path,
      content: generated.get(path)?.content ?? readFileSync(join(rootDir, path), 'utf8'),
    }))
}
