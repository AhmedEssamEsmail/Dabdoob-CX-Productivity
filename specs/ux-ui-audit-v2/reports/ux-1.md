# ux report - ux-ui-audit-v2 - round 1 (FULL, final-diff gate)

Verdict: **FAIL** — one HIGH (queue mobile reflow) + one MED (overview phantom scroll) + deferred LOWs open.
Open: 0B/1H/1M/3L

Scope: final working-tree diff (95 files, +3474/−14982) vs DECISION.md + AUDIT-REPORT Top-20. TL evidence: tl-6 (tsc 0, eslint 0 err, vitest 1196/1196, build 156/156, e2e 124/1 env-flake). Fresh rendered spot-check: 5 routes × 1440/390 into `shots/post-fix/` (log `logs/ux-final-capture.log`, probes `logs/ux-hscroll*.log`).

States checked: rendered 1440+390 (overview, queue, my-day, status-validation, login), h-scroll measured (scrollWidth), h1 presence, empty/error/busy via primitives, keyboard/focus via code + tl-6 a11y-e2e 3/3. Not verified: 200% zoom, dark-mode live (fixture evidence in ux-yours-2), remaining ~38 routes rendered.

## Findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-4 | HIGH | `/queue` — `queue-page.tsx:278-279` `table.cx-table` inside bare `.cc-chart` | Rendered @390: `scrollWidth=857` vs vw=390 (probe ux-hscroll2.log); shot `queue--390.png` is 857px wide — In-today/Resolved columns reachable only via page h-scroll → WCAG 1.4.10 AA fail on primary route. `.cc-chart` only clips `:has(.cx-ladder)` (cx-kit.css:706); this chart wraps a table, no clip. Pre-existing class swap (`tbl`→`cx-table`, no wrap) but in audit's responsive fix class — still open. | Wrap table in `TableScroll`/`cx-tablewrap` (label for role=region+tabindex), or extend clip rule: `.cc-chart:has(.cx-table){overflow-x:auto}` + `min-width` per house pattern. | dev |
| ux-5 | MED | `/overview` — `.cx-sr`/`.sr-only` spans inside `.cx-ladder__seg` (hub-shared.tsx:445-456) | Rendered @390: `scrollWidth=474` (probe ux-hscroll3.log) — phantom 84px page scroll; `overview--390.png` is 474px wide. Root cause: `.cx-sr` is `position:absolute` at static position (cx-kit.css:653-659) inside `pos:static` segs → containing block = ICB → escapes `.cc-chart` overflow clip. Same class applies to any sr-only inside scrollable wide content. | Add `position:relative` to `.cx-ladder__seg` (cx-kit.css:685) AND add `inset-inline-start:0` (or `inset:0`) to `:root .cx-sr, :root .sr-only` so the 1px clip box anchors to its containing block instead of mid-scrollport. | dev |
| ux-6 | MED | `ui/NotConnected.tsx` — exported via `ui/index.ts`, **zero consumers** src-wide | `grep NotConnected src/` → only the file + barrel. Fix #5 (HUB-H2: "not-connected state component + error-copy mapper") half-landed: `toUserText/toUserCopy` adopted (my-day:150,341,515,618,911; admin-config/roster; productivity-analytics) but the component never wired — ecosystem still uses inline copy (`ecosystem-page.tsx:128`). DECISION: "delete zero-value wrappers". | Adopt at the not-connected sites (ecosystem `t('That app is not connected yet…')`, admin `Not connected yet` hint) or drop the export. | dev |
| ux-2 | LOW (carried, still open) | `.cx-empty` inside `.cx-panel`: `audit-queue-page.tsx:364-365`, `my-actions-page.tsx:140-141`; `.cx-empty p` no margin reset, `max-width:34ch` dropped | Confirmed in final diff — `.cx-empty` (cx-kit.css:804-816) still no `p{margin:0;max-width:34ch}` / in-panel transparent variant; box-in-box persists. | As ux-yours-1: `:root .cx-empty p{margin:0;max-width:34ch}`; optional `:root .cx-panel > .cx-empty{border:0;background:transparent}`. | dev |
| ux-3 | LOW (carried, still open) | `trackers-page.tsx:732` `<Chip status="info" className="trk-outside">` | Unchanged — `.cx-chip::before` still resolves `--st-edge` (info) on the grey dashed chip; old `.pill::before` used currentColor. | `plain` prop at site or `.trk-outside::before{background:currentColor}` in operations.css:26. | dev |
| ux-7 | LOW | `Tabs.tsx:107` `aria-orientation="horizontal"` on `role="tabpanel"` | aria-orientation is not a supported attribute on tabpanel (APG); harmless but invalid → validator noise. | Drop the attribute on the panel; keep it on `role="tablist"` (:79). | dev |

