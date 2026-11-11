# UX3 audit — quality shard 2 — 2026-11-11 — ux-ui-expert

Env: npm run dev @ :3000 (pre-existing instance PID 14556), e2e seed users, chromium (Playwright).
Identities: e2e.admin for /quality-scores, /quality-analytics, /my-auditor-kpis, /qa-forms; **e2e.agent for /my-audits** (agent-role view).
Screenshots: `specs/ux-ui-audit-v3/results/ux3-screens/quality/<route>-<w>.png` (fullPage). Probes: DOM metrics per route×width.

| Route | 375 | 768 | 1024 | 1440 | Failing Qs | Verdict |
|-------|-----|-----|------|------|------------|---------|
| /quality-scores | PASS | PASS | PASS | PASS | — | **PASS** |
| /quality-analytics | FAIL | PASS | PASS | PASS | Q4 @375 | **FAIL** |
| /my-auditor-kpis | PASS | PASS | PASS | PASS | — | **PASS** |
| /my-audits (agent) | PASS | PASS | PASS | PASS | — | **PASS** |
| /qa-forms | PASS | PASS | PASS | PASS | — | **PASS** |

All routes: `documentElement.scrollWidth <= innerWidth` verified at every width except where noted; no unnamed controls (0 unnamed of 6–48 visible controls per route); landmarks `nav`+`main`+labelled `section`s present on all; heading order sane (H1→H2, single H1); focus ring measured `outline: solid 2px rgb(47,111,237)` on first Tab (skip link); `--cx-*` tokens used throughout (only inline `style` = dynamic chart-tooltip `transform/width/height` at ≥1024 — JS-positioned, not a hardcoded layout value).

## /quality-scores — PASS
- Q1: PASS — `HEADER.page-head` rect identical (x249.6/y105.6/w740.8/h77.6) before/after clicking "Team lead" sort control @1024; no dedicated refresh control exists.
- Q2: PASS — 29–48 controls, 0 unnamed; sort buttons `.cx-btn.qa-sort`, links `.qa-link`; focus ring verified.
- Q3: PASS — 12 classless `input[type=radio|checkbox]` are wrapped in shared `.cx-seg` labels (`label:has(input:checked)` pill styling per quality.css:61); 1 classless `<a href="/quality-analytics">` sits in footer copy and renders styled.
- Q4: PASS — scrollW=375/768/1024/1440 = vw; `.qa-line` chart svg (min-inline-size 480px) scrolls inside `.qa-trend__scroll{overflow-x:auto}` by design @375.
- Q5: PASS — designed empty state "No tagged fails in these dates." (dashed box); "Not in the score" card populated.
- Q6: PASS — `var(--cx-*)` tokens; 1 dynamic tooltip transform inline @1024+ (JS-positioned).
- Q7: PASS — H1 "Team scores" → card sections; nav/main/labelled regions (6).
- Q8: PASS — `.qa-sort:hover` underline, `:focus-visible` 2px ring, `.cx-seg` checked/hover states, `aria-current` on nav (selected=1).
- Notes (LOW, no fail): classless inputs/anchor are pattern-consistent but would trip a raw-`input:not([class])` lint (B3-lite); `input[type=checkbox]` "Compare with the 11 days before" is a native checkbox inside styled row.
- Dev-mode note: console shows Next dev prerender error `unstable value Date.now()` + one 500 resource; dev overlay "1 Issue" badge overlaps lower-left content in shots — dev-only artifact, not app UI.

## /quality-analytics — FAIL
- Q1: PASS — `.page-head` static across load; no refresh control (filters are segmented/select).
- Q2: PASS — 27–46 controls, 0 unnamed; `.cx-select`, `.cx-seg`, `.cx-btn` shared components.
- Q3: PASS — no raw elements (0/0/6 inputs all inside `.cx-seg`/`.cx-select`).
- **Q4: FAIL @375** — `documentElement.scrollWidth=384 > innerWidth=375` → page-level horizontal scroll. Culprit: "By channel and contact reason" section — `.qa-cols__grid`/`.qa-cols__pick`/`figure.qa-cols`/`.qa-trend__scroll`/svg all w=360 ending at right=384. Root cause: `quality.css:133` `.qa-cols .qa-trend__scroll svg{min-inline-size:360px}` exceeds the ~351px grid track; `grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))` (quality.css:126) min-content blowout — grid item lacks `min-inline-size:0` (or svg min-width needs dropping ≤100%). Also at 375 the "Who needs a look" / "Agents" tables clip columns at card edge (inside `.cx-tablewrap` scroll — acceptable, but no visible scroll affordance). Severity: **major**. Screenshot: `ux3-screens/quality/quality-analytics-375.png`. Phase-1 class: none listed (grid min-content blowout; nearest B13 layout/overflow).
- Q5: PASS — designed empty cells "No random audits in this period."; "Team health" card renders zeros/em-dashes designed.
- Q6: PASS — tokens; tooltip transform only.
- Q7: PASS — H1 + 9×H2 section heads, all labelled regions (12).
- Q8: PASS — `:focus-visible`/`aria-selected`/`aria-current` verified; `.cx-seg` checked state.
- Dev-mode note: same `Date.now()` prerender console error + dev "1 Issue" badge (overlaps table rows at 375 in shot).

