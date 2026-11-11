# UX3 audit — queue shard 1 — 2026-11-11 — ux-ui-expert

Env: npm run dev @ :3000 (pre-existing instance), e2e seed users (`e2e.admin@dabdoob.com`), chromium headless, heights 900px, fullPage screenshots.
Method: login via `/auth/login`; per route per width — toolbar bounding-box + per-control positions before/after primary action; `scrollWidth <= innerWidth`; heading/landmark/control-name/raw-element/inline-style/overflow DOM probe; 6×Tab focus-ring sample; screenshot `ux3-screens/queue/<route>-<w>.png`.

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|------------|---------|
| `/queue` | PASS | PASS | PASS | FAIL | Q1 @1440 | **FAIL** |
| `/aging` | PASS | PASS | PASS | PASS | — | **PASS** |
| `/checkins` | FAIL | PASS | PASS | PASS | Q4 @375 | **FAIL** |
| `/analytics` | PASS | PASS | PASS | PASS | — | **PASS** |
| `/heatmap` | PASS | PASS | PASS | PASS | — | **PASS** |
| `/scheduler` | PASS | PASS | PASS | PASS | — | **PASS** |

## /queue — FAIL
- Q1: **FAIL @1440** — clicking "Refresh now" reflows `.page-head`: search `input` x 862.8→960.9, "Export" x 1133.8→1330.0, and the refresh button itself drops from y=139.2 (actions row) to y=191.2 (new row). Controls jump ≥98px. PASS @375 (all controls x/y unchanged; status appends below). PASS @768/@1024 (`.page-head` box identical pre/post).
  - What: toolbar controls reposition when refresh state label changes | `.page-head` / `.page-actions` row | 1440px | `ux3-screens/queue/queue-1440.png` | severity **major** | class **A2** (status text shares the actions row instead of a dedicated fixed row; the `aging-page-head` pattern not applied here)
- Q2: PASS — all controls named; focus ring measured `solid 2px rgb(47,111,237)` + box-shadow ring on every tabbable element.
- Q3: PASS — zero raw links/buttons/inputs; `q-mixseg` bars are styled divs.
- Q4: PASS — `scrollWidth==innerWidth` all widths; `.cx-table` (right=1397@375) sits inside a designed h-scroll wrapper, no doc-level scroll.
- Q5: PASS — designed states observed: "no snapshot yet today" cards, "Stale: these figures are from the daily report…" banner, "4 open · click a band…" hint.
- Q6: PASS — only inline styles are dynamic `flex:N 1 0px` + `var(--cx-age-*)` backgrounds (data-driven, allowed) and `.nav-ind` transform.
- Q7: PASS — single h1 "Queue health", no level skips, nav+main+banner landmarks.
- Q8: PASS — seg-selected, disabled ("Refresh again in 99 s"), hover states visually distinct.

## /aging — PASS
- Q1: PASS — "Refresh now" → "Refresh again in N s": radiogroup (x=274.4,y=210.1), hint, and button x/y identical at 375 and 1440; status text lands on its own row below — the A2 reference pattern working as specified (head container +26px is the designed status row).
- Q2: PASS — all controls named; visible 2px focus ring sampled.
- Q3: PASS — 4 class-less `input[radio|checkbox]` are visually-hidden (opacity:0, absolute) inside `.cx-seg`/`.cx-toggle` components — the component pattern, not raw UI.
- Q4: PASS — `scrollWidth==innerWidth` all widths; `.cx-table--nowrap` scrolls inside wrapper at 375.
- Q5: PASS — "No open ticket matches. Widen the filters or press Show all open." designed empty row; "Freshdesk, read …" freshness hint; refresh status `[role=status]` line.
- Q6: PASS — inline literals limited to benign `margin:0px` on `.cx-section__title` and dynamic `.nav-ind` transform.
- Q7: PASS — single h1 "Aging cases", no skips, landmarks present.
- Q8: PASS — `All/Ours/Unassigned` seg distinct selected state; disabled refresh state distinct.

## /checkins — FAIL
- Q1: PASS — `.page-head` identical before/after; no refresh control on page.
- Q2: PASS — labelled fields/selects/textareas; 2px focus ring sampled.
- Q3: PASS with note — 2 visible class-less checkboxes (`label.cx-correct`, checkins-page.tsx:153,185) are intentionally "kept raw" bespoke inline checkbox labels — labelled, focusable, consistent in context. LOW only.
- Q4: **FAIL @375** — `documentElement.scrollWidth=376 > innerWidth=375` (1px horizontal overflow; confirmed by 376px-wide screenshot). No child element exceeds viewport (body.scrollWidth=368) — culprit is above body level or a fixed/shell element; needs source-level bisect.
  - What: 1px document h-overflow | `html` element (no overflowing descendant found) | 375px | `ux3-screens/queue/checkins-375.png` | severity **minor** | class **A6**-adjacent (untraced fixed-width culprit; not a `.cx-*` table overflow)
