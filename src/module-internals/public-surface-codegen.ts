import { basename, relative, resolve } from 'node:path'

import {
  Node,
  Project,
  type CallExpression,
  type ExportAssignment,
  type ExportDeclaration,
  type ObjectLiteralExpression,
  type SourceFile,
  type VariableDeclaration,
} from 'ts-morph'

import { operationIdToHandlePath } from './operation-handle-codegen.js'

export const DEFAULT_OPERATION_CODEGEN_INCLUDE = ['convex/**/*.ts', 'shared/**/*.ts'] as const
export const DEFAULT_OPERATION_CODEGEN_EXCLUDE = ['convex/components/**'] as const
export const DEFAULT_MCP_TOOL_CODEGEN_INCLUDE = ['server/mcp/tools/**/*.ts'] as const

export interface PublicSurfaceProjectionRoot {
  name: string
  functionKind: 'query' | 'mutation' | 'action'
  supportsPreview?: boolean
}

export interface PublicSurfaceCodegenOptions {
  operationInclude?: readonly string[]
  operationExclude?: readonly string[]
  toolInclude?: readonly string[]
  projectionRoots?: readonly PublicSurfaceProjectionRoot[]
  ignoredProjectionRoots?: readonly string[]
}

export interface OperationDefinitionMetadata {
  exportName: string
  file: string
  line: number
  id: string
  name?: string
  kind: 'safe' | 'destructive'
  executeFunctionRef?: string
  contract?: OperationContractMetadata
}

export interface OperationContractMetadata {
  exportName: string
  file: string
  line: number
  description?: string
  fields?: OperationContractFieldMetadata[]
}

export interface OperationContractFieldMetadata {
  name: string
  kind: 'id' | 'unknown'
  tableName?: string
  label?: string
  description?: string
  examples?: unknown[]
  resolveWith?: string
  displayField?: string
}

export interface OperationProjectionBindingMetadata {
  operationId: string
  operationExportName: string
  exportName: string
  file: string
  line: number
  projection: 'execute' | 'preview'
  functionKind: 'query' | 'mutation' | 'action'
  targetFunctionRef: string
}

export interface ToolDefinitionMetadata {
  name: string
  file: string
  line: number
  source: 'tool' | 'operation' | 'defineMcpTool'
  operationId?: string
  operationExportName?: string
  resolveIdFields?: string[]
  idResolutionWaiver?: {
    reason: string
  }
}

export type PublicSurfaceCodegenDiagnosticCode =
  | 'unsupported-projection-call'
  | 'unsupported-projection-conditional'
  | 'unsupported-projection-operation-reference'
  | 'unsupported-projection-re-export'

export interface PublicSurfaceCodegenDiagnostic {
  code: PublicSurfaceCodegenDiagnosticCode
  exportName: string
  file: string
  line: number
  message: string
}

export interface PublicSurfaceCodegenMetadata {
  include: {
    operations: string[]
    tools: string[]
  }
  operations: OperationDefinitionMetadata[]
  projections: OperationProjectionBindingMetadata[]
  tools: ToolDefinitionMetadata[]
  diagnostics: PublicSurfaceCodegenDiagnostic[]
}

function toPosixPath(value: string): string {
  return value.replaceAll('\\', '/')
}

function normalizeExcludePattern(value: string): string {
  return toPosixPath(value).replace(/^!+/u, '')
}

function isExcludedPath(file: string, patterns: readonly string[] = []): boolean {
  return patterns.some((pattern) => {
    const normalized = normalizeExcludePattern(pattern)
    if (normalized.endsWith('/**')) return file.startsWith(normalized.slice(0, -2))
    return file === normalized
  })
}

function isPrivateMcpSurfaceFile(rootDir: string, sourceFile: SourceFile): boolean {
  const file = toPosixPath(relative(rootDir, sourceFile.getFilePath()))
  if (!file.startsWith('server/mcp/')) return false
  return basename(file).startsWith('_')
}

function createProject(rootDir: string, include: readonly string[]): Project {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  })

  for (const pattern of include) {
    project.addSourceFilesAtPaths(resolve(rootDir, pattern))
  }

  return project
}

function unwrapExpression<T extends Node>(expression: T | undefined): Node | undefined {
  let current: Node | undefined = expression

  while (current) {
    if (
      Node.isAsExpression(current) ||
      Node.isSatisfiesExpression(current) ||
      Node.isParenthesizedExpression(current)
    ) {
      current = current.getExpression()
      continue
    }

    if (Node.isNonNullExpression(current)) {
      current = current.getExpression()
      continue
    }

    return current
  }

  return undefined
}

function isObjectAssignCall(expression: Node): boolean {
  if (!Node.isCallExpression(expression)) return false
  const callee = unwrapExpression(expression.getExpression())
  return (
    !!callee &&
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === 'assign' &&
    callee.getExpression().getText() === 'Object'
  )
}

function readPreviewOperationIdentifier(expression: Node | undefined): string | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression) return null

  if (Node.isCallExpression(unwrappedExpression)) {
    if (isObjectAssignCall(unwrappedExpression)) {
      return readPreviewOperationIdentifier(unwrappedExpression.getArguments()[0])
    }

    const previewCallee = unwrapExpression(unwrappedExpression.getExpression())
    if (!previewCallee || !Node.isIdentifier(previewCallee)) return null
    if (previewCallee.getText() !== 'previewOf') return null

    const [previewArg] = unwrappedExpression.getArguments()
    const unwrappedPreviewArg = unwrapExpression(previewArg)
    return unwrappedPreviewArg && Node.isIdentifier(unwrappedPreviewArg)
      ? unwrappedPreviewArg.getText()
      : null
  }

  if (Node.isObjectLiteralExpression(unwrappedExpression)) {
    for (const property of unwrappedExpression.getProperties()) {
      if (!Node.isSpreadAssignment(property)) continue
      const operationIdentifier = readPreviewOperationIdentifier(property.getExpression())
      if (operationIdentifier) return operationIdentifier
    }
  }

  return null
}

