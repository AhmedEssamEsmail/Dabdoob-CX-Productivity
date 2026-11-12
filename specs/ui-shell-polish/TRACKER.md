# TRACKER: ui-shell-polish
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Mode: FIX. Source report: `reports/debug-1.md` (8 blocking findings).
Fix spec: `fix-dbg-1.md` (leaves dbg1-01…dbg1-08, all Owner: dev).
Regression spec: `e2e/ui-shell-polish.spec.ts` (6 tests, failing pre-fix).
Baseline dirty tree: not captured — FIX starts on a clean task tree; leaf
purity checked via `git diff HEAD` scoped to each leaf's Files.

Round 2: FIX from `reports/qa-1.md` (verdict FAIL; 4 findings routed as
blocking per task — report tags qa-3/qa-4 LOW). Fix spec: `fix-qa-1.md`
(leaves qa1-01…qa1-04). Baseline dirty tree @qa-1 dispatch: untracked `nul`,
`logs/` (owned by qa1-04). All 4 leaves disjoint files → parallel wave.

Round 3: FIX from `reports/qa-2.md` (verdict FAIL; 1 finding qa-5 MED —
leaf qa1-04 clobbered foreign tracked repo-root `results/qa1-04.md`).
Fix spec: `fix-qa-2.md` (leaf qa2-01). Baseline dirty tree @qa-2 dispatch:
` M results/qa1-04.md` (foreign, owned by qa2-01) + untracked
`specs/ui-shell-polish/` (this task) + `e2e/ui-shell-polish.spec.ts`.

