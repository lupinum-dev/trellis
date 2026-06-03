import { collectModuleValidationFindings } from '../../analysis/validation.js'
import { resolvePermissionQuerySetup } from '../../module-internals/setup.js'
import {
  getIdentityForwardingKeyProductionIssue,
  minimumIdentityForwardingKeyLength,
} from '../../runtime/identity-forwarding/shared.js'
import type { DoctorFinding, DoctorReport } from './findings.js'
import { summarizeFindings } from './findings.js'
import { collectInventoryDoctorFindings } from './inventory-findings.js'
import {
  collectTrellisCliInventory,
  collectTrellisCliInventoryFacts,
  type TrellisCliInventory,
  type TrellisCliInventoryFacts,
} from './inventory.js'
import { collectPermissionInventoryFindings } from './permission-metadata.js'
import {
  findConvexUrlSource,
  findEnvKeySource,
  findConvexHttpSource,
  findConvexAuthSource,
  findConfiguredPermissionQueryPath,
  findMissingCanonicalLayoutPaths,
  hasBetterAuthBootstrapExport,
  hasBetterConvexNuxtRegistration,
  hasBetterAuthRouteRegistration,
  hasDependency,
  hasNitroAsyncContextEnabled,
  classifyTrellisApp,
  inspectProject,
  isAuthBootstrapExplicitlyDisabled,
  isAuthExplicitlyEnabled,
  usesTrellisUsersTable,
  type ProjectInspection,
  type TrellisAppClassification,
} from './project.js'

const canonicalPackageManager = 'pnpm@11.5.0'
const canonicalNodeEngine = '>=22.12.0'

function formatIntegrationOwners(owners: TrellisAppClassification['integrationOwners']): string {
  return owners.map((owner) => `${owner.label} (${owner.packageName})`).join(', ')
}