- Q5: PASS — "No earlier check-ins yet." dashed empty panel; missed-check-in amber banners; "Missed. Not submitted." slot states all designed.
- Q6: PASS — inline styles use `var(--cx-space-3)`/`var(--cx-line)` tokens only.
- Q7: PASS — single h1 "Check-ins", no skips, landmarks present.
- Q8: PASS — styled select ("Choose…"), inputs, green submit, checkbox rows; states distinct.

## /analytics — PASS
- Q1: PASS — `.page-head` identical all widths; no refresh control (read-only report page).
- Q2: PASS — all controls named; 2px focus ring.
- Q3: PASS — 9 class-less inputs are opacity:0/absolute inside `cx-seg`/`cx-toggle` components.
- Q4: PASS — `scrollWidth==innerWidth` all widths. At 375 SVG chart nodes measure right=425 but live inside a designed scroll container (2 h-scrollers); rendered chart is not clipped in `analytics-375.png`.
- Q5: PASS — "3,239" KPI block, ranked country bars, weekly chart, "Show the numbers as a table" disclosure all render.
- Q6: PASS — zero inline literals at ≤768; only `.nav-ind` transform above.
- Q7: PASS — single h1 "Analytics", no skips, landmarks present.
- Q8: PASS — By day/week/month seg + country pills show distinct selected states.

## /heatmap — PASS
- Q1: PASS — `.page-head` identical all widths; no refresh control.
- Q2: PASS — toggles/selects/time-inputs named via wrapping labels; 2px focus ring.
- Q3: PASS — 8 class-less checkboxes are hidden inside `cx-toggle`/`hm-toggle`; 3 visible ones sit under `.hm-toggle` which styles `input` via descendant selector (queue.css:56) — documented component styling, not unstyled.
- Q4: PASS — `scrollWidth==innerWidth` all widths; dense settings grid stacks cleanly at 375 (see `heatmap-375.png`).
- Q5: PASS — "No volumes yet." empty panel with next-step copy; "None yet. Save the current assumptions…" designed empty set.
- Q6: PASS — only `.nav-ind` transform inline.
- Q7: PASS — single h1 "Heatmap", no skips, landmarks + labelled sections (Calls/Chats/Staffing/…).
- Q8: PASS — country pills, AM/PM toggles, disclosure chevrons have distinct selected/open states.

## /scheduler — PASS
- Q1: PASS — `.page-head` identical all widths. No refresh-style control; primary action "Regenerate" not exercised (state-changing recompute; read-only audit caution). Loading→loaded container stable.
- Q2: PASS — named controls; 2px focus ring.
- Q3: PASS — zero raw elements detected.
- Q4: PASS — `scrollWidth==innerWidth` all widths; `.sch-grid-table` (right≈1580@375) scrolls inside a designed h-scroll wrapper — correct dense-grid pattern.
- Q5: PASS — designed status blocks: "1 uncovered shift", "10 tasks will not fit before the deadline", "2 roster exceptions" alert lists.
- Q6: PASS — zero inline literals ≤768; `.nav-ind` only above.
- Q7: PASS — single h1 "TL scheduler", no skips, landmarks present.
- Q8: PASS — Month/Hour by hour/Rest days tabs + day-cell buttons have distinct selected states (visible in `scheduler-375.png`).

## Cross-cutting minor findings (all 6 routes — shell level, not queue-specific)
- **F-logo (minor):** brand logo broken — `GET /_next/image?url=%2Fassets%2Fdabdoob-logo.png&w=640&q=75` → **HTTP 500** in this dev environment; a broken-image icon renders in the top-left shell header in every screenshot (e.g. `queue-1440.png`). Likely dev-mode image-optimizer artifact, but verify before release.
- **F-badge (minor):** floating "⊘ 1 issue ×" badge overlaps the sidebar "PEOPLE & PERFORMANCE" section label at ≥1024 and floats over page content at the left edge at 375 (`scheduler-375.png`, `checkins-375.png`). Deliberate dismissable indicator, but it obscures a nav label — candidate polish item for the shell shard.
- **Env noise (not a finding):** every route logs `Route "<path>": Next.js encountered the unstable value Date.now() while prerendering` + one 500 — dev-server prerender noise, no visible effect.

## Not verified / assumptions
- Empty/error/loading states triggered only via existing UI; error paths not forced (would need data manipulation — out of scope read-only). States inferred from designed empty/stale copy observed.
- `/scheduler` "Regenerate" not clicked (state-changing); Q1 assessed on container stability only.
- Dark mode not exercised (not in contract).
- Focus ring verified by sampling first 6 tabbable elements per route at each width — all showed `2px solid` outline + shadow ring.

Screenshots: `specs/ux-ui-audit-v3/results/ux3-screens/queue/{queue,aging,checkins,analytics,heatmap,scheduler}-{375,768,1024,1440}.png` — 24 files, all present.
