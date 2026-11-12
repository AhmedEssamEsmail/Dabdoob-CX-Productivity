# DECISION: headcount-access-split

Context: Split access (`roster.role`) from title (`roster.position`) while keeping 4 access levels; add gender/mobile/hr_id/employment_status to roster via dq_hct mirror + backfill; make offqueue audits capture a date-only `interaction_at`; count "agents" as `active && position === 'Customer Experience Agent'` exactly. Constraints: Next.js 16/Supabase, timestamped migrations only, legacy-parity naming, no deps/env/package changes, sheets batchGet limits.

Options:
 A) **role = access, position = title** — keep `role` CHECK {admin,tl,agent,specialist} and all `requireRole`/`roleForEmail` checks untouched; populate `position` verbatim from HCT; re-point org features (`pwDirectory.tls/managerOf/agentsOf`) at a position-derived level with role fallback. Pros: minimal blast radius vs 51+ role usages; access semantics already live on role. Cons: two fields to keep coherent; org code needs careful retargeting.
 B) Add `access_level` column, migrate role→access — cleaner name but rewrites every role check, the CHECK constraint, and `PlatformUser`; same outcome, far more churn. Rejected (gold-plating).
 C) Keep role-only + admin override flag — cannot express "admin access, TL title" in UI/reporting and still needs position populated for counting. Rejected.

Decision: **A** — simplest option meeting PLAN criteria; role already functions as access, so the only real work is sourcing org/title semantics from `position`.

Design:
- **Migrations** (one file `..._headcount_access_split.sql`): `dq_hct` ADD `code` text, `gender` text, `"contactNumber"` text (quoted camelCase convention; `position` col exists). `roster` ADD `gender`, `mobile`, `hr_id`, `employment_status` text (`position`, `hiring_date` exist). `refresh_log` ADD `submitted_by` text, `submitted_at` timestamptz (fixes the `appendRow` stamping bug; keeps stamping uniform). All additive/nullable.
- **Mirror**: `mappings/hct.ts` columns += `code`, `gender`, `contactNumber`; sheetToDb `code:'code'`, `gender:'gender'`, `contactNumber:'contact number'`; verify `position` actually populates (all-NULL today).
- **roster.ts**: `dqRosterFromHct_` row += `gender`, `mobile`←`contactNumber`, `hr_id`←`code`, `employment_status`←`status` verbatim; `dqRoleFor_` stays as default-access for rows without `role_override`; `dqSyncRoster_` field list, `getRosterAdmin` shape, `setPersonV2Fields` extended.
- **identity.ts**: add `dqTitleLevel_(position, role)` → 'tl' if `/team\s*lead(er)?/i`, 'manager' if `/manager|head of/i`, else 'agent' (fallback to `role` when position blank); `tls()`, `managerOf`, `agentsOf` use it. Export `CX_AGENT_POSITION` + `isCxAgent_(p)` = `active && position === CX_AGENT_POSITION`; re-point all headcount consumers (PLAN's "Users of roster role" list).
- **Offqueue**: new `qaCleanInteractionDate_` in pure.ts — accepts `yyyy-MM-dd`, same future/180-day bounds, returns `'`-prefixed marker (downstream `qaWhen_` regex already matches). `submitQaAudit` picks it when the queue row's `source==='offqueue'` (server-side, not client input). `AuditForm` renders `type="date"` via the `source` prop chain at `AuditEntry`; `qa-when` id kept for contract tests.
- **UI**: people-holidays table + `Lg` editor: role select (access), position text (title), hiring date, gender, mobile, HR ID, status.
- **Backfill**: `scripts/ops/backfill-hct-headcount.mts` (check-sheet-access.mts service-account pattern): re-read Sheet1 → dq_hct upsert + roster fill for existing rows.

Risks & mitigations:
- Blank `position` after partial backfill → org fallback to `role`; backfill is in-scope acceptance.
- TL regex false positives → roster is section-scoped (Data Entry excluded); fallback preserves old behavior.
- Manual position edits overwritten by sync → sync only fills from non-empty sheet values; document title is HCT-owned.
- Sheet renames "Customer Experience Agent" → single `CX_AGENT_POSITION` constant; golden test pins 16-agent count.
- `role`/`position` drift for new hires → `dqRoleFor_` default + `role_override` escape hatch preserved.

Rollback / migration path: all DDL additive — revert code to restore prior behavior; drop new columns in a follow-up migration if abandoned. Date validator is additive; existing `interaction_at` values untouched.

Impacts on PLAN: criteria unchanged; add explicit check that `tls()`/`agentsOf`/`managerOf` behave identically pre/post backfill; flag `dq_hct` mapping fix as part of criterion 2.

Open questions: none.