function readExecuteOperationIdentifier(expression: Node | undefined): string | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression) return null

  if (Node.isIdentifier(unwrappedExpression)) {
    return unwrappedExpression.getText()
  }

  if (Node.isCallExpression(unwrappedExpression) && isObjectAssignCall(unwrappedExpression)) {
    return readExecuteOperationIdentifier(unwrappedExpression.getArguments()[0])
  }

  if (Node.isObjectLiteralExpression(unwrappedExpression)) {
    for (const property of unwrappedExpression.getProperties()) {
      if (!Node.isSpreadAssignment(property)) continue

      const operationIdentifier = readExecuteOperationIdentifier(property.getExpression())
      if (operationIdentifier) return operationIdentifier
    }
  }

  return null
}

function isLikelyOperationIdentifier(value: string): boolean {
  return /(?:Operation|Descriptor|Op)$/u.test(value)
}

type CanonicalProjectionCall = {
  projection: 'execute' | 'preview'
  functionKind: 'query' | 'mutation' | 'action'
}

type ExplicitProjectionCall = CanonicalProjectionCall & {
  operationIdentifier: string
  projectionExpression: Node
  targetFunctionRef?: string
}

const defaultProjectionRoots: readonly PublicSurfaceProjectionRoot[] = [
  { name: 'mutation', functionKind: 'mutation', supportsPreview: true },
  { name: 'query', functionKind: 'query' },
  { name: 'action', functionKind: 'action' },
]

function projectionRootsFor(
  options: PublicSurfaceCodegenOptions,
): Map<string, PublicSurfaceProjectionRoot> {
  return new Map(
    (options.projectionRoots ?? defaultProjectionRoots).map((root) => [root.name, root]),
  )
}

function getCallRootIdentifier(expression: Node | undefined): string | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression || !Node.isCallExpression(unwrappedExpression)) return null

  let callee = unwrapExpression(unwrappedExpression.getExpression())
  while (callee && Node.isPropertyAccessExpression(callee)) {
    callee = unwrapExpression(callee.getExpression())
  }

  return callee && Node.isIdentifier(callee) ? callee.getText() : null
}

function readCanonicalProjectionCall(
  expression: Node | undefined,
  options: PublicSurfaceCodegenOptions = {},
): CanonicalProjectionCall | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression || !Node.isCallExpression(unwrappedExpression)) return null

  const projectionRoots = projectionRootsFor(options)
  const callee = unwrapExpression(unwrappedExpression.getExpression())
  if (!callee || !Node.isPropertyAccessExpression(callee)) return null

  if (callee.getName() === 'preview') {
    const laneExpression = unwrapExpression(callee.getExpression())
    if (!laneExpression || !Node.isPropertyAccessExpression(laneExpression)) return null

    const rootExpression = unwrapExpression(laneExpression.getExpression())
    if (
      !rootExpression ||
      !Node.isIdentifier(rootExpression) ||
      projectionRoots.get(rootExpression.getText())?.supportsPreview !== true
    ) {
      return null
    }

    const root = projectionRoots.get(rootExpression.getText())!
    return { projection: 'preview', functionKind: root.functionKind }
  }

  const rootExpression = unwrapExpression(callee.getExpression())
  if (
    !rootExpression ||
    !Node.isIdentifier(rootExpression) ||
    !projectionRoots.has(rootExpression.getText())
  ) {
    return null
  }

  const root = projectionRoots.get(rootExpression.getText())!
  return {
    projection: 'execute',
    functionKind: root.functionKind,
  }
}

function readExplicitProjectionCall(
  expression: Node | undefined,
  options: PublicSurfaceCodegenOptions = {},
  sourceFile?: SourceFile,
): ExplicitProjectionCall | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression || !Node.isCallExpression(unwrappedExpression)) return null

  const callee = unwrapExpression(unwrappedExpression.getExpression())
  if (!callee || !Node.isIdentifier(callee)) return null

  const helperName = callee.getText()
  const projection =
    helperName === 'executeOperationRef'
      ? 'execute'
      : helperName === 'previewOperationRef'
        ? 'preview'
        : null
  if (!projection) return null

  const [operationArg, projectionArg, optionsArg] = unwrappedExpression.getArguments()
  const operationIdentifier = unwrapExpression(operationArg)
  if (!operationIdentifier || !Node.isIdentifier(operationIdentifier)) return null

  const projectionExpression = resolveProjectionCallExpression(projectionArg, sourceFile)
  if (!projectionExpression) return null

  const canonicalProjection = readCanonicalProjectionCall(projectionExpression, options)
  if (!canonicalProjection) return null
  if (canonicalProjection.projection === 'preview' && projection !== 'preview') return null

  const projectionDefinition = unwrapExpression(projectionExpression.getArguments()[0])
  if (!projectionDefinition) return null

  const explicitOptions = unwrapExpression(optionsArg)
  const targetFunctionRef =
    explicitOptions && Node.isObjectLiteralExpression(explicitOptions)
      ? readStringProperty(explicitOptions, 'functionRef')
      : undefined

  return {
    operationIdentifier: operationIdentifier.getText(),
    projection,
    functionKind: canonicalProjection.functionKind,
    projectionExpression: projectionDefinition,
    ...(targetFunctionRef ? { targetFunctionRef } : {}),
  }
}

function resolveProjectionCallExpression(
  expression: Node | undefined,
  sourceFile?: SourceFile,
): CallExpression | null {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression) return null

  if (Node.isCallExpression(unwrappedExpression)) return unwrappedExpression

  if (sourceFile && Node.isIdentifier(unwrappedExpression)) {
    const declaration = sourceFile.getVariableDeclaration(unwrappedExpression.getText())
    const initializer = unwrapExpression(declaration?.getInitializer())
    return initializer && Node.isCallExpression(initializer) ? initializer : null
  }

  return null
}

function hasProjectionLikeExpression(
  expression: Node | undefined,
  operationsByExport: Map<string, OperationDefinitionMetadata>,
  options: PublicSurfaceCodegenOptions = {},
): boolean {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression) return false

  if (Node.isConditionalExpression(unwrappedExpression)) {
    return (
      hasProjectionLikeExpression(unwrappedExpression.getWhenTrue(), operationsByExport, options) ||
      hasProjectionLikeExpression(unwrappedExpression.getWhenFalse(), operationsByExport, options)
    )
  }

  if (!Node.isCallExpression(unwrappedExpression)) return false
  const rootIdentifier = getCallRootIdentifier(unwrappedExpression)
  if (rootIdentifier && options.ignoredProjectionRoots?.includes(rootIdentifier)) return false
  if (readCanonicalProjectionCall(unwrappedExpression, options)) return true
  if (
    readExplicitProjectionCall(unwrappedExpression, options, unwrappedExpression.getSourceFile())
  ) {
    return true
  }

  const [firstArg] = unwrappedExpression.getArguments()
  const executeOperationIdentifier = readExecuteOperationIdentifier(firstArg)
  if (executeOperationIdentifier && operationsByExport.has(executeOperationIdentifier)) return true

  const previewOperationIdentifier = readPreviewOperationIdentifier(firstArg)
  return !!previewOperationIdentifier && operationsByExport.has(previewOperationIdentifier)
}

