# ux report — dabdoob-refresh — MOCKUP-PARITY GATE

Verdict: **FAIL** — 6 of 10 pages are DIFF. One systemic chrome gap plus
page-level contract deviations (missing/relocated/dropped mock elements).
3 pages MATCH cleanly, 1 matches with notes.

Open: 1B / 3H / 4M / 2L
Shots: `.devin/work/parity-gate/` — `mock-NN.png` vs `app-NN[-dark].png`
(1440×900, light+dark; `app-07-detail.png` = flag selected state).
Mocks are light-only; dark shots judged for coherent parity anatomy.
Seeding: harness roster upserts (as shoot-new.mjs) + `admin_emails`
prepended with `e2e.admin@dabdoob.com` via PUT /api/config so the seeded
admin is the assistant owner and /my-day stops redirecting (no
`assistant_owner_email` row exists; original admin list preserved).

## Per-page verdicts

| # | Mock → route | Verdict | Blocking diffs |
|---|---|---|---|
| 01 | login → /auth/login | **MATCH** | Card anatomy identical (brand row, title, sub, labelled email, password + forgot link, primary CTA w/ arrow, foot lock+version). Name reads "Dabdoob CX" (real product name). |
| 02 | home → /overview | **DIFF** | Missing topbar (B1). "Team pulse" card renders age-band mini-bars; mock's 4 KPI bars (Quality/Productivity/FCR/Adherence) dropped (M2). Extra "Ecosystem" link row (L). 4th stat differs (Check-ins vs Resolved today — data-driven). Needs-you worklist + Queues-right-now match. |
| 03 | my-day → /my-day | **DIFF** | Missing topbar (B1). Mock seg = Today/**Week** — app has Today/Tomorrow nav, no Week view (M3). No "Book focus block" page CTA (booking exists per-gap inside Focus blocks card) (M3). Timeline shows inline "Google is not connected" errors — legit env state; empty states structurally match. App adds Deadlines/TL-follow-ups sections (additive). |
| 04 | queue-health → /queue | **DIFF** | Missing topbar (B1). Mock's page-level **Export** button absent everywhere (H4). Queue search moved into "By queue" card vs mock's page-head field (L). Stats/age-bar/queue-table anatomy incl. CHANGE/OURS/UNASSIGNED/AGE MIX/OLDEST/IN TODAY/RESOLVED all match; "OTHER TEAMS" break + help/watch chips additive. |
| 05 | aging-cases → /aging | **DIFF** | Missing topbar (B1). Extra full "How long open tickets have waited" band-ladder section duplicating the distribution bar's job (M5). Distribution card, queue×age matrix with coloured cells + ">10d" pill match; band count is config-driven (12 vs 7). |
| 06 | audit-desk → /audit-queue | **MATCH** | Master-detail (Today's queue + audit detail), To do/In progress/Done counters, sub copy all present. Admin context renders another auditor's desk read-only (viewing-as banner — correct role behaviour); audit form needs a selected item (mock shows mid-audit state). Extra sections (Non-ticket / Off-queue / daily log) additive. |
| 07 | status-validation → /status-validation | **DIFF** | Missing topbar (B1). Mock seg Open/Reviewed/Disputed absent — app splits into pending list + disputes section + "Decided, last 30 days" table (H7a). "Inside the window" table drops TOUCHES / DUR. / EVIDENCE columns (mock 5 cols → app 2: Case, Channel) (H7b). Mock's 3-stat summary → FlagStrip timeline; "Score effect" stat dropped (M7). List items lack avatar chip (L). Detail pane verified via selected-flag shot — renders strip + table + status seg + reason + Accept/Revert. |
| 08 | agents → /agents | **MATCH** | Stat row exists but is data-gated (`agents.length`) — period empty ⇒ hidden; table headers + tabs + filters all present, columns superset (adds Inbound/Texting/Waiting Addr). Note (M8): `.cx-input` width:100% makes the two date pickers stack 3 rows vs mock's compact inline range row. |
| 09 | tph → /tph | **DIFF** | Missing topbar (B1). Mock places `.tabs` directly under page-head governing the whole page; app renders the warn banner + 5 stats + cap-chart/attention cards as always-on summary and puts `tph-tabs` below it, where the Overview tab repeats the same cap chart + attention (H9). All mock elements exist; hierarchy/order differs. |
| 10 | my-status → /my-status (agent) | **MATCH** | 4 stats, Your flags card (dispute-window hint), Before-vs-after card w/ Raw/Reviewed bars + Mon→Sun strip, What-you-can-do bullets — all present; empty states structurally match. Week range moved from topbar into page sub (topbar absent anyway). |

B1 = systemic: every shell mockup (02–10) carries a `.topbar` row
(crumbs + right-side notifications bell w/ dot, appearance icon, avatar).
`.topbar`/`.crumbs` CSS exists (refresh.css:9-15) but no component renders
it — zero occurrences in any app DOM/styles dump. Also: mock toast is
bottom-right dark; app's insight chip renders bottom-left orange (L).

## Round-4 nav — verified live

- Unified groups: all 8 groups render in every admin context (no inApp
  filter; `navVisible = PAGES.filter(pageAllowed)`); agent context = 6.
- Collapsible: `.nav-group-label` is a button w/ `aria-expanded` +
  `aria-controls`, chevron, `ul hidden` toggle; current group auto-opens,
  manual state in sessionStorage (`cx.nav-groups`). Measured: 8 buttons,
  1 open per admin page; 6/1 agent.
- `.nav-ext` count = 0 on every page (styles.json + probe).
- BootSplash: present in SSR HTML, `display:none` once `#app` non-empty —
  never visible in any shot incl. client nav. PASS.

## Blocking diffs (fix before re-gate)

1. **B1 — render the topbar row** (crumbs `<b>` current page + right slot:
   notification bell, appearance trigger, avatar) on all shell pages, or
   get an explicit contract amendment removing it from the mockups.
2. **H4 — /queue: restore Export button** in page actions.
3. **H7a/b — /status-validation: add Open/Reviewed/Disputed seg** (or
   documented divergence) and **restore Touches / Dur. / Evidence
   columns** in "Inside the window".
4. **H9 — /tph: move `.tph-tabs` above the summary block** per mock order
   (head → tabs → note → stats → cards), or re-scope the contract.
5. **M3 — /my-day: add Week view + Book-focus-block CTA; M5 — /aging:
   drop the duplicated band-ladder section; M7 — restore Score-effect
   stat; M8 — constrain date-input width in `.page-actions`.**

Not verified: mock "Audit Desk in-progress form" (no auditor session),
/New-check-in CTA (no open slot at shot time), Focus-block booking
(no free gaps), notification bell behaviour (element absent).
