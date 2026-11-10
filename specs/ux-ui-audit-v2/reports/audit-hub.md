# Area audit — hub (cx-hub feature + / /overview /agents /analytics /ecosystem + hub.css)

Scope: `src/features/cx-hub/*`, `src/app/{page,overview,agents,analytics,ecosystem}/page.tsx`, `src/app/styles/hub.css`.
Rendered shots (verified): `shots/home--{1440,390}.png`, `overview--{1440,390,768}.png`, `agents--{1440,390,768}.png`, `analytics--{1440,390,768}.png`, `ecosystem--{1440,390,768}.png`, `admin--{1440,390,768}.png`, `admin__config--1440.png`, `admin__roster--1440.png`, `people-holidays--1440.png`.
Baseline: `reports/audit-shared-tokens.md` (vocabularies, tokens, dead sheets).

**Route delegation note:** `/agents` renders `cx-people/agents-page` + `people.css`; `/analytics` renders `cx-queue/analytics-page` + `queue.css` — component findings belong to the people/queue reports (shots confirm both render; route-level issues noted where seen). `/` is a client-side fallback dispatcher (page.tsx:20-38) rendering MyDayPage/PeopleHolidaysPage/AdminPage/OverviewPage in place. `admin-*`, `my-day`, `people-holidays` components live in cx-hub but their routes belong to desk-ops/productivity/people shards — file-level findings are reported here (marked **co-owned**) because the files are in-scope.

---

## FINDINGS

```
SEVERITY: High
ELEMENT: Unregistered routes /admin/config + /admin/roster — wrong shell identity
LOCATION: AppShell.tsx:132-137 (`route = PAGES.find(...) ?? PAGES[0]`) +
  registry.ts (PAGES has "admin" but no "admin/config"/"admin/roster");
  rendered by src/app/admin/{config,roster}/page.tsx
CATEGORY: Layout / Navigation / Accessibility
ISSUE: For `path="admin/roster"` (or admin/config) the PAGES lookup misses →
  route falls back to PAGES[0] (my-day). Result: breadcrumb reads
  "Hub / My day", the rail's aria-current="page" sits on "My day", and the
  app context/title resolve to my-day while the Roster/Configuration page
  renders. VERIFIED: shots/admin__roster--1440.png shows crumb
  "Hub / My day" and the "My day" rail item highlighted on the Roster page.
  The pages still render (requested===undefined → children branch), so the
  chrome lies about where the user is. aria-current pointing at the wrong
  destination is also a name/state defect (4.1.2-adjacent).
ROOT CAUSE: Next routes exist that were never added to the PAGES registry;
  AppShell defaults unknown paths to hub context + first page.
IMPACT: Orientation + assistive-tech location feedback are wrong on two live
  admin screens; any future unregistered route gets the same silent lie.
RECOMMENDED FIX: Register admin/config + admin/roster in PAGES (roles:[admin],
  group:"hub"), or resolve sub-paths to their parent:
  `PAGES.find(p => path === p.path || path.startsWith(p.path + '/'))`.
CENTRALIZATION OPPORTUNITY: No (registry correctness).
```

```
SEVERITY: High
ELEMENT: Deployer-facing error copy on My day (env vars + Apps Script names)
LOCATION: myday-google.ts:59-61 (NOT_CONFIGURED: "set
  GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY with domain-wide
  delegation to the assistant owner"); my-day-page.tsx:46 (Wo: "Run
  debugMyDay in the Apps Script editor"), :1058-1060 (still-loading banner);
  surfaced by Gr() my-day-page.tsx:147 in Today/Tomorrow/Mail/Files/
  Follow-ups sections
CATEGORY: UX copy / Error states / Design System
ISSUE: Internal configuration names (env vars, "Apps Script editor",
  "debugMyDay") are shown to end users as red error text, repeated in up to
  five cards on the home page. VERIFIED: shots/home--390.png shows the
  Google env-var string in Today, Tomorrow, Team lead follow-ups, Waiting
  for your reply and Recent files. Non-admins can neither understand nor
  act on it; it also discloses infra detail (which env vars the deploy
  expects).
ROOT CAUSE: `configured:false` falls through the same `md-err` channel as
  runtime failures — no copy layer between infrastructure errors and user
  surfaces.
IMPACT: Primary landing page presents as "broken" with cryptic tooling
  references whenever Google creds are absent; trust + readability loss on
  the app's front door.
RECOMMENDED FIX: Map the `configured:false` envelope to user copy once
  ("Calendar, mail and Drive aren't connected — the CX admin can finish
  setup in Admin") rendered in ONE banner/card; keep technical detail in
  logs or for admin role only.
CENTRALIZATION OPPORTUNITY: Yes — a configured/feature-off state component
  (icon + plain-language line + admin hint) reused wherever an integration
  is absent.
```