function createProjectionDiagnostic(
  rootDir: string,
  declaration: VariableDeclaration,
  code: PublicSurfaceCodegenDiagnosticCode,
  message: string,
): PublicSurfaceCodegenDiagnostic {
  return {
    code,
    exportName: declaration.getName(),
    file: toPosixPath(relative(rootDir, declaration.getSourceFile().getFilePath())),
    line: declaration.getNameNode().getStartLineNumber(),
    message,
  }
}

function readStringProperty(node: ObjectLiteralExpression, name: string): string | undefined {
  const property = node.getProperty(name)
  if (!property || !Node.isPropertyAssignment(property)) return undefined
  const initializer = unwrapExpression(property.getInitializer())
  if (!initializer) return undefined

  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText()
  }

  return undefined
}

function readObjectProperty(
  node: ObjectLiteralExpression,
  name: string,
): ObjectLiteralExpression | undefined {
  const property = node.getProperty(name)
  if (!property || !Node.isPropertyAssignment(property)) return undefined
  const initializer = unwrapExpression(property.getInitializer())
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : undefined
}

function readPropertyName(node: Node): string | null {
  if (Node.isIdentifier(node)) return node.getText()
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText()
  }
  return null
}

function readStaticValue(expression: Node | undefined): unknown {
  const unwrapped = unwrapExpression(expression)
  if (!unwrapped) return undefined

  if (Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.getLiteralText()
  }

  if (Node.isNumericLiteral(unwrapped)) return Number(unwrapped.getText())
  if (unwrapped.getText() === 'true') return true
  if (unwrapped.getText() === 'false') return false
  if (unwrapped.getText() === 'null') return null

  return undefined
}

function readStaticArrayProperty(
  node: ObjectLiteralExpression,
  name: string,
): unknown[] | undefined {
  const property = node.getProperty(name)
  if (!property || !Node.isPropertyAssignment(property)) return undefined
  const initializer = unwrapExpression(property.getInitializer())
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) return undefined

  const values = initializer.getElements().map((element) => readStaticValue(element))
  return values.every((value) => value !== undefined) ? values : undefined
}

function readFalseProperty(node: ObjectLiteralExpression, name: string): boolean {
  const property = node.getProperty(name)
  if (!property || !Node.isPropertyAssignment(property)) return false
  const initializer = unwrapExpression(property.getInitializer())
  return initializer?.getText() === 'false'
}

function readExplicitIdOverride(expression: Node | undefined): string | undefined {
  const unwrappedExpression = unwrapExpression(expression)
  if (!unwrappedExpression) return undefined

  if (Node.isObjectLiteralExpression(unwrappedExpression)) {
    return readStringProperty(unwrappedExpression, 'id')
  }

  if (Node.isCallExpression(unwrappedExpression) && isObjectAssignCall(unwrappedExpression)) {
    const args = unwrappedExpression.getArguments()
    for (let index = args.length - 1; index >= 0; index -= 1) {
      const explicitId = readExplicitIdOverride(args[index])
      if (explicitId) return explicitId
    }
  }

  return undefined
}

function deriveProjectionTargetFunctionRef(
  operation: OperationDefinitionMetadata,
  projection: 'execute' | 'preview',
  projectionExpression: Node,
): string {
  if (projection === 'execute' && operation.executeFunctionRef) return operation.executeFunctionRef

  const explicitId = readExplicitIdOverride(projectionExpression)
  if (explicitId) return explicitId

  if (projection === 'preview') return `${operation.id}:preview`

  return operation.id
}

function readNestedStringProperty(
  node: ObjectLiteralExpression,
  parentName: string,
  childName: string,
): string | undefined {
  const property = node.getProperty(parentName)
  if (!property || !Node.isPropertyAssignment(property)) return undefined
  const initializer = unwrapExpression(property.getInitializer())
  if (!initializer || !Node.isObjectLiteralExpression(initializer)) return undefined
  return readStringProperty(initializer, childName)
}

function readPropertyPath(expression: Node | undefined): string[] | null {
  const unwrapped = unwrapExpression(expression)
  if (!unwrapped) return null
  if (Node.isIdentifier(unwrapped)) return [unwrapped.getText()]

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const parent = readPropertyPath(unwrapped.getExpression())
    return parent ? [...parent, unwrapped.getName()] : null
  }

  return null
}

function readStringLiteralExpression(expression: Node | undefined): string | null {
  const unwrapped = unwrapExpression(expression)
  if (!unwrapped) return null
  if (Node.isStringLiteral(unwrapped) || Node.isNoSubstitutionTemplateLiteral(unwrapped)) {
    return unwrapped.getLiteralText()
  }

  return null
}

function createOperationsByHandlePath(
  operations: OperationDefinitionMetadata[],
): Map<string, OperationDefinitionMetadata> {
  const pathCounts = new Map<string, number>()
  const pathEntries = operations.map((operation) => {
    const path = operationIdToHandlePath(operation.id).join('.')
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1)
    return [path, operation] as const
  })

  return new Map(pathEntries.filter(([path]) => pathCounts.get(path) === 1))
}

function createOperationsById(
  operations: OperationDefinitionMetadata[],
): Map<string, OperationDefinitionMetadata> {
  const idCounts = new Map<string, number>()
  for (const operation of operations) {
    idCounts.set(operation.id, (idCounts.get(operation.id) ?? 0) + 1)
  }

  return new Map(
    operations
      .filter((operation) => idCounts.get(operation.id) === 1)
      .map((operation) => [operation.id, operation]),
  )
}

