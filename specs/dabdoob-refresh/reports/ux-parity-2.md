# ux report — dabdoob-refresh — MOCKUP-PARITY RE-GATE (round 2, DELTA)

Verdict: **FAIL** — 9 of 10 pages MATCH their mockups (or carry only the
documented divergences). One residual undocumented deviation on /tph:
the cap-chart + needs-attention card pair still renders above the tab
strip instead of inside the tab-governed flow (H9 partially fixed).

Open: 0B / 0H / 1M / 1L
Shots: `.devin/work/parity-gate/` — `mock-NN.png` vs `app-NN[-dark].png`,
1440×900 light+dark; `app-07-detail.png` = flag selected.
`_index.json`: 0 page errors; navFacts all green — `navExt` 0, `groupBtns`
8 on every admin page / 6 on agent page 10, `groupsOpen` 1,
`bootSplashVisible` false everywhere incl. login (0/0).

## Prior-findings verification

| Prior ID | Finding | Status | Evidence |
|---|---|---|---|
| B1 | `.topbar` row absent on all shell pages | **fixed** | `.topbar`+`.topbar-right` in every `app-0N.dom.txt` (2–10); shots show crumbs `<b>` + bell + appearance + avatar. Live probe in TRACKER gate log: 7/7 routes. |
| H4 | /queue page-level Export absent | **fixed** | app-04.png: Export button in page-head actions beside head search field + Refresh now. |
| H7a | /status-validation Open/Reviewed/Disputed seg + avatar chips | **fixed** | app-07.png: `Open (450) · Reviewed (150) · Disputed (0)` seg in head aside; flag rows carry avatar initials chips. Source: status-validation-page.tsx:463-481. |
| H7b | TOUCHES/DUR./EVIDENCE cols dropped | **fixed — documented divergence** | `case_ids_json` stores [id,channel] pairs only; no per-case store. Table renders CASE+CHANNEL (app-07-detail.png). Accepted per task list. |
| M7 | Score-effect stat dropped | **fixed** | app-07-detail.png: 3-stat grid = Suggested status / Cases inside window / Score effect (`–` null-safe via prod_intervals). |
| H9 | /tph tabs below summary | **partial — see ux-p2-1** | `.tph-tabs` now sits above warn-note + grid-5 stats (correct), but `<Qs>` (cap chart + Needs attention) still mounts before `<Ga>` at tph-grid-page.tsx:2239 → stays above tabs. Duplication gone; order residual remains. |
| M3 | /my-day Week view + Book-focus-block CTA | **fixed — divergence noted** | app-03.png: `Today · Week` seg + primary "Book focus block" CTA in head actions. Week = 2-day API window (documented). |
| M5 | /aging duplicated band-ladder | **fixed** | app-05.png: ladder section gone; distribution card + queue×age matrix + `>10 d` pill only. |
| M2 | Team pulse rendered age-bars; Ecosystem row extra | **fixed — divergence noted** | overview-page.tsx:426-430,585-607: 4 `hbar-row` KPI bars (Quality/Productivity/FCR/Schedule adherence); adherence `–` (no source — documented). Ecosystem row absent from shot+DOM. |
| M8 | /agents date range stacked 3 rows | **fixed** | agents-page.tsx:598,608 `style={{width:'9.5rem'}}`; app-08.png single-row range + Apply + presets. |
| L | queue search in card vs head | **fixed** | search field now in page-head (app-04.png). |
| L | flag-list avatar chips | **fixed** | app-07.png initials chips on every row. |
| L | insight chip bottom-left orange vs toast bottom-right dark | **fixed — documented divergence** | element = `<nextjs-portal>` dev-overlay badge, dev-only, not app UI. |
| — | agents-list avatar chip | already done (FUX-12) | `.avatar` initials in rank table. |

## Per-page verdicts

| # | Mock → route | Verdict | Notes |
|---|---|---|---|
| 01 | login → /auth/login | **MATCH** | Identical card anatomy light+dark; brand "Dabdoob CX". |
| 02 | home → /overview | **MATCH** | Topbar, 4 stats, needs-you worklist, queues-right-now, Team pulse 4 KPI bars. Notes: 4th stat = Check-ins vs mock's Resolved (data-driven); adherence `–` documented; "Up next 09:30" banner + "Next:" stamp additive; `+ New check-in` CTA not shown (no open slot — same as round 1). |
| 03 | my-day → /my-day | **MATCH** | Week seg + Book CTA present; Week=2-day window documented; Google-not-connected note = env state; additive sections below. |
| 04 | queue-health → /queue | **MATCH** | Export + head search restored; stats/age-bar/queue table 1:1. |
| 05 | aging-cases → /aging | **MATCH** | Ladder gone; distribution + matrix + `>10 d` pill; band count config-driven (12 vs 7). |
| 06 | audit-desk → /audit-queue | **MATCH** | Master-detail, counters, viewing-as read-only banner (correct role behaviour), empty detail state; additive sections below. |
| 07 | status-validation → /status-validation | **MATCH** | Seg + avatar chips + 3-stat grid incl. Score effect + FlagStrip + CASE/CHANNEL table (H7b documented) + decide form (seg, reason, Accept/Revert — verified status-validation-page.tsx:235-275). |
| 08 | agents → /agents | **MATCH** | Inline date row; tabs + table headers superset; stat row data-gated (0 agents → hidden). Note: h1 "Agents" vs mock "Agent performance" (real product title; nav label matches). |
| 09 | tph → /tph | **DIFF** | ux-p2-1 (M) + ux-p2-2 (L) below. |
| 10 | my-status → /my-status | **MATCH** | 4 stats, Your flags, Before-vs-after + Mon→Sun strip, What-you-can-do; week range in sub; agent nav = 6 groups. |

## Open findings

| ID | Sev | file:line / route+element | Evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| ux-p2-1 | MED | /tph — `Qs` block vs `.tph-tabs` | Mock 09-tph.html order: head → `.tabs` (L66) → `.note` (L70) → stats (L76) → cards (L84+). App renders head → `Qs` chart+attention → `.tph-tabs` → note → stats (tph-grid-page.tsx:2239 `{d && sum ? <Qs …/> : null}` before `<Ga>`; visible app-09.png light+dark). Residual of H9: tabs still not directly under head; card pair ungoverned. | Move `<Qs>` out of the pre-`Ga` slot: render it inside the `summary` fragment after `.grid-5` stats (or inside the overview `Xa` panel flow) so DOM = head → tabs → note → stats → cards. | dev |
| ux-p2-2 | LOW | /tph — `.tph-day` head day-picker | `#tph-date` `.cx-input` keeps `width:100%` (cx-kit.css:263-267) inside `.tph-day` flex-wrap → Previous day / date / Next day stack 3 rows (app-09.png) vs mock's single inline row — same class as fixed M8. | Add width stop: `style={{width:'9.5rem'}}` on the `Input` (Ja, tph-grid-page.tsx:392-398) mirroring agents-page.tsx:598. | dev |

Not verified: New-check-in CTA (no open slot at shot time), notification
bell behaviour (renders, unclicked), Week-seg data fetch, audit
in-progress form (no auditor session), mobile breakpoints (gate is
1440px parity only).