```
SEVERITY: High
ELEMENT: Up-next banner (.upnext section)
LOCATION: hub-shared.tsx:647-666 (Nf), rendered on /overview for tl/admin;
  style should live in hub.css:194-201
CATEGORY: Design System / Layout
ISSUE: The `.upnext` CONTAINER rule is missing from every loaded stylesheet.
  hub.css ports only the children (.upnext-when/-num/-tag/-body/-title/-meta,
  and a 600px collapse for .upnext-go at :201). The container rule
  (grid auto|1fr|auto, surface bg, border, 4px accent stripe, padding,
  margin-block-end, `[data-live]` accent, `:focus-visible` ring) exists only
  in dead globals.css. The section therefore renders as bare text: huge
  "22:00", then "Up next", title, meta stacked — no card, no accent edge,
  no grid. VERIFIED in shots/overview--1440.png: unstyled text block sits
  between the stat row and the work cards. The missing :focus-visible rule
  also means Om() (hub-shared.tsx:60-66) scrolls + focuses a target that
  shows no focus indication (2.4.7 gap on the jump path).
  `.upnext-jump` (hub-shared:642) is a styleless class (harmless —
  .btn-quiet carries it).
ROOT CAUSE: The S12 straggler port recovered .upnext-* children but dropped
  the parent selector (it lives in globals.css, no longer imported).
IMPACT: A promoted "your next thing" callout reads as body text — users miss
  it; the If() jump button scrolls to an unbranded block; programmatic focus
  invisible. Visible regression on a primary page.
RECOMMENDED FIX: Re-add in hub.css:
  [data-app="hub"] .upnext{display:grid;grid-template-columns:auto
    minmax(0,1fr) auto;align-items:center;gap:var(--cx-space-4);
    margin-block-end:var(--cx-space-5);padding:var(--cx-space-4)
    var(--cx-space-5);background:var(--cx-surface);border:1px solid
    var(--cx-line);border-inline-start:4px solid var(--cx-accent);
    border-radius:var(--cx-radius-object)}
  plus `.upnext[data-live]{border-inline-start-color:var(--signal)}`,
  `.upnext:focus-visible{outline:2px solid var(--focus)}` and the 600px
  single-column fallback.
CENTRALIZATION OPPORTUNITY: No (restore what was lost).
```

```
SEVERITY: High
ELEMENT: Age ladder (.cx-ladder) — page-level horizontal overflow at 390px
LOCATION: hub-shared.tsx:475-501 (Wf), styled by cx-kit.css:656-659;
  instances on /overview ("Open tickets by age" panel, Mu board, TL ladder)
CATEGORY: Responsive / Accessibility (1.4.10 reflow)
ISSUE: `.cx-ladder{display:flex;gap:2px}` never wraps and every
  `.cx-ladder__seg` enforces `min-inline-size:2.75rem`. With 13 age bands the
  row can't shrink below ~600px, and nothing between it and the page
  scrolls (.cc-chart/.cx-panel have no overflow handling). Measured
  evidence: shots/overview--390.png is **637×4949** — document scrollWidth
  637px at a 390px viewport (home--390 is 390, ecosystem--390 is 390,
  overview--768 is 768 → overflow starts under ~640px). 1.4.10 fails: whole
  page requires 2D scrolling on phones.
ROOT CAUSE: Fixed min segment width × unbounded band count + no scroll
  container; reflow only tested at ≥768px.
IMPACT: Primary hub dashboard horizontally scrolls on every phone; table/
  header columns lose alignment reference. (queue-page also uses the ladder —
  queue shard should verify the same defect.)
RECOMMENDED FIX: Make the ladder horizontally scrollable instead of the page:
  `.cc-chart{overflow-x:auto}` or `.cx-ladder{overflow-x:auto}`; optionally
  drop min-inline-size to ~2rem under `@media(max-width:600px)`. Fix in
  cx-kit.css once — covers all ladder consumers.
CENTRALIZATION OPPORTUNITY: Yes — one CSS fix fixes every .cx-ladder usage.
```

