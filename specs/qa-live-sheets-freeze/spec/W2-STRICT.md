# W2-STRICT: sheets-freeze strict flip — deferred mode deleted (FINAL)
Kind: package
ID: W2-STRICT
Dispatch: NEVER

## Goal and contract
The wave-1 grandfather ends: `assertSheetReadAllowed_` drops the `deferred`
branch and `SheetReadGateOpts.deferred` — every non-allowlisted sheet read now
logs `[SHEETS_FREEZE_VIOLATION]` once and throws `SheetsFreezeError`. The
freeze-scan EXPECTED map shrinks to the two guarded seams plus the permanent
carve-outs (manual HCT `readSheet`, user-owned cx-quality, non-sheets
`googleapis` literals, ops scripts). MUST run after every leaf that carried a
`deferred:` flag: W2-SC-02, W2-HM-01, W2-TLQ-01, W2-ADM-01, W2-ADM-02,
W2-ADM-03 — otherwise tsc breaks on the removed type member.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| W2-STRICT-01 | dev | W2-SC-02, W2-HM-01, W2-TLQ-01, W2-ADM-01, W2-ADM-02, W2-ADM-03 | #6 strict flip + EXPECTED shrink | 4/7/160/10 |

## W2-STRICT-01: drop deferred from the guard + scan/test/script alignment
Kind: mini
ID: W2-STRICT-01
Parent: W2-STRICT
Owner: dev
Depends: W2-SC-02, W2-HM-01, W2-TLQ-01, W2-ADM-01, W2-ADM-02, W2-ADM-03
Criteria: PLAN Amendment 4 #6 (strict flip; deferred:true call sites = 0; EXPECTED = two seams)
Skills: none
Budget: files=4; actions=7; changed_lines=160; minutes=10

### Goal
`deferred` no longer exists as a gate option: non-allowlisted reads always
throw, the repo scan pins the shrunk EXPECTED set, the unit test asserts the
strict semantics, and the consumed exempt seed script loses its flag.

### Files
- Edit: `src/features/shared/lib/sheets-freeze.ts` | remove `deferred?:` + its branch (:18, :29-32); log-then-throw tail
- Edit: `tests/lib/sheets-freeze.test.ts` | deferred cases -> strict cases
- Edit: `tests/freeze/sheets-freeze-scan.test.ts` | EXPECTED map shrink + header comment + `deferred` pin
- Edit: `scripts/ops/seed-prod-assumptions.ts` | drop `{ deferred: true }` at :26 (re-run -> SheetsFreezeError by design; comment notes the exemption is consumed)

### Context
- `src/features/shared/lib/sheets-freeze.ts:15-34` | the guard — allowlist rules 1-3 stay verbatim; only the deferred branch changes
- `tests/freeze/sheets-freeze-scan.test.ts:34-59` | current EXPECTED (post-S01-03 tree incl. DEFERRED entries)
- `tests/lib/sheets-freeze.test.ts` | S01-01's five behaviour cases
- `scripts/ops/seed-prod-assumptions.ts:21-30` | the one-time exempt read (already run per TRACKER; prod_assumptions seeded)
- `src/features/cx-hub/lib/roster.ts` | the only remaining opts carrier — `{ manualHct: true }` stays valid

### Contract
Guard tail becomes: allowlist rules 1-3 pass; else
`console.error('[SHEETS_FREEZE_VIOLATION] ' + JSON.stringify({ spreadsheetId, tab }))`
then `throw new SheetsFreezeError('Sheets read frozen: ' + id + ' / ' + tab)` —
the ops-grep marker survives strict mode (the scan test's marker assertion
keeps passing). `SheetReadGateOpts` = `{ extraIds?, manualHct? }` only.
EXPECTED keeps exactly: the two seams (`sheets.ts`, `engine.ts` — update its
comment: no DEFERRED calls remain), `roster.ts` (manualHct), user-owned
`cx-quality/lib/server.ts` + `migrate.ts`, `list-sheets/route.ts` REMOVED
(410 stub — no googleapis left), the two NON-SHEETS googleapis files
(`myday-google.ts`, `shell/registry.ts`), and the three ops scripts
(`qa-recon-sheet.ts`, `check-sheet-access.mts`, `seed-prod-assumptions.ts` —
now throws on re-run, flag consumed). REMOVED entries: tlqueue, heatmap,
scorecard-server, source-health, mirrors, list-sheets. Header comment: wave-2
strict end-state. Unit test: replace the `deferred` case with 'non-allowlisted
logs `[SHEETS_FREEZE_VIOLATION]` once then throws' (spy on console.error);
keep the other four cases. Scan test gains a third assertion: the guard file
contains no `deferred` identifier.
Out of scope: allowlist ids/tabs themselves, roster.ts, engine internals,
cx-quality/** (user-owned EXPECTED entries stay), any e2e run.

### Actions
1. Guard: delete `deferred?:` from `SheetReadGateOpts` + the branch; tail becomes log-then-throw.
2. `npx tsc --noEmit` — proves zero `deferred:` call sites remain in src/ (type member gone); fix nothing else (any hit means a dependency leaf is missing -> stop and report).
3. Unit test: swap the deferred case for the log-then-throw assertion.
4. Scan test: shrink EXPECTED per contract + comment + `deferred` pin on the guard file.
5. Seed script: drop the opts arg + comment that the Amendment-3 exemption is consumed.
6. `npx vitest run tests/lib/sheets-freeze.test.ts tests/freeze/sheets-freeze-scan.test.ts`.
7. Final grep: `rg "deferred:\s*true" src` -> 0 hits; `rg "fetchWorkbookTabs\(|readSheet(Raw)?\(" src --files-with-matches` -> only the EXPECTED files.

### Done when
- Guard throws on every non-allowlisted read (with one violation log); `deferred` absent from SheetReadGateOpts and all of src/; both freeze test files green; tsc clean.

### Verify
- Run: `npx tsc --noEmit && npx vitest run tests/lib/sheets-freeze.test.ts tests/freeze/sheets-freeze-scan.test.ts` -> 0 errors / all pass.

### Handoff
Freeze is strict: the only live sheet reads are `qa_audits`, manual-HCT `Sheet1`, and caller-scoped `Activities`. `[SHEETS_FREEZE_VIOLATION]` remains the ops signal on every blocked read.
Write results/W2-STRICT-01.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
Single leaf done; plan criterion #6 verified when `rg "deferred" src/features/shared/lib/sheets-freeze.ts` is empty and the scan EXPECTED holds only the two seams + permanent carve-outs.
