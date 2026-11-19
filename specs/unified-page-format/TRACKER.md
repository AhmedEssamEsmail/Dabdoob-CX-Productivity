# TRACKER: unified-page-format
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at TL start: only untracked `specs/unified-page-format/` (this spec). All other changes are assignment-local.
Baseline at wave-2 start (S02+S03–S07): S01 modified files (docs/UI-SYSTEM.md, app/refresh.css, app/styles/people.css, hub-shared.tsx, cx-queue/shared.tsx, shell/ui.tsx, PageShell.tsx, ui/index.ts) + untracked docs/PAGE-FRAME.md, RefreshButton.tsx, Spinner.tsx. New changes beyond this are assignment-local.
Phase plan (per PM): S01 foundation → gates+report → S02 → S03–S07 → S08 → S09.
Preflight tl-2 batch: check_shards.py PASS ×12 (structural); semantic review PASS (all ≤10f/10a/170 lines/10min, one outcome each). Chains serialized: S03-01→S03-02 (Head), S05-01→S05-02 (QaPage), S06-01→S06-02 (PwShell).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | all 5 leaves done; phase gates passed (see Gate log) |
| S01-01 | mini/S01 | dev | none | 2/4/140/8 | PASS | verified | results/S01-01.md (attempt1 died mid-run; attempt2 finished; tsc+eslint clean) |
| S01-02 | mini/S01 | dev | none | 2/5/70/6 | PASS | verified | results/S01-02.md (rules+clamp in refresh.css, people .main override removed; tsc clean) |
| S01-03 | mini/S01 | dev | S01-02 | 3/4/70/6 | PASS | verified | results/S01-03.md (Spinner + barrel + .page-loading; tsc+eslint clean) |
| S01-04 | mini/S01 | dev | S01-03 | 4/4/130/8 | PASS | verified | results/S01-04.md (attempt1 died mid-run; attempt2 finished; RefreshNow/Hf delegate; tsc+eslint clean) |
| S01-05 | mini/S01 | tech-writer | S01-01 S01-02 S01-03 S01-04 | 2/3/140/8 | PASS | verified | results/S01-05.md (docs/PAGE-FRAME.md + UI-SYSTEM pointer; tokens verified) |
| S02 | package/- | - | S01-03 | n/a | not dispatchable | verified | S02-01 done; wave-2 integration gates pass |
| S02-01 | mini/S02 | dev | S01-03 | 3/6/80/8 | PASS | verified | results/S02-01.md (loading.tsx + data-booted latch in SiteChrome + SPLASH_CSS rule; tsc+eslint clean; manual smoke = PM) |
| S03 | package/- | - | S01-01 S01-02 | n/a | not dispatchable | verified | both leaves done; gates pass |
| S03-01 | mini/S03 | dev | S01-01 S01-02 | 3/9/170/10 | PASS | verified | results/S03-01.md (Head +5 slots; queue: search→toolbar, Export+RefreshNow→actions, stats→stats; aging: Seg→toolbar, AsOfHint→status, RefreshNow→actions; tsc+eslint clean) |
| S03-02 | mini/S03 | dev | S01-01 S01-02 S03-01 | 4/9/150/10 | PASS | verified | results/S03-02.md (analytics→status; heatmap select→toolbar+btns→actions; scheduler pager→toolbar+admin→actions; checkins clean; dead .hm-head-actions/.sch-controls for S09-01) |
| S04 | package/- | - | S01-01 S01-02 | n/a | not dispatchable | verified | both leaves done; gates pass |
| S04-01 | mini/S04 | dev | S01-01 S01-02 | 2/9/170/10 | PASS | verified | results/S04-01.md (overview aside→actions + stats→stats, aging-page-head dropped; my-day kicker→prop, md-head-actions split; tsc+eslint clean) |
| S04-02 | mini/S04 | dev | S01-01 S01-02 | 5/9/150/10 | PASS | verified | results/S04-02.md (Vf +5 slots; roster aside→actions keeps .roster-add-btn; holidays aside→actions; admin/config verified clean; tsc+eslint clean) |
| S05 | package/- | - | S01-01 S01-02 | n/a | not dispatchable | verified | both leaves done; gates pass |
| S05-01 | mini/S05 | dev | S01-01 S01-02 | 6/10/170/10 | PASS | verified | results/S05-01.md (QaPage +5 slots; audit-queue re-slotted; calibration/ctls/disputes already clean; detail asides are body chrome per contract; tsc+eslint clean) |
| S05-02 | mini/S05 | dev | S01-01 S01-02 S05-01 | 6/10/170/10 | PASS | verified | results/S05-02.md (kb-gaps/my-auditor-kpis/qa-forms/quality-analytics/quality-scores re-slotted; my-audits clean; tsc+eslint clean) |
| S06 | package/- | - | S01-01 S01-02 | n/a | not dispatchable | verified | both leaves done; gates pass |
| S06-01 | mini/S06 | dev | S01-01 S01-02 | 5/10/160/10 | PASS | verified | results/S06-01.md (PwShell +5 slots; agents/meetings/my-actions re-slotted; coaching untouched; tsc+eslint clean) |
| S06-02 | mini/S06 | dev | S01-01 S01-02 S06-01 | 4/10/160/10 | PASS | verified | results/S06-02.md (notes search→toolbar+count→status; tl-tasks aside→actions; one-on-ones/-views no head markup; tsc+eslint clean) |
| S07 | package/- | - | S01-01 S01-02 | n/a | not dispatchable | verified | three leaves done; gates pass |
| S07-01 | mini/S07 | dev | S01-01 S01-02 | 4/9/150/10 | PASS | verified | results/S07-01.md (my-status stats→stats; prod-analytics/status-validation pickers→toolbar; tph-grid Ja→toolbar + lastAuto→status; cxp-page dup fixed; tsc+eslint clean) |
| S07-02 | mini/S07 | dev | S01-01 S01-02 | 4/9/140/10 | PASS | verified | results/S07-02.md (kb-tracker/kpi-logs/mail-desk/tl-performance local Shells→slots; editing-conditional kept; tsc+eslint clean) |
| S07-03 | mini/S07 | dev | S01-01 S01-02 | 1/5/60/6 | PASS | verified | results/S07-03.md (trackers switcher aside→toolbar, isEmpty gate kept; tsc+eslint clean) |
| S08 | package/- | - | S02 S03 S04 S05 S06 S07 | n/a | not dispatchable | verified | both specs green post-fixes: frame 3 passed (3.6m), nav 8 passed/2 skipped |
| S08-01 | mini/S08 | test-engineer | S03 S04 S05 S06 S07 | 1/6/230/10 | PASS (check_shards.py) | verified | results/S08-01.md (spec ~270l; suite RED on real findings -> fix-e2e-1 leaves; no skips; tolerance not loosened) |
| S08-02 | mini/S08 | test-engineer | S02 | 1/5/140/10 | PASS (check_shards.py) | verified | results/S08-02.md (spec ~195l; exit 0, 8 passed/2 skipped non-chromium; no splash/appEmpty/rail-remount) |
| S09 | package/- | - | S01-02 S03-01 S04-01 | n/a | not dispatchable | verified | S09-01 done; tsc gate below |
| S09-01 | mini/S09 | dev | S01-02 S03-01 S04-01 | 4/8/70/8 | PASS (check_shards.py) | verified | no results file (worker ended mid-write); TL-verified: 4 dead rules deleted, .pw-page -> --main-pad, zero src refs |
| e1-01 | mini/fix-e2e-1 | dev | none | 1/4/20/5 | PASS (check_shards.py) | verified | results/e1-01.md (worker wrote to root results/ — TL consolidated; kicker+Hm dropped; geometry pass) |
| e1-02 | mini/fix-e2e-1 | dev | none | 7/5/120/10 | PASS (check_shards.py) | superseded | results/e1-02.md (diagnosis done; root fix = refresh.css .page-actions +margin-inline-start:auto — outside Files; edit landed via e1-04) |
| e1-04 | mini/fix-e2e-1 | dev | e1-02 | 1/4/5/5 | PASS (check_shards.py) | verified | results/e1-04.md (+margin-inline-start:auto; six routes ±2px both widths; tsc 0) |
| e1-05 | mini/fix-e2e-1 | dev | S09-01 e1-04 | 2/4/15/5 | PASS (check_shards.py) | verified | results/e1-05.md (SITES retargeted to .page-actions + control guard added to :root .page-actions; vitest 22/22; tsc 0) |
| e1-03 | mini/fix-e2e-1 | dev | none | 2/5/40/6 | PASS (check_shards.py) | verified | results/e1-03.md (worker wrote to root results/ — TL consolidated; quality.css +overflow-wrap:anywhere; hScroll 0 @375) |
| qa1-01 | mini/fix-qa-1 | dev | none | 2/4/20/6 | PASS (check_shards.py) | verified | results/qa1-01.md — TL-verified diff: minInlineSize 14rem meetings / 10rem tl-tasks on actions= primaries; no QUIRKS/routes.ts touch |
| qa1-02 | mini/fix-qa-1 | dev | none | 1/4/40/5 | PASS (check_shards.py) | verified | results/qa1-02.md — TL-verified diff: 4 QUIRKS.skipToolbar entries (/ /audit-queue /people-holidays /qa-forms) w/ notes; `/` console-500 cleared per result |
| qa1-03 | mini/fix-qa-1 | dev | none | 1/3/4/3 | PASS (check_shards.py) | verified | results/qa1-03.md — TL-verified diff: .hm-head-actions + .sch-controls deleted; grep count 0 |
| qa1-04 | mini/fix-qa-1 | dev | none | 1/3/8/4 | PASS (check_shards.py) | verified | results/qa1-04.md — TL-verified diff: reduced-motion guard now :root .spinner + :root[data-reduce-motion] .spinner (container-agnostic) |
| ux1-01 | mini/fix-ux-1 | dev | none | 1/3/8/4 | PASS (check_shards.py) | verified | results/ux1-01.md — TL-verified diff: stats slot now `<>`+4 `.stat` verbatim, no grid-4/mb-3 hits |
| ux1-02 | mini/fix-ux-1 | dev | none | 3/5/14/6 | PASS (check_shards.py) | verified | no results file (worker died post-edit pre-result); TL-verified diff: refresh.css:32-33 both `:root .page-actions` rules after .roster-add-btn; className swaps in both tsx; grep minInlineSize 0; tsc+scoped eslint 0; e2e pin check in gate log |
| ux1-03 | mini/fix-ux-1 | dev | ux1-02 | 1/3/6/4 | PASS (check_shards.py) | verified | results/ux1-03.md — worker 50e9b833 stale (no edit/results) -> fresh 14455f66 applied; TL-verified diff: `:root .page-loading` + `[data-reduce-motion]` variant inside media block + standalone `:root[data-reduce-motion] .page-loading` rule, mirrors .spinner; tsc 0, nav-no-splash 2/2 |
| qa3-01 | mini/fix-qa-3 | dev | none | 1/3/10/5 | PASS (check_shards.py) | verified | results/qa3-01.md — TL-verified diff: grid-4/grid-5 rules + 1180px media block deleted, 820px list cleaned (keeps grid-2/grid-3/cols-32/cols-75); grep 0 hits; guards 22/22; tsc 0 |

