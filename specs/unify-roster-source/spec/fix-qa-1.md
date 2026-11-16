# fix-qa-1 — unify-roster-source FIX leaves for reports/qa-1.md

Findings routed: qa-2 -> qa1-01, qa-3 -> qa1-02, qa-4 -> qa1-03.
qa-1 (HIGH, execute verify-hct-parity.mts) is BLOCKED on user-approved remote
read — not a leaf; tracked in TRACKER "Blocked / needs user".

## qa1-01: delete stray `nul` file at repo root
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: reports/qa-1.md finding qa-2
Skills: none
Budget: files=1; actions=2; changed_lines=1; minutes=2

### Goal
Remove the stray untracked `nul` file at the repo root (Git Bash `> nul`
redirect artifact, 0 bytes) so it cannot be swept into the merge commit.

### Files
- Edit: `nul` | delete this repo-root stray artifact (0-byte file; removal is the whole change)

### Context
- `reports/qa-1.md` finding qa-2 | `?? nul` in `git status --porcelain`.

### Contract
Delete ONLY `nul`. `nul` is a Windows reserved device name — in Git Bash use
`rm ./nul` (or `rm nul`); if a tool refuses the name, `git clean -f -- nul` is
acceptable. No other file is touched; no commits.
Out of scope: every other file, any git write op, .gitignore edits.

### Actions
1. Delete `nul` at repo root.
2. Confirm it is gone (`git status --porcelain | grep -c nul` -> 0 / `ls nul` fails).

### Done when
- `git status --porcelain` no longer lists `?? nul`.
- No other path changed by this leaf.

### Verify
- Run: `git status --porcelain | grep nul; echo "exit=$?"` -> no `?? nul` line.

### Handoff
none.
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-02: parity harness dedupe mirrors production raw-key
Kind: mini
ID: qa1-02
Parent: fix-qa-1
Owner: data-engineer
Depends: none
Criteria: reports/qa-1.md finding qa-3
Skills: none
Budget: files=1; actions=3; changed_lines=40; minutes=8

### Goal
`indexByEmail` in `scripts/ops/verify-hct-parity.mts` must dedupe on the SAME
key production uses — raw `String(rec.email)`, no trim/lowercase — so
case/whitespace-variant duplicate emails surface as parity diffs instead of
being masked; report those variants as a named diagnostic.

### Files
- Edit: `scripts/ops/verify-hct-parity.mts` | `indexByEmail` + its docblock + one bounded diagnostic block in `main()`

### Context
- `src/features/cx-hub/lib/roster.ts:281,284-286` | production `dqReadHct_`: rows with `rec.email == null` are already filtered; dedupe is `byEmail.set(String(rec.email), rec)` — RAW string, last-wins. This is the exact semantics to mirror.
- `scripts/ops/verify-hct-parity.mts:45-58` | current `indexByEmail` uses `String(r.email ?? '').trim().toLowerCase()` — the masking bug.
- `reports/qa-1.md` finding qa-3 | reviewer's fix direction.

### Contract
- In `indexByEmail`: index key = `String(r.email)` raw (no `.trim()`, no
  `.toLowerCase()`), last-wins `Map.set` — identical to roster.ts:285.
- Skip + count as `blank` only rows whose `r.email` is null/undefined or the
  empty string (production null-filter equivalent). A whitespace-only email is
  NOT blank — it is a real raw key (trimming is the bug being removed).
- New diagnostic in `main()`: after indexing, group each side's indexed raw
  keys by `key.trim().toLowerCase()`; groups containing >1 distinct raw key
  are "case/whitespace variants" — print their count and up to EXAMPLE_CAP
  examples (raw keys shown) under a `case-variants:` label. No extra exit
  condition: raw-key indexing already surfaces variants as
  only-sheet/only-table -> existing exit(1) logic covers them.