## Verified — fix classes landed (no findings)

- **`.cx-*` canonical (fix #2, DECISION B)**: zero loser tokens in `className` src-wide (tbl/seg/card/pill/empty/tag/page-sub/pw-dialog probes = 0 hits; `md-*`/`eco3-*`/`login-*` suffixed skins + `.btn` dual-form alias are documented keeps — `.btn` folded into `:is(.btn,.cx-btn)` cx-kit.css:113-163, deliberately outside the ratchet). eslint `no-restricted-syntax` error-gates `empty|card|pill|note|agechip|tabs|tag|tbl|seg|page-sub|pw-dialog|dq-*` (eslint.config.mjs:9); dq keeps = dq-editor/days/holform only. `dq-refresh` gone → `cx-refresh`. Card.tsx/Modal.tsx/Table.tsx deleted; globals.css/legacy-apps.css absent (−282KB class closed).
- **Primitives**: `PageShell` (section + `aria-labelledby`→h1 + `aria-busy` + busy→LinesSkeleton/error→Failed); `Tabs` APG — tablist/tab/tabpanel, roving tabindex, Arrow/Home/End + RTL, `aria-selected/controls/labelledby`, selected-scrolls-into-view honoring `prefers-reduced-motion`; `Chip` `cx-chip`+`data-status` union (non-interactive span — 0 onClick sites); `Empty` `cx-empty` + `role="heading" aria-level={level}` (e2e1-01 heal verified, default 2); `Dialog` on native `<dialog>` via useDialogModal (Esc onCancel + lightDismiss + labelledby/label props); `Field` clones `aria-invalid`/`aria-describedby`; `ConfirmInline` for destructive actions (4 consumer files); `StatusChip` = Chip delegate.
- **Responsive fixes**: `.upnext` restored scoped `[data-app="hub"]` hub.css:190-196 (fix #3); `.cc-chart:has(.cx-ladder){overflow-x:auto}` + `@media ≤600px .cx-ladder__seg{min-inline-size:2rem}` (fix #4 — but see ux-4 gap); `.cols-32/.cols-75` collapse under media (refresh.css:147-154, fix #13); `TableScroll` `.tblscroll` role=region+tabIndex+fade adopted (kb-gaps:153, mail-desk:456); `PagedList` caps status-validation worklist (:369).
- **a11y batch (#16)**: `document.title` per route (AppShell:299); toasts `role="status" aria-live="polite"` (Toasts:120); bell `aria-label` (Topbar:49); storeErrors `role="alert"`; ink-3 token retuned (theme.css:29/163/236); ecosystem skip-link + state labels; PaintGrid APG + roving tabindex + `aria-readonly`; AutoSaveInput commit-on-blur; my-status `exact:true` heal (e2e1-02).
- **Registry/splits/perf (#1/#18/#20)**: route-coverage guard `tests/shell/registry-coverage.test.ts` (no PAGES[0] fallback); `/tph` renders TphGridPage (S14-06); three.js scene via `next/dynamic` (ecosystem-page:25); monoliths split (tph-grid-*, one-on-ones-*, audit-queue-*, quality-analytics-charts, ecosystem-*, carried-review, queue-core).

## Rendered evidence (post-fix, this round)

- `shots/post-fix/{overview,queue,my-day,status-validation,login}--{1440,390}.png` + `_results.json`; scripts `verify-ux-final.mjs`, `probe-hscroll{,2,3}.mjs`; logs `logs/ux-final-capture.log`, `ux-hscroll{,2,3}.log`.
- /my-day, /status-validation, /auth/login: clean both widths, h1 present, no h-scroll. /overview @1440 clean. Ladder chart renders clipped at 349px but page still scrolls (ux-5).

## Not verified / assumptions

- Only 5/~40 routes re-rendered; remaining routes trusted to tl-6 e2e 124/1 + per-leaf goldens. 320px not probed directly — ux-4/ux-5 measured at 390 and scale worse at 320 (fixed content widths).
- Contrast not re-measured — all migrated markup is token-for-token on baselined `--cx-status-*`/`--st-*`/`--ink-*` paths.
- `.btn` raw-class remnants (11 files) treated as documented dual-form per DECISION B, not findings.
- ux-4 is pre-existing (HEAD had same unwrapped `tbl`); reported because it sits inside the audit's responsive fix class on a primary route.