```
SEVERITY: Medium
ELEMENT: admin-config-page + admin-roster-page — second code generation,
  silent state failures  **co-owned with desk-ops shard (routes /admin/*)**
LOCATION: admin-config-page.tsx:20-32 (load), :39-51 (save);
  admin-roster-page.tsx:39-51, :58-91; both vs hub-shared.tsx:69-228
  (Eo/fetchJson/sh machinery they ignore)
CATEGORY: Architecture / States
ISSUE: These two pages are NOT legacy ports: raw fetch() + useState instead
  of Eo/fetchJson. Consequences: res.ok never checked; load errors →
  console.error → `config=[]` → the "No configuration yet"/"No users yet"
  EMPTY state renders (error reported as empty). Save/Add failures are
  invisible — the catch logs to console, no toast, no field error. roster
  `required` attrs (:139,:148) never enforce: inputs aren't in a <form>,
  handleAdd fires on click → empty user POSTable.
ROOT CAUSE: Newer hand-written pages bypassing the hub's own api/state layer
  (Eo error channel, sh() retry card, toast).
IMPACT: Admin mutations silently fail; a failed GET looks identical to "no
  data". Wrong-admin decisions possible.
RECOMMENDED FIX: Convert both to Eo(fetchJson) + sh() error card + toast on
  mutation failure; wrap add-form in <form onSubmit> for native required
  enforcement.
CENTRALIZATION OPPORTUNITY: Yes — adopt existing Eo/sh/toast; deletes ~60
  lines of bespoke fetch/catch per page.
```

```
SEVERITY: Medium
ELEMENT: Same two pages — accessibility contract gaps  **co-owned**
LOCATION: admin-config-page.tsx:60 (nested <main>), :95-98 (<th> no scope,
  empty <th />), :112-115 (edit Input, no label); admin-roster-page.tsx:95,
  :225-231, :241/:256/:266 (edit Inputs, no label), :126/:210
  (div.card-title, not a heading)
CATEGORY: Accessibility
ISSUE: (a) `<main className="state-screen">` renders inside AppShell's
  `<main id="main">` (AppShell.tsx:634) → two <main> landmarks on the loading
  path. (b) Table <th>s lack scope="col" and the action column is an empty
  <th /> — siblings (_u, people-holidays:303-308) set scope. (c) Inline-edit
  <Input>s in table cells have no accessible name — a SR user lands on an
  unlabeled text field (4.1.2). (d) `.card-title` on <div> where overview
  uses <h2> — heading outline skips levels on the same visual component
  (same defect also in my-day-page.tsx:347,683,753,846 and
  people-holidays-page.tsx:285,407 — pages whose card titles are divs lose
  all h2 structure).
ROOT CAUSE: Not ported markup; handwritten without the conventions the ports
  follow (scope, h2-in-card-head, labeled inputs).
IMPACT: Screen-reader and landmark navigation degrade on admin pages.
RECOMMENDED FIX: main→div; scope="col" + aria-label or cx-sr on empty th;
  aria-label on edit inputs ("Name for {email}"); card-title divs→h2.
CENTRALIZATION OPPORTUNITY: Yes — same fixes as the refactor above; a shared
  EditableCell/inline-edit pattern would prevent recurrence.
```

```
SEVERITY: Medium
ELEMENT: .md-status-blocked pill — borderline contrast (measured)
LOCATION: hub.css:33-34 (`background:var(--cx-status-bad-edge);
  color:var(--cx-accent-ink)`); rendered inside md-actions (my-day-page:193)
CATEGORY: Accessibility (1.4.3)
ISSUE: status-bad-edge #d9483f behind white (#ffffff accent-ink) text at
  .75rem computes to ≈4.25:1 — under the 4.5:1 floor for normal-size text.
  Same pairing risk anywhere *-edge is used as a pill background with
  accent-ink text.
ROOT CAUSE: Edge token (designed for borders) reused as a text background.
IMPACT: The "blocked" action status fails AA on the My day agenda.
RECOMMENDED FIX: Use --cx-status-bad-bg + --cx-status-bad-fg (same pairing
  the other chips use), or darken the edge for text-on-fill uses.
CENTRALIZATION OPPORTUNITY: Yes — prefer the data-status attribute chip
  pattern (_g/cx-chip) over bespoke status classes.
```

