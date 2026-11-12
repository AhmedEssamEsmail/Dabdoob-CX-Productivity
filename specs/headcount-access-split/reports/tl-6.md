# tl-6 — FIX round for reports/ux-1.md (ux round 1)

Source report: `reports/ux-1.md` (verdict FAIL; open 0/0/1/3).
Fix spec created: `spec/fix-ux-1.md` (one leaf for the one blocking finding).
Leaves dispatched: 1 (`ux1-01` -> dev). Preflight: structural PASS + within
LIMITS (1 file / 2 actions / ~3 lines / 5 min).

## Findings disposition

| Finding | Sev | Disposition |
|---|---|---|
| ux-1 'Leave unchanged' clears stored status | MED | FIXED via ux1-01 — results/ux1-01.md |
| ux-2 cx-hint auto-places beside Status field | LOW | deferred (TRACKER Review findings) |
| ux-3 Mobile input lacks type/inputMode | LOW | deferred |
| ux-4 cx-switch label cursor on disabled | LOW | deferred (pre-existing shared quirk) |

## Changed files (DELTA scope for re-review)

- `src/features/cx-hub/components/people-holidays-page.tsx` — line 126:
  `employmentStatus: emp || undefined` (+1/-1). The empty Status option
  "Leave unchanged" now drops the key from the JSON payload, so
  `setPersonV2Fields` (roster.ts:605-608) skips the write instead of storing
  `''`. 'Current'/'Left' still write and still sync `active` (unchanged).
  Label kept — now truthful. Chose the reviewer's send-`undefined` option:
  unlike plain diff-send it also covers the stored-'Current' + choose-''
  path, where a diff-only guard would still clear.

Evidence: results/ux1-01.md; git diff of the file shows only the spec'd
one-line change on top of prior task work.

## Integration gates (fix-ux-1 round)

- `npx tsc --noEmit` — PASS, no diagnostics (logs/gate-tsc-6.log, empty)
- `npx eslint src/features/cx-hub/components/people-holidays-page.tsx` — PASS, exit 0 (logs/gate-eslint-6.log, empty)
- `npx vitest run tests/golden/hub-people-holidays.test.ts` — PASS 18/18 (logs/gate-vitest-6.log)

## Notes

- No shard requested a reviewer or out-of-role owner; nothing ignored.
- ux-1.md "Not verified" items unchanged: e2e page-contract stays red
  pre-existing (gate-e2e-2); manual 375/1024px spot-check of the 12-col
  table still recommended before ship. The two reviewer assumptions
  (specialist on title axis; Current/Left-only Status) flagged for product
  confirmation remain open — not defects.
- Still blocked/needs user (unchanged): S07-01 real backfill run needs
  APPROVAL; data1-03 + S01-01 migrations are local-only, apply on merge.