Serialization: refresh.css S01-02→S01-03→S09-01; ui/index.ts S01-03→S01-04. Max 4 workers. FIX-qa1 wave: all four leaves touch disjoint files (meetings/tl-tasks tsx; e2e/routes.ts; queue.css; refresh.css) — parallel-safe. FIX-ux1 wave: ux1-01 (overview-page.tsx) + ux1-02 (2 tsx + refresh.css@31) parallel; ux1-03 (refresh.css@593) serial after ux1-02.

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| S01-phase | typecheck | `npx tsc --noEmit` | PASS exit 0 |
| S01-phase | lint | `npx eslint .` | 1 error + 6 warnings, ALL pre-existing/out-of-scope (tests/golden/queue-aggregates.test.ts `any` @123 — baseline at HEAD, untouched; warnings in scripts/specs-probes/admin-page/jobs.ts). S01 files clean. |
| S01-phase | unit | `npx vitest run` | PASS 114 files / 1471 tests |
| S01-phase | e2e | `npm run test:e2e` | N/A — no e2e specs until S08; dev server is PM-owned |
| wave2 (S02+S03–S07) | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/gate-tsc-wave2.log) |
| wave2 | lint | `npx eslint .` | 1 error + 6 warnings — identical to S01 baseline, all pre-existing/out-of-scope (tests/golden `any`, specs probes, admin-page, jobs.ts, qa-queue-active); zero in wave-2 files (logs/gate-eslint-wave2.log) |
| wave2 | unit | `npx vitest run` | PASS 114 files / 1471 tests (logs/gate-vitest-wave2.log) |
| wave2 | e2e | `npm run test:e2e` | N/A — S08 specs not yet written; dev server PM-owned |
| wave3 (S08/S09+fixes) | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/gate-tsc-w3.log empty) |
| wave3 | lint | `npx eslint .` | 1 error + 6 warnings — identical baseline, all pre-existing; zero in wave-3 files (logs/gate-eslint-w3.log) |
| wave3 | unit | `npx vitest run` | interim run: 1 fail css-form-guards (stale .aging-page-head SITES) -> e1-05 fixed; `vitest run tests/css-form-guards.test.ts` PASS 22/22 (logs/gate-cssguards-w3.log); full-suite rerun = PM gate |
| wave3 | e2e frame | `npx playwright test e2e/page-frame.spec.ts --project=chromium` | PASS 3 passed (3.6m) — geometry @1024/@1440 + 375px stack/h-scroll all green (logs/gate-frame-w3.log) |
| wave3 | e2e nav | `npx playwright test e2e/nav-no-splash.spec.ts` | PASS exit 0 (S08-02 leaf run: 8 passed/2 skipped non-chromium) |
| qa1-fix | unit | `npx vitest run` | PASS 114 files / 1471 tests (logs/gate-vitest-qa1.log) |
| qa1-fix | lint | `npx eslint .` | 1 error + 6 warnings — identical pre-existing baseline (tests/golden `any` @123 + out-of-scope warnings); zero in qa1 files (logs/gate-eslint-qa1.log) |
| qa1-fix | e2e contract+frame | `npx playwright test e2e/page-contract.spec.ts e2e/page-frame.spec.ts --project=chromium` | 81 passed / 4 failed (5.7m) — all 4 = cold-dev-server flakes (2× remote-auth login timeout, 2× /quality-analytics aria-busy>15s); isolated warm rerun 6/6 PASS (logs/gate-e2e-qa1*.log). Effective 85/85 green; all qa-1 routes pass; `/` console-500 gone |
| qa1-fix | typecheck | `npx tsc --noEmit` | PASS exit 0 — first run hit stale `.next/dev/types` placeholder (dead dev server: AppRoutes=never); repopulated by e2e's spawned dev server, then clean (logs/gate-tsc-qa1.log) |
| ux1-fix | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/gate-tsc-ux1.log empty) |
| ux1-fix | lint | `npx eslint .` | 1 error + 6 warnings — identical pre-existing baseline (tests/golden `any` @123 + out-of-scope warnings); zero in ux1 files (logs/gate-eslint-ux1.log) |
| ux1-fix | unit | `npx vitest run` | 114 files / 1471 tests PASS; 1 extra "failed" suite = stray reviewer probe `logs/ux-probe/frame-dark-rtl.spec.ts` (Playwright spec collected by vitest — not a project test; review artifact, untouched). Scoped `vitest run tests src` = 114/114, 1471/1471 green (logs/gate-vitest-ux1*.log) |
| ux1-fix | e2e contract+frame | `npx playwright test e2e/page-contract.spec.ts e2e/page-frame.spec.ts --project=chromium` | PASS 85/85 (3.9m) — `/overview` contract + head/stats geometry green post ux1-01/02/03; first attempt aborted on Next.js security-nudge exit, retry clean (logs/gate-e2e-ux1.log) |
| ux1-fix | e2e nav | `npx playwright test e2e/nav-no-splash.spec.ts --project=chromium` | PASS 2/2 (ux1-03 leaf run; one transient login flake, retry green) |
| qa3-fix | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/gate-tsc-qa3.log empty) |
| qa3-fix | lint | `npx eslint .` | 1 error + 6 warnings — identical pre-existing baseline (tests/golden `any` @123 + out-of-scope warnings); zero in refresh.css (logs/gate-eslint-qa3.log) |
| qa3-fix | unit | `npx vitest run` | 114/114 project files, 1471/1471 tests PASS; sole failed file = known stray probe `logs/ux-probe/frame-dark-rtl.spec.ts` (Playwright spec in vitest scope — PM-flagged, unchanged) (logs/gate-vitest-qa3.log) |
| qa3-fix | targeted | `grep -rn "grid-4\|grid-5" src/ tests/ e2e/ docs/` + `npx vitest run tests/css-form-guards.test.ts` | 0 hits; guards 22/22 PASS (leaf run) |
| qa3-fix | e2e | — | SKIPPED — dead-code removal, zero consumers repo-wide; no rendered diff possible. Last green: ux1-fix 85/85 on tree differing only by this removal |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 HIGH: .page-actions box moves/vanishes on primary click — /audit-queue /people-holidays /meetings /tl-tasks /qa-forms | reports/qa-1.md | qa1-01 + qa1-02 | verified | spec/fix-qa-1.md; safe label-swaps get min-inline-size (meetings, tl-tasks); mutating/unmounting primaries get QUIRKS.skipToolbar (/audit-queue, /people-holidays, /qa-forms) |
| qa-2 HIGH: console-500 on `/` | reports/qa-1.md | qa1-02 | verified | `/` renders MyDayPage; primary = mutating POST /api/hub/my-day focusBlock (500 on re-book, pre-existing per specs/e2e-contract-green); `/` QUIRKS.skipToolbar registered — result reports 500 cleared at both widths |
| qa-3 LOW: dead .hm-head-actions/.sch-controls in queue.css | reports/qa-1.md | qa1-03 | verified | spec/fix-qa-1.md#qa1-03 — both rules deleted, grep 0 |
| qa-4 LOW: reduced-motion guard scoped to .page-loading .spinner | reports/qa-1.md | qa1-04 | verified | spec/fix-qa-1.md#qa1-04 — guard rescoped to .spinner |
| qa-5 LOW: `/` date eyebrow dropped (Hm kicker) | reports/qa-1.md | - | deferred | accepted trade-off per e1-01 shard; needs a slot that doesn't shift h1.top if PM wants it back |
| `/` only route rendering `.kicker` -> h1.top -34px vs fleet | results/S08-01.md | e1-01 | verified | spec/fix-e2e-1.md#e1-01; my-day kicker prop + Hm helper removed; frame spec green |
| `.page-actions` right edge off .page-head 384-491px on /agents /heatmap /overview /quality-analytics /queue /scheduler | results/S08-01.md | e1-02 -> e1-04 | verified | e1-02 diagnosed (wrapped flex item, shared cause); e1-04: refresh.css +margin-inline-start:auto; frame spec green |
| `/ctls` 328px h-scroll @375 | results/S08-01.md | e1-03 | verified | spec/fix-e2e-1.md#e1-03; quality.css +overflow-wrap:anywhere on .qa-note-txt--full; hScroll 0 |
| vitest regression: css-form-guards SITES referenced deleted `.aging-page-head` (S09-01 fallout) | logs/gate-vitest-w3.log | e1-05 | verified | SITES retargeted to `.page-actions` + canonical control guard added; 22/22 pass |
| ux-1 MED: Home `stats` slot wrapped in `.grid grid-4 mb-3` — wrong wrap @821-1180px + ~3rem stats→body gap | reports/ux-1.md | ux1-01 | verified | spec/fix-ux-1.md#ux1-01 — wrapper dropped, `.page-stats` auto-fit governs |
| ux-2 LOW: inline `minInlineSize` 14rem/10rem magic values on meetings/tl-tasks primaries | reports/ux-1.md | ux1-02 | verified | spec/fix-ux-1.md#ux1-02 — `.meetings-form-btn`/`.tl-task-form-btn` rules in refresh.css, same 14rem/10rem |
| ux-3 LOW: `.page-loading` animation not gated by reduced-motion | reports/ux-1.md | ux1-03 | verified | spec/fix-ux-1.md#ux1-03 — both guards applied mirroring .spinner; nav-no-splash + contract/frame green |
| ux-4 LOW: `BootSplash.tsx:46` img missing `alt=""` | reports/ux-1.md | - | verified | fixed opportunistically (was PM-deferred); ux-2 confirms `alt=""` present on all three splash imgs (:40/:46/:56) |
| qa-7 LOW: dead `.grid-4`/`.grid-5` utility rules — refresh.css:177-178 + breakpoint mentions (:182, :185-186); ux1-01 removed the last `grid-4` consumer, `grid-5` never had one | reports/qa-3.md | qa3-01 | verified | spec/fix-qa-3.md#qa3-01 — both rules + 1180px block deleted, 820px list cleaned; `grid-2`/`grid-3` kept; grep 0; tsc/eslint/vitest green |