function readPackageString(project: ProjectInspection, key: string): string | null {
  const value = project.packageJson?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readPackageRecordString(
  project: ProjectInspection,
  parentKey: string,
  childKey: string,
): string | null {
  const parent = project.packageJson?.[parentKey]
  if (!parent || typeof parent !== 'object' || Array.isArray(parent)) return null
  const value = (parent as Record<string, unknown>)[childKey]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function hasCanonicalMcpBearerAuth(project: ProjectInspection): boolean {
  const middleware = project.sourceFiles.find((file) =>
    /[/\\]server[/\\]middleware[/\\]mcp-auth\.[cm]?[jt]s$/u.test(file.path),
  )
  if (!middleware) return false

  return (
    middleware.text.includes('MCP bearer token required.') &&
    middleware.text.includes('api.features.mcpKeys.domain.validate') &&
    middleware.text.includes("auth: 'none'")
  )
}

function expectsCanonicalMcpBearerAuth(project: ProjectInspection): boolean {
  return project.sourceFiles.some((file) =>
    /[/\\](?:server[/\\]middleware[/\\]mcp-auth|convex[/\\]features[/\\]mcpKeys[/\\]domain)\.[cm]?[jt]s$/u.test(
      file.path,
    ),
  )
}

function formatIntegrationDoctorCommand(
  owners: TrellisAppClassification['integrationOwners'],
): string {
  const commands = owners
    .map((owner) => owner.doctorCommand)
    .filter((command): command is string => typeof command === 'string' && command.length > 0)

  return commands.length > 0 ? commands.join(' or ') : 'the integration package doctor'
}

function toDoctorFindingTitle(id: string): string {
  switch (id) {
    case 'isolation-valid':
      return 'Tenant classification validity'
    case 'isolation-table-coverage':
      return 'Tenant classification coverage'
    case 'destructive-safety-schema':
      return 'Destructive safety schema'
    case 'auth-enabled-consistency':
      return 'Auth enabled consistency'
    default:
      return id
  }
}

function createDoctorFindings(
  project: ProjectInspection,
  inventory: TrellisCliInventory,
  inventoryFacts: TrellisCliInventoryFacts,
): DoctorFinding[] {
  const cwd = project.cwd
  const isNuxtApp = Boolean(project.packageJsonPath && project.nuxtConfigPath)
  const trellisApp = classifyTrellisApp(project)
  const integrationOwners = trellisApp.integrationOwners
  const integrationManaged = trellisApp.kind === 'integration-managed'
  const directTrellisApp = trellisApp.kind === 'direct'
  const missingCanonicalLayoutPaths =
    isNuxtApp && !integrationManaged ? findMissingCanonicalLayoutPaths(project) : []
  const convexUrlSource = findConvexUrlSource(project)
  const authExpected = isNuxtApp && isAuthExplicitlyEnabled(project)
  const authBootstrapDisabled = authExpected && isAuthBootstrapExplicitlyDisabled(project)
  const siteUrlSource = findEnvKeySource(project, ['SITE_URL', 'NUXT_PUBLIC_SITE_URL'])
  const convexSiteUrlSource = findEnvKeySource(project, [
    'CONVEX_SITE_URL',
    'NUXT_PUBLIC_CONVEX_SITE_URL',
  ])
  const betterAuthSecretSource = findEnvKeySource(project, ['BETTER_AUTH_SECRET'])
  const convexHttpSource = findConvexHttpSource(project)
  const hasAuthRoutes = hasBetterAuthRouteRegistration(project)
  const convexAuthSource = findConvexAuthSource(project)
  const expectsTrellisUsers = usesTrellisUsersTable(project)
  const hasAuthBootstrap = hasBetterAuthBootstrapExport(project)
  const identityForwardingExpected = inventory.forwarding.expected
  const mcpExpected = inventory.mcp.toolCount > 0 || identityForwardingExpected
  const nitroAsyncContextEnabled = hasNitroAsyncContextEnabled(project)
  const mcpAsyncContextEffective = nitroAsyncContextEnabled || directTrellisApp
  const canonicalMcpBearerAuthExpected = expectsCanonicalMcpBearerAuth(project)
  const mcpBearerAuthConfigured = hasCanonicalMcpBearerAuth(project)
  const identityForwardingKeySource = findEnvKeySource(project, ['CONVEX_IDENTITY_FORWARDING_KEY'])
  const identityForwardingKeyIssue = identityForwardingKeySource
    ? getIdentityForwardingKeyProductionIssue(identityForwardingKeySource.value, 'production')
    : null
  const packageManager = readPackageString(project, 'packageManager')
  const nodeEngine = readPackageRecordString(project, 'engines', 'node')
  const usesPermissions = inventoryFacts.usesPermissions
  const configuredPermissionQueryPath = findConfiguredPermissionQueryPath(project)
  let permissionQueryResolutionError: Error | null = null

  if (configuredPermissionQueryPath) {
    try {
      resolvePermissionQuerySetup(cwd, configuredPermissionQueryPath)
    } catch (error) {
      permissionQueryResolutionError = error instanceof Error ? error : new Error(String(error))
    }
  }

  const baseFindings: DoctorFinding[] = [
    {
      id: 'trellis-runtime-owner',
      category: 'core',
      title: 'Trellis runtime owner',
      status:
        directTrellisApp || integrationManaged
          ? 'pass'
          : hasDependency(project, '@lupinum/trellis')
            ? 'fail'
            : 'warn',
      message: directTrellisApp
        ? integrationOwners.length > 0
          ? `Direct Trellis module registration was found. Integration metadata also exists for ${formatIntegrationOwners(integrationOwners)}, but direct Trellis layout checks remain authoritative.`
          : 'Direct @lupinum/trellis Nuxt module registration was found.'
        : integrationManaged
          ? `Trellis runtime is managed by ${formatIntegrationOwners(integrationOwners)}. Canonical Trellis app layout checks are delegated to the integration package.`
          : hasDependency(project, '@lupinum/trellis')
            ? '@lupinum/trellis is installed, but no direct module registration or integration owner was detected.'
            : 'No direct @lupinum/trellis module registration or Trellis integration owner was detected.',
      fixHint: directTrellisApp
        ? 'Run trellis doctor for direct Trellis app checks.'
        : integrationManaged
          ? `Run ${formatIntegrationDoctorCommand(integrationOwners)} for integration-specific checks.`
          : hasDependency(project, '@lupinum/trellis')
            ? 'Register @lupinum/trellis in nuxt.config.* or install/register an integration package that declares Trellis ownership.'
            : 'No action needed unless this app is expected to use Trellis directly or through an integration package.',
    },
    {
      id: 'nuxt-app-root',
      category: 'core',
      title: 'Nuxt app structure',
      status: isNuxtApp ? 'pass' : 'fail',
      message: isNuxtApp
        ? `Found package.json and ${project.nuxtConfigPath?.split('/').pop()}.`
        : 'Expected package.json and a nuxt.config.* file in the target directory.',
      fixHint: isNuxtApp
        ? 'Run the CLI inside a Nuxt app root when checking consumer setup.'
        : 'Run the command in a Nuxt project root or pass --cwd <path>.',
    },
    {
      id: 'nuxt-installed',
      category: 'core',
      title: 'Nuxt dependency',
      status: hasDependency(project, 'nuxt') ? 'pass' : 'fail',
      message: hasDependency(project, 'nuxt')
        ? 'nuxt is declared in package.json.'
        : 'nuxt is not declared in dependencies or devDependencies.',
      fixHint: hasDependency(project, 'nuxt')
        ? 'Keep Nuxt installed in the consumer app.'
        : 'Add nuxt to the app package.json.',
    },
    {
      id: 'module-installed',
      category: 'core',
      title: '@lupinum/trellis dependency',
      status: hasDependency(project, '@lupinum/trellis') || integrationManaged ? 'pass' : 'fail',
      message: hasDependency(project, '@lupinum/trellis')
        ? '@lupinum/trellis is declared in package.json.'
        : integrationManaged
          ? `Direct @lupinum/trellis dependency is not required because ${formatIntegrationOwners(integrationOwners)} owns the Trellis runtime.`
          : '@lupinum/trellis is not declared in dependencies or devDependencies.',
      fixHint:
        hasDependency(project, '@lupinum/trellis') || integrationManaged
          ? 'Keep Trellis dependency ownership aligned with the app owner.'
          : 'Add @lupinum/trellis to the app package.json.',
    },
    {
      id: 'module-registered',
      category: 'core',
      title: 'Nuxt module registration',
      status: hasBetterConvexNuxtRegistration(project) || integrationManaged ? 'pass' : 'fail',
      message: hasBetterConvexNuxtRegistration(project)
        ? 'nuxt.config registers @lupinum/trellis in modules.'
        : integrationManaged
          ? `Direct @lupinum/trellis module registration is skipped because ${formatIntegrationOwners(integrationOwners)} owns module setup.`
          : 'Could not find "@lupinum/trellis" inside the nuxt.config modules array.',
      fixHint:
        hasBetterConvexNuxtRegistration(project) || integrationManaged
          ? 'Keep module ownership aligned with the app owner.'
          : 'Add "@lupinum/trellis" to modules in nuxt.config.*.',
    },
    {
      id: 'canonical-layout',
      category: 'core',
      title: 'Canonical Trellis layout',
      status:
        !isNuxtApp || integrationManaged
          ? 'pass'
          : missingCanonicalLayoutPaths.length === 0
            ? 'pass'
            : 'fail',
      message: !isNuxtApp
        ? 'Skipping canonical layout checks because this is not a Nuxt app root.'
        : integrationManaged
          ? `Skipping canonical Trellis starter layout checks because ${formatIntegrationOwners(integrationOwners)} manages the app integration.`
          : missingCanonicalLayoutPaths.length === 0
            ? 'Found the canonical convex/, shared/features/, app/pages/, and server/ layout.'
            : `Missing canonical paths: ${missingCanonicalLayoutPaths.join(', ')}.`,
      fixHint: !isNuxtApp
        ? 'Run doctor inside a generated Trellis app root.'
        : integrationManaged
          ? `Run ${formatIntegrationDoctorCommand(integrationOwners)} for integration-specific layout checks.`
          : missingCanonicalLayoutPaths.length === 0
            ? 'Keep the generated Trellis layout intact.'
            : 'Restore the missing canonical paths or recreate the app with `trellis init <name> --template public|personal|workspace|workspace-mcp`.',
    },
    {
      id: 'convex-installed',
      category: 'core',
      title: 'Convex dependency',
      status: hasDependency(project, 'convex') ? 'pass' : 'fail',
      message: hasDependency(project, 'convex')
        ? 'convex is declared in package.json.'
        : 'convex is not declared in dependencies or devDependencies.',
      fixHint: hasDependency(project, 'convex')
        ? 'Keep Convex installed in the consumer app.'
        : 'Add convex to the app package.json.',
    },
    {
      id: 'runtime-engine-baseline',
      category: 'core',
      title: 'Runtime engine baseline',
      status: !directTrellisApp
        ? 'pass'
        : packageManager === canonicalPackageManager && nodeEngine === canonicalNodeEngine
          ? 'pass'
          : 'warn',
      message: !directTrellisApp
        ? 'Skipping canonical package engine checks because Trellis is not the direct runtime owner.'
        : packageManager === canonicalPackageManager && nodeEngine === canonicalNodeEngine
          ? `packageManager and engines.node match the generated Trellis baseline (${canonicalPackageManager}, ${canonicalNodeEngine}).`
          : `Expected packageManager ${canonicalPackageManager} and engines.node ${canonicalNodeEngine}; found packageManager ${packageManager ?? '(missing)'} and engines.node ${nodeEngine ?? '(missing)'}.`,
      fixHint: !directTrellisApp
        ? 'Run the integration-owned doctor for product-specific package engine policy.'
        : 'Align package.json with the generated Trellis baseline before comparing runtime behavior across generated apps.',
    },
    {
      id: 'convex-url-configured',
      category: 'core',
      title: 'Convex URL source',
      status: convexUrlSource ? 'pass' : 'warn',
      message: convexUrlSource
        ? `Found Convex URL configuration in ${convexUrlSource}.`
        : 'No CONVEX_URL or NUXT_PUBLIC_CONVEX_URL source was found.',
      fixHint: convexUrlSource
        ? 'Keep the Convex URL available in the environment or env files.'
        : 'Add CONVEX_URL or NUXT_PUBLIC_CONVEX_URL to .env.local, .env, or the process environment.',
    },
    {
      id: 'site-url-configured',
      category: 'auth',
      title: 'SITE_URL source',
      status: authExpected ? (siteUrlSource ? 'pass' : 'warn') : 'pass',
      message: !authExpected
        ? 'Auth is explicitly disabled in nuxt.config.'
        : siteUrlSource
          ? `Found SITE_URL configuration in ${siteUrlSource.source}.`
          : 'No SITE_URL or NUXT_PUBLIC_SITE_URL source was found.',
      fixHint: !authExpected
        ? 'No action needed unless you enable auth later.'
        : siteUrlSource
          ? 'Keep SITE_URL aligned with your app origin.'
          : 'Add SITE_URL (or NUXT_PUBLIC_SITE_URL) for Better Auth callbacks and trusted-origin checks.',
    },
    {
      id: 'convex-site-url-configured',
      category: 'auth',
      title: 'Convex site URL source',
      status: authExpected ? (convexSiteUrlSource ? 'pass' : 'warn') : 'pass',
      message: !authExpected
        ? 'Auth is explicitly disabled in nuxt.config.'
        : convexSiteUrlSource
          ? `Found Convex site URL configuration in ${convexSiteUrlSource.source}.`
          : 'No CONVEX_SITE_URL or NUXT_PUBLIC_CONVEX_SITE_URL source was found.',
      fixHint: !authExpected
        ? 'No action needed unless you enable auth later.'
        : convexSiteUrlSource
          ? 'Keep convex.siteUrl pointed at your Convex HTTP Actions origin.'
          : 'Add CONVEX_SITE_URL (or NUXT_PUBLIC_CONVEX_SITE_URL) when auth token exchange cannot be auto-derived reliably.',
    },
    {
      id: 'better-auth-secret-configured',
      category: 'auth',
      title: 'BETTER_AUTH_SECRET source',
      status: authExpected ? (betterAuthSecretSource ? 'pass' : 'warn') : 'pass',
      message: !authExpected
        ? 'Auth is explicitly disabled in nuxt.config.'
        : betterAuthSecretSource
          ? `Found BETTER_AUTH_SECRET configuration in ${betterAuthSecretSource.source}.`
          : 'No BETTER_AUTH_SECRET source was found in the local environment or env files.',
      fixHint: !authExpected
        ? 'No action needed unless you enable auth later.'
        : betterAuthSecretSource
          ? 'Keep BETTER_AUTH_SECRET synced with the Convex Better Auth deployment.'
          : 'Set BETTER_AUTH_SECRET in the Convex Dashboard and your local environment when using Better Auth.',
    },
    {
      id: 'better-auth-routes-registered',
      category: 'auth',
      title: 'Better Auth route registration',
      status: authExpected ? (hasAuthRoutes ? 'pass' : 'warn') : 'pass',
      message: !authExpected
        ? 'Auth is explicitly disabled in nuxt.config.'
        : hasAuthRoutes
          ? `Found Better Auth route registration in ${convexHttpSource?.path ?? 'convex/http.ts'}.`
          : convexHttpSource
            ? `Found ${convexHttpSource.path}, but it does not appear to call authComponent.registerRoutes(...).`
            : 'Could not find convex/http.ts with Better Auth route registration.',
      fixHint: !authExpected
        ? 'No action needed unless you enable auth later.'
        : 'Register your Better Auth bridge in convex/http.ts so the Nuxt auth proxy can exchange session cookies for Convex JWTs.',
    },
    {
      id: 'trellis-auth-bootstrap-exported',
      category: 'auth',
      title: 'Trellis auth bootstrap export',
      status:
        authExpected && expectsTrellisUsers && !authBootstrapDisabled
          ? hasAuthBootstrap
            ? 'pass'
            : 'warn'
          : 'pass',
      message: !authExpected
        ? 'Auth is explicitly disabled in nuxt.config.'
        : authBootstrapDisabled
          ? 'Trellis auth bootstrap is explicitly disabled with auth.bootstrap: false.'
          : !expectsTrellisUsers
            ? 'No Trellis users-table pattern was detected in the app source.'
            : hasAuthBootstrap
              ? `Found createUserIfNeeded export in ${convexAuthSource?.path ?? 'convex/auth.ts'}.`
              : convexAuthSource
                ? `Found ${convexAuthSource.path}, but it does not export createUserIfNeeded.`
                : 'Could not find convex/auth.ts with the Trellis auth bootstrap export.',
      fixHint:
        !authExpected || authBootstrapDisabled || !expectsTrellisUsers
          ? 'No action needed unless this app resolves actors from the Trellis users table later.'
          : 'Export `createUserIfNeeded` from defineBetterAuth(...) in convex/auth.ts so the client bootstrap can create or refresh the app user row from Convex auth identity.',
    },
    {
      id: 'permissions-query-configured',
      category: 'core',
      title: 'Permissions query wiring',
      status:
        usesPermissions && !configuredPermissionQueryPath
          ? 'fail'
          : permissionQueryResolutionError
            ? 'fail'
            : 'pass',
      message:
        usesPermissions && !configuredPermissionQueryPath
          ? 'Permission composables were detected in app code, but trellis.permissions.query is not configured in nuxt.config.'
          : permissionQueryResolutionError
            ? permissionQueryResolutionError.message
            : configuredPermissionQueryPath
              ? `Configured permissions query resolves: ${configuredPermissionQueryPath}.`
              : 'No permission-context query is configured, and no permission composables were detected.',
      fixHint:
        usesPermissions && !configuredPermissionQueryPath
          ? 'Set trellis.permissions to your backend permission-context query, for example `permissions/context.getAccessContext`.'
          : permissionQueryResolutionError
            ? 'Point trellis.permissions.query at a real exported Convex query in `convex/permissions/context.ts`.'
            : configuredPermissionQueryPath
              ? 'Keep trellis.permissions.query aligned with the exported backend permission-context query.'
              : 'No action needed unless you add useAccess() or useAuthGuard() later.',
    },
    {
      id: 'mcp-async-context-enabled',
      category: 'core',
      title: 'MCP async context',
      status: mcpExpected ? (mcpAsyncContextEffective ? 'pass' : 'fail') : 'pass',
      message: !mcpExpected
        ? 'No MCP surfaces were detected in the app source.'
        : nitroAsyncContextEnabled
          ? 'Nitro async context is enabled for MCP tool execution.'
          : directTrellisApp
            ? 'Trellis will enable Nitro async context for MCP tool execution.'
            : 'MCP surfaces were detected, but nuxt.config does not enable experimental.asyncContext.',
      fixHint: !mcpExpected
        ? 'No action needed unless you add MCP later.'
        : 'Set `experimental: { asyncContext: true }` in nuxt.config so MCP tools can read request context.',
    },
    {
      id: 'mcp-bearer-auth-configured',
      category: 'core',
      title: 'MCP bearer auth',
      status:
        mcpExpected && canonicalMcpBearerAuthExpected
          ? mcpBearerAuthConfigured
            ? 'pass'
            : 'fail'
          : 'pass',
      message: !mcpExpected
        ? 'No MCP surfaces were detected in the app source.'
        : !canonicalMcpBearerAuthExpected
          ? 'No generated workspace MCP bearer-key slice was detected.'
          : mcpBearerAuthConfigured
            ? 'Found canonical MCP bearer middleware that validates keys through the generated mcpKeys slice.'
            : 'MCP surfaces were detected, but the canonical bearer-key middleware was not found.',
      fixHint: !mcpExpected
        ? 'No action needed unless you add MCP later.'
        : !canonicalMcpBearerAuthExpected
          ? 'Use the generated workspace MCP bearer-key slice for workspace apps; custom MCP auth remains an explicit advanced surface.'
          : 'Restore server/middleware/mcp-auth.ts from `trellis add mcp`; workspace MCP must validate bearer keys before forwarding caller identity.',
    },
    {
      id: 'identity-forwarding-key-configured',
      category: 'advanced',
      title: 'Identity forwarding key source',
      status: identityForwardingExpected ? (identityForwardingKeySource ? 'pass' : 'warn') : 'pass',
      message: !identityForwardingExpected
        ? 'No identity-forwarding or MCP surfaces were detected in the app source.'
        : identityForwardingKeySource
          ? `Found CONVEX_IDENTITY_FORWARDING_KEY in ${identityForwardingKeySource.source}.`
          : 'Trusted-forwarding or MCP surfaces were detected, but no CONVEX_IDENTITY_FORWARDING_KEY source was found.',
      fixHint: !identityForwardingExpected
        ? 'No action needed unless you add MCP or identity-forwarding flows later.'
        : 'Set CONVEX_IDENTITY_FORWARDING_KEY in the local environment and the Convex deployment that serves identity-forwarding traffic.',
    },
    {
      id: 'identity-forwarding-key-strength',
      category: 'advanced',
      title: 'Identity forwarding key quality',
      status: !identityForwardingExpected
        ? 'pass'
        : !identityForwardingKeySource
          ? 'warn'
          : identityForwardingKeyIssue
            ? 'fail'
            : 'pass',
      message: !identityForwardingExpected
        ? 'No identity-forwarding or MCP surfaces were detected in the app source.'
        : !identityForwardingKeySource
          ? 'Cannot evaluate identity-forwarding key quality because no key source was found.'
          : identityForwardingKeyIssue
            ? `${identityForwardingKeyIssue} Source: ${identityForwardingKeySource.source}.`
            : `Identity forwarding key in ${identityForwardingKeySource.source} clears the production hardening checks.`,
      fixHint: !identityForwardingExpected
        ? 'No action needed unless you add MCP or identity-forwarding flows later.'
        : `Use a long random CONVEX_IDENTITY_FORWARDING_KEY (${minimumIdentityForwardingKeyLength}+ characters) and avoid placeholder or development values.`,
    },
    ...collectInventoryDoctorFindings(inventory),
    ...collectPermissionInventoryFindings(inventory, project),
  ]
  const moduleValidationFindings = directTrellisApp
    ? collectModuleValidationFindings({
        rootDir: cwd,
        authEnabled: authExpected,
      }).map(
        (finding): DoctorFinding => ({
          id: finding.id,
          category: 'core' as const,
          title: toDoctorFindingTitle(finding.id),
          status: 'fail' as const,
          message: finding.message,
          fixHint:
            finding.id === 'isolation-table-coverage' || finding.id === 'isolation-valid'
              ? 'Align convex/schema.ts, convex/features/*/feature.ts, and convex/functions.ts so the derived manifest tenant classification is complete and non-conflicting.'
              : finding.id === 'destructive-safety-schema'
                ? 'Restore the destructive-safety tables in convex/schema.ts, including the stored confirmation fields, audit fields, and `by_token_hash`, `by_jti`, and `by_expires_at` indexes.'
                : 'Align the project source with the canonical Trellis contract.',
        }),
      )
    : []

  return [...baseFindings, ...moduleValidationFindings]
}

const productionRequiredFindingIds = new Set([
  'identity-forwarding-key-configured',
  'identity-forwarding-key-strength',
  'mcp-rate-limit-store',
  'operation-tool-agreement',
])

function applyProductionProfile(findings: DoctorFinding[]): DoctorFinding[] {
  return findings.map((finding) => {
    if (finding.status !== 'warn' || !productionRequiredFindingIds.has(finding.id)) {
      return finding
    }

    return {
      ...finding,
      status: 'fail',
      message: `${finding.message} Production doctor treats this warning as a failure.`,
    }
  })
}

export async function buildDoctorReport(
  cwd: string,
  options: { production?: boolean } = {},
): Promise<DoctorReport> {
  const project = inspectProject(cwd)
  const inventoryFacts = collectTrellisCliInventoryFacts(project)
  const inventory = collectTrellisCliInventory(project, inventoryFacts)
  const baseFindings = createDoctorFindings(project, inventory, inventoryFacts)
  const findings = options.production ? applyProductionProfile(baseFindings) : baseFindings
  return {
    cwd,
    inventory,
    findings,
    summary: summarizeFindings(findings),
  }
}
