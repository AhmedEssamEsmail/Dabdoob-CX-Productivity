# TRACKER: dabdoob-refresh
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass.

Baseline dirty tree at BUILD start: `?? mockups/`, `?? specs/dabdoob-refresh/`
(untracked only; no modified source files — any src/ diff is assignment-local).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | done | all children done; checkpoint-2 gates pass |
| S01-01 | mini/S01 | dev | none | 3/3/20/6 | PASS | done | results/S01-01.md; tsc clean, 0 old strings |
| S01-02 | mini/S01 | dev | none | 2/2/12/5 | PASS | done | results/S01-02.md; tsc clean; note: 'Dabdoob CX Productivity' title still matches PLAN grep substring |
| S01-03 | mini/S01 | dev | none | 7/7/25/10 | PASS | superseded | results/S01-03.md; all 7 edits applied; remainder -> S01-05 (golden oracle brand norm) |
| S01-04 | mini/S01 | dev | none | 5/5/15/8 | PASS | done | results/S01-04.md; tsc clean, 0 hits |
| S01-05 | mini/S01 | test-engineer | none | 2/4/40/10 | PASS (round-2 re-preflight) | done | results/S01-05.md; desk.test.ts 160/160 green; base64-body decode seam documented (D-BRAND) |
| S02 | package/- | - | - | n/a | not dispatchable | done | all children done; checkpoint-2 gates pass |
| S02-01 | mini/S02 | dev | none | 1/4/140/10 | PASS | done | results/S02-01.md; tokens moved, dark blocks done, density intact |
| S02-02 | mini/S02 | dev | S01-01 | 2/8/280/10 | PASS | done | results/S02-02.md; refresh.css created + imported, tsc clean |
| S02-03 | mini/S02 | dev | S02-02 | 1/6/300/10 | PASS (round-2 re-preflight) | done | results/S02-03.md; ~198 lines appended, grep verify 63 >=40 |
| S02-04 | mini/S02 | dev | S02-03 | 1/5/280/10 | PASS | done | results/S02-04.md; ~192 lines viz/lists/agenda/login, grep 56 >=40, tsc clean |
| S02-05 | mini/S02 | dev | S02-02 | 1/5/180/10 | PASS | done | results/S02-05.md; nav bullets off, toasts off-rail, tsc clean |
| S02-06 | mini/S02 | dev | S02-05 | 1/6/200/10 | PASS | done | results/S02-06.md; controls/cards/chips/tables reskin, tsc clean |
| S03 | package/- | - | - | n/a | not dispatchable | done | all children done; checkpoint-2 gates pass |
| S03-01 | mini/S03 | dev | none | 2/5/300/10 | PASS | done | results/S03-01.md; palette + 6/6 filter tests green |
| S03-02 | mini/S03 | dev | S02-02 | 1/6/130/10 | PASS | done | results/S03-02.md; brand+search+avatar rail, eslint/tsc clean |
| S03-03 | mini/S03 | dev | S03-01, S03-02 | 1/4/60/8 | PASS | done | results/S03-03.md; palette wired in AppShell, tsc clean |
| S03-04 | mini/S03 | dev | S02-04 | 1/4/120/8 | PASS | done | results/S03-04.md; login rebuilt to mock, tsc+eslint clean |
| S04 | package/- | - | - | n/a | not dispatchable | done | all children done; checkpoint-3 gates pass |
| S04-01 | mini/S04 | dev | S02-04, S02-06 | 1/4/180/10 | PASS | done | results/S04-01.md; head+4 stats real counts, tsc+eslint clean |
| S04-02 | mini/S04 | dev | S04-01 | 1/5/260/10 | PASS | done | results/S04-02.md; ov-main grid worklist/bars/pulse, scoped style, tsc+eslint clean |
| S04-03 | mini/S04 | dev | S02-04, S02-06 | 1/4/200/10 | PASS | done | results/S04-03.md; head+seg+agenda card real events, tsc+eslint clean |
| S04-04 | mini/S04 | dev | S04-03 | 1/4/180/10 | PASS | done | results/S04-04.md; waiting+focus cards added; NOTE: legacy side cards remain, removal = extra scope flagged |
| S04-05 | mini/S04 | dev | S02-04, S02-06 | 1/4/160/10 | PASS | done | results/S04-05.md; 5 stat cards+deltas real aggregates, tsc+eslint clean |
| S04-06 | mini/S04 | dev | S04-05 | 1/5/220/10 | PASS | done | results/S04-06.md; mixbar+tbl+pill status, tsc clean |
| S04-07 | mini/S04 | dev | S02-04, S02-06 | 1/4/160/10 | PASS | done | results/S04-07.md; seg+mixbar real bands, eslint clean |
| S04-08 | mini/S04 | dev | S04-07 | 1/4/200/10 | PASS | done | results/S04-08.md; queue×age matrix .tbl+agechip drill kept, eslint clean |
| S04-09 | mini/S04 | dev | S02-04, S02-06 | 1/5/220/10 | PASS | done | results/S04-09.md; head+seg+queue worklist, wiring kept, tsc+eslint clean |
| S04-10 | mini/S04 | dev | S04-09 | 1/5/280/10 | PASS | superseded | results/S04-10.md; no code changed; remainder -> S04-20 (qa-shared AuditForm) + S04-21 (`.md` mount) |
| S04-20 | mini/S04 | dev | none | 1/6/380/10 | PASS (round-3 preflight) | done | results/S04-20.md; .card/.tbl AuditForm anatomy, logic untouched, tsc+eslint clean |
| S04-21 | mini/S04 | dev | S04-20 | 1/4/90/6 | PASS (round-3 preflight) | done | results/S04-21.md; open-audit mounted in `.md` right col + `.empty` placeholder, #qa-audit-open kept, tsc+eslint clean |
| S04-11 | mini/S04 | dev | S02-04, S02-06 | 1/4/160/10 | PASS | done | results/S04-11.md; e2e hooks kept, tsc+eslint clean |
| S04-12 | mini/S04 | dev | S04-11 | 1/4/200/10 | PASS | done | results/S04-12.md; FlagDetail->.card/.tbl, logic untouched, tsc+eslint clean |
| S04-13 | mini/S04 | dev | S02-04, S02-06 | 1/4/170/10 | PASS | done | results/S04-13.md; head+4 stats real aggregates, tsc+eslint clean |
| S04-14 | mini/S04 | dev | S04-13 | 1/4/240/10 | PASS | superseded | results/S04-14.md; no code changed; remainder -> S04-22 (.spark->.delta vs-team, no data-layer change) |
| S04-22 | mini/S04 | dev | none | 1/6/170/8 | PASS (round-3 preflight) | done | results/S04-22.md; rank `.tbl` + `.delta` vs-team + kpi `.pill`, no .spark/no queries, tsc+eslint clean |
| S04-23 | mini/S04 | dev | none | 1/6/300/10 | PASS (round-3 preflight) | done | results/S04-23.md; 5 legacy side cards -> `.card`/`.workitem`, all features kept, tsc+eslint clean |
| S04-15 | mini/S04 | dev | S02-04, S02-06 | 1/4/180/10 | PASS | done | results/S04-15.md; head+banner+5 stats real aggregates, tsc+eslint clean |
| S04-16 | mini/S04 | dev | S04-15 | 1/4/200/10 | PASS | done | results/S04-16.md; cap mixbar+attention+spark cards, tsc+eslint clean |
| S04-17 | mini/S04 | dev | S04-16 | 1/3/120/8 | PASS | done | results/S04-17.md; tph grid card-wrapped, tsc+eslint clean |
| S04-18 | mini/S04 | dev | S02-04, S02-06 | 1/4/140/8 | PASS | done | results/S04-18.md; 4 stat cards real metrics, tsc+eslint clean |
| S04-19 | mini/S04 | dev | S04-18 | 1/5/200/10 | PASS | done | results/S04-19.md; flags+bva+actions cards, hooks kept, tsc+eslint clean |
| S05 | package/- | - | - | n/a | not dispatchable | done | all children done; checkpoint-2 gates pass |
| S05-01 | mini/S05 | dev | S01-02, S02-04 | 3/8/200/10 | PASS (round-2 re-preflight) | done | results/S05-01.md; 3 admin pages normalized, tsc+eslint clean |
| S05-02 | mini/S05 | dev | S02-04 | 1/5/160/10 | PASS (round-2 re-preflight) | done | results/S05-02.md; cards/pill/empty applied, tsc+eslint clean |
| S05-03 | mini/S05 | dev | S02-04 | 2/6/200/10 | PASS (round-2 re-preflight) | done | results/S05-03.md; 2 pages card/pill/empty normalized, tsc+eslint clean |
| S05-04 | mini/S05 | dev | S02-04 | 2/6/180/10 | PASS (round-2 re-preflight) | done | results/S05-04.md; audits/kpis pages normalized, tsc+eslint clean |
| S05-05 | mini/S05 | dev | S02-04 | 2/6/180/10 | PASS (round-2 re-preflight) | done | results/S05-05.md; ctls/disputes card+pill normalized, tsc+eslint clean |
| S05-06 | mini/S05 | dev | S02-04 | 2/6/180/10 | PASS (round-2 re-preflight) | done | results/S05-06.md; calibration/kb-gaps card+tbl normalized, tsc+eslint clean |
| S05-07 | mini/S05 | dev | S02-04 | 1/5/160/10 | PASS (round-2 re-preflight) | done | results/S05-07.md; qa-forms card+pill+empty, tsc+eslint clean |
| S05-08 | mini/S05 | dev | S02-04 | 1/5/160/10 | PASS (round-2 re-preflight) | done | results/S05-08.md; sections->cards+pill, tsc+eslint clean |
| S05-09 | mini/S05 | dev | S02-04 | 2/6/200/10 | PASS (round-2 re-preflight) | done | results/S05-09.md; checkins/analytics normalized, tsc+eslint clean |
| S05-10 | mini/S05 | dev | S02-04 | 2/6/180/10 | PASS (round-2 re-preflight) | done | results/S05-10.md; heatmap/scheduler card-framed, tsc+eslint clean |
| S05-11 | mini/S05 | dev | S02-04 | 2/6/200/10 | PASS (round-2 re-preflight) | done | results/S05-11.md; ~255 lines (>200 declared, <cap), tsc+eslint clean |
| S05-12 | mini/S05 | dev | S02-04 | 2/6/200/10 | PASS (round-2 re-preflight) | done | results/S05-12.md; meetings/actions card+worklist+pill, tsc+eslint clean |
| S05-13 | mini/S05 | dev | S02-04 | 2/6/180/10 | PASS (round-2 re-preflight) | done | results/S05-13.md; notes/coaching normalized, tsc+eslint clean |
| S05-14 | mini/S05 | dev | S02-04 | 1/5/160/10 | PASS (round-2 re-preflight) | done | results/S05-14.md; trackers card+empty+pill, .trk-* hooks kept, tsc+eslint clean |
| S05-15 | mini/S05 | dev | S02-04 | 2/6/180/10 | PASS (round-2 re-preflight) | done | results/S05-15.md; tl-perf/kb-tracker normalized, tsc+eslint clean |
| S05-16 | mini/S05 | dev | S02-04 | 2/6/180/10 | PASS (round-2 re-preflight) | done | results/S05-16.md; kpi-logs/mail-desk normalized, tsc+eslint clean |
| S05-17 | mini/S05 | dev | S02-04 | 1/4/80/8 | PASS (round-2 re-preflight) | done | results/S05-17.md; UnbuiltPage .empty body, tsc+eslint clean |
| S06-01 | mini/- | test-engineer | S02-05, S03-02..04, S04-11/12/18/19 | 5/4/80/10 | PASS | done | results/S06-01.md; e2e 75p/10s/0f x2, shot harness 103 shots clean, 0 selector changes |
| FUX-01 | mini/FIX-UX1 | dev | none | 1/3/10/4 | PASS | done | results/FUX-01.md; `.login-card .cx-btn--primary` + svg .95rem rule (refresh.css:519-524) |
| FUX-02 | mini/FIX-UX1 | dev | none | 1/2/8/4 | PASS | done | results/FUX-02.md; `<a href="#">` -> `<span>` same class/style; 0 `href="#"` left |
| FUX-03 | mini/FIX-UX1 | dev | none | 2/4/25/8 | PASS | done | results/FUX-03.md; Tab preventDefault; railSearchRef + focus() in onClose |
| FUX-04 | mini/FIX-UX1 | dev | FUX-03 | 1/3/12/5 | PASS | done | results/FUX-04.md; listRef + useEffect scrollIntoView block:nearest |
| FUX-05 | mini/FIX-UX1 | dev | FUX-04 | 1/3/15/6 | PASS | done | results/FUX-05.md; combobox+expanded+controls+activedescendant, option ids |
| FUX-06 | mini/FIX-UX1 | dev | none | 1/2/20/5 | PASS | done | results/FUX-06.md; prose wall -> one `.card-hint` D() line |
| FUX-07 | mini/FIX-UX1 | dev | none | 1/2/6/4 | PASS | done | results/FUX-07.md; segment `color: var(--cx-age-ink-${ageRank})` like aging-page |
| FUX-08 | mini/FIX-UX1 | dev | FUX-01, FUX-02 | 2/2/6/4 | PASS | done | results/FUX-08.md; `.kicker` + forgot span -> `var(--cx-accent-text)` |
| FUX-09 | mini/FIX-UX2 | dev | none | 1/3/10/5 | PASS | done | results/FUX-09.md; fills -> `--cx-accent`/`--cx-status-bad-fg`/`--cx-line-2`, flat ink `--cx-ink`; tsc+eslint clean |
| FUX-10 | mini/FIX-UF | dev | none | 3/4/170/8 | PASS (fix3 preflight) | done | results/FUX-10.md; `.dq-*`+`.trk-table` -> refresh.css `:root` verbatim; sweep confirms no other cross-app family |
| FUX-11 | mini/FIX-UF | dev | none | 3/4/140/9 | PASS (fix3 preflight) | done | results/FUX-11.md; `scTrend_` + `agents[i].trend`/`prevTeam`; scorecard.test 13/13, tsc clean |
| FUX-12 | mini/FIX-UF | dev | FUX-11 | 1/5/120/9 | PASS (fix3 preflight) | done | results/FUX-12.md; spark col w/ stub+aria, avatar, behaviour pill, delta chip; colSpan 15 |
| FUX-13 | mini/FIX-UF | dev | FUX-12 | 1/5/110/9 | PASS (fix3 preflight) | done | results/FUX-13.md; `.tabs` 4-tab role=tab chrome; admin-gated workbook pane; agent scope unchanged |
| FUX-14 | mini/FIX-UF | dev | FUX-10 | 1/3/35/6 | PASS (fix3 preflight) | done | results/FUX-14.md; ux-9/10/11 CSS fixed; `.rail-search-label`+rail-off rules shipped |
| FUX-15 | mini/FIX-UF | dev | none | 2/5/45/8 | PASS (fix3 preflight) | done | results/FUX-15.md; label span, Ctrl K platform hint, falling-edge focus restore, 4 AR keys |
| NAV | package/- | - | - | n/a | not dispatchable | done | all children done; checkpoint-fix4 gates pass |
| NAV-01 | mini/NAV | dev | none | 1/7/180/10 | PASS (fix4 preflight) | done | results/NAV-01.md; ~185 lines AppShell.tsx; tsc+eslint clean, 0 banned patterns |
| NAV-02 | mini/NAV | dev | NAV-01 | 1/5/70/6 | PASS (fix4 preflight) | done | results/NAV-02.md; 7 `:root` rules refresh.css tail |
| NAV-03 | mini/NAV | test-engineer | NAV-01 | 1/5/120/10 | PASS (fix4 preflight) | done | results/NAV-03.md; e2e/nav-collapse.spec.ts 4 tests, 20/20 all projects |
| PARITY | package/- | - | - | n/a | not dispatchable | done | all children done; checkpoint-fix5 gates pass |
| PX-01 | mini/PARITY | dev | none | 3/7/230/10 | PASS (fix5 preflight) | done | results/PX-01.md; Topbar.tsx + AppShell + Popups; live probe: .topbar first child of #main on 7 routes |
| PX-02 | mini/PARITY | dev | none | 1/5/90/8 | PASS (fix5 preflight) | done | results/PX-02.md; head search + Export CSV + CxFilters row removed |
| PX-03 | mini/PARITY | dev | none | 1/6/130/8 | PASS (fix5 preflight) | done | results/PX-03.md; Open/Reviewed/Disputed seg + .pv-item avatar chips |
| PX-04 | mini/PARITY | dev | PX-03 | 2/4/110/9 | PASS (fix5 preflight) | done | results/PX-04.md; 3-stat grid + scoreEffect via prod_intervals; H7b PARITY divergence comment |
| PX-05 | mini/PARITY | dev | none | 1/4/80/8 | PASS (fix5 preflight) | done | results/PX-05.md; Ga summary slot after Ya tabs; head→tabs→note→stats→panels |
| PX-06 | mini/PARITY | dev | none | 2/5/200/10 | PASS (fix5 preflight) | done | results/PX-06.md; pulse via sc_daily→prod_daily_layers→fcr_daily cascade; Ecosystem row removed; adherence=null (no source) |
| PX-07 | mini/PARITY | dev | none | 1/7/150/9 | PASS (fix5 preflight) | done | results/PX-07.md; today|week seg (2-day API window, documented) + Book focus block CTA |
| PX-08 | mini/PARITY | dev | none | 1/4/45/5 | PASS (fix5 preflight) | done | results/PX-08.md; AgeLadder cx-section dropped; matrix card kept |
| PX-09 | mini/PARITY | dev | none | 1/3/8/4 | PASS (fix5 preflight) | done | results/PX-09.md; sc-from/sc-to style width 9.5rem |
| PX-10 | mini/PARITY | test-engineer | PX-06 | 1/4/40/6 | PASS (fix5 preflight) | done | results/PX-10.md; D-PULSE dropPulse_ seam in hub-overview.test.ts; 10/10 green |
| P2-01 | mini/FIX-PARITY2 | dev | none | 1/3/10/5 | PASS (fix6 preflight) | done | results/P2-01.md; `<Qs>` inside `summary` after grid-5 (L2215), 1 mount, tsc+eslint clean |
| P2-02 | mini/FIX-PARITY2 | dev | P2-01 (same file serial) | 1/2/4/3 | PASS (fix6 preflight) | done | results/P2-02.md; `style width 9.5rem` on `tph-date` Input (L395), tsc+eslint clean |

