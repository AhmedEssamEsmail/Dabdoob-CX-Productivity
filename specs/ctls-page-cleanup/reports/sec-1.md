# sec report - ctls-page-cleanup - round 1 (FULL)
Verdict: PASS
Open: 0 B / 0 H / 0 M / 1 L

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | LOW | supabase/migrations/20261120121758_close_historical_ctls.sql:16-29 | Not exploitable; robustness only: a sheet date that matches `^\d{4}-\d{2}-\d{2}` but is an invalid date ('2024-13-40', '2024-02-31') still throws on `::timestamptz`/`::date`, aborting the whole migration at auto-apply on merge to main. | Tighten the guard regex to `'^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])'` (or wrap the cast in a safe-to-date helper), same for the `sla_met` branches. | supabase-expert |

## Reviewed (FULL scope — tl-1 + tl-2 changed files)
- `supabase/migrations/20261120121758_close_historical_ctls.sql` — data-only UPDATE on `qa_ctls`; idempotent WHERE guard (`status in ('open','on_hold')`); no DDL, no RLS/policy/view/function changes, no `security definer`, no grants, no secrets. Supabase checklist N/A beyond the UPDATE itself (migrations run privileged; policies unaffected).
- `src/features/cx-quality/lib/core.ts` — new `qaCtlScopeVisible_` is pure; admin sees all; non-'all'/unknown scope falls back to `tl_email === user` (fail-closed). No `user_metadata`, no client-supplied identity.
- `src/features/cx-quality/lib/server.ts` — `getQaCtlPage` keeps `qaRequireRole_(['admin','tl'])` (server-side session, L76-78). `scope` is in-memory filtering only — never interpolated into SQL/PostgREST filters, so no injection path. `canClose` is a UI hint; the mutating path `submitQaCtl` still re-checks `qaCanCloseCtl_` server-side (L1281) — no authz regression.
- `src/app/api/qa/[action]/route.ts` — new arg plumbed as `String(a[0] ?? 'mine')`; arbitrary strings are safe (only `'all'` widens, and only for an already-authorized admin/tl).
- `ctls-page.tsx`, `qa-shared.tsx` — Seg/toolbar wiring only; no `dangerouslySetInnerHTML`, no new URL/redirect, no secrets.
- `tests/quality/qa-ctl-scope.test.ts` — covers admin/TL/mine/all/unknown-scope cases.
- `actSet === null` fail-open (server.ts ~L1204): only widens list rendering to pre-change baseline visibility; it never exposes rows the caller couldn't already see — not a finding.

## Not verified / assumptions
- PLAN item 4 deliberately widens TL read access: scope 'all' lets any TL read every team's CTL rows (agent names, coaching notes, outcomes) — previously limited to own + `shift_tls` rows. Accepted as spec'd read-view; closing remains gated. Flagging for PM awareness only.
- Migration live row counts not verified (no local stack / MCP unreachable, per PLAN research notes). `npm run test:security` is a PM-run gate, not re-run here.
- Lockfile/manifest unchanged → `npm audit` not triggered.