## /my-auditor-kpis — PASS
- Q1: PASS — `.page-head` stable; month `<select>` is the only state control.
- Q2: PASS — 7–26 controls, 0 unnamed.
- Q3: PASS — 0 raw links/buttons/inputs.
- Q4: PASS — scrollW=vw all widths; `.cx-table` w=444 @375 scrolls inside `.cx-tablewrap{overflow-x:auto}` (designed); right-edge "HOW IT IS COUNTED" column clipped but reachable via in-card scroll.
- Q5: PASS — "No audits in the last 90 days." designed empty row; dash placeholders for zero KPIs.
- Q6: PASS — tokens; tooltip transform only.
- Q7: PASS — H1 "My auditor work" → H2 "E2E Admin, 2026-11" / "Audits you did"; landmarks ok.
- Q8: PASS — select + sort controls have `:focus-visible` rings; `aria-current` nav.
- Dev-mode note: same prerender `Date.now()` console error; dev badge overlaps "Audits you did" heading area @375 (artifact only).

## /my-audits — PASS (agent identity: e2e.agent@dabdoob.com)
- Q1: PASS — `.page-head` stable; page has no mutation controls (confirm list is empty for fixture agent).
- Q2: PASS — 6–14 controls, 0 unnamed; all keyboard-reachable.
- Q3: PASS — 0 raw elements.
- Q4: PASS — scrollW=vw all widths; no overflow.
- Q5: PASS — designed dashed empty states "Nothing to confirm." / "No other audits."; avg line renders "—".
- Q6: PASS — tokens only.
- Q7: PASS — H1 "My audits" → H2 "To confirm"; nav/main present; agent nav correctly reduced (role-gated).
- Q8: PASS — `aria-current` on "My audits" nav; focus ring verified.
- Dev-mode note: dev "1 Issue" badge bottom-left (same prerender error, verified on sibling routes; agent session showed same badge in shot).

## /qa-forms — PASS
- Q1: PASS — `.page-head` stable; "New form" is primary action (not clicked — opens builder; read-only rule).
- Q2: PASS — 13–32 controls, 0 unnamed; `Edit` buttons `.cx-btn` per row labeled.
- Q3: PASS — 0 raw elements; "New form" is styled `.cx-btn` (green solid variant).
- Q4: PASS — scrollW=375/768/1024/1440 = vw; `.cx-table` w=563 @375 inside `.cx-tablewrap{overflow-x:auto}` — "VERSION" header clipped at card edge, scrollable by design (minor note: no scroll affordance cue at 375).
- Q5: PASS — table renders fixture data; states via chips ("Active"/"Off"/"Placeholder" — designed chips).
- Q6: PASS — tokens; tooltip transform only.
- Q7: PASS — H1 "Audit forms"; landmarks ok.
- Q8: PASS — `aria-current` nav selected; Edit buttons + chips distinct; focus ring verified.
- Notes (LOW): row "PLACEHOLDER audit form: replace with the real criteria" is seeded data, not UI placeholder — flagged in case seeds leak to prod data.
- Dev-mode note: same prerender `Date.now()` console error + dev badge.

## Cross-route finding (all 5 routes)
- **Console/dev error**: every route logs `Error: Route "<path>": Next.js encountered the unstable value Date.now() while prerendering` (+ a 500 resource on some routes; `/` also errors). Next dev overlay shows "1 Issue" badge bottom-left, overlapping content in 375px shots. Dev-only overlay, but the underlying prerender defect is real — routes need dynamic rendering (`await connection()` or `export const dynamic`). Severity: minor (dev-only symptom). Screenshot: any `*-375.png`.

## Not verified / assumptions
- Error/success toasts, dialog flows (New form builder), loading skeletons — not triggerable without mutating data; read-only rule respected.
- Q1 exercised concretely only on /quality-scores (sort click, chrome identical); other routes have no refresh control — header verified static across load+settle.
- Hover distinctness: CSS rules confirmed (`:hover`, `input:checked+span`, `qa-sort:hover`); runtime hover probe was inconclusive (test target retained focus ring) — verified by stylesheet instead.
- Q4 table edge-clipping inside `.cx-tablewrap` judged acceptable (established sibling pattern; internal scroll, page never h-scrolls).
