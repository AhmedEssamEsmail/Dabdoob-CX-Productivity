# S06-01: decide doc for v1_ops's 17 non-task tabs
Kind: mini
ID: S06-01
Parent: S06
Owner: data-engineer
Depends: none
Criteria: PLAN #1, #4 (v1_ops `reshard:` tabs get verdicts with evidence)
Skills: none
Budget: files=2; actions=5; changed_lines=220; minutes=10

## Goal
Produce `specs/migration-remaining/decisions-v1-ops.md`: a per-tab verdict
for the 17 v1_ops tabs no leaf covers — `migrate:` (existing table + upsertOn
natural key + sheetToDb column map) | `NEW:` (name + columns, only when NO V2
table can hold the data class, max 3) | `covered:` (feeding job + parity) |
`rejected:` (reason). This doc is the contract for S06-04/05/06/07.

## Files
- Create: `migration/probe-v1-tabs.ts` | bounded header probe for the 17 tabs
- Create: `specs/migration-remaining/decisions-v1-ops.md` | the deliverable

## Context
- `migration/probe-remaining-tabs.ts` | read-only auth + probe pattern to reuse
- `specs/migration-remaining/source-inventory.md:26-43` | tab list + row counts
- `supabase/migrations/007_queue.sql:106-144` | sched_* tables (plan, team,
  offdays, overrides, hour_overrides, requests, config)
- `supabase/migrations/008_people.sql:134-186` + `011_remote_reconcile.sql:11-95`
  | one_on_one_*, meetings, kpi_*_log, options, holidays, tlp_team candidates
- `supabase/migrations/010_desk.sql:116-169` + `009_operations.sql:1-60` |
  actions/action_task_details + trackers/tracker_records candidates

## Contract
Probe the 17 tabs: ShiftPlan, ShiftOverrides, TeamLeads, TLOffDays,
ShiftRequests, RoadmapVisibility, HourOverrides, Agents, AgentOneOnOnes,
OneOnOnes, KPI, Settings, Tickets, IdentityPins, HardCases, Standups,
TaskOccurrences — `values.get '<tab>'!A1:AZ5` + a col-A count (all <1k rows).
Verdict rules: prefer existing tables — match tab headers to a table's
columns verbatim (name the exact upsertOn column[s]); `NEW:` only where no
table fits (max 3 tables, else RESHARD_NEEDED); `rejected` for ⊆ landed
tables or derived/scratch. IdentityPins default verdict `rejected: credential
material` unless evidence shows non-secret data — flag any doubt for PM.
Decisions are evidence calls from headers/rows, not guesses.
Out of scope: writes anywhere; mapping modules (S06-05..07); DDL (S06-04).

## Actions
1. Write `migration/probe-v1-tabs.ts` (auth per probe-remaining-tabs; loop the
   17 tab names against `v1_ops` id `1hul-T8Tc2h1nmk_9wM9bj8HmWM-_2ZeVIu_kOYpicyA`).
2. Run read-only -> `specs/migration-remaining/logs/probe-v1-tabs.log`; keep
   `exit=` + `tail -c 3000` evidence.
3. Match each tab's headers to candidate V2 table columns (context pointers).
4. Write `decisions-v1-ops.md`: per tab one line — verdict + target table +
   upsertOn + verbatim sheetToDb pairs (or `NEW:`/reason).
5. Write `results/S06-01.md` (<=10 lines: verdict counts + NEW list + flags).

## Done when
- All 17 tabs have a verdict + evidence; every `migrate:` names an existing
  table, a natural key, and a column map; `NEW:` list <=3 tables with columns.

## Verify
- Run: `npx tsx migration/probe-v1-tabs.ts > specs/migration-remaining/logs/probe-v1-tabs.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/probe-v1-tabs.log` -> exit=0, 17 tabs probed.

## Handoff
`decisions-v1-ops.md` is required context for S06-04 (`NEW:` list) and
S06-05/06/07 (mappings). Write `results/S06-01.md`; TL updates TRACKER.md.