- Update the `indexByEmail` docblock to say "raw String(email) — mirrors
  dqReadHct_ last-wins dedupe".
Out of scope: running the script (blocked on approved remote read), any other
file, changing readTable/normalize/diff/exit logic beyond what is stated.

### Actions
1. Change `indexByEmail` key + blank rule + docblock per contract.
2. Add the bounded `case-variants:` diagnostic in `main()`.
3. Run tsc + eslint on the file (no live execution).

### Done when
- Dedupe key is raw `String(r.email)`; no trim/lowercase anywhere on the key.
- Case/whitespace-variant groups are counted + capped-printed.
- `npx tsc --noEmit` exit 0; `npx eslint scripts/ops/verify-hct-parity.mts` exit 0.

### Verify
- Run: `npx tsc --noEmit && npx eslint scripts/ops/verify-hct-parity.mts` -> exit 0.

### Handoff
The qa-1 remote-run approval (TRACKER Blocked) can then prove live parity with
a harness that cannot mask case-variant dupes.
Write results/qa1-02.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-03: silence require() eslint errors in 3 untracked probe files
Kind: mini
ID: qa1-03
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: reports/qa-1.md finding qa-4
Skills: none
Budget: files=3; actions=4; changed_lines=15; minutes=5

### Goal
`npx eslint .` reports 0 errors: fix the 5
`@typescript-eslint/no-require-imports` errors so the lint gate stays green
even if the untracked probes get committed.

### Files
- Edit: `scripts/ops/probe-sync-health.ts` | line 2 `require('dotenv')` -> ESM import
- Edit: `scripts/ops/probe-aging-stale.ts` | line 2 `require('dotenv')` -> ESM import
- Edit: `specs/qa-audit-form-ui/logs/ux-check.cjs` | file-level eslint-disable for the rule (lines 5-7 require fs/path/playwright — legitimate CJS; converting would break `__dirname`/CJS semantics)

### Context
- `scripts/ops/verify-hct-parity.mts:18,21-22` | dotenv ESM precedent in this repo: `import dotenv from 'dotenv'` then `dotenv.config({ path: '...' })`.
- `npx eslint` output: probes err at `:2` (`require('dotenv').config({ path: '.env.local' })`); ux-check.cjs errs at `5:12, 6:14, 7:22`.

### Contract
- In each `.ts` probe: add `import dotenv from 'dotenv'` (after the existing
  import) and replace `require('dotenv').config({ path: '.env.local' })` with
  `dotenv.config({ path: '.env.local' })`. Same env file, same call site —
  behaviour identical (imports hoist; `createClient` is called explicitly
  after the config line, not at import time).
- In `ux-check.cjs`: add `/* eslint-disable @typescript-eslint/no-require-imports */`
  at the top (before or directly after the header comment). Keep all
  `require()` calls as-is.
- No probe logic, paths, queries or file locations change; files stay untracked.
Out of scope: deleting/moving the probes, .eslintignore/config edits, any
other file, `nul` (qa1-01 owns it).

### Actions
1. Convert require->import in `probe-sync-health.ts`.
2. Convert require->import in `probe-aging-stale.ts`.
3. Add the file-level disable in `ux-check.cjs`.
4. Run `npx eslint` on all three + `npx tsc --noEmit`.

### Done when
- `npx eslint scripts/ops/probe-sync-health.ts scripts/ops/probe-aging-stale.ts "specs/qa-audit-form-ui/logs/ux-check.cjs"` exits 0.
- `npx tsc --noEmit` exit 0.

### Verify
- Run: `npx eslint scripts/ops/probe-sync-health.ts scripts/ops/probe-aging-stale.ts "specs/qa-audit-form-ui/logs/ux-check.cjs" && npx tsc --noEmit` -> exit 0.

### Handoff
none — lint gate goes fully green regardless of what lands in the merge commit.
Write results/qa1-03.md (<=10 lines); TL alone updates TRACKER.md.
