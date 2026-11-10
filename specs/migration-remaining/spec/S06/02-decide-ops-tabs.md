# S06-02: decide doc for oct + daily_report reshard tabs
Kind: mini
ID: S06-02
Parent: S06
Owner: data-engineer
Depends: none
Criteria: PLAN #1 (oct {FD_AUX, Transcript, AUXes Exceptions} + daily_report
{WA, CTL & Quality} get verdicts with evidence)
Skills: none
Budget: files=2; actions=5; changed_lines=220; minutes=10

## Goal
Produce `specs/migration-remaining/decisions-ops-tabs.md`: per-tab verdict
for the 5 unique ops tabs — same vocabulary as S06-01 (`migrate:` table +
upsertOn + column map | `NEW:` name + cols, max 3 across BOTH decision docs |
`covered:` | `rejected:`). Contract for S06-04/08.

## Files
- Create: `migration/probe-ops-tabs.ts` | bounded header probe for the 5 tabs
- Create: `specs/migration-remaining/decisions-ops-tabs.md` | the deliverable

## Context
- `migration/probe-remaining-tabs.ts` | read-only auth + probe pattern
- `specs/migration-remaining/source-inventory.md:45-69,93-112` | tab census:
  oct FD_AUX (14,329-grid agent AUX spans), Transcript (5,606), AUXes
  Exceptions (agent,date,AUX,duration); daily_report WA (223), CTL & Quality
  (1,921, coaching tracker + audit echo partially ⊆ qa_audits)
- `supabase/migrations/006_quality.sql:104-160` | qa_ctls / qa_disputes /
  qa_calibrations candidates for the CTL tracker portion
- `supabase/migrations/004_mirror_tables.sql:21-30` +
  `src/features/shared/jobs/mirrors.ts:36-90` | maqsam_calls shape — does it
  hold transcripts? decide covered vs NEW for `Transcript`
- `supabase/migrations/009_operations.sql:1-60` | trackers/tracker_records —
  candidate for WA parcel/order tracking

## Contract
Probe per tab: `values.get '<tab>'!A1:AZ5` + col-A count, on oct workbook
`1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI` (tabs: FD_AUX, Transcript,
AUXes Exceptions) and daily_report `1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4`
(tabs: WA, CTL & Quality). CTL & Quality may split: audit-echo rows ⊆
qa_audits get `rejected: ⊆ qa_audits` while the unique coaching-tracker
columns get their own `migrate:`/`NEW:` line — one tab, two verdicts is OK.
`NEW:` cap 3 across both decision docs (S06-01 may already use some).
Out of scope: writes anywhere; mappings (S06-08); DDL (S06-04).

## Actions
1. Write `migration/probe-ops-tabs.ts` (auth pattern; tab list per store id).
2. Run read-only -> `specs/migration-remaining/logs/probe-ops-tabs.log`;
   `exit=` + `tail -c 3000` evidence.
3. Match headers to candidate tables (context pointers); check Transcript
   cols vs maqsam_calls and CTL&Quality vs qa_ctls/qa_audits.
4. Write `decisions-ops-tabs.md`: per tab verdict + target + upsertOn +
   verbatim column map (or `NEW:`/reason).
5. Write `results/S06-02.md` (<=10 lines: verdicts + NEW list).

## Done when
- All 5 tabs (incl. any CTL split) have verdict + evidence; `migrate:` lines
  name table + key + column map; combined `NEW:` across both docs <=5 tables.

## Verify
- Run: `npx tsx migration/probe-ops-tabs.ts > specs/migration-remaining/logs/probe-ops-tabs.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/probe-ops-tabs.log` -> exit=0, 5 tabs probed.

## Handoff
`decisions-ops-tabs.md` is required context for S06-04 (`NEW:` list) and
S06-08 (mappings). Write `results/S06-02.md`; TL updates TRACKER.md.