function readOperationHandleMetadata(
  expression: Node | undefined,
  operationsByHandlePath: Map<string, OperationDefinitionMetadata>,
  operationsById: Map<string, OperationDefinitionMetadata>,
): OperationDefinitionMetadata | undefined {
  const unwrapped = unwrapExpression(expression)
  if (!unwrapped) return undefined

  if (Node.isElementAccessExpression(unwrapped)) {
    const path = readPropertyPath(unwrapped.getExpression())
    if (path?.join('.') !== 'operations.byId') return undefined
    const operationId = readStringLiteralExpression(unwrapped.getArgumentExpression())
    return operationId ? operationsById.get(operationId) : undefined
  }

  const path = readPropertyPath(unwrapped)
  if (!path || path[0] !== 'operations' || path.length < 2) return undefined
  return operationsByHandlePath.get(path.slice(1).join('.'))
}

function readDefineArgsObject(declaration: VariableDeclaration): ObjectLiteralExpression | null {
  const initializer = unwrapExpression(declaration.getInitializer())
  if (!initializer || !Node.isCallExpression(initializer)) return null
  const callee = unwrapExpression(initializer.getExpression())
  if (!callee || !Node.isIdentifier(callee) || callee.getText() !== 'defineArgs') return null

  const [firstArg] = initializer.getArguments()
  const definition = unwrapExpression(firstArg)
  return definition && Node.isObjectLiteralExpression(definition) ? definition : null
}

function readIdValidatorTableName(expression: Node | undefined): string | undefined {
  const unwrapped = unwrapExpression(expression)
  if (!unwrapped || !Node.isCallExpression(unwrapped)) return undefined

  const callee = unwrapExpression(unwrapped.getExpression())
  if (!callee || !Node.isPropertyAccessExpression(callee)) return undefined

  if (callee.getName() === 'optional') {
    return readIdValidatorTableName(unwrapped.getArguments()[0])
  }

  if (callee.getName() !== 'id') return undefined

  const tableName = readStringLiteralExpression(unwrapped.getArguments()[0])
  return tableName ?? undefined
}

function readFieldMeta(
  meta: ObjectLiteralExpression | undefined,
  fieldName: string,
): ObjectLiteralExpression | undefined {
  const property = meta?.getProperty(fieldName)
  if (!property || !Node.isPropertyAssignment(property)) return undefined
  const initializer = unwrapExpression(property.getInitializer())
  return initializer && Node.isObjectLiteralExpression(initializer) ? initializer : undefined
}

function extractArgsDefinitionFields(
  definition: ObjectLiteralExpression,
): OperationContractFieldMetadata[] | undefined {
  const args = readObjectProperty(definition, 'args')
  if (!args) return undefined

  const meta = readObjectProperty(definition, 'meta')
  const fields: OperationContractFieldMetadata[] = []

  for (const property of args.getProperties()) {
    if (!Node.isPropertyAssignment(property)) continue

    const fieldName = readPropertyName(property.getNameNode())
    if (!fieldName) continue

    const fieldMeta = readFieldMeta(meta, fieldName)
    const tableName = readIdValidatorTableName(property.getInitializer())
    const examples = fieldMeta ? readStaticArrayProperty(fieldMeta, 'examples') : undefined
    const label = fieldMeta ? readStringProperty(fieldMeta, 'label') : undefined
    const description = fieldMeta ? readStringProperty(fieldMeta, 'description') : undefined
    const resolveWith = fieldMeta ? readStringProperty(fieldMeta, 'resolveWith') : undefined
    const displayField = fieldMeta ? readStringProperty(fieldMeta, 'displayField') : undefined
    const hasFieldMetadata =
      !!label || !!description || !!examples || !!resolveWith || !!displayField

    if (!tableName && !hasFieldMetadata) continue

    fields.push({
      name: fieldName,
      kind: tableName ? 'id' : 'unknown',
      ...(tableName ? { tableName } : {}),
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      ...(examples ? { examples } : {}),
      ...(resolveWith ? { resolveWith } : {}),
      ...(displayField ? { displayField } : {}),
    })
  }

  fields.sort((a, b) => a.name.localeCompare(b.name))
  return fields.length > 0 ? fields : undefined
}

function extractArgsDefinitions(
  rootDir: string,
  sourceFile: SourceFile,
): OperationContractMetadata[] {
  const argsDefinitions: OperationContractMetadata[] = []

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const definition = readDefineArgsObject(declaration)
    if (!definition) continue
    const fields = extractArgsDefinitionFields(definition)

    argsDefinitions.push({
      exportName: declaration.getName(),
      file: toPosixPath(relative(rootDir, sourceFile.getFilePath())),
      line: declaration.getNameNode().getStartLineNumber(),
      ...(readStringProperty(definition, 'description')
        ? { description: readStringProperty(definition, 'description') }
        : {}),
      ...(fields ? { fields } : {}),
    })
  }

  return argsDefinitions
}

function createArgsDefinitionsByExport(
  argsDefinitions: OperationContractMetadata[],
): Map<string, OperationContractMetadata> {
  const exportCounts = new Map<string, number>()
  for (const argsDefinition of argsDefinitions) {
    exportCounts.set(
      argsDefinition.exportName,
      (exportCounts.get(argsDefinition.exportName) ?? 0) + 1,
    )
  }

  return new Map(
    argsDefinitions
      .filter((argsDefinition) => exportCounts.get(argsDefinition.exportName) === 1)
      .map((argsDefinition) => [argsDefinition.exportName, argsDefinition]),
  )
}

function readOperationContractMetadata(
  definition: ObjectLiteralExpression,
  argsDefinitionsByExport: Map<string, OperationContractMetadata>,
): OperationContractMetadata | undefined {
  const argsProperty = definition.getProperty('args')
  if (!argsProperty || !Node.isPropertyAssignment(argsProperty)) return undefined
  const initializer = unwrapExpression(argsProperty.getInitializer())
  if (!initializer || !Node.isPropertyAccessExpression(initializer)) return undefined
  if (initializer.getName() !== 'args') return undefined

  const contractExpression = unwrapExpression(initializer.getExpression())
  if (!contractExpression || !Node.isIdentifier(contractExpression)) return undefined

  return argsDefinitionsByExport.get(contractExpression.getText())
}

type ReadOperationDefinitionResult = {
  definition: ObjectLiteralExpression
  kind?: 'safe' | 'destructive'
}