Serialization: refresh.css FUX-10->FUX-14->NAV-02; AppShell.tsx FUX-15->NAV-01;
agents-page.tsx FUX-12->FUX-13. NAV-02 || NAV-03 after NAV-01.
Fix5: status-validation-page.tsx PX-03 -> PX-04 (declared dep); all other
leaves touch disjoint files. Waves: W1 = PX-01/02/03/05; W2 = PX-04/06/07/08;
W3 = PX-09.

Serialization: layout.tsx S01-01->S02-02; refresh.css S02-02->03->04;
cx-kit.css S02-05->06; AppShell.tsx S03-02->03; admin-page.tsx S01-02->S05-01;
each S04 page file serial across its leaves.

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| S02-03 (spec/S02/03-refresh-data-surfaces.md) | structural: Budget actions=7 vs 6 numbered Actions | whole leaf — fixed: Budget actions=6 | spec fixed |
| S05-01..S05-17 (spec/S05/*.md) | structural: Files lines lack `\| bounded region`; file-count/budget mismatch; S05-01 also actions mismatch | whole leaves — fixed: `| region` appended to all Files lines; S05-01 expanded to 8 numbered actions | spec fixed |
| S01-03 remainder | golden-oracle parity: port `maildesk.ts` emits `Dabdoob CX`, frozen `_archive` legacy emits `CX Helm`; needs divergence mechanism in `tests/golden/desk.test.ts` (normalize brand or allowlist) | S01-05 — brand-normalize legacy oracle output in the test harness only | spec fixed |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| preflight | check_shards.py all 53 leaves | see above | 34 PASS / 19 FAIL (S02-03, S05-01..17) |
| checkpoint-1 | typecheck | `npx tsc --noEmit` | PASS (clean) |
| checkpoint-1 | lint | `npx eslint . --quiet` | PASS (0 errors; 213 pre-existing warnings) |
| checkpoint-1 | unit | `npx vitest run` | 1115/1117 PASS; 2 desk.test.ts parity fails = S01-03 known gap |
| preflight-2 | check_shards.py S01-05, S02-03, S05-01..17 | see above | 19/19 PASS |
| checkpoint-2 | typecheck | `npx tsc --noEmit` | PASS (clean) |
| checkpoint-2 | lint | `npx eslint . --quiet` | PASS (0 errors) |
| checkpoint-2 | unit | `npx vitest run` | 1117/1117 PASS (parity fixed by S01-05) |
| checkpoint-2 | e2e (via S06-01) | `npm run test:e2e` | 75 pass / 10 skip / 0 fail, x2; shot harness 103 shots clean |
| preflight-3 | check_shards.py S04-20..23 | see above | 4/4 PASS (structural) + semantic review vs LIMITS |
| checkpoint-3 | typecheck | `npx tsc --noEmit` | PASS (clean) |
| checkpoint-3 | lint | `npx eslint . --quiet` + scoped 4 files | PASS (0 errors; scoped files clean) |
| checkpoint-3 | unit | `npx vitest run` | 1117/1117 PASS |
| preflight-fix1 | check_shards.py FUX-01..08 | see above | 8/8 PASS (structural) + semantic vs LIMITS |
| checkpoint-fix1 | typecheck | `npx tsc --noEmit` | PASS (clean) |
| checkpoint-fix1 | lint | `npx eslint . --quiet` | PASS (0 errors) |
| checkpoint-fix1 | unit | `npx vitest run` | 1117/1117 PASS |
| preflight-fix2 | check_shards.py FUX-09 | spec/FIX/ux-15-mixbar-tokens.md | 1/1 PASS (structural) + semantic vs LIMITS |
| checkpoint-fix2 | typecheck | `npx tsc --noEmit` | PASS (clean) |
| checkpoint-fix2 | lint | `npx eslint . --quiet` | PASS (0 errors) |
| checkpoint-fix2 | unit | `npx vitest run` | 1117/1117 PASS |
| preflight-fix3 | check_shards.py FUX-10..15 | spec/FIX/uf-*.md | 6/6 PASS (structural; FUX-10 needed "stragglers" reword) + semantic vs LIMITS |
| checkpoint-fix3 | typecheck | `npx tsc --noEmit` | PASS (clean) |
| checkpoint-fix3 | lint | `npx eslint . --quiet` | PASS (EXIT:0, 0 errors) |
| checkpoint-fix3 | unit | `npx vitest run` | 1119/1119 PASS (+2 new `scTrend_` tests) |
| preflight-fix4 | check_shards.py NAV-01..03 | spec/NAV/nav-0*.md | 3/3 PASS (structural) + semantic vs LIMITS |
| checkpoint-fix4 | typecheck | `npx tsc --noEmit` | PASS (clean) |
| checkpoint-fix4 | lint | `npx eslint . --quiet` | PASS (EXIT:0, 0 errors) |
| checkpoint-fix4 | unit | `npx vitest run` | 1119/1119 PASS |
| checkpoint-fix4 | e2e | `npm run test:e2e` + `--last-failed` retry | 84p/12f first pass — ALL 12 = remote-auth login flakes under parallel load (pre-existing specs too); retry: 11p/1s/0f — net PASS |
| preflight-fix5 | check_shards.py PX-01..09 | spec/FIX/parity-0*.md | 9/9 PASS after Files-single-line + budget/context normalization; semantic vs LIMITS ok |
| preflight-fix5b | check_shards.py PX-10 | spec/FIX/parity-10-pulse-oracle.md | 1/1 PASS (structural) + semantic vs LIMITS |
| checkpoint-fix5 | typecheck | `npx tsc --noEmit` | PASS (EXIT:0, clean) |
| checkpoint-fix5 | lint | `npx eslint . --quiet` | PASS (EXIT:0, 0 errors) |
| checkpoint-fix5 | unit | `npx vitest run` | 1117/1117 PASS after PX-10 D-PULSE seam (was 6 oracle fails on additive `pulse` key) |
| checkpoint-fix5 | e2e | `npm run test:e2e` | 95 pass / 10 skip / 0 fail — clean (no login flakes this run) |
| checkpoint-fix5 | live probe | `.devin/work/probe-topbar.mjs` | `.topbar` first child of #main on /overview /queue /status-validation /aging /tph /my-day /agents; crumbs + 3 right controls verified |
| preflight-fix6 | check_shards.py P2-01..02 | spec/FIX/parity2-0*.md | 2/2 PASS (structural) + semantic vs LIMITS |
| checkpoint-fix6 | typecheck | `npx tsc --noEmit` | PASS (EXIT:0, clean) |
| checkpoint-fix6 | lint | `npx eslint . --quiet` | PASS (EXIT:0, 0 errors) |
| checkpoint-fix6 | unit | `npx vitest run` | PASS 1124/1124 (54 files) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| ux-1 (HIGH) login CTA `.btn-primary` dead selector + bare svg | ux-1.md | FUX-01 / dev | done | refresh.css:519-524; results/FUX-01.md |
| ux-2 (MED) forgot-password `href="#"` dead link | ux-1.md | FUX-02 / dev | done | no reset route exists -> `<span>`; results/FUX-02.md |
| ux-3 (MED) palette: no Tab trap / focus not restored | ux-1.md | FUX-03 / dev | done | Tab preventDefault + railSearchRef focus; results/FUX-03.md |
| ux-4 (MED) palette: `.on` scrolls below fold | ux-1.md | FUX-04 / dev | done | scrollIntoView block:nearest; results/FUX-04.md |
| ux-5 (MED) palette: no combobox ARIA | ux-1.md | FUX-05 / dev | done | combobox wiring + ids; results/FUX-05.md |
| ux-6 (MED) agents prose-wall paragraph | ux-1.md | FUX-06 / dev | done | one `.card-hint` line; results/FUX-06.md |
| ux-7 (MED) queue mixbar white labels on light fills | ux-1.md | FUX-07 / dev | done | per-segment `--cx-age-ink-*`; results/FUX-07.md |
| ux-8 (MED) `--cx-accent` as text: `.kicker` + forgot link | ux-1.md | FUX-08 / dev | done | `--cx-accent-text` both spots; results/FUX-08.md |
| ux-9 (LOW) `.cpk-input` container/input style mismatch | ux-1.md | deferred | deferred | LOW per FIX convention |
| ux-10 (LOW) `--cx-ink-3` 4.42:1 on `--cx-bg` | ux-1.md | deferred | deferred | LOW per FIX convention |
| ux-11 (LOW) `.rail-search` label wraps/clips | ux-1.md | deferred | deferred | LOW per FIX convention |
| ux-12 (LOW) `⌘K` glyph shown on non-Mac | ux-1.md | deferred | deferred | LOW per FIX convention |
| ux-13 (LOW) 3 shell strings missing from AR dict | ux-1.md | deferred | deferred | LOW per FIX convention |
| ux-15 (MED) tph mixbar/legend `var(--accent)`/`var(--bad)` undefined; `--line-2` ink 1.39:1 light / ~2.1:1 dark | ux-2.md | FUX-09 / dev | done | results/FUX-09.md; tph-grid-page.tsx ~L2066-2090 remapped, 0 undefined vars left |
| ux-14 (LOW) palette close via ⌘K/route-change skips focus restore | ux-2.md | deferred | deferred | LOW per FIX convention (same as ux-9..13) |
| UF-1 (HIGH) `.dq-*` unstyled on /overview — `[data-app="queue"]`-scoped family used cross-app | user-fix-round.md | FUX-10 / dev | done | sweep done in preflight: real cross-app hits = `.dq-*` (hub/people/quality pages) + `.trk-table` (queue heatmap); `pw-seg`/`oo-alert*`/`cc-*`/`ag-*` already global in cx-kit/refresh; `md-*` sets are per-app; `md-aside`/`md-table`/`md-mail*` are dead classes/ids, never styled |
| UF-2 (HIGH) agents page mockup parity incl. TREND-8W spark from real data | user-fix-round.md | FUX-11 + FUX-12 + FUX-13 / dev | done | payload has no series -> `a.trend` derived from already-loaded sc_daily via scDayRows_ (0 new queries); `prevTeam` = prior-window scAggregate_ mean |
| UF-3 (MED) all deferred LOWs ux-9..ux-14 | user-fix-round.md | FUX-14 + FUX-15 / dev | done | ux-9/10/11 -> refresh.css; ux-11 span + ux-12 + ux-14 -> AppShell.tsx; ux-13 (+ 'vs prior period') -> legacy-i18n-ar.json |
| NAV-1..4 (user round 2) unified collapsible nav, kill _top/BootSplash-on-nav | spec/NAV/user-nav-round.md | NAV-01 + NAV-02 + NAV-03 | done | all groups inline+collapsible, sessionStorage open-set, 0 `_top`/`.nav-ext`, SPA nav e2e-proven |
| B1 (BLOCKER) `.topbar` row missing on all shell pages (crumbs + bell + appearance + avatar); CSS exists refresh.css:9-15 | ux-parity.md | PX-01 / dev | done | results/PX-01.md; live probe 7/7 routes |
| H4 /queue: page-level Export button absent (+ L: queue search into page-head) | ux-parity.md | PX-02 / dev | done | results/PX-02.md |
| H7a /status-validation: Open/Reviewed/Disputed seg absent (+ L: flag-list avatar chips) | ux-parity.md | PX-03 / dev | done | results/PX-03.md |
| H7b /status-validation: TOUCHES/DUR./EVIDENCE cols dropped in "Inside the window" | ux-parity.md | PX-04 / dev | done — documented divergence | results/PX-04.md; case_ids_json stores [id,channel] pairs only; no per-case touches/dur store — PARITY comment in code |
| H9 /tph: `.tph-tabs` below summary block; mock order head→tabs→note→stats→cards | ux-parity.md | PX-05 / dev | done | results/PX-05.md |
| M3 /my-day: no Week view in seg; no page-level Book-focus-block CTA | ux-parity.md | PX-07 / dev | done — divergence noted | results/PX-07.md; Week = API 2-day window (today+tomorrow); wider range needs API change |
| M5 /aging: duplicated band-ladder section | ux-parity.md | PX-08 / dev | done | results/PX-08.md |
| M7 /status-validation: "Score effect" stat dropped (if derivable) | ux-parity.md | PX-04 / dev | done | results/PX-04.md; scoreEffect = flagged_min/dayMin share via prod_intervals (null-safe) |
| M8 /agents: `.cx-input` width stacks date range 3 rows | ux-parity.md | PX-09 / dev | done | results/PX-09.md |
| M2 /overview: Team pulse renders age-band bars, not mock's 4 KPI bars (+ L: extra Ecosystem row) | ux-parity.md | PX-06 / dev | done — divergence noted | results/PX-06.md; adherence has no source → null/`–` |
| L insight chip bottom-left orange vs mock toast bottom-right dark | ux-parity.md | none needed | done — documented divergence | probe-portal.json: element = `<nextjs-portal>` `.nextjs-toast` "0 1 Issue" (Next dev-overlay error badge, shadow DOM, dev-only — NOT app UI). App `.toasts` already bottom-right (`inset-inline-end` + rail margin) dark (`--cx-ink`) = mock `.toast` anatomy; no code change |
| L agents-list avatar chip | ux-parity.md | already done (FUX-12) / PX-03 covers flag-list chips | done | agents-page.tsx:755 `.avatar` initials chip already in rank table |
| ux-p2-1 (MED) /tph `Qs` cap-chart + needs-attention pair above `.tph-tabs` (H9 residual) | ux-parity-2.md | P2-01 / dev | done | results/P2-01.md; `<Qs>` inside `summary` after `.grid-5` stats (L2215), rendered once |
| ux-p2-2 (LOW, blocking per task) /tph `#tph-date` width:100% stacks 3 rows | ux-parity-2.md | P2-02 / dev | done | results/P2-02.md; `style={{width:'9.5rem'}}` on `tph-date` Input (L395) |

Serialization (fix6): both leaves edit tph-grid-page.tsx → serial: P2-01 then P2-02.

## Re-sharding (round 2 returns)
|| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
||---|---|---|---|
|| S04-10 (spec/S04/10-audit-queue-detail.md) | SCOPE_REQUEST: mock-06 detail anatomy lives in `qa-shared.tsx` `AuditForm` (~L805-1005), excluded from Files; shared with calibration-page.tsx | S04-20 (AuditForm -> `.card`/`.tbl` anatomy, qa-shared.tsx) + S04-21 (mount as `.md` right column, audit-queue-page.tsx; dep S04-20) | spec fixed — S04-10 superseded |
|| S04-14 (spec/S04/14-agents-table.md) | SCOPE_REQUEST: `.spark` cells need per-agent weekly series; `scorecard-server.ts`/`scDerive_` only expose period aggregates | S04-22 — `.spark` replaced by real `.delta` vs-team chip (`a.overall − teamScore`, already loaded); band `.pill` from `a.kpi` flags; no data-leaf, no new queries | spec fixed — S04-14 superseded |
|| S04-04 remainder | legacy side cards on my-day-page.tsx remain below new waiting/focus cards; removal exceeded leaf budget | S04-23 — 5 legacy `.md-card`s reskinned to `.card`/`.workitem`; mail search, mark-done, toggles, settings all kept (removal = functional regression, out of scope) | spec fixed |

## Blocked / needs user
- (none)