Round 4: FIX from `reports/ux-1.md` (verdict FAIL; 4 findings ux-1…ux-4 —
2 MED + 2 LOW, all routed blocking per task). Fix spec: `fix-ux-1.md`
(leaves ux1-01…ux1-04). Baseline dirty tree @ux-1 dispatch: ` M .gitignore,
src/app/auth/login/page.tsx, src/app/cx-kit.css, src/app/refresh.css,
src/app/styles/quality.css, src/features/cx-hub/components/admin-page.tsx,
src/features/shared/components/shell/AppShell.tsx` (prior rounds' work) +
untracked `specs/ui-shell-polish/` + `e2e/ui-shell-polish.spec.ts`. Leaf
purity = no NEW modified files outside each leaf's Files list. All 4 leaves
disjoint (login page / admin-page+Toggle+cx-kit.css / theme.css / AppShell)
→ parallel wave of 4.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| dbg1-08 | mini/fix-dbg-1 | dev | none | 2/4/60/10 | PASS | verified | RESHARD→env fix: Windows Job-Object killed jest-worker spawns; dev restarted outside Job Object by PM — getQaAccess/getQaScoresPage/options all JSON (401/200); no code edits; results/dbg1-08.md |
| dbg1-03 | mini/fix-dbg-1 | dev | none | 2/3/90/8 | PASS | verified | item3 5/5; imperative body overlay; results/dbg1-03.md |
| dbg1-04 | mini/fix-dbg-1 | dev | none | 2/4/140/10 | PASS | verified | item4 5/5; pending link + calm entry + dead VT rules removed; results/dbg1-04.md |
| dbg1-05 | mini/fix-dbg-1 | dev | none | 1/3/60/8 | PASS | verified | item5 pass; .between row + Toggle; results/dbg1-05.md |
| dbg1-02 | mini/fix-dbg-1 | dev | dbg1-08 | 1/2/20/5 | PASS | verified | item2 re-run 5/5 pass, `overlaps:[]` all projects, api probe 200; results/e2e-item2-rerun.log |
| dbg1-06 | mini/fix-dbg-1 | dev | dbg1-04 | 1/2/20/5 | PASS | verified | avatar+initials removed; tsc clean; e2e flaked on dev-server restart → TL re-runs at integration |
| dbg1-07 | mini/fix-dbg-1 | dev | dbg1-04 | 1/1/15/5 | PASS | verified | :root .who-name xs+ellipsis; e2e flaked on restart → TL re-runs at integration |
| dbg1-01 | mini/fix-dbg-1 | dev | dbg1-02 | 2/4/60/10 | PASS | verified | .qa-sub→inline scoped to qs-tbl-h; item1 5/5; rows 49→36px; results/dbg1-01.md |
| dbg1-09 | mini/fix-dbg-1 | test-engineer | none | 1/1/5/5 | PASS | verified | spec /is→[\s\S]/i; tsc exit 0; results/dbg1-09.md |
| qa1-01 | mini/fix-qa-1 | dev | none | 1/2/25/5 | PASS | verified | navWatch timeout → setError+setLoading(false); tsc 0; item3 5/5; results/qa1-01.md |
| qa1-02 | mini/fix-qa-1 | test-engineer | none | 1/2/25/8 | PASS | verified | item1 per-col ≤1px assert; item3 busy-sample + dead=0; tsc 0; item1\|item3 10/10; results/qa1-02.md |
| qa1-03 | mini/fix-qa-1 | dev | none | 1/1/15/5 | PASS | verified | guarded 8s setTimeout self-clear in navigate; tsc 0; item4 5/5; results/qa1-03.md |
| qa1-04 | mini/fix-qa-1 | dev | none | 5/3/5/5 | PASS | verified | nul+3 stale logs deleted; /logs/ in .gitignore; status clean; results/qa1-04.md |
| qa2-01 | mini/fix-qa-2 | dev | none | 2/3/10/5 | PASS | verified | foreign results/qa1-04.md restored (git diff HEAD empty); leaf result re-placed at specs/…/results/qa1-04.md; results/qa2-01.md |
| ux1-01 | mini/fix-ux-1 | dev | none | 1/2/30/8 | PASS | verified | AbortSignal.timeout(20000) on login fetch; catch maps AbortError/TimeoutError → timeout msg; tsc 0; item3 5/5; results/ux1-01.md |
| ux1-02 | mini/fix-ux-1 | dev | none | 3/3/60/10 | PASS | verified | optimistic `pending` drives checked+disabled; finally reverts to server truth; admin-page.tsx only; tsc 0; item5 5/5; results/ux1-02.md |
| ux1-03 | mini/fix-ux-1 | dev | none | 1/1/4/5 | PASS | verified | `animation-delay:0s !important` in both kill blocks (grep=2); results/ux1-03.md |
| ux1-04 | mini/fix-ux-1 | dev | none | 1/1/2/5 | PASS | verified | `title={user.name}` on .who-name; tsc 0; results/ux1-04.md |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| (none) | | | |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| int-1 | tsc | `npx tsc --noEmit` | FAIL→PASS (TS1501 in spec; dbg1-09 fixed; exit 0) |
| int-1 | eslint | `npx eslint <changed files>` | PASS (exit 0) |
| int-1 | vitest | `npx vitest run` | 1 foreign FAIL: tests/perf/audit-queue-memo.test.tsx (mock missing TableScroll export; files untouched by this fix — pre-existing) |
| int-1 | e2e spec | `npx playwright test e2e/ui-shell-polish.spec.ts` | 29/30; firefox item5 browserContext.close protocol flake → passes solo (e2e-item5-firefox-rerun.log) |
| int-1 | page-contract | `npx playwright test e2e/page-contract.spec.ts -g "admin\|quality-scores\|calibration"` | 27/50 pass; 23 foreign fails = webkit CORS fetch noise + firefox console "Error" (also on untouched /admin/config·roster) + known `.page-actions x moved /admin/roster` (baseline doc'd); 0 h-scroll/unnamed fails — baseline /admin h-scroll cleared |
| int-2 | tsc | `npx tsc --noEmit` | PASS exit 0 (logs/qa1-gate-tsc.log) |
| int-2 | eslint | `npx eslint <changed files + spec>` | PASS exit 0 (1 ignore-warning on .gitignore — no config) |
| int-2 | vitest | `npx vitest run` | 85/86 files, 1295/1299 — only foreign `tests/perf/audit-queue-memo.test.tsx` ×4 (TableScroll mock; untouched, same as int-1/qa-1) |
| int-2 | e2e spec | `npx playwright test e2e/ui-shell-polish.spec.ts` | 27/30 first pass; fails = firefox item1+item2, mobile item2 (data-render 30s waits, probes 200) → 4/4 PASS on `-g "item1\|item2" --project=firefox --project=mobile --workers=1` rerun → env flake (documented firefox/mobile class), net 30/30 evidence |
| int-3 | scoped restore | `git diff HEAD -- results/qa1-04.md` + `git status --porcelain -- results/` | PASS — empty diff (byte-identical to HEAD); no modified entries under results/ |
| int-4 | tsc | `npx tsc --noEmit` | PASS exit 0 (logs/ux1-gate-tsc.log) |
| int-4 | eslint | `npx eslint <4 changed files>` | PASS exit 0 (1 ignore-warning on theme.css — no config; logs/ux1-gate-eslint.log) |
| int-4 | vitest | `npx vitest run` | 85/86 files, 1295/1299 — only foreign `tests/perf/audit-queue-memo.test.tsx` ×4 (TableScroll mock; untouched, same as int-1/int-2; logs/ux1-gate-vitest.log) |
| int-4 | e2e spec | `npx playwright test e2e/ui-shell-polish.spec.ts --workers=2` | 30/30 PASS first pass, no flakes (logs/ux1-gate-e2e.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| dbg-1 TL-drill table labels | debug-1.md | dbg1-01 | verified | item1 5/5; scoped CSS fix |
| dbg-2 qa-grid field overlap | debug-1.md | dbg1-02 | verified | item2 5/5, overlaps:[] |
| dbg-3 login busy dies early | debug-1.md | dbg1-03 | verified | item3 5/5 (worker-run) |
| dbg-4 dead nav wait | debug-1.md | dbg1-04 | verified | item4 5/5 (worker-run) |
| dbg-5 reminders layout | debug-1.md | dbg1-05 | verified | item5 pass (worker-run) |
| dbg-6 rail avatar | debug-1.md | dbg1-06 | verified | tsc clean; e2e at integration |
| dbg-7 rail name size | debug-1.md | dbg1-07 | verified | e2e at integration |
| dbg-8 /api/qa 500 crash | debug-1.md | dbg1-08 | verified | JSON 401/200 on all /api/qa probes |
| qa-1 login stuck busy on dead nav (MED) | qa-1.md | qa1-01 | verified | timeout branch sets error+setLoading(false); item3 5/5 |
| qa-2 item1 weak assert + item3 race (MED) | qa-1.md | qa1-02 | verified | per-col ≤1px assert; busy-sample + dead=0 asserts; 10/10 |
| qa-3 pendingHref no timeout (LOW, routed blocking) | qa-1.md | qa1-03 | verified | 8s guarded self-clear in navigate; item4 5/5 |
| qa-4 stray nul + logs/ scratch (LOW, routed blocking) | qa-1.md | qa1-04 | verified | nul+3 stale logs gone; /logs/ ignored; live dev-server.log kept |
| qa-5 clobbered foreign results/qa1-04.md (MED) | qa-2.md | qa2-01 | verified | foreign file byte-identical to HEAD; leaf result now at specs/ui-shell-polish/results/qa1-04.md |
| ux-1 login fetch hang pins overlay (MED) | ux-1.md | ux1-01 | verified | fetch bounded 20s via AbortSignal.timeout; abort → 'Sign-in timed out — try again.' + overlay dismissed + form re-enabled; item3 5/5 |
| ux-2 reminders toggle looks dead while saving (MED) | ux-1.md | ux1-02 | verified | optimistic `pending` state: pill flips on click, disabled till save settles; error reverts to server truth; item5 5/5 |
| ux-3 reduced-motion kill misses animation-delay (LOW, routed blocking) | ux-1.md | ux1-03 | verified | `animation-delay:0s !important` in both theme.css kill blocks; .page>* no longer pins opacity:0 |
| ux-4 truncated rail name unrecoverable (LOW, routed blocking) | ux-1.md | ux1-04 | verified | `title={user.name}` on .who-name — native tooltip reveals truncated name |

## Blocked / needs user
- Foreign (attributed, not this fix): vitest `tests/perf/audit-queue-memo.test.tsx` 4 fails — ui-barrel mock missing `TableScroll`; page-contract env console-error noise on webkit/firefox; `/admin/roster` toolbar-x (baseline finding).
