# Audit diff: npm-audit-before.json vs npm-audit-after.json (next@16.4.6 synced)

Counts: before 7 (all moderate) -> after 7 (all moderate). metadata.vulnerabilities identical: {info:0, low:0, moderate:7, high:0, critical:0, total:7}.

Findings whose name/via resolves to `next` or `eslint-config-next`: before 0, after 0.

After-set minus before-set: NONE (no new advisory ids/severities).
Before-set minus after-set: NONE (nothing silently resolved either).

Baseline minimatch dev-chain set present verbatim in both (all severity=moderate):
- minimatch | via: minimatch (GHSA-3ppc-4f35-3m26 family, dev chain)
- @typescript-eslint/typescript-estree | via: minimatch
- @typescript-eslint/type-utils | via: typescript-estree, utils
- @typescript-eslint/utils | via: typescript-estree
- @typescript-eslint/parser | via: typescript-estree
- @typescript-eslint/eslint-plugin | via: type-utils, utils
- typescript-eslint | via: eslint-plugin, parser, typescript-estree, utils

Conclusion: 16.4.6 sync introduced zero advisories and zero next/eslint-config-next findings; remaining 7 are the documented out-of-scope minimatch baseline (PLAN.md:17,44). No remediation performed (read-only; no `npm audit fix`, no overrides).