```
SEVERITY: Medium
ELEMENT: /ecosystem — no <main> landmark, no skip link, color-only node state
LOCATION: AppShell.tsx:387-389 (children rendered bare for path==="ecosystem");
  ecosystem-page.tsx:2541 (.eco3 role="group" as root), :2545-2550 (tag
  buttons show state text only when is-hot)
CATEGORY: Accessibility (1.3.1 / 1.4.1)
ISSUE: (a) The bare-render path means no <main> landmark and no skip link on
  this route; the page root is a div. (b) At rest each node tag shows only a
  coloured dot for status — state (ok/warn/down/idle) is colour-only until
  hover/focus expands the label (the aria-label does carry it for SR).
ROOT CAUSE: Deliberate bare-scene design (legacy n1) never re-fitted with
  landmarks; expanded state text gated on hover/focus.
IMPACT: Landmark navigation missing on a whole route; non-SR users get no
  persistent read of system health per node.
RECOMMENDED FIX: Wrap .eco3-page in <main id="main">; keep the state label
  visible on down/warn nodes (or a status word next to the dot at all times).
CENTRALIZATION OPPORTUNITY: No.
```

```
SEVERITY: Medium
ELEMENT: Inline <style> block + scattered inline style props
LOCATION: overview-page.tsx:244-246 (OV_CSS const), injected at :503 via
  dangerouslySetInnerHTML; inline props at :288, :289, :507, :541, :544,
  :554 (gap:'.7rem'), :588 (margin:0 ×3); my-day-page.tsx:862
  (margin:'.7rem 0')
CATEGORY: Design System / Architecture
ISSUE: `.ov-main` two-column grid is defined as a JS string injected into the
  document body — outside the hub.css cascade/[data-app] scoping, unminifiable,
  re-inserted per mount. More one-off style props duplicate what
  utility/card classes already express ('.7rem' is off the space scale).
ROOT CAUSE: Port shortcut — page-layout CSS kept next to markup instead of
  the area stylesheet.
IMPACT: Styles invisible to stylesheet audits/codemods; specificity fights;
  pattern invites copy-paste.
RECOMMENDED FIX: Move .ov-main + collapse media rule into hub.css; replace
  inline props with cx-space-* margins or small utility classes; delete
  dangerouslySetInnerHTML.
CENTRALIZATION OPPORTUNITY: Yes — fold into hub.css (its rightful layer).
```

```
SEVERITY: Medium
ELEMENT: Vocabulary splits inside the hub area (headers, seg controls,
  card-title element)
LOCATION: hub-shared.tsx:231-243 (Vf: .dq-head + .page-purpose, used ONLY by
  people-holidays-page.tsx:255) vs overview-page.tsx:434-453 + admin pages
  hand-writing .page-head/.page-sub/.page-purpose; segmented control as
  `.seg`+class "on" in my-day-page.tsx:1021-1037 vs `.pw-seg`+aria-pressed
  in hub-shared.tsx:546 (plus `.cx-seg` third system, baseline finding)
CATEGORY: Design System / Architecture
ISSUE: Two subtitle class names (.page-sub vs .page-purpose) for the same
  element; a shared Vf() header exists but almost no page uses it; and two
  different segmented-control vocabularies live inside this one feature
  (.seg uses an `.on` class, pw-seg uses aria-pressed-only). Same-pattern
  evidence for the baseline's vocabulary-triplication finding.
ROOT CAUSE: Vf/one seg variant ported for one page; later pages copied
  whichever markup was nearest.
IMPACT: Header + toggle markup drifts per page; global restyle needs N edits;
  selected-state mechanism differs (class vs aria-pressed).
RECOMMENDED FIX: Single <PageHead title purpose aside> component + one
  subtitle class; pick ONE segmented control (recommend .cx-seg/Seg) and
  convert .seg/.pw-seg users.
CENTRALIZATION OPPORTUNITY: Yes — ~5 header blocks → 1 component; seg×2→1.
```