## Review status (final, tl-8 closeout)
| Report | Round | Scope | Verdict | Outcome |
|---|---|---|---|---|
| reports/qa-1.md | 1 | FULL | findings | 2H (qa-1, qa-2) + 3L — fixed via fix-qa-1 (qa1-01..04); qa-5 deferred by PM decision |
| reports/ux-1.md | 1 | FULL | findings | 1M + 3L — fixed via fix-ux-1 (ux1-01..03); ux-4 fixed opportunistically |
| reports/perf-1.md | 1 | FULL | PASS | 0 open — nav latency/splash/rail budgets + ~+1KB gz bundle all within budget |
| reports/qa-2.md | 2 | DELTA | PASS | 1L (qa-6) — fixed by ux1-02, verified FIXED in qa-3 |
| reports/ux-2.md | 2 | DELTA | PASS | 0 open — ux-1..ux-4 all verified FIXED |
| reports/qa-3.md | 3 | DELTA | PASS | 1L (qa-7 dead `.grid-4`/`.grid-5`) — fixed via qa3-01 (tl-7), verified |
| reports/qa-4.md | 4 | DELTA | PASS | 0 open — qa-7 verified FIXED (refresh.css GRID block byte-matches spec; grep 0); all gates green; stray ux-probe vitest artifact + Next upgrade nudge remain PM-owned non-blockers |
| reports/ux-3.md | 3 | DELTA | PASS | 0 open — ux-1..ux-4 confirmed no open items; refresh.css dead-GRID removal zero rendered-diff; live consumers' ≤820px collapse unchanged |

## Blocked / needs user
- (non-blocking, PM decision) Stray reviewer artifact `specs/unified-page-format/logs/ux-probe/frame-dark-rtl.spec.ts` (a Playwright spec) is collected by `npx vitest run` and fails suite loading — will fail every future full vitest run. Fix = move probe out of vitest scope or add `**/specs/**` to vitest exclude; left untouched as review evidence.
- (info) Next.js printed a security-vulnerability upgrade nudge during e2e dev-server spawn (`next upgrade --agent=security`); already relayed by tl-4/qa-2 — no action taken (no deps changes without approval).
