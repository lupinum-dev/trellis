import { findSecuritySourcePolicyViolations } from './lib/security-source-policy.mjs'

const violations = findSecuritySourcePolicyViolations(process.cwd())

if (violations.length > 0) {
  const preview = violations
    .slice(0, 80)
    .map(
      (violation) =>
        `${violation.filePath}:${violation.line}: ${violation.policy}: ${violation.source}`,
    )
    .join('\n')
  const suffix =
    violations.length > 80 ? `\n...and ${violations.length - 80} more violation(s)` : ''
  throw new Error(
    `[trellis] security source policy failed with ${violations.length} violation(s)\n${preview}${suffix}`,
  )
}

console.log('[trellis] security source policy passed')