```
SEVERITY: Medium
ELEMENT: /admin — "Not built yet." placeholder + unbounded settings list
LOCATION: admin-page.tsx:284-291 (Pf renders `.pending-line` "Not built
  yet." on every /admin visit); admin--1440.png is 1440×16,811 and
  admin--390.png is 490×244,165 — the Settings dl is unbounded
CATEGORY: UX copy / Responsive
ISSUE: A live admin page leads with a development placeholder ("Not built
  yet.") — the audit spec's placeholder-text flag. Below it the Settings
  section renders every config row in one flat list (~16.8K px desktop;
  the mobile shot's 244K px suggests per-row blow-up worth investigating —
  VERIFY: JSON values wrap with overflow-wrap:anywhere and no length cap).
ROOT CAUSE: Pending shell kept verbatim after the real blocks were built
  around it; no pagination/grouping on the settings dl.
IMPACT: The admin console's first word is a TODO; the settings list is
  unwieldy (find-by-search exists but no structure).
RECOMMENDED FIX: Drop the .pending block (or only show it when reqs are
  actually pending); group settings by prefix or cap rows + "show more".
CENTRALIZATION OPPORTUNITY: Yes — a FilteredList pattern (search + grouped
  rows) shared with admin-config.
```

```
SEVERITY: Medium
ELEMENT: hub.css — instances of baseline debts (100vh, breakpoint drift, px
  literals, dead rules)
LOCATION: hub.css:61 (.md-side max-height:calc(100vh - 2*var(--main-pad)));
  breakpoints :55/:62 (900px), :156/:178 (560px eco3), :201 (600px upnext);
  literals :29 (2px), :33 (3px radius), :36/:52/:53 (6px), :58/:71 (10px),
  :22/:50 (64px), :77 (6px 10px), :186 (360px), eco3 rem literals
  :139/:147/:152; :98-105 ([data-accent-preview] dark block identical to
  light → 4 dead rules)
CATEGORY: Design System / Responsive
ISSUE: The 100vh sidebar cap inherits the baseline 100vh problem (mobile URL
  chrome → clipped sidebar). Breakpoints add two more off-scale cuts (560,
  600) on top of the baseline's 1180-vs-1200/900/820 set. Spacing literals
  break the 4px scale. The dark-theme accent-swatch block re-declares the
  identical declarations as light (vars already flip) → dead rules.
ROOT CAUSE: px-faithful port + copy of a defensive block that's now a no-op.
IMPACT: Same as baseline (mobile clip, mid-width hybrids); dead code.
RECOMMENDED FIX: Fold into the baseline sweeps (100dvh, breakpoint tokens,
  spacing snap); delete the duplicate dark block.
CENTRALIZATION OPPORTUNITY: Yes — same token/sweep fixes as shared-tokens.
```

```
SEVERITY: Low
ELEMENT: Misc interaction/semantic nits in cx-hub
LOCATION: (a) my-day-page.tsx:147 (Gr `.md-err` no role="alert") and :336 —
  :507 has it, same file inconsistent; (b) inert <button> segments when Wf
  gets no onPick (hub-shared.tsx:478-493: tabIndex=-1, no handler, yet
  cx-kit.css:665 gives them cursor:pointer) — a button role with no
  behaviour (4.1.2-adjacent); (c) overview-page.tsx:484 check-ins tile
  hardcoded data-tone="ok" even at 0/4 done; (d) fixed heading ids
  "oldest-h" (:70), "md-mail" (my-day:345/347), "upnext-h" (hub-shared:652)
  — duplicate-id land mines if components ever render twice; (e)
  WaitingCard `href={String(m.url || '#')}` (my-day:723,739) — dead "#"
  link when a thread lacks a URL (jumps to top); (f) ih() aria-controls
  → `${n}-body` which only exists while open (my-day:378 vs :415);
  (g) DaySection uses aria-label on <section> while its own <h2> is right
  there (my-day:258-259) — aria-labelledby would chain them;
  (h) Vf renders an empty <p className="page-purpose"> when sub is absent
  (hub-shared:238); (i) `If`/`sh`/`Oo` stack legacy classes onto
  primitives (`btn btn-quiet`/`cx-btn` on <Button>, `input`/`select` on
  <Input>/<Select>) — harmless dup, part of baseline's class-mixing.
CATEGORY: Accessibility / Interaction
RECOMMENDED FIX: role="alert" on all .md-err; cursor:pointer only under
  .cc-pick (and render non-button elements when not pickable); derive tone
  from counts; useId() for heading ids; render <span> not <a> when no url;
  aria-labelledby for DaySection.
CENTRALIZATION OPPORTUNITY: Mixed (per item).
```

