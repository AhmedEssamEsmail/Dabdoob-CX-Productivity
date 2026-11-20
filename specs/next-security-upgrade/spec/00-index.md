# Spec index: next-security-upgrade
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | none | #1-#4 | not dispatchable |

Coverage through S01 children: S01-01 -> #1,#2; S01-02 + S01-03 -> #3 (static
gates); S01-04 SUPERSEDED (e2e FAIL 603/750, evidence preserved) ->
S01-06..S01-09 covered #3 browser gate: classify, chromium rerun, serial
firefox rerun, verdict. S01-05 -> #4. S01-09 verdict = REGRESSION (26
deterministic failures, `logs/e2e-gate-verdict.md`) -> USER-APPROVED fix
leaves: S01-10 toolbar geometry (15/26), S01-11 aria-busy never-settles
(4/26), S01-12 /productivity-analytics console errors (2/26), S01-13 /admin
Reminders Toggle (2/26), S01-14 post-fix verify @workers=1 both projects.
The PLAN review gates are PM-run after S01 completes — not leaves.

S01-01..09 + S01-14 are verification/log leaves: zero source edits; `Files`
budgets cover generated logs under `specs/next-security-upgrade/logs/` plus
one <=10-line `results/<id>.md`. S01-10..13 are the approved exception —
bounded app-code fixes in the files each leaf names; `package.json`/lockfile
stay byte-identical, no e2e/config/`.env*` edits. Every fix leaf must read
its cited `node_modules/next/dist/docs/` guide first (Next 16 != training
data — project rule).

Ready now: S01-10..S01-13 (no inter-file conflicts: geometry files vs
quality/use-page-data vs productivity vs admin/Toggle are disjoint; fix
leaf Playwright verifications still serialize on the :3000 webServer — TL
staggers dispatch or owners wait). S01-14 waits on all four fix leaves.
NEEDS_USER: none.
Size gate evidence: manual review vs LIMITS.md — largest new leaf S01-10 at
files=5/actions=5/lines=150/min=10; TL to confirm with
`python "<skill-dir>/check_shards.py" spec/S01.md` pre-dispatch.