function readOperationDefinitionObject(
  declaration: VariableDeclaration,
): ReadOperationDefinitionResult | null {
  if (!declaration.getVariableStatement()?.isExported()) return null

  const initializer = unwrapExpression(declaration.getInitializer())
  if (!initializer || !Node.isCallExpression(initializer)) return null

  const callee = unwrapExpression(initializer.getExpression())
  if (
    Node.isIdentifier(callee) &&
    (callee.getText() === 'defineOperation' || callee.getText() === 'defineOperationDescriptor')
  ) {
    const [arg] = initializer.getArguments()
    const unwrappedArg = unwrapExpression(arg)
    return unwrappedArg && Node.isObjectLiteralExpression(unwrappedArg)
      ? { definition: unwrappedArg }
      : null
  }

  if (callee && Node.isPropertyAccessExpression(callee)) {
    const operationKind = callee.getName()
    if (
      ['query', 'mutation', 'publicMutation', 'destructive'].includes(operationKind) &&
      callee.getExpression().getText() === 'operation'
    ) {
      const [arg] = initializer.getArguments()
      const unwrappedArg = unwrapExpression(arg)
      return unwrappedArg && Node.isObjectLiteralExpression(unwrappedArg)
        ? {
            definition: unwrappedArg,
            kind: operationKind === 'destructive' ? 'destructive' : 'safe',
          }
        : null
    }
  }

  if (!callee || !Node.isCallExpression(callee)) return null
  const inner = unwrapExpression(callee.getExpression())
  if (!inner || !Node.isPropertyAccessExpression(inner)) return null
  if (inner.getName() !== 'withContext') return null
  if (inner.getExpression().getText() !== 'defineOperation') return null

  const [arg] = initializer.getArguments()
  const unwrappedArg = unwrapExpression(arg)
  return unwrappedArg && Node.isObjectLiteralExpression(unwrappedArg)
    ? { definition: unwrappedArg }
    : null
}

function extractOperationDefinitions(
  rootDir: string,
  sourceFile: SourceFile,
  argsDefinitionsByExport: Map<string, OperationContractMetadata>,
): OperationDefinitionMetadata[] {
  const operations: OperationDefinitionMetadata[] = []

  for (const declaration of sourceFile.getVariableDeclarations()) {
    const operationDefinition = readOperationDefinitionObject(declaration)
    if (!operationDefinition) continue
    const { definition } = operationDefinition

    const id = readStringProperty(definition, 'id')
    if (!id) continue
    const contract = readOperationContractMetadata(definition, argsDefinitionsByExport)

    operations.push({
      exportName: declaration.getName(),
      file: toPosixPath(relative(rootDir, sourceFile.getFilePath())),
      line: declaration.getNameNode().getStartLineNumber(),
      id,
      ...(readStringProperty(definition, 'name')
        ? { name: readStringProperty(definition, 'name') }
        : {}),
      kind:
        operationDefinition.kind ??
        (readStringProperty(definition, 'kind') as 'safe' | 'destructive' | undefined) ??
        'safe',
      ...(readStringProperty(definition, 'executeFunctionRef')
        ? { executeFunctionRef: readStringProperty(definition, 'executeFunctionRef') }
        : {}),
      ...(contract ? { contract } : {}),
    })
  }

  return operations
}

function extractOperationImplementationAliases(
  sourceFile: SourceFile,
  operationsByExport: Map<string, OperationDefinitionMetadata>,
): Map<string, OperationDefinitionMetadata> {
  const aliases = new Map<string, OperationDefinitionMetadata>()

  for (const declaration of sourceFile.getVariableDeclarations()) {
    if (!declaration.getVariableStatement()?.isExported()) continue

    const initializer = unwrapExpression(declaration.getInitializer())
    if (!initializer || !Node.isCallExpression(initializer)) continue

    const callee = unwrapExpression(initializer.getExpression())
    if (!callee || !Node.isIdentifier(callee) || callee.getText() !== 'implementOperation') {
      continue
    }

    const descriptor = unwrapExpression(initializer.getArguments()[0])
    if (!descriptor || !Node.isIdentifier(descriptor)) continue

    const operation = operationsByExport.get(descriptor.getText())
    if (!operation) continue

    aliases.set(declaration.getName(), operation)
  }

  return aliases
}

function extractProjectionBinding(
  rootDir: string,
  declaration: VariableDeclaration,
  operationsByExport: Map<string, OperationDefinitionMetadata>,
  options: { requireExport?: boolean } = {},
  codegenOptions: PublicSurfaceCodegenOptions = {},
): OperationProjectionBindingMetadata | null {
  if ((options.requireExport ?? true) && !declaration.getVariableStatement()?.isExported()) {
    return null
  }

  const initializer = unwrapExpression(declaration.getInitializer())
  if (!initializer || !Node.isCallExpression(initializer)) return null

  const explicitProjectionCall = readExplicitProjectionCall(
    initializer,
    codegenOptions,
    declaration.getSourceFile(),
  )
  if (explicitProjectionCall) {
    const operation = operationsByExport.get(explicitProjectionCall.operationIdentifier)
    if (!operation) return null

    return {
      operationId: operation.id,
      operationExportName: operation.exportName,
      exportName: declaration.getName(),
      file: toPosixPath(relative(rootDir, declaration.getSourceFile().getFilePath())),
      line: declaration.getNameNode().getStartLineNumber(),
      projection: explicitProjectionCall.projection,
      functionKind: explicitProjectionCall.functionKind,
      targetFunctionRef:
        explicitProjectionCall.targetFunctionRef ??
        deriveProjectionTargetFunctionRef(
          operation,
          explicitProjectionCall.projection,
          explicitProjectionCall.projectionExpression,
        ),
    }
  }

  const [firstArg] = initializer.getArguments()
  const unwrappedFirstArg = unwrapExpression(firstArg)
  if (!unwrappedFirstArg) return null

  const projectionCall = readCanonicalProjectionCall(initializer, codegenOptions)
  if (!projectionCall) return null

  if (projectionCall.projection === 'preview') {
    const previewOperationIdentifier = readExecuteOperationIdentifier(unwrappedFirstArg)
    if (!previewOperationIdentifier) return null

    const operation = operationsByExport.get(previewOperationIdentifier)
    if (!operation) return null

    return {
      operationId: operation.id,
      operationExportName: operation.exportName,
      exportName: declaration.getName(),
      file: toPosixPath(relative(rootDir, declaration.getSourceFile().getFilePath())),
      line: declaration.getNameNode().getStartLineNumber(),
      projection: 'preview',
      functionKind: projectionCall.functionKind,
      targetFunctionRef: deriveProjectionTargetFunctionRef(operation, 'preview', unwrappedFirstArg),
    }
  }

  const previewOperationIdentifier = readPreviewOperationIdentifier(unwrappedFirstArg)
  if (previewOperationIdentifier) {
    const operation = operationsByExport.get(previewOperationIdentifier)
    if (!operation) return null

    return {
      operationId: operation.id,
      operationExportName: operation.exportName,
      exportName: declaration.getName(),
      file: toPosixPath(relative(rootDir, declaration.getSourceFile().getFilePath())),
      line: declaration.getNameNode().getStartLineNumber(),
      projection: 'preview',
      functionKind: projectionCall.functionKind,
      targetFunctionRef: deriveProjectionTargetFunctionRef(operation, 'preview', unwrappedFirstArg),
    }
  }

  const executeOperationIdentifier = readExecuteOperationIdentifier(unwrappedFirstArg)
  if (!executeOperationIdentifier) return null

  const operation = operationsByExport.get(executeOperationIdentifier)
  if (!operation) return null

  return {
    operationId: operation.id,
    operationExportName: operation.exportName,
    exportName: declaration.getName(),
    file: toPosixPath(relative(rootDir, declaration.getSourceFile().getFilePath())),
    line: declaration.getNameNode().getStartLineNumber(),
    projection: 'execute',
    functionKind: projectionCall.functionKind,
    targetFunctionRef: deriveProjectionTargetFunctionRef(operation, 'execute', unwrappedFirstArg),
  }
}