```
SEVERITY: Low
ELEMENT: `#/path` navigation + ecosystem dead-end
LOCATION: overview-page.tsx:75,364,547,619,634,649,660 (`#/aging…`,
  `#/queue`, `#/checkins`, `#/coaching`); ecosystem-page.tsx:2565 Lr,
  :2649, :2662; people-holidays:60 (`#/admin`)
CATEGORY: Architecture
ISSUE: All internal links are `#/path` legacy links rewritten by HashShim
  (HashShim.tsx:30-35 → router.replace — client-side, works). Two
  fragilities: the path regex `^[a-z0-9-]+$` silently ignores NESTED paths
  (a future `#/admin/roster` link would be a dead click, no fallback); and
  mixed navigation mechanisms (im() uses location.assign/window.open at
  :2612 — full reload for non-hash links). /ecosystem renders intentionally
  bare (AppShell:387-390) with the only exit being a small "Hub home" text
  link — by design, but single-point-of-exit with no nav landmark.
ROOT CAUSE: Legacy hash-router contract kept verbatim.
IMPACT: Today: none broken. Forward: a nested-path link silently no-ops;
  ecosystem users on mobile must find the 12px "Hub home" link to leave.
RECOMMENDED FIX: Emit `/{path}` hrefs directly (or extend the shim regex to
  allow `/`); consider a back-to-app affordance on the eco3 scene.
CENTRALIZATION OPPORTUNITY: Yes — one link builder (resolveLink already
  exists in gates.ts:139 — reuse it).
```

```
SEVERITY: Low
ELEMENT: ecosystem-page.tsx — architecture + minor scene issues
LOCATION: ecosystem-page.tsx (2,663 lines — minified-name closure port);
  hub.css:139 (.eco3-tag transform:translate(-200vw) initial);
  status hexes duplicated hub.css:132-135 (.eco3-s-*) AND
  ecosystem-page.tsx:139-143 (tr palette for WebGL)
CATEGORY: Architecture / Accessibility
ISSUE: Single 2.6k-line file = the whole three.js scene + data + nav logic
  (>300-line rule broken 8×); unmaintainable symbol names. .eco3-tag buttons
  sit at translate(-200vw) until JS positions them — focusable while
  offscreen in that window (brief invisible-focus risk; the no-WebGL path at
  :2539 correctly omits tags). The four status colours are declared twice
  (CSS --c vars for DOM, tr{} for the scene) — one source of truth per layer
  is inherent, but a shared const could feed the CSS custom properties.
  Good things verified: auto-rotate off under reduced-motion (:2495 !Jd()),
  tags are real <button>s with aria-labels (:2545-2550), dock controls
  labelled/aria-pressed (:2555-2557), Escape resets view (:2535-2538),
  loading/error/denied states exist (:2553, :2646, :2662), credit + links.
ROOT CAUSE: Verbatim minified port kept as one file for parity.
IMPACT: Any ecosystem fix is high-risk archaeology; palette drift possible
  between DOM tag colours and scene colours.
RECOMMENDED FIX: No redesign (out of audit scope) — split scene/data/nav at
  next touch; `visibility:hidden` on .eco3-tag until positioned; keep the
  two palettes in one exported const consumed by both CSS var + three.js.
CENTRALIZATION OPPORTUNITY: Partial (status palette).
```

```
SEVERITY: Low
ELEMENT: Route naming + cross-area visual notes
LOCATION: (a) /agents: route h1 "Agents" (agents/page.tsx:6) vs registry/
  rail/breadcrumb "Agent performance" (registry.ts:296-297) — copy mismatch
  on the same page; (b) /analytics at 390px: chart x-axis labels run
  together ("30 Aug6 Sep13 Sep20 Sep…", shots/analytics--390.png) —
  component is cx-queue/analytics-page.tsx → queue shard owns the fix,
  recorded here for route coverage; (c) "1 Issue ×" pill in every shot's
  bottom-left (overlaps .eco3-dock and the rail) is the Next.js dev-tools
  badge — a capture artifact, not app UI; the harness should disable
  devIndicators so it doesn't collide with shot content.
