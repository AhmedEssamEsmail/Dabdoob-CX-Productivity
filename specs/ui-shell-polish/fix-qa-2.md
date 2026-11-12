# fix-qa-2 — ui-shell-polish qa-2 findings (1 leaf)

Source report: `specs/ui-shell-polish/reports/qa-2.md` (finding qa-5, MED —
the only finding this round, routed blocking). Leaf qa1-04 wrote its result
to repo-root `results/qa1-04.md`, overwriting a tracked FOREIGN file
(HEAD content = pwDirectory roster-parity results, another task). The correct
leaf path `specs/ui-shell-polish/results/qa1-04.md` does not exist.

## qa2-01: Restore clobbered foreign `results/qa1-04.md`; re-place leaf result
Kind: mini
ID: qa2-01
Parent: fix-qa-2
Owner: dev
Depends: none
Criteria: repo hygiene / scope integrity (qa-2 finding qa-5)
Skills: none
Budget: files=2; actions=3; changed_lines=10; minutes=5

### Goal
Foreign tracked `results/qa1-04.md` (repo root) is byte-identical to HEAD
again, and the ui-shell-polish qa1-04 leaf result text is preserved at the
correct path `specs/ui-shell-polish/results/qa1-04.md`.

### Files
- Create: `specs/ui-shell-polish/results/qa1-04.md` | the qa1-04 leaf result text currently (wrongly) sitting in repo-root `results/qa1-04.md`
- Edit: `results/qa1-04.md` | repo-root foreign tracked file — restore HEAD content over the clobbered working-tree file

### Context
- `specs/ui-shell-polish/reports/qa-2.md` | finding qa-5 row (evidence + exact fix)
- Repo-root `results/qa1-04.md` | working tree currently holds the 5-line ui-shell-polish leaf result; `git show HEAD:results/qa1-04.md` shows the foreign pwDirectory roster-parity text that must come back

### Contract
Restore + re-place ONLY. Order matters: FIRST copy the current working-tree
content of repo-root `results/qa1-04.md` verbatim to
`specs/ui-shell-polish/results/qa1-04.md` (that text IS the qa1-04 leaf
result evidence), THEN restore the root file from HEAD:
`git show HEAD:results/qa1-04.md > results/qa1-04.md`
(the report's prescribed `git checkout HEAD -- results/qa1-04.md` is the
equivalent and is authorised by the PM task for this one file; no other git
write ops). Do not touch any other file in `results/`, no source edits, no
`.gitignore`/manifest/lockfile changes, no other git commands (no commit,
push, reset, stash, or checkout of any other path).
Out of scope: everything else.

### Actions
1. Write `specs/ui-shell-polish/results/qa1-04.md` with the exact current content of repo-root `results/qa1-04.md` (the qa1-04 leaf result text).
2. Restore the foreign file: `git show HEAD:results/qa1-04.md > results/qa1-04.md` (or the prescribed `git checkout HEAD -- results/qa1-04.md`).
3. Verify `git diff HEAD -- results/qa1-04.md` is empty and `git status --porcelain -- results/` no longer shows `M results/qa1-04.md`.

### Done when
- `specs/ui-shell-polish/results/qa1-04.md` exists and contains the leaf result (Status: done — nul + stale logs deleted, `/logs/` ignored)
- `git diff HEAD -- results/qa1-04.md` output is empty (foreign content restored byte-identical)
- `git status --porcelain -- results/qa1-04.md` prints nothing
- `git show HEAD:results/qa1-04.md | diff - results/qa1-04.md` reports no differences

### Verify
- Run: `git diff HEAD --stat -- results/qa1-04.md` -> empty output

### Handoff
None. Write results/qa2-01.md (<=10 lines) — under
`specs/ui-shell-polish/results/`, NOT repo root; TL alone updates TRACKER.md.
