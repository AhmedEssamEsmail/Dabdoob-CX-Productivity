# sec report - next-security-upgrade - round 1 (FULL)
Verdict: PASS
Open: 0B/0H/0M/0L

| ID | Sev | file:line | Attack scenario | Exact fix | Owner |
|---|---|---|---|---|---|
| — | — | — | No open findings. | — | — |

## Scope reviewed
- Change set (per `git status`/`git diff` vs HEAD + tl-3/tl-4): one source file `src/features/cx-hub/components/admin-page.tsx` (+19/-23); `src/app/refresh.css` already in HEAD via 7511b13 (CSS positioning only); 11 regenerated e2e PNGs left uncommitted and excluded (tl-4 qa-4). `package.json`, `package-lock.json`, `next.config.ts`, `playwright.config.ts`: zero diff (verified `git diff --name-only` empty).
- Version sync: `npm ls next eslint-config-next --depth=0` → both 16.4.6, no `invalid` marker; `node_modules/next/package.json` = 16.4.6. No canary, no new dependencies.

## Findings (checked, closed)
1. **Dependency state** — `npm audit --omit=dev`: 0 vulnerabilities. Full audit: 7 moderate, all dev-chain minimatch per PLAN baseline; 0 high/critical. Next.js 16.4.6 has no advisory entries in the audit output.
2. **admin-page.tsx Toggle swap** — cosmetic refactor of a custom `.cx-switch` checkbox to the canonical `Toggle` (`src/features/shared/components/ui/Toggle.tsx:16-38`, a controlled checkbox; no injection/XSS surface, no `dangerouslySetInnerHTML`). The write path `Ln.saveConfigSetting('reminders_enabled', next)` is byte-identical to the removed code (admin-page.tsx:346).
3. **AuthZ on the write path (unchanged, verified)** — `saveConfigSetting` enforces `requireRole(['admin'])` (src/features/cx-hub/lib/admin.ts:48) and `assertWritable()` view-as write guard (admin.ts:49); `/api/hub/admin` POST dispatches server-side (src/app/api/hub/admin/route.ts:33-34). No client-supplied role/identity; admin-only mutation cannot be reached by lower roles or during view-as.
4. **refresh.css (7511b13)** — `position:absolute` status spans + `:has()` padding only; CSS cannot affect authz/data flow. The commit's other tsx edits are `cx-num` className tagging — cosmetic.
5. **Secrets/config** — no `.env*`, key, or credential material in the diff; no new env vars; no CORS/header/cookie changes.

## Not verified / assumptions
- e2e/browser and build gates are QA-owned (qa-1 GREEN, qa-2 deferred env-class); not re-run by security.
- qa-2 (`deferred-qa2.md`): StrictMode double-mount → duplicate `GET /api/prod/analytics` 500 under load. Reviewed for exposure: it is availability/log noise, not a data-leak or authz issue; remediation is a schedulable dedupe, not a security gate.
- `npm audit` reflects the registry at run time; future Next.js advisories would need a fresh audit.
