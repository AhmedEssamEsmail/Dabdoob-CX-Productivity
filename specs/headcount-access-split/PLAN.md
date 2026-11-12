# PLAN: headcount-access-split
Type: feature   Status: draft
Date: 2026-11-12   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Two related changes:

1. **Offqueue `interaction_at`**: audits created outside the samples (`qa_queue.source = 'offqueue'`, stored `sample_basis = 'off-queue'`) must ask for the interaction date as a **date-only** input in the audit form (replaces the current `datetime-local` input for those audits), and store `yyyy-MM-dd` in `qa_audits.interaction_at`.
2. **Headcount management in /people-holidays**: the roster gains hiring date (exists), gender, mobile number, HR ID, and employment-status fields — synced from `dq_hct` and editable in the person editor. Access (`roster.role`: admin/tl/agent/specialist) is split from title (`roster.position`, free text from HCT), so e.g. ahmed.ismail@dabdoob.com can hold admin access while his title stays "Customer Experience Team Leader". Everywhere the app counts "agents" for numbers must count only people with status `Current` AND position exactly `Customer Experience Agent`.

## User decisions (asked 2026-11-12)
- interaction_at: date-only REPLACES the datetime input for offqueue audits; same `interaction_at` column.
- Access model: keep the 4 access levels (admin/tl/agent/specialist) + separate title. TL features (reports_to, team scoping, manager picklists) key off title/position, not access.
- New headcount fields: editable in the Edit dialog AND HCT-synced.
- Agent counting: EXACT `position === 'Customer Experience Agent'` (Option A) — grounded in the real sheet values below.

## Success criteria
1. Opening the audit form for an offqueue queue item shows a required **date** input (not datetime); submitting stores `yyyy-MM-dd` in `qa_audits.interaction_at` and passes server validation. Queue/request/non-ticket audits keep the datetime input.
2. `dq_hct` mirrors `Code` (HR ID), `Gender`, `Contact Number`, and `Position` (currently all-null for 51 rows) from HCT Sheet1; a backfill populates `position` (+ new cols) for existing `dq_hct` and `roster` rows using the service-account JSON.
3. `roster` gains `gender`, `mobile`, `hr_id`, `employment_status` (hiring_date exists); "Sync roster from HCT now" fills them and succeeds (the `refresh_log submitted_at` schema-cache error below is fixed as part of this).
4. /people-holidays table + Edit dialog show/edit: access level (role), title (position), hiring date, gender, mobile, HR ID, status — alongside existing reports-to/based-in/days-off.
5. Access and title are independent in code and DB: a user can be `role=admin` with `position='Customer Experience Team Leader'` and still be treated as a TL for reports-to lists/team scoping; every permission check continues to work on the access field.
6. All "agent" populations/headcount numbers in every tab count `status='Current'` (roster.active) AND `position='Customer Experience Agent'` exactly — sheet ground truth: 16 Current CX Agents, 4 Current CX Team Leaders, 1 CX Manager, 1 Enablemen Specialist (CX section); Data Entry section is out of roster scope.
7. Gates pass: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` (update `tests/golden/hub-people-holidays.test.ts` + related), e2e page-contract for /people-holidays.

## Scope / Non-goals
In: qa AuditForm + submit validation, roster/dq_hct schema + mirror mapping + sync + backfill script, people-holidays UI, access/title split across role checks, agent-count definition everywhere, the refresh_log logging bug blocking sync.
Out: new access levels, production deploy, package.json/lockfile changes, .env* changes, unrelated people-holidays warnings (the "Based in" banner).

## Risk flags (y/n)
arch **y** (access/title split touches every `role` check + directories) · db **y** (roster + dq_hct migrations) · data **y** (mirror mapping + sheet backfill, KPI counting rule) · auth **y** (access semantics change) · external-api **y** (Google Sheets service account) · ui **y** (people-holidays editor + audit form) · perf n · deps n · tests **y** (golden tests + contract) · docs n · deploy n
Review gates: QA (always) · Security: run (auth) · Data: run · Performance: skip · UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`

## Conventions
- Schema changes only via `npx supabase migration new <name>` (timestamped file; auto-applies on merge to main). No dashboard SQL. Remote DB writes need explicit user approval.
- Next.js 16 differs from training data: read `node_modules/next/dist/docs/` before Next code.
- Forbidden: package.json/lockfile, `.env*`, `cx-kpis-*.json` (read/use OK for the sanctioned sheet sync, never edit/commit).
- Follow legacy-parity naming (verbatim legacy function names) — see specs/cx-hub/PORTING-GUIDE.md.
- No env-dependent clients at module top level (lazy-init); `import 'server-only'` needs scripts/tsconfig paths for tsx/vitest.
- Sheets batchGet caps ~8KB URL (~150 ranges/call), pace calls, 429 retry. Output budget: redirect heavy logs, tail bounded.
- Leaf result files go under `specs/headcount-access-split/results/`, never repo-root `results/`.

