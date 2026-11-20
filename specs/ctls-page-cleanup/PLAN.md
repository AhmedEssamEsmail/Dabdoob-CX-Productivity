# PLAN: ctls-page-cleanup
Type: feature   Status: draft
Date: 2026-11-20   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
The CTLs desk (Quality > CTLs) is noisy: dozens of `open` CTLs imported from the
legacy `daily_report` sheet 'CTL & Quality' (ctl_id `hist-<Call ID>`) were coached
before the GAS tool existed and can never be legitimately closed in-app. Also the
open list shows CTLs of agents who left. Fix in three parts:
1. Bulk-close the historical CTLs as **done** via a Supabase migration.
2. Open/on-hold CTL list only shows agents whose roster status is `current`
   (roster `active` — see `dqHctActive_`; inactive or not-on-roster = not current).
3. Add a Mine/All segmented filter in the page toolbar (unified pattern like
   audit-queue's `actMode` Seg). Default = My CTLs. For a TL, All = every team's
   CTLs (read view; closing still gated by `qaCanCloseCtl_`). Admin already sees
   all — show the Seg for TLs only.

## Success criteria
1. Migration: every `qa_ctls` row with status in ('open','on_hold') that is
   historical becomes 'confirmed' — historical = `ctl_id LIKE 'hist-%'` OR its
   `audit_id` joins a `qa_audits` row with `status='historical'` OR
   `sample_basis='historical'`. Done shape mirrors submitQaCtl+confirmQaCtl:
   `outcome='acknowledged'`, `submitted_date` = COALESCE(NULLIF(reminded_date,''),
   NULLIF(opened_date,''), due_date) (reminded_date was the sheet's 'CTL Date' =
   coaching date), `submitted_at` = that date, `sla_met` = submitted_date <=
   due_date, `closed_by` = tl_email, `updated_by` = 'history closeout',
   `coaching_notes` left as-is unless empty (then 'Coached before the QA tool.').
   Idempotent (safe to re-run; only touches open/on_hold rows).
2. After migration, zero historical CTLs remain open/on_hold; non-historical
   open CTLs are untouched; `qa_ctls` done statuses stay in the existing
   vocabulary ('submitted'|'confirmed'|'not_confirmed' — 'confirmed' chosen
   because 'submitted' would dangle an agent "confirm coaching" affordance and
   'not_confirmed' means "agent says it did not happen").
3. `getQaCtlPage` marks each open/on_hold row's agent active state and the
   client hides open/on_hold CTLs of non-current agents from the list (closed
   history rows unchanged). Alternatively filter server-side — implementer's
   choice, but the count chip ("N open") must match the rendered list.
4. `ctlPage` accepts scope 'mine'|'all' (default 'mine'); the toolbar Seg
   switches server-side like audit-queue's `actMode`; `own` already exists per
   row — 'mine' = tl_email === user for TLs, for admin 'all' is the only scope.
5. "Open in the form" shows only when the row is `open` AND the user may close
   it (add `canClose` per row = `qaCanCloseCtl_` with onShift for TLs) — prevents
   dead-end submits in All view.
6. Typecheck + lint pass; targeted vitest on any new pure helper passes.

## Scope / Non-goals
In: qa_ctls data migration; getQaCtlPage + ctls-page.tsx (+qa-shared only if a
    Seg/toolbar prop is missing); small pure helper for scope/visibility if needed.
Out: submitQaCtl semantics; dispute flow; agent confirm flow; SLA formula;
     closing/mutating non-historical CTLs; any remote write beyond the migration
     file (migrations auto-apply on merge to main; no manual remote run).

## Risk flags (y/n)
arch n · db y · data n · auth n · external-api n · ui y · perf n · deps n · tests n · docs n · deploy n
Review gates: QA (always) · Security: run (db flag) · Data: skip (no metric-definition change; SLA formula untouched) · Performance: skip · UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npm run lint`  unit: `npx vitest run <changed-test>`  e2e: skip (heavy; UX gate covers page contract)  security: `npm run test:security`  build: skip (typecheck+lint suffice for this diff)

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Schema/data changes ship as new timestamped migration files
  (`npx supabase migration new <name>`); auto-apply on merge to main. Never edit
  the remote by hand; remote CLI needs `--remote` + `env -u SUPABASE_ACCESS_TOKEN`.
- This repo's Next version differs from training — check node_modules/next/dist/docs if touching app router.
- Keep context small: pass paths, not contents; redirect heavy output to log files.
- UI done = page contract at 375/1024px (see specs/ux-ui-audit-v3/PLAN.md Phase 2).
- Never commit/push/deploy or apply remote DB changes without explicit approval.

## Research notes
- "Done" CTL = status in {submitted, confirmed, not_confirmed} (core.ts qaCtlSla_
  ~L387; confirmQaCtl server.ts ~L1135). 'open' CTLs reappear in reminders; only
  done/cancelled/on_hold escape the reminder job.
- Historical CTLs: ROW_TRANSFORMS['CTL & Quality'] sets ctl_id='hist-<Call ID>'
  and status 'Pending'|'' -> 'open' (migration/mappings/ops-tabs.ts:187-197).
- Agent 'current' status = roster `active` (roster.ts dqHctActive_ ~L180:
  status 'current' + no LWD; roster patch L701). Directory person(e).active.
- Unified filter pattern: audit-queue-page.tsx actMode Seg in PageShell toolbar,
  server param `P.queuePage(who, actMode)` (~L107-205). QaPage supports `toolbar`.
- Visibility today: `qaCtlVisibleTo_` = admin OR tl_email=me OR shift_tls has me
  (core.ts L326). 'mine' must drop the shift_tls leg; 'all' returns every row.
- Supabase MCP currently unreachable (known OAuth-shadow lesson) — verify counts
  inside the migration shard via the migration dry-run/log or a bounded SELECT
  if CLI access exists; do not block on live counts.

## Key pointers
- src/features/cx-quality/lib/server.ts:1192-1238 — getQaCtlPage (visibility, row build)
- src/features/cx-quality/lib/server.ts:1308-1318 — canonical "done" field writes
- src/features/cx-quality/lib/core.ts:321-352 — qaCanCloseCtl_/qaCtlVisibleTo_/qaFindOpenCtls_
- src/features/cx-quality/components/ctls-page.tsx:323-506 — page + list + button
- src/features/cx-quality/components/qa-shared.tsx:125-160 — QaPage toolbar prop
- src/features/cx-quality/components/audit-queue-page.tsx:186-205 — Seg pattern to mirror
- src/features/shared/migration/mappings/ops-tabs.ts:75-90,187-197 — hist- origin
- src/features/shared/platform/identity.ts:186-281 — Directory/active
