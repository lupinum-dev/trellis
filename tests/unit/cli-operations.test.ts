import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { stripVTControlCharacters } from 'node:util'

import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()
const cliEntry = resolve(repoRoot, 'dist/cli.mjs')

function runCli(args: string[], cwd: string) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      NO_COLOR: '1',
    },
  })
}

function createTempDir(prefix: string): string {
  return mkdtempSync(resolve(tmpdir(), prefix))
}

function write(root: string, path: string, content: string): void {
  const absolutePath = resolve(root, path)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content, 'utf8')
}

function read(root: string, path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

function parseJsonOutput<T>(output: string): T {
  return JSON.parse(stripVTControlCharacters(output)) as T
}

function operationGenerateArgs(appRoot: string, extra: string[] = []): string[] {
  return [
    'operations',
    'generate',
    '--cwd',
    appRoot,
    '--operation-include',
    'src/**/*.ts',
    '--operation-exclude',
    'src/generated/**,src/operations.ts',
    '--projection-root',
    'callerQuery:query,callerMutation:mutation:preview,callerAction:action',
    '--ignored-projection-root',
    'callerTransportMutation',
    '--convex-source-root',
    'src',
    '--operation-refs',
    'src/generated/operation-refs.ts',
    '--operation-handles',
    'src/generated/operation-handles/testing.ts',
    '--api-import',
    '../_generated/api.js',
    '--relative-import-extension',
    '.js',
    '--define-operation-handle-import',
    '@lupinum/trellis/backend',
    '--project-operation-ref-import',
    '@lupinum/trellis/backend',
    '--operation-descriptor-type-import',
    '@lupinum/trellis/backend',
    '--descriptor-mode',
    'generated-metadata',
    '--runtime',
    'testing',
    '--json',
    ...extra,
  ]
}

function operationProjectionOnlyArgs(appRoot: string, extra: string[] = []): string[] {
  return [
    'operations',
    'generate',
    '--cwd',
    appRoot,
    '--operation-include',
    'src/**/*.ts',
    '--operation-exclude',
    'src/generated/**,src/operations.ts',
    '--projection-root',
    'callerQuery:query,callerMutation:mutation:preview,callerAction:action',
    '--ignored-projection-root',
    'callerTransportMutation',
    '--convex-source-root',
    'src',
    '--operation-projections',
    'src/generated/operation-projections.ts',
    '--json',
    ...extra,
  ]
}

function writePackageRootOperationFixture(appRoot: string): void {
  write(
    appRoot,
    'src/entries/publish.ts',
    `
      import { defineOperation, previewOf } from '@lupinum/trellis/backend'
      import { callerMutation, callerTransportMutation } from '../functions'

      export const publishEntryOperation = defineOperation({
        id: 'ginko-cms.publish-entry',
        name: 'publish-entry',
        kind: 'destructive',
        executeFunctionRef: 'entries/publish:publishEntryOperationExecute',
        args: {},
        handler: async () => ({ published: true }),
        preview: async () => ({ confirmation: { token: 'confirm', expiresAt: 1 } }),
      })

      export const publishEntryOperationExecute = callerMutation.protected({
        ...publishEntryOperation,
      })
      export const publishEntryTransportExecute = callerTransportMutation({
        ...publishEntryOperation,
        id: 'entries/publish:publishEntryTransportExecute',
      })
      export const previewPublishEntryOperation = callerMutation.protected(
        Object.assign(previewOf(publishEntryOperation), {
          id: 'editor:previewPublishEntryOperation',
        }),
      )
    `,
  )
  write(
    appRoot,
    'src/functions.ts',
    `
      export const callerQuery = { protected: (definition: unknown) => definition }
      export const callerMutation = { protected: (definition: unknown) => definition }
      export const callerAction = { protected: (definition: unknown) => definition }
      export const callerTransportMutation = (definition: unknown) => definition
    `,
  )
  write(
    appRoot,
    'src/operations.ts',
    `
      export { publishEntryOperationExecute } from './entries/publish'
    `,
  )
}

describe('operations CLI', () => {
  it('generates and checks package-root operation registry files', () => {
    const appRoot = createTempDir('trellis-operations-generate-')
    writePackageRootOperationFixture(appRoot)

    const generateResult = runCli(operationGenerateArgs(appRoot), repoRoot)
    const generateReport = parseJsonOutput<{
      status: string
      mode: string
      written: string[]
      outOfDate: string[]
      operations: number
      projections: number
    }>(generateResult.stdout)

    expect(generateResult.status, `${generateResult.stdout}\n${generateResult.stderr}`).toBe(0)
    expect(generateReport).toMatchObject({
      status: 'ok',
      mode: 'write',
      written: ['src/generated/operation-refs.ts', 'src/generated/operation-handles/testing.ts'],
      outOfDate: [],
      operations: 1,
      projections: 2,
    })
    expect(existsSync(resolve(appRoot, 'src/generated/operation-refs.ts'))).toBe(true)
    expect(read(appRoot, 'src/generated/operation-refs.ts')).toContain(
      "import { api } from '../_generated/api.js'",
    )
    expect(read(appRoot, 'src/generated/operation-refs.ts')).toContain(
      "functionRef: 'editor:previewPublishEntryOperation'",
    )
    expect(read(appRoot, 'src/generated/operation-refs.ts')).toContain(
      "executeFunctionRef: 'entries/publish:publishEntryOperationExecute'",
    )
    expect(read(appRoot, 'src/generated/operation-refs.ts')).not.toContain(
      'publishEntryTransportExecute',
    )
    expect(read(appRoot, 'src/generated/operation-handles/testing.ts')).toContain(
      "from '../operation-refs.js'",
    )
    expect(read(appRoot, 'src/generated/operation-handles/testing.ts')).toContain(
      "runtimes: ['testing']",
    )

    const cleanCheckResult = runCli(operationGenerateArgs(appRoot, ['--check']), repoRoot)
    const cleanCheckReport = parseJsonOutput<{ status: string; mode: string; outOfDate: string[] }>(
      cleanCheckResult.stdout,
    )
    expect(cleanCheckResult.status, `${cleanCheckResult.stdout}\n${cleanCheckResult.stderr}`).toBe(
      0,
    )
    expect(cleanCheckReport).toEqual(
      expect.objectContaining({
        status: 'ok',
        mode: 'check',
        outOfDate: [],
      }),
    )

    write(appRoot, 'src/generated/operation-refs.ts', '// stale\n')

    const staleCheckResult = runCli(operationGenerateArgs(appRoot, ['--check']), repoRoot)
    const staleCheckReport = parseJsonOutput<{ status: string; mode: string; outOfDate: string[] }>(
      staleCheckResult.stdout,
    )
    expect(staleCheckResult.status, `${staleCheckResult.stdout}\n${staleCheckResult.stderr}`).toBe(
      1,
    )
    expect(staleCheckReport).toEqual(
      expect.objectContaining({
        status: 'out-of-date',
        mode: 'check',
        outOfDate: ['src/generated/operation-refs.ts'],
      }),
    )
  })

  it('checks projection-only registry output without generated refs or handles', () => {
    const appRoot = createTempDir('trellis-operations-projections-')
    writePackageRootOperationFixture(appRoot)

    const generateResult = runCli(operationProjectionOnlyArgs(appRoot), repoRoot)
    const generateReport = parseJsonOutput<{
      status: string
      mode: string
      written: string[]
      outOfDate: string[]
      operations: number
      projections: number
      files: string[]
    }>(generateResult.stdout)

    expect(generateResult.status, `${generateResult.stdout}\n${generateResult.stderr}`).toBe(0)
    expect(generateReport).toMatchObject({
      status: 'ok',
      mode: 'write',
      written: ['src/generated/operation-projections.ts'],
      outOfDate: [],
      operations: 1,
      projections: 2,
      files: ['src/generated/operation-projections.ts'],
    })
    expect(read(appRoot, 'src/generated/operation-projections.ts')).toContain('executeById: {')
    expect(read(appRoot, 'src/generated/operation-projections.ts')).toContain(
      "'ginko-cms.publish-entry': 'entries/publish:publishEntryOperationExecute'",
    )
    expect(existsSync(resolve(appRoot, 'src/generated/operation-refs.ts'))).toBe(false)
    expect(existsSync(resolve(appRoot, 'src/generated/operation-handles/testing.ts'))).toBe(false)

    const cleanCheckResult = runCli(operationProjectionOnlyArgs(appRoot, ['--check']), repoRoot)
    const cleanCheckReport = parseJsonOutput<{ status: string; mode: string; outOfDate: string[] }>(
      cleanCheckResult.stdout,
    )
    expect(cleanCheckResult.status, `${cleanCheckResult.stdout}\n${cleanCheckResult.stderr}`).toBe(
      0,
    )
    expect(cleanCheckReport).toEqual(
      expect.objectContaining({
        status: 'ok',
        mode: 'check',
        outOfDate: [],
      }),
    )

    write(appRoot, 'src/generated/operation-projections.ts', '// stale\n')

    const staleCheckResult = runCli(operationProjectionOnlyArgs(appRoot, ['--check']), repoRoot)
    const staleCheckReport = parseJsonOutput<{ status: string; mode: string; outOfDate: string[] }>(
      staleCheckResult.stdout,
    )
    expect(staleCheckResult.status, `${staleCheckResult.stdout}\n${staleCheckResult.stderr}`).toBe(
      1,
    )
    expect(staleCheckReport).toEqual(
      expect.objectContaining({
        status: 'out-of-date',
        mode: 'check',
        outOfDate: ['src/generated/operation-projections.ts'],
      }),
    )
  })
})