function extractProjectionDiagnostic(
  rootDir: string,
  declaration: VariableDeclaration,
  operationsByExport: Map<string, OperationDefinitionMetadata>,
  options: PublicSurfaceCodegenOptions = {},
): PublicSurfaceCodegenDiagnostic | null {
  if (!declaration.getVariableStatement()?.isExported()) return null

  const initializer = unwrapExpression(declaration.getInitializer())
  if (!initializer) return null

  if (Node.isConditionalExpression(initializer)) {
    return hasProjectionLikeExpression(initializer, operationsByExport, options)
      ? createProjectionDiagnostic(
          rootDir,
          declaration,
          'unsupported-projection-conditional',
          `Conditional operation projections are unsupported for "${declaration.getName()}". Use one direct exported lane call per operation projection.`,
        )
      : null
  }

  if (!Node.isCallExpression(initializer)) return null
  const rootIdentifier = getCallRootIdentifier(initializer)
  if (rootIdentifier && options.ignoredProjectionRoots?.includes(rootIdentifier)) return null

  const explicitProjectionCall = readExplicitProjectionCall(
    initializer,
    options,
    declaration.getSourceFile(),
  )
  if (explicitProjectionCall) {
    return isLikelyOperationIdentifier(explicitProjectionCall.operationIdentifier) &&
      !operationsByExport.has(explicitProjectionCall.operationIdentifier)
      ? createProjectionDiagnostic(
          rootDir,
          declaration,
          'unsupported-projection-operation-reference',
          `Unsupported operation projection "${declaration.getName()}". Pass the operation export directly to the projection helper.`,
        )
      : null
  }

  const [firstArg] = initializer.getArguments()
  const callee = unwrapExpression(initializer.getExpression())
  if (callee && Node.isIdentifier(callee) && callee.getText() === 'implementOperation') {
    return null
  }

  const projectionCall = readCanonicalProjectionCall(initializer, options)
  if (projectionCall) {
    const operationIdentifier = readExecuteOperationIdentifier(firstArg)
    return operationIdentifier &&
      isLikelyOperationIdentifier(operationIdentifier) &&
      !operationsByExport.has(operationIdentifier)
      ? createProjectionDiagnostic(
          rootDir,
          declaration,
          'unsupported-projection-operation-reference',
          `Unsupported operation projection "${declaration.getName()}". Pass the operation export directly to the lane call.`,
        )
      : null
  }

  const executeOperationIdentifier = readExecuteOperationIdentifier(firstArg)
  if (executeOperationIdentifier && operationsByExport.has(executeOperationIdentifier)) {
    return createProjectionDiagnostic(
      rootDir,
      declaration,
      'unsupported-projection-call',
      `Unsupported operation projection "${declaration.getName()}". Use a direct lane call such as mutation.workspace(${executeOperationIdentifier}).`,
    )
  }

  const previewOperationIdentifier = readPreviewOperationIdentifier(firstArg)
  if (previewOperationIdentifier && operationsByExport.has(previewOperationIdentifier)) {
    return createProjectionDiagnostic(
      rootDir,
      declaration,
      'unsupported-projection-call',
      `Unsupported operation projection "${declaration.getName()}". Use a direct lane preview call such as mutation.workspace.preview(${previewOperationIdentifier}).`,
    )
  }

  return null
}

function createProjectionReExportDiagnostic(
  rootDir: string,
  exportDeclaration: ExportDeclaration,
  exportName: string,
  line: number,
): PublicSurfaceCodegenDiagnostic {
  return {
    code: 'unsupported-projection-re-export',
    exportName,
    file: toPosixPath(relative(rootDir, exportDeclaration.getSourceFile().getFilePath())),
    line,
    message: `Re-exported operation projection "${exportName}" is unsupported. Export the direct lane call from the Convex function module instead.`,
  }
}

function extractProjectionReExportDiagnostics(
  rootDir: string,
  exportDeclaration: ExportDeclaration,
  operationsByExport: Map<string, OperationDefinitionMetadata>,
  options: PublicSurfaceCodegenOptions = {},
): PublicSurfaceCodegenDiagnostic[] {
  const targetSourceFile =
    exportDeclaration.getModuleSpecifierSourceFile() ?? exportDeclaration.getSourceFile()
  const diagnostics: PublicSurfaceCodegenDiagnostic[] = []

  for (const specifier of exportDeclaration.getNamedExports()) {
    const declaration = targetSourceFile.getVariableDeclaration(specifier.getName())
    if (!declaration) continue

    const binding = extractProjectionBinding(
      rootDir,
      declaration,
      operationsByExport,
      {
        requireExport: false,
      },
      options,
    )
    if (!binding) continue

    const exportName = specifier.getAliasNode()?.getText() ?? specifier.getName()
    diagnostics.push(
      createProjectionReExportDiagnostic(
        rootDir,
        exportDeclaration,
        exportName,
        specifier.getStartLineNumber(),
      ),
    )
  }

  return diagnostics
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function deriveToolName(sourceFile: SourceFile): string {
  const base = basename(sourceFile.getBaseNameWithoutExtension())
  return toKebabCase(base)
}

function readResolveIdFields(options: ObjectLiteralExpression | null): string[] | undefined {
  const resolveIds = options ? readObjectProperty(options, 'resolveIds') : undefined
  if (!resolveIds) return undefined

  const fields = resolveIds
    .getProperties()
    .map((property) =>
      Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)
        ? readPropertyName(property.getNameNode())
        : null,
    )
    .filter((field): field is string => !!field)
    .sort((a, b) => a.localeCompare(b))

  return fields.length > 0 ? fields : undefined
}

