# S01-01: tab census + per-store verdict inventory
Kind: mini
ID: S01-01
Parent: root
Owner: data-engineer
Depends: none
Criteria: PLAN #1 (every readable store ends in migrated/covered/rejected with evidence)
Skills: none
Budget: files=2; actions=4; changed_lines=180; minutes=10

## Goal
Produce `specs/migration-remaining/source-inventory.md`: a tab census (tab
names + header rows) for the ~10 readable-but-unmigrated stores plus a
proposed verdict per store — **migrated** (name the target table), **covered**
(name the feeding job/table + parity counts), or **rejected** (reason).

## Files
- Create: `migration/probe-remaining-tabs.ts` | tab-list + header probe
- Create: `specs/migration-remaining/source-inventory.md` | the deliverable

## Context
- `migration/probe-tabs.ts:15-43` | reuse this read-only probe pattern
- `specs/megaplan/audits/sheet-access.md:13-33` | the 19 shared store ids/titles
- `specs/migration-remaining/PLAN.md:99-124` | the 11-store target list + research
- `src/features/shared/platform/settings.ts:68-72` | daily_report/fd_activity/roster_hct ids

## Contract
Probe targets (read-only `spreadsheets.get` + `values.get` on `A1:AZ3` per tab):
hct `1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`, v1_ops `1hul-T8Tc2h1nmk_9wM9bj8HmWM-_2ZeVIu_kOYpicyA`,
oct workbook `1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI`, voice `1bna3_kNAxdaS2dPJUMTTw75NKQiwAN6NJVbxRxPKeqA`,
text `1BNzinvWZ_1qm5QZX-Thqk0oR3CvfkNMnJ7TPi1_wy6k`, daily_report `1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4`,
fd_activity `1Fc6VCk8bLmy8ZUMCeBDPHvu7dMWDtONn6CRd9H_aHzM`, fc_messages `1ZxDxS13pu0xXS3aPBfXxajtodwKIndaF0NOjZv6xacM`,
touch archive `1qch1vaZP2xaiQQ3k0FFhWLGJ4gVL0i7Zx_vbX3jG_-A`, qa_engine_source `1VtBT8kIIhK7PxKYJJQlnhxNtmz17ewhkWtpUt8jiB4s`,
qa_queue `1ArWBreAPYAmFX4qnWd1jw3OQ2s8MLvJpqp5024gWjYY`.
Record per store: every tab name, header row, approx row count (from a bounded
values.get), and the exact header strings downstream leaves need (esp. hct
Sheet1 and the v1_ops task tab). Verdict rules: migrated = a leaf targets it;
covered = a ported job/mirror feeds the same data (show remote-vs-tab counts);
rejected = stale duplicate/subset of an already-landed table (say which).
If evidence shows data no existing leaf/table can hold, write verdict
`reshard:<reason>` and return RESHARD_NEEDED — do not guess.
Out of scope: any writes to sheets or Supabase; migrating anything; `.env*`.

## Actions
1. Write `migration/probe-remaining-tabs.ts` (auth = `migration/probe-tabs.ts`
   pattern; for each of the 11 ids: `spreadsheets.get` for tab list, then
   `values.get '<tab>'!A1:AZ3` + a `A:AZ` row count on task/list tabs only).
2. Run it read-only, output to `specs/migration-remaining/logs/probe-tabs.log`;
   keep only `exit=` + `tail -c 3000` as evidence (OUTPUT-BUDGET rules).
3. Write `source-inventory.md`: per-store table = tab census + header strings
   + verdict + reason. Compare counts against `audits/migration-run.md` §2/§7
   and `specs/megaplan/migration-report.md` for covered/rejected calls.
4. Write `results/S01-01.md` (<=10 lines: verdict summary + log tail).

## Done when
- `source-inventory.md` lists all 11 stores, each with verdict + evidence.
- hct Sheet1 headers + v1_ops tab list/headers are recorded verbatim.
- Probe log shows 0 sheet writes; `exit=0` or per-tab FAIL noted.
- Any uncovered unique dataset is flagged `reshard:` not silently dropped.

## Verify
- Run: `npx tsx migration/probe-remaining-tabs.ts > specs/migration-remaining/logs/probe-tabs.log 2>&1; echo "exit=$?"; tail -c 3000 specs/migration-remaining/logs/probe-tabs.log` -> exit=0, all 11 stores listed.

## Handoff
Downstream leaves read `source-inventory.md` for exact sheet headers (S03-02
hct, S04-02 v1_ops, S04-07 fc_messages) and honour its verdicts; S05-04
finalises it to post-run state. Write results/S01-01.md; TL updates TRACKER.md.
