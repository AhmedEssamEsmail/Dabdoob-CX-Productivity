# sec report - headcount-access-split - round 1 (FULL)

Verdict: PASS
Open: 0/0/0/1

Scope reviewed (uncommitted working tree vs HEAD; tl-1..tl-4 file lists + PLAN):
migration `20261112142701_headcount_access_split.sql`, `scripts/ops/backfill-hct-headcount.mts`,
`title-level.ts` (new), `identity.ts`, `adapters.ts`, `viewas.ts`, `calendar.ts`, `roster.ts`,
`pure.ts`, `cx-quality/lib/server.ts`, `qa-shared.tsx`, `audit-queue-coverage.tsx`,
`people-holidays-page.tsx`, `admin-page.tsx`, `i18n.ts`, `layout.tsx`, `theme.css`,
`BootSplash.tsx`, `refresh.css`, `jobs.ts`, `tlqueue.ts`, `kpilogs.ts`, `myday.ts`,
`coaching.ts`, `meetings.ts`, `meetings-page.tsx`, `one-on-ones.ts`, `one-on-ones-page.ts`,
`tph/page.ts`, `mappings/hct.ts`, plus new/changed tests.
Excluded (other specs' trees): `engine-live.ts`, `jobs/freshdesk.ts`, `jobs/mirrors.ts`,
`jobs/vendor-apis.ts`, the 4 `2026111215*` migrations, ui-shell-polish PNGs,
`docs/Reference_Code.gs`, `specs/fd-direct-mirrors/` (fd-direct-mirrors spec — separate review).

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| sec-1 | LOW | src/features/shared/platform/identity.ts:35-40 | `isCxAgent_` requires `position==='Customer Experience Agent'`; roster.position is NULL on ~all rows until the S07-01 backfill runs. Merge+deploy before backfill blanks every agent list/headcount (kpiLogsPage, tphPeople_, qaQuotaAgents_, tlqTeamRows_) — availability/data-integrity gap, not exploitable. | Run the approved backfill (`backfill-hct-headcount.mts`) immediately after the migration applies; tl-4 already gates it NEEDS_APPROVAL. | dev |

## Checklist findings (no issues)

- **AuthN/Z — access axis intact.** `requireRole`/`roleForEmail`/`pwIsManagerOf_`/view-as
  untouched by the diff; all roster writes stay `requireRole(['admin'])` + `assertWritable()`
  (roster.ts:379,425,502,563,663,692). Role whitelist `DQ_ROSTER_ROLES` enforced
  (roster.ts:429); `role_override`/`tl_override` still win over HCT-derived role at sync
  (roster.ts:307-309), so an admin-titled person's access survives re-sync. New
  `dqTitleLevel_` axis only drives org features (managerOf/agentsOf/tls, isTl, auditor
  picklists, mgr-eligibility in setPersonOverrides:446-449) — the spec's intended split.
- **Offqueue date path.** `submitQaAudit` branches on server-side `q.source` (DB queue
  row, not client input) — server.ts:759. `qaCleanInteractionDate_` (pure.ts:56-68) is
  strict `yyyy-MM-dd` + real-date round-trip, +5min future and 180-day bounds mirroring
  `qaCleanInteractionAt_`; stray datetime degrades to its date. Auditor gate
  (`qaIsAuditor_`) + `assertWritable` precede it (server.ts:739-743). Test file
  `tests/quality/qa-interaction-date.test.ts` covers the rejects.
- **Supabase/RLS.** Migration is additive `ADD COLUMN IF NOT EXISTS` on
  `dq_hct`/`roster`/`refresh_log`. All public tables are RLS-enabled with zero policies
  (deny-all for anon/auth) since `20261108205852_rls_lockdown` + dq_hct's own
  `ENABLE ROW LEVEL SECURITY`; new columns inherit it. No `security definer`, no new
  views/policies/grants. Remote apply needs user approval per AGENTS.md.
- **New PII (gender/mobile/hr_id).** Only surfaced via `getRosterAdmin`
  (roster.ts:501-526, admin-gated) → `GET /api/hub/roster` → people-holidays page.
  `pwDirectory`/`wcState`/`dqActiveTlEmails_` select lists exclude them — no leakage into
  client-visible directories or caches.
- **Input validation.** `setPersonV2Fields` (roster.ts:550+) caps position 120 / others
  60 chars, validates hiringDate `yyyy-MM-dd`, admin-only; client sends typed fields only.
  No string-built `.or()`/`.filter()`/raw SQL, no `dangerouslySetInnerHTML`, no redirects
  or user-URL fetches in the diff.
- **Secrets/config.** No literals in the diff (only the `FRESHDESK_API_KEY is not
  configured` error string, fd spec). `.env*` and `cx-kpis-*.json`/`*.gserviceaccount.json`
  gitignored; backfill loads `.env.pulled`/`.env.production` locally, creates the
  service-role client only after the `--dry-run` exit, Sheets scope is `spreadsheets.readonly`.
- **Deps.** No package.json/lockfile change — `npm audit` not triggered.
- **S10 UI removals.** Appearance toggles/`data-reduce-*` writers removed; OS media
  queries retained; `APPEARANCE_BOOT` inline script still try/catch-wrapped — cosmetic only.

## Not verified / assumptions

- Remote state unverified: dq_hct column contents and live "Sync roster from HCT" pending
  merge + the approved real backfill run (NEEDS_APPROVAL, unchanged from tl-4).
- `meetings.ts:416` tracked-action owner check widened from role tl/admin to
  `titleLevel !== 'agent'` — spec-intended title axis; qa-6 verified. Logged, not a finding.
- `docs/Reference_Code.gs` (untracked, fd-direct-mirrors reference) scanned for secret
  literals — none (keys via ScriptProperties); outside this spec's file set.
- Security gate `npm run test:security` already PASS 4/4 (qa-2); not re-run — no changes
  to files it covers since.
- `git diff` covered all listed files; diffs >400 lines were read at target ranges.