function readIdResolutionWaiver(
  options: ObjectLiteralExpression | null,
): ToolDefinitionMetadata['idResolutionWaiver'] {
  const agent = options ? readObjectProperty(options, 'agent') : undefined
  if (!agent || !readFalseProperty(agent, 'idResolution')) return undefined

  const reason = readStringProperty(agent, 'reason')?.trim()
  return reason ? { reason } : undefined
}

function readToolMetadata(
  rootDir: string,
  sourceFile: SourceFile,
  exportAssignment: ExportAssignment,
  operationsByExport: Map<string, OperationDefinitionMetadata>,
  operationsByHandlePath: Map<string, OperationDefinitionMetadata>,
  operationsById: Map<string, OperationDefinitionMetadata>,
): ToolDefinitionMetadata | null {
  const expression = unwrapExpression(exportAssignment.getExpression())
  if (!expression || !Node.isCallExpression(expression)) return null

  const callee = unwrapExpression(expression.getExpression())
  let source: ToolDefinitionMetadata['source'] | null = null
  let options: ObjectLiteralExpression | null = null
  let operation: OperationDefinitionMetadata | undefined

  if (Node.isIdentifier(callee)) {
    if (callee.getText() !== 'tool' && callee.getText() !== 'defineMcpTool') return null
    source = callee.getText() === 'defineMcpTool' ? 'defineMcpTool' : 'tool'
    const [firstArg] = expression.getArguments()
    const unwrappedArg = unwrapExpression(firstArg)
    options = unwrappedArg && Node.isObjectLiteralExpression(unwrappedArg) ? unwrappedArg : null
  } else if (Node.isPropertyAccessExpression(callee)) {
    if (callee.getName() === 'operation') {
      source = 'operation'
      const firstArg = unwrapExpression(expression.getArguments()[0])
      if (firstArg && Node.isIdentifier(firstArg)) {
        operation = operationsByExport.get(firstArg.getText())
      } else {
        operation = readOperationHandleMetadata(firstArg, operationsByHandlePath, operationsById)
      }
    } else if (['query', 'mutation', 'action'].includes(callee.getName())) {
      source = 'tool'
    } else {
      return null
    }
    const optionsArgIndex = callee.getName() === 'operation' ? 1 : 0
    const unwrappedArg = unwrapExpression(expression.getArguments()[optionsArgIndex])
    options = unwrappedArg && Node.isObjectLiteralExpression(unwrappedArg) ? unwrappedArg : null
  } else {
    return null
  }

  if (!source) return null
  const resolveIdFields = readResolveIdFields(options)
  const idResolutionWaiver = readIdResolutionWaiver(options)

  return {
    name:
      options &&
      (readStringProperty(options, 'name') ?? readNestedStringProperty(options, 'meta', 'name'))
        ? (readStringProperty(options, 'name') ??
            readNestedStringProperty(options, 'meta', 'name'))!
        : deriveToolName(sourceFile),
    file: toPosixPath(relative(rootDir, sourceFile.getFilePath())),
    line: exportAssignment.getStartLineNumber(),
    source,
    ...(operation
      ? {
          operationId: operation.id,
          operationExportName: operation.exportName,
        }
      : {}),
    ...(resolveIdFields ? { resolveIdFields } : {}),
    ...(idResolutionWaiver ? { idResolutionWaiver } : {}),
  }
}

function toTypeImportPath(file: string): string {
  const withoutExtension = file.replace(/\.(cts|mts|ts|tsx|js|jsx)$/, '')
  return `../../${withoutExtension}`
}

function renderTypeImports(metadata: PublicSurfaceCodegenMetadata): string {
  const lines: string[] = []

  metadata.operations.forEach((operation, index) => {
    lines.push(
      `import type { ${operation.exportName} as __trellisOperation${index} } from ${JSON.stringify(toTypeImportPath(operation.file))}`,
    )
  })

  metadata.projections.forEach((projection, index) => {
    lines.push(
      `import type { ${projection.exportName} as __trellisProjection${index} } from ${JSON.stringify(toTypeImportPath(projection.file))}`,
    )
  })

  metadata.tools.forEach((tool, index) => {
    lines.push(
      `import type __trellisTool${index} from ${JSON.stringify(toTypeImportPath(tool.file))}`,
    )
  })

  return lines.join('\n')
}

function renderInterfaceBody(lines: string[]): string {
  return lines.length > 0 ? lines.map((line) => `  ${line}`).join('\n') : ''
}