CATEGORY: Consistency / Capture hygiene
RECOMMENDED FIX: Align h1 with registry title; queue shard fixes axis label
  collision; capture shard disables dev indicators.
CENTRALIZATION OPPORTUNITY: No.
```

---

## A. Layout & Alignment Summary
- Components reviewed: 8 component files (~6,300 lines: hub-shared 854, overview 669, ecosystem 2,663, my-day 1,088, admin 497, admin-config 148, admin-roster 303, people-holidays 503) + hub.css (217) + 5 routes with shots ×3 viewports.
- Misaligned/overlapping: `.upnext` container unstyled (structural); unregistered-route chrome shows wrong page identity (admin/config, admin/roster).
- Spacing violations: ~15 px/rem literals in hub.css; `.7rem`/`margin:0` inline props in overview-page + my-day-page.
- Overflow: `.cx-ladder` → 637px document width at 390px viewport (measured from shot); admin--390 at ~244K px page height (unbounded list, VERIFY row heights).

## B. Design-System Violations (severity)
- High: wrong chrome identity on unregistered /admin/* routes; env-var/dev-tooling error copy to users; lost `.upnext` container rule; `.cx-ladder` reflow failure.
- Medium: `.md-status-blocked` edge-on-white ≈4.25:1; missing <main>/landmark + colour-only node state on /ecosystem; inline `<style>` + inline props bypassing the token layer; page-head + seg vocabulary split (Vf unused); second code generation in admin-config/roster bypassing Eo/sh/cx-* conventions (raw .pill vs _g cx-chip — 4th chip-family instance); "Not built yet." placeholder + unbounded settings list; hub.css 100vh/560px/600px/literals/duplicate dark swatch block.
- Low: `.md-err` role inconsistency; inert button-role ladder segs with pointer cursor; hardcoded data-tone; fixed heading ids; dead `#` href; `#/` links; eco3 palette ×2 sources; agents h1-vs-registry title.

## C. Shared-Components Opportunity Report
- Centralize: PageHead component (Vf already exists — adopt it, one subtitle class); Eo+sh+toast state pattern into admin-config/roster (kills ~120 lines bespoke fetch); `resolveLink` for all `#/` hrefs; EditableCell/inline-edit pattern for the two admin tables; ONE segmented control (.seg/.pw-seg→.cx-seg or Seg); a "feature not connected" state component for the Google-creds envelope; `.card-title`→h2 convention.
- Tokenize/extend: none new — hub.css instances fold into baseline sweeps (breakpoints, spacing, 100vh→dvh).
- Extract: `.ov-main` + `.upnext` rules into hub.css; `cursor:pointer` under `.cc-pick` only; eco3 status palette → one exported const.
- Pages using duplicated implementations: admin-config + admin-roster (fetch/state/landmark/table patterns re-implemented badly); overview vs Vf (header re-implemented); my-day seg vs hub-shared pw-seg.

## D. Technical-Debt Analysis
- Duplicate code: small inside the area — hub-shared.tsx is genuinely the shared layer (good). The real debt is (a) the ecosystem mega-file (2,663 lines of minified names) and (b) the two newer admin pages ignoring the shared layer, plus (c) their routes' missing registry entries lying to the shell.
- Refactor effort: S–M. Registry additions = ~10 lines; .upnext restore = ~10 CSS lines; ladder overflow = ~4 CSS lines; OV_CSS move = trivial; admin pages = mechanical conversion to Eo/sh/form; error copy = one mapping.
- Highest-risk: any future edit in ecosystem-page.tsx; CSS edits near the :root/[data-app] specificity contract (baseline risk flag).

