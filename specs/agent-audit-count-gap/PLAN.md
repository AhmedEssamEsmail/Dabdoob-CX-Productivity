# PLAN — agent-audit-count-gap

## Goal
Explain / fix the audit-count gap for agent **Kareem Salah** on the Quality
Analytics Agents table: UI shows **26 audits** for period `2026-11` on the
**interaction** date basis, while the source Google Sheet ("CC2 Quality",
`qa_audits` tab, spreadsheet `1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w`)
contains **43** rows for him with interaction dates in November.

## Success criteria
1. Identify exactly which sheet rows account for the 17-audit delta and why
   each is excluded from (or missing from) the Agents-table count:
   classify each as one of — not synced to `qa_audits`, excluded by
   `qaRollupAudits_` (kind/status), blank score (`qaScoreKnown_`), non-`random`
   `sample_basis`, interaction-date fallback placing it outside 2026-11, or
   inactive-agent filter.
2. If rows are genuinely missing from the DB or wrongly classified
   (bug): fix so the count reflects the intended rule; add/adjust a test.
3. If the 26 is correct by design (random-sample-only count): document the
   precise breakdown so the user can verify against the sheet.

## Non-goals
- Changing the definition of the Agents-table `audits` count (random-only is
  design D1) unless the investigation proves the rule itself is wrong.
- Re-syncing/mutating remote DB rows without explicit user approval.

## Risk flags
- `data` — KPI/metric logic + Google-Sheets integration.
- `db` — possible missing rows in `qa_audits` (remote Supabase; read-only
  investigation first, writes need approval).

## Gates
- `npm run lint` (eslint)
- `npx vitest run src/features/cx-quality` (targeted unit tests)
- `npx tsc --noEmit` if TS changes

## Conventions
- AGENTS.md: schema changes only via `npx supabase migration new`; never hand-DDL.
- Heavy output -> log file + bounded tail (OUTPUT-BUDGET.md); never cat logs.
- `nul` file in repo root is Windows junk — ignore.
- Windows shell: avoid `node --check src/*.js` globs.

## Research notes
- Agents-table count path: `getQaAnalytics` (src/features/cx-quality/lib/server.ts)
  -> `qaAnalytics_` block 7 in src/features/cx-quality/lib/analytics.ts:588-651.
  `byAgent[].audits = list.length` where `list` comes from `rnd = cur.filter(isRandom)`
  — **random `sample_basis` only**.
- Filter chain reducing sheet rows -> counted rows:
  `qaRollupAudits_` (core.ts:262: kind='audit', status != voided/disputed)
  -> `qaScoreKnown_` (analytics.ts:304: score_final or score non-blank)
  -> period match on `qaScoreDate_` (analytics.ts:151: Riyadh date of
  `interaction_at`, fallback `audit_date`)
  -> `qaSampleBasis_` === 'random' (analytics.ts:179)
  -> `qaActiveKeep_` active-agent filter (server.ts ~1955).
- Sync path: `scripts/ops/qa-audits-sync.ts` inserts only NEW `audit_id`s from
  the sheet (diff-scoped; rows already in DB are never updated, so
  sheet-side edits to existing rows won't propagate). `--all` upserts everything.
  Mapping: `@/features/shared/migration/mappings/route-core`, sheet
  'quality'/`qa_audits`.
- Drill-down exists for verification: `getQaAnalyticsAudits` (server.ts:1976)
  returns the audits behind an analytics row.

## Key pointers
- Agent: Kareem Salah — get `agent_email` from `qa_audits` / directory
  (TL shown in UI: "Ahmed Essam Ismail Ali").
- Period: month `2026-11`, basis `interaction`.
- Sheet: spreadsheet `1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w`, tab `qa_audits`.
- Debugger should query DB via Supabase MCP (read-only) and the sheet via
  google-sheets MCP; produce the per-row reconciliation table.
