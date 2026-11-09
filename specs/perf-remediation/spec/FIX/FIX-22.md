# FIX-22: Delete stray artifacts from FIX/QA runs (qa-3)
Kind: mini
ID: FIX-22
Parent: -
Owner: dev
Depends: none
Criteria: qa-3 finding qa-3 (LOW, blocking per task): stray untracked files — `nul` (repo root + spec dir, 0-byte), `tsc-FIX17.log`, `tsc-fix18.log`, and the still-open `.qa-tmp/` dir — would dirty any commit
Skills: none
Budget: files=5; actions=5; changed_lines=5; minutes=4

## Goal
The repo root and spec dir contain none of the listed stray artifacts; the
working tree is free of them.

## Files
- Edit: `nul` | delete this 0-byte stray at repo root entirely
- Edit: `specs/perf-remediation/nul` | delete this 0-byte stray in the spec dir entirely
- Edit: `tsc-FIX17.log` | delete this stray tsc log at repo root entirely (logs belong in specs/perf-remediation/logs/)
- Edit: `tsc-fix18.log` | delete this stray tsc log at repo root entirely
- Edit: `.qa-tmp` | delete this empty stray dir at repo root entirely (from a prior round)

## Context
- `specs/perf-remediation/reports/qa-3.md` (qa-3 row) | the finding
- `git status --porcelain` | confirms all are untracked strays — deleting loses nothing

## Contract
- Delete ONLY the five listed paths. Do not touch any other file, tracked or
  untracked (the baseline dirty tree is user/other-agent work).
- `nul` is a Windows reserved device name: if `rm -f nul` fails, delete via the
  `\\?\` prefix, e.g. `cmd //c "del /f /q \\?\%CD%\nul"` or PowerShell
  `Remove-Item -LiteralPath '\\?\C:\Users\AHMED\KPIs\CX-Hub\nul'`.
- `.qa-tmp` is an empty dir — `rmdir`/`rm -rf` it (verify it is empty first).
Out of scope: gitignore changes, `specs/perf-remediation/logs/*.log` (legit
gate logs — keep), tsconfig.tsbuildinfo (build output, leave).

## Actions
1. Delete `nul` (root).
2. Delete `specs/perf-remediation/nul`.
3. Delete `tsc-FIX17.log`.
4. Delete `tsc-fix18.log`.
5. Delete `.qa-tmp/` and verify with `git status --porcelain` that none remain.

## Done when
- `git status --porcelain` shows no `nul`, `tsc-FIX*.log`, or `.qa-tmp` entries; `ls` confirms all five paths gone.
- No other file modified or deleted.

## Verify
- Run: `git status --porcelain | grep -iE "nul|tsc-FIX|qa-tmp"` -> empty output.

## Handoff
None.
Write results/FIX-22.md (<=10 lines); TL alone updates TRACKER.md.