## E. Architecture Scorecard (/10, this area)
- UI Consistency: 5 — pages look coherent, but upnext regression + .pill-vs-cx-chip + subtitle/seg splits + dev error walls.
- Layout Quality: 6 — solid grid usage; broken upnext + missing .ov-main stylesheet + unbounded admin list.
- Design System Compliance: 6 — hub.css is token-clean; component inline styles + literals + injected CSS drag it down.
- Component Reusability: 7 — hub-shared is a real shared layer; Vf unused; admin pages bypass it.
- Responsiveness: 4 — verified page-level 2D scroll at 390px; 100vh sidebar; extreme mobile admin page; otherwise fine at 768/1440.
- Accessibility: 6 — ladders/tag buttons/error roles/aria-labels largely right; missing landmark + colour-only state on ecosystem, contrast fail, unlabeled inputs + nested <main> on admin pages.
- Performance: 6 — count-up rAF + IntersectionObserver done properly; ecosystem bundle isolated to its route; 5-min health poll gated on document.hidden.
- Maintainability: 4 — minified-name ports (ecosystem 2.6k lines, closure code) + split state conventions + registry gap.
- Scalability: 5 — shared layer exists; adoption unenforced (admin pages prove it).

## F. Top 20 Priority Fixes (this area; merged by PM)
1. Register admin/config + admin/roster in PAGES (or parent-path resolution) — chrome currently claims the user is on "My day" (H, ~10 lines).
2. Replace env-var/Apps-Script error copy with one user-facing "not connected" state; consolidate per-section repeats (H, small).
3. Restore `.upnext` container rule (+data-live accent + focus ring) in hub.css (H, ~12 lines, visible regression).
4. Make `.cx-ladder` scroll internally (`.cc-chart{overflow-x:auto}` + optional mobile min-size) (H, ~4 lines, fixes 1.4.10 on primary page).
5. admin-config/roster → Eo/fetchJson + sh() + toast + <form> (M, kills silent failures).
6. a11y pass on same pages: labels on edit inputs, th scope, single <main>, h2 card-titles (M, bundled with 5).
7. `.md-status-blocked` → status-bad-bg/-fg (M, 1 declaration).
8. Wrap eco3-page in <main>; show node state word at rest (M, small).
9. Move OV_CSS into hub.css; replace inline style props (M, small).
10. One PageHead component + one subtitle class; one segmented control (M, small).
11. Drop "Not built yet." Pf line; group/cap the settings list (M, small).
12. `.md-err` role="alert" everywhere (M→L, 1 attr).
13. `cursor:pointer` → `.cc-pick`-only + non-button segs when no onPick (L, ~3 rules).
14. Delete duplicate [data-accent-preview] dark block (L, trivial).
15. Fold hub.css 100vh/560px/600px/literals into the baseline token sweeps (M, sweep).
16. `#/path` → direct hrefs via resolveLink, or extend shim regex for nested paths (L, small).
17. Dead `href="#"` → non-link span in WaitingCard (L, 1 branch).
18. useId() for fixed heading ids (oldest-h, md-mail, upnext-h) (L, small).
19. Align /agents h1 with registry title "Agent performance" (L, 1 string).
20. Split ecosystem-page.tsx scene/data/nav + dedupe status palette (L, strategic — only on next touch).

## Not verified / assumptions
- Contrast of --eco3-* scene palette vs the 3D backdrop (dynamic, measured-by-eye only) — custom dark-scene palette is intentional; flagged Low. Measured numerically: --eco3-ink-2 #a8a294 on --eco3-bg #0a090c ≈ 8:1 (passes).
- `.upnext` breakage assumed role-gated (tl/admin): /overview shots for the seeded user DO show the unstyled block; agents' view never renders Nf.
- admin--390.png is 490×244,165 — the mobile settings page is ~165 viewports tall; exact per-row cause not isolated (overflow-wrap on huge JSON values suspected) — flagged VERIFY.
- agents/analytics component internals deliberately not audited here (people/queue area files) — shots showed no route-level breakage except the analytics 390px axis-label crowding noted above.
- `.upnext` legacy intent taken from dead globals.css rule — port gap is code-proven regardless of intent.
- Keyboard tab-order inside the 3D scene's tag layer not exercised (code shows real buttons + Escape + focus handlers).
- The "1 Issue ×" badge in all shots is the Next.js dev-tools indicator (dev server), not application UI — its overlap of the eco3 dock is a capture artifact; recommend `devIndicators` off in the capture harness.
- Focus-visible ring coverage: cx-kit.css:115 pins :is(a,button,input,select,textarea,summary,[tabindex]):focus-visible — verified in code; eco3 has its own focus styles.