## Research notes
- HCT Sheet1 (`1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`, same as `SPREADSHEETS.hct`) columns A–S: `Sr., Code, Employee Name, Arabic Name, Hiring Date, Position, Department, Section, Gender, Contact Number, Email, Direct Repporter, Batch, Status, LWD, Level, Fresh desk ID, Freshdesk Name, Maqsam Name`. `Code` = HR ID, `Contact Number` = mobile. Cols U–W hold an unrelated side-table (already ignored by the mapping).
- Live probe (service account `cx-kpis-513312-*.json`): `dq_hct` 51 rows, `position` NULL for ALL; `roster` `position` blank for ~all 50. Sheet HAS Position populated → mirror import dropped it; a re-import/backfill via the existing engine should fill it.
- Sheet position distribution (status Current): `Customer Experience Agent` 36 rows/16 Current · `Customer Experience Team Leader` 5/4 · `Customer Experience Manager` 2/1 · `Enablemen Specialist` 1/1 · `Head of CX, Enablement & WFM` 1/0 · Data Entry section (out of scope): Specialist 7/6, Team Leader 1/1.
- **Pre-existing bug (in scope, blocks sync)**: `appendRow` stamps `submitted_by`/`submitted_at` (src/features/shared/platform/repo.ts:256); `refresh_log` has neither column → `dqLogRun_` after roster sync throws `Could not find the "submitted_at" column of "refresh_log" in the schema cache` (visible in the page screenshot). Fix = migration adding the two columns to `refresh_log` (preferred, keeps stamping uniform) or skip stamping for that table.
- `qaCleanInteractionAt_` (src/features/cx-quality/lib/pure.ts:41) strictly requires `yyyy-MM-dd HH:mm` and returns `"'" + s` (leading-quote marker); needs a date-only acceptance path for offqueue submits while keeping downstream `qaWhen_`/`qaHasInteraction_` (`/^\d{4}-\d{2}-\d{2}/`) working.
- `AuditForm` (src/features/cx-quality/components/qa-shared.tsx:700) always renders the required `datetime-local` input `qa-when`; offqueue state is available via the queue row `source` prop chain at `AuditEntry` (audit-queue-coverage.tsx:183).
- Role↔access entanglement: `roster.role` CHECK constraint {admin,tl,agent,specialist} (migration 20261030163812); `roleForEmail`/`requireRole`/`pwDirectory` (src/features/shared/platform/identity.ts:86-256) drive access AND org features (`tls()`, `role==='agent'||'specialist'` agent lists, `pwIsManagerOf`); `dqRoleFor_` maps HCT position→role at sync (roster.ts:123); `role_override`/`tl_override` are manual overrides that survive syncs (roster.ts:298-307).

## EXTEND 2026-11-12 (user-requested UI fixes)
- E1: /people-holidays `dq-holform` — date input clipped, holiday field/form too wide → spec/S10.md#S10-01.
- E2: /admin Reminders master switch reads as a pill "Reminders" button → off/on `cx-switch` control → spec/S10.md#S10-02.
- E3: Remove "Reduce transparency"/"Reduce motion" appearance controls + the `solid`/`still`→`data-reduce-*` mechanism they drive (admin-page, i18n, layout boot, theme.css, BootSplash) → spec/S10.md#S10-02.

## Key pointers
- src/features/cx-quality/lib/pure.ts:41 — `qaCleanInteractionAt_` server validation to extend for date-only
- src/features/cx-quality/components/qa-shared.tsx:700-830 — `AuditForm` `qa-when` input (datetime-local → date for offqueue)
- src/features/cx-quality/components/audit-queue-coverage.tsx:163-230 — `AuditEntry`, passes `row.interactionAt`; row `source` available here
- src/features/cx-quality/lib/server.ts:756-769 — `submitQaAudit` builds `audit.interaction_at` + `qaDeriveBasis_`
- src/features/cx-quality/lib/analytics.ts:168 — `qaDeriveBasis_` ('off-queue' from source='offqueue')
- src/features/cx-hub/lib/roster.ts — whole roster sync/admin surface: `dqRosterFromHct_` (row build ~200), `dqRoleFor_` (123), `dqSyncRoster_` fields list (~282), `setPersonV2Fields`/`setPersonOverrides` (~408+), `getRosterAdmin` row shape (~489)
- src/features/cx-hub/components/people-holidays-page.tsx — roster table + inline editor `Lg` (~72-205); Gi role labels (15-20)
- src/features/shared/platform/identity.ts:86-256 — `roleForEmail`, `requireRole`, `pwDirectory`, `tls()`, `pwIsManagerOf`
- src/features/shared/migration/mappings/hct.ts — dq_hct column map (extend: code, gender, contact number → hrId/gender/contactNumber or similar; keep adapter-key naming)
- supabase/migrations/20261109131140_dq_hct_table.sql — dq_hct schema (quoted camelCase cols convention)
- supabase/migrations/20261105171948_hub.sql:26-41 — roster extra columns precedent
- src/features/shared/migration/engine.ts — `readSheet`/`sheetToDb`/upsert machinery; `SPREADSHEETS.hct` id at :40
- src/features/shared/jobs/mirrors.ts:244 `syncAllMirrors` — how dq_hct gets refreshed (POST /api/admin/mirrors)
- src/features/cx-queue/lib/jobs.ts:40 — `dqLogRun_` refresh_log insert (the submitted_at bug)
- tests/golden/hub-people-holidays.test.ts — golden coverage of roster admin surface
- scripts/ops/check-sheet-access.mts — service-account auth pattern for the backfill script
- src/app/api/hub/roster/route.ts — `syncRosterNow` endpoint
- Users of roster role for numbers (verify all): cx-people/lib/kpi/server.ts, scorecard-server.ts:306,348, one-on-ones-page.ts, cx-productivity/lib/prod-access.ts:17-21, tph/page.ts, cx-quality/lib/server.ts (`qaImportablePeople_`, auditor/TL lists), cx-queue/lib/{jobs,tlqueue}.ts, cx-hub/lib/{aggregates,myday}.ts