export function extractPublicSurfaceCodegenMetadata(
  rootDir: string,
  options: PublicSurfaceCodegenOptions = {},
): PublicSurfaceCodegenMetadata {
  const rawOperationInclude = [...(options.operationInclude ?? DEFAULT_OPERATION_CODEGEN_INCLUDE)]
  const operationInclude = rawOperationInclude.filter((pattern) => !pattern.startsWith('!'))
  const operationExclude = [
    ...(options.operationExclude ?? DEFAULT_OPERATION_CODEGEN_EXCLUDE),
    ...rawOperationInclude
      .filter((pattern) => pattern.startsWith('!'))
      .map((pattern) => pattern.slice(1)),
  ]
  const toolInclude = [...(options.toolInclude ?? DEFAULT_MCP_TOOL_CODEGEN_INCLUDE)]
  const project = createProject(rootDir, [...operationInclude, ...toolInclude])

  const argsDefinitions: OperationContractMetadata[] = []
  const operations: OperationDefinitionMetadata[] = []
  const projections: OperationProjectionBindingMetadata[] = []
  const tools: ToolDefinitionMetadata[] = []
  const diagnostics: PublicSurfaceCodegenDiagnostic[] = []

  for (const sourceFile of project.getSourceFiles()) {
    if (isPrivateMcpSurfaceFile(rootDir, sourceFile)) continue
    if (
      isExcludedPath(toPosixPath(relative(rootDir, sourceFile.getFilePath())), operationExclude)
    ) {
      continue
    }

    argsDefinitions.push(...extractArgsDefinitions(rootDir, sourceFile))
  }

  const argsDefinitionsByExport = createArgsDefinitionsByExport(argsDefinitions)

  for (const sourceFile of project.getSourceFiles()) {
    if (isPrivateMcpSurfaceFile(rootDir, sourceFile)) continue
    if (
      isExcludedPath(toPosixPath(relative(rootDir, sourceFile.getFilePath())), operationExclude)
    ) {
      continue
    }

    const fileOperations = extractOperationDefinitions(rootDir, sourceFile, argsDefinitionsByExport)

    operations.push(...fileOperations)
  }

  const operationExportCounts = new Map<string, number>()
  for (const operation of operations) {
    operationExportCounts.set(
      operation.exportName,
      (operationExportCounts.get(operation.exportName) ?? 0) + 1,
    )
  }
  const operationsByExport = new Map(
    operations
      .filter((operation) => operationExportCounts.get(operation.exportName) === 1)
      .map((operation) => [operation.exportName, operation]),
  )
  const operationsByHandlePath = createOperationsByHandlePath(operations)
  const operationsById = createOperationsById(operations)
  const projectionOperationsByExport = new Map(operationsByExport)

  for (const sourceFile of project.getSourceFiles()) {
    if (isPrivateMcpSurfaceFile(rootDir, sourceFile)) continue
    if (
      isExcludedPath(toPosixPath(relative(rootDir, sourceFile.getFilePath())), operationExclude)
    ) {
      continue
    }

    for (const [alias, operation] of extractOperationImplementationAliases(
      sourceFile,
      operationsByExport,
    )) {
      if (!projectionOperationsByExport.has(alias)) {
        projectionOperationsByExport.set(alias, operation)
      }
    }
  }

  for (const sourceFile of project.getSourceFiles()) {
    if (isPrivateMcpSurfaceFile(rootDir, sourceFile)) continue
    if (
      isExcludedPath(toPosixPath(relative(rootDir, sourceFile.getFilePath())), operationExclude)
    ) {
      continue
    }

    for (const declaration of sourceFile.getVariableDeclarations()) {
      const binding = extractProjectionBinding(
        rootDir,
        declaration,
        projectionOperationsByExport,
        {},
        options,
      )
      if (binding) {
        projections.push(binding)
        continue
      }

      const diagnostic = extractProjectionDiagnostic(
        rootDir,
        declaration,
        projectionOperationsByExport,
        options,
      )
      if (diagnostic) diagnostics.push(diagnostic)
    }

    for (const exportAssignment of sourceFile.getExportAssignments()) {
      const tool = readToolMetadata(
        rootDir,
        sourceFile,
        exportAssignment,
        projectionOperationsByExport,
        operationsByHandlePath,
        operationsById,
      )
      if (tool) tools.push(tool)
    }

    for (const exportDeclaration of sourceFile.getExportDeclarations()) {
      diagnostics.push(
        ...extractProjectionReExportDiagnostics(
          rootDir,
          exportDeclaration,
          projectionOperationsByExport,
          options,
        ),
      )
    }
  }

  operations.sort((a, b) => a.id.localeCompare(b.id) || a.file.localeCompare(b.file))
  projections.sort(
    (a, b) =>
      a.operationId.localeCompare(b.operationId) ||
      a.projection.localeCompare(b.projection) ||
      a.file.localeCompare(b.file),
  )
  tools.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file))
  diagnostics.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.exportName.localeCompare(b.exportName),
  )

  return {
    include: {
      operations: operationInclude,
      tools: toolInclude,
    },
    operations,
    projections,
    tools,
    diagnostics,
  }
}

export function renderPublicSurfaceCodegenTypes(metadata: PublicSurfaceCodegenMetadata): string {
  const imports = renderTypeImports(metadata)

  const operationsById = metadata.operations.map(
    (operation, index) => `${JSON.stringify(operation.id)}: typeof __trellisOperation${index}`,
  )

  const operationExecutionsById = metadata.projections
    .filter((projection) => projection.projection === 'execute')
    .map((projection) => {
      const projectionIndex = metadata.projections.indexOf(projection)
      return `${JSON.stringify(projection.operationId)}: typeof __trellisProjection${projectionIndex}`
    })

  const operationPreviewsById = metadata.projections
    .filter((projection) => projection.projection === 'preview')
    .map((projection) => {
      const projectionIndex = metadata.projections.indexOf(projection)
      return `${JSON.stringify(projection.operationId)}: typeof __trellisProjection${projectionIndex}`
    })

  const toolsByName = metadata.tools.map(
    (tool, index) => `${JSON.stringify(tool.name)}: typeof __trellisTool${index}`,
  )

  return `// AUTO-GENERATED. Do not edit.
// Source operations: ${metadata.include.operations.join(', ')}
// Source tools: ${metadata.include.tools.join(', ')}

import '@lupinum/trellis/backend'
import '@lupinum/trellis/mcp'
${imports}${imports ? '\n' : ''}

declare module '@lupinum/trellis/backend' {
  interface OperationsById {
${renderInterfaceBody(operationsById)}
  }

  interface OperationExecutionsById {
${renderInterfaceBody(operationExecutionsById)}
  }

  interface OperationPreviewsById {
${renderInterfaceBody(operationPreviewsById)}
  }
}

declare module '@lupinum/trellis/mcp' {
  interface ToolsByName {
${renderInterfaceBody(toolsByName)}
  }
}
`
}

export function renderPublicSurfaceCodegenMetadata(metadata: PublicSurfaceCodegenMetadata): string {
  return `${JSON.stringify(metadata, null, 2)}\n`
}

export function shouldRefreshPublicSurfaceCodegen(changedPath: string): boolean {
  const normalizedPath = toPosixPath(changedPath)
  if (!normalizedPath.endsWith('.ts')) return false
  if (normalizedPath.startsWith('server/mcp/') && basename(normalizedPath).startsWith('_')) {
    return false
  }

  return (
    normalizedPath.startsWith('convex/') ||
    normalizedPath.startsWith('shared/') ||
    normalizedPath.startsWith('server/mcp/tools/')
  )
}
