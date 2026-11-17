# fix-sec-1 — FIX leaves for reports/sec-1.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/sec-1.md`. Only the MED
finding (sec-1) is dispatched; sec-2/sec-3/sec-4 are LOW -> deferred (wave-2
per owner notes; sec-4 flagged to PM since remote apply is still pending).

## sec1-01: manualHct moves to the dqSyncRoster_ boundary; non-manual callers log + freeze
Kind: mini
ID: sec1-01
Parent: fix-sec-1
Owner: dev
Depends: none
Criteria: sec-1 report finding sec-1 (MED); PLAN #1
Skills: none
Budget: files=2; actions=4; changed_lines=80; minutes=8

### Goal
`dqReadHct_` stops self-granting the Sheet1 exemption. The `{manualHct:true}`
allowance is passed only by `dqSyncRoster_` (reachable solely via admin-gated
`syncRosterNow`/`jobRosterSync`); any other caller emits a loud
`[SHEETS_FREEZE_VIOLATION]` log and is thrown by the freeze guard —
`qaActiveEmails_` (user-owned, DO NOT EDIT) catches it and fails open to null
per its contract.

### Files
- Edit: `src/features/cx-hub/lib/roster.ts` | `dqReadHct_` (:264-288) signature + doc comment; `dqSyncRoster_` call site (:304)
- Edit: `tests/platform/dq-hct-snapshot.test.ts` | add regression cases for the boundary/log behaviour

### Context
- `src/features/cx-hub/lib/roster.ts:264-288,299-317,423-452` | `dqReadHct_` hardcodes `{ manualHct: true }` at :274; `dqSyncRoster_` is the only manual caller; `syncRosterNow`/`jobRosterSync` already `requireRole(['admin'])` + `assertWritable`
- `src/features/shared/lib/sheets-freeze.ts:15-34` | `SheetReadGateOpts`; guard throws `SheetsFreezeError` for non-allowlisted reads, `deferred` logs `[SHEETS_FREEZE_VIOLATION]` and passes — use neither for callers; the leaf logs the same marker itself
- `src/features/cx-quality/lib/server.ts:1799-1830` | `qaActiveEmails_` wraps `dqReadHct_()` in try/catch -> null (fail-open verified: a throw cannot 500 the page, so no grandfather entry). USER-OWNED — reference only, do not edit
- `tests/platform/dq-hct-snapshot.test.ts:12-37` | `readSheet` is vi.mock'd (guard bypassed in tests; opts arg ignored) — regression must spy `console.error`, not the guard
- `scripts/ops/verify-hct-parity.mts:92-93` | calls `dqReadHct_()` — intentionally NOT edited: its Sheet1 read is frozen by design (pre-merge baseline already consumed)

### Contract
`dqReadHct_(opts?: SheetReadGateOpts)` (type-only import from
`@/features/shared/lib/sheets-freeze`) forwards `opts` to `readSheet` — default
is NO `manualHct`. When `!opts?.manualHct` it first emits
`console.error('[SHEETS_FREEZE_VIOLATION] ' + JSON.stringify({ spreadsheetId: <hct id>, tab: 'Sheet1', caller: 'dqReadHct_' }))`,
then calls `readSheet(SPREADSHEETS.hct, 'Sheet1', opts)` which the real engine
rejects with `SheetsFreezeError` (guard fires before any Google call). Record
projection/dedupe unchanged. `dqSyncRoster_` passes `{ manualHct: true }` —
the ONLY `manualHct` grant in src/. `seed-prod-assumptions.ts` keeps its own
`{deferred:true}` exemption untouched.
Out of scope: server.ts and all cx-quality/**, sheets-freeze.ts, engine.ts,
verify-hct-parity.mts, EXPECTED map (roster.ts `readSheet(` entry stays valid),
sec-2/3/4.

### Actions
1. Change `dqReadHct_` to `dqReadHct_(opts?: SheetReadGateOpts)`; add the `!opts?.manualHct` violation log; forward `opts` to `readSheet`; update the doc comment (exemption now granted by the caller, not the read site).
2. In `dqSyncRoster_`, change `await dqReadHct_()` to `await dqReadHct_({ manualHct: true })`.
3. In `tests/platform/dq-hct-snapshot.test.ts`, add cases: bare `dqReadHct_()` logs `[SHEETS_FREEZE_VIOLATION]` (vi.spyOn(console,'error')); `dqReadHct_({manualHct:true})` and a full `dqSyncRoster_` run do NOT log it.
4. Run the targeted vitest files; confirm green.

### Done when
- `{ manualHct: true }` appears in src/ only at the `dqSyncRoster_` call site.
- `dqReadHct_()` with no opts emits `[SHEETS_FREEZE_VIOLATION]` on console.error (spy-verified); with `{manualHct:true}` it does not.
- `dqSyncRoster_` still writes the full dq_hct snapshot and emits no violation log.
- `npx vitest run tests/platform/dq-hct-snapshot.test.ts tests/lib/sheets-freeze.test.ts tests/freeze/sheets-freeze-scan.test.ts` passes.

### Verify
- Run: `npx vitest run tests/platform/dq-hct-snapshot.test.ts tests/lib/sheets-freeze.test.ts tests/freeze/sheets-freeze-scan.test.ts` -> all pass

### Handoff
`dqReadHct_(opts?)` is the new signature — unrepointed user caller
`qaActiveEmails_` (server.ts:1811) now logs `[SHEETS_FREEZE_VIOLATION]` then
throws into its own catch -> null (fail-open preserved; PM hand-back to repoint
it to `dq_hct` stands). `verify-hct-parity.mts` is frozen by design.
Write results/sec1-01.md (<=10 lines); TL alone updates TRACKER.md.
