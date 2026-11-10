# perf report - ux-ui-audit-v2 - round 1 (FULL)

Scope: verify PERF-H1..H12 fix items landed + no perf regressions in the working-tree diff (90 M / 51 ?? / 5 D files). Budget: "no regression vs `npm run test:performance` baselines" (PLAN.md §Budgets; suite is a vacuous stub — see notes). Evidence: source inspection + production `.next` manifests left by tl-6 build; `test:performance` re-run to `logs/perf-1-test.log`.

Verdict: **PASS**
Open: 0 BLOCKER / 0 HIGH / 0 MED / 1 LOW

## Measurements

| Metric | Before (audit-perf measured) | After (measured) | Tool |
|---|---|---|---|
| three.js on /ecosystem first load | static top-level imports; ~600KB+ min / ~160KB+ gz est. in route initial chunk | single async chunk `0m1u_hfn4c-04.js` = **694,247 B raw / 180,224 B gz**; in `react-loadable-manifest`, **NOT in the route's 5 initial files** | `next/dynamic ssr:false` at `ecosystem-page.tsx:24`; `.next` manifests via node |
| Dead CSS | `globals.css` 92,999 B + `legacy-apps.css` 188,690 B = **281,689 B** unimported | both **deleted** (`git status` D); `cx-kit.css:1-5` header corrected to real order theme→cx-kit→refresh→route sheet | git status / head |
| `fetchJson` impls | 4 defs, 3 divergent contracts | 1 canonical `shared/lib/fetch-json.ts` (+FetchError/postJson); remaining `export function fetchJson` at queue/shared.tsx:60, hub-shared.tsx:78, people/shared.tsx:14 are **thin facades** delegating to it (legacy names kept) | grep + read |
| Options caches | **5** private inflight Maps (pw dropdownApi, queue optInflight, hub Vo, qa `it`, trackers `Ce`) | 1 canonical `use-options.ts` (optionsCache+optionsInflight, session cache, errors never cached); **4/5 delegate**: pw→`loadOptions`/`useOptions` (pw.tsx:20,222), queue→`useOptions` (shared.tsx:14,483), hub→`loadOptions` (hub-shared.tsx:25,691), qa→`loadOptions` (qa-shared.tsx:52,367). Trackers `Ce` still private → perf-1 | grep + read |
| Loader hooks | 4 `useSe` variants + private cache Maps | `use-page-data.ts` canonical; aliases keep `useSe`/`Eo` names (qa-shared.tsx:115, queue/shared.tsx:65) | read |
| `React.memo` | **0** repo-wide | **22** `memo(` sites; the 5 hot post-split modules carry 6/1/9/3/3 (one-on-ones-views, tph-grid-matrix, tph-grid-views, audit-queue-detail, audit-queue-coverage) — matches S13-08 result | `grep -c "memo("` |
| `useMemo`+`useCallback` | 73 occurrences | **135** occurrences | grep -c |
| Monoliths | 2,771 / 2,663 / 2,244 / 2,125-line pages | split: ecosystem-page **149** + scene 2,474 + ui 67; tph-grid/audit-queue/one-on-ones split per S13-02..05 (tracker-verified goldens 104/104) | `wc -l` |
| AppShell forced layout | `useLayoutEffect` **no dep array** → layout read every render + `PAGES.filter` ×2/render | dep'd `[current?.path, railOff, boot]` + ResizeObserver (AppShell.tsx:187-216); `visible`/`navVisible` memoized (:149,:163). `prevRoutePath`/`openGroups` adjust-during-render kept (sanctioned pattern; audit fix allowed it) | read |
| Bootstrap waterfall | 3 identity reads serial before Promise.all | `Promise.all([currentUser, viewAsState, currentEmail])` at `bootstrap.ts:15` | read |
| Popups poll | 60s poll + **redundant 2.5s boot poll** despite `__CC_BOOT__` | `usePoll(POLL_MS, poll, { immediate:false })` — boot poll gone (Popups.tsx:65); both 1s countdown tickers migrated to visibility-aware `usePoll` (hub-shared:545, queue/shared:365) | read |
| New deps | — | `+server-only` (runtime, ~1KB), `+supabase` (devDep) — **no new client weight** | `git diff package.json` |
| `test:performance` | stub, 14 assertions of hardcoded constants | **PASS exit 0, 14/14, 296ms** — green but measures nothing | vitest run |

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-1 | LOW | `cx-operations/components/trackers-page.tsx:236,458-465` | Residual 5th options impl: private `Ce = new Map<string, Promise<string[]>>` + `G.getDropdownOptions` never re-pointed — S02-03 context listed it but barrel leaves S02-07..11 covered only *-shared modules; spec gap, no leaf owned the page-file impl. Impact bounded: still inflight-deduped + session-cached (= baseline behavior); just not shared cross-feature (~25 private lines). Not a regression vs baseline. | Replace `Ce`/`G.getDropdownOptions` loader with `loadOptions`/`useOptions` from `shared/lib/use-options` (same pattern as pw.tsx:222). | dev |

Not measured / assumptions:
- `test:performance` is the vacuous stub (audit perf-12, carried to PM by tl-6; DECISION "Stays out") — the PLAN budget "no regression vs baselines" is **unenforced**; PASS rests on code/manifest measurements above, not the suite.
- Web-vitals (LCP/INP) on split pages not sampled — no runtime traces run; render-path improvements are structural (memo counts, effect deps), not traced.
- PERF-H2 (server initialData), PERF-H9 (@layer rewrite), PERF-H12 (budget rewrite) excluded per DECISION "Stays out" / runner-up status — verified absent as intended, not flagged.
- Scene chunk also behind `i ? <Scene3D>` data gate (ecosystem-page.tsx:121+) — fetched only after health data arrives; still off initial files per manifest.
