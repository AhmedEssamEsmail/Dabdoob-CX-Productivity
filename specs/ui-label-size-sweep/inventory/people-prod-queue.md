# Inventory: cx-people + cx-productivity + cx-queue + shared — ui-label-size-sweep Phase 1 FIND

Areas: `src/features/cx-people/**`, `src/features/cx-productivity/**`, `src/features/cx-queue/**`, `src/features/shared/**` · Rubric: L + G1–G4 (specs/ui-label-size-sweep/PLAN.md)
Reviewer: FIND agent · Date: 2026-11-20 · Scope: 13 people + 8 productivity + 7 queue tsx components, 16 shared shell/layout components. `lib/**`, `jobs/**`, `platform/**`, `migration/**`, `shell/*` (non-component), `*api.ts`, `*helpers.ts`, `*-shared.ts` = non-UI, out of scope. `shared/components/ui/*` = toolkit, skipped per plan.

## Geometry evidence (from CSS, cited in rows)

- `.cx-input/.cx-select/.cx-textarea` default `width:100%`, `min-height:var(--cx-target)` — `src/app/cx-kit.css:275-291`.
- Default `md` button = min-height `--cx-target`; `size="sm"` → `.cx-btn--sm` (≈1.9rem) — `cx-kit.css:138-160,215-216`.
- `.pw-textarea{width:100%;min-height:72px}` people.css:36; `.pw-textarea--short{min-height:3.5rem}` people.css:311; `.pw-inline .field{flex:1 1 160px;min-inline-size:8rem}` people.css:30-32; `.pw-max-w-*` people.css:288-292.
- `.chk-grid{display:grid;gap:space-3}` (single column, full-width children) queue.css:240; `.chk-note{min-block-size:6.2rem}` queue.css:243; `.sch-actions` queue.css:221; `.sch-settings`/`.sch-edit-row`/`.sch-grow` constrained queue.css:215-219.
- `.pv-form{display:grid;gap:space-3}` (single column) productivity.css:46; `.tph-taskform .cx-field{min-inline-size:9rem}` productivity.css:116-118; `.tph-date{width:9.5rem}` productivity.css:242.
- Precedents (NOT findings): `rows={2}` + `60ch` cap on `#qa-comment` qa-shared.tsx:1014; footer `size="sm"` qa-shared.tsx:1053-1078; `Pass`→`Skip` audit-queue-page.tsx:477-486.

## Per-file coverage checklist

| File | Buttons/CTAs | Textareas | Fields | Hero blocks | Findings |
|---|---|---|---|---|---|
| cx-people/agents-page.tsx | 10 reviewed | none | `ps-beh-*` in `.cx-filters` flex (content-width) | `.stat` tiles in PageShell slot (not in form → G4 n/a) | 1 G2 |
| cx-people/carried-review.tsx | Seg outcomes only | none | `pw-max-w-220` date (constrained) | none | 0 |
| cx-people/coaching-page.tsx | 1 submit | 1 (86) | `cs-r` full-width | none | 1 G1 |
| cx-people/meetings-page.tsx | 16 reviewed | 2 (572,582) | `pw-max-w-280` datetime (constrained) | none | 2 G1, 1 G2 |
| cx-people/my-actions-page.tsx | 4 reviewed | 1 (76) | none | none | 1 G1, 1 G2 |
| cx-people/notes-page.tsx | reviewed | 2 (57 `rows={4}`, 143 dynamic rows) | `nt-tag` styled | none | 0 |
| cx-people/one-on-ones-page.tsx | Tabs only | none | none | none | 0 |
| cx-people/one-on-ones-views.tsx | 32 reviewed (most `size="sm"`) | 8 (948,952,1169 `rows={2}`; 1353 `--short` class; 1746,1761 un-rowed) | `.pw-inline`/`.pw-max-w-*` constrained | none | 2 G1 |
| cx-people/pw.tsx | 5 reviewed (PwCombo add/cancel pair, PwDialog Keep/danger) | none | `.other-row` input | none | 0 |
| cx-people/shared.tsx | none | none | none | none | 0 (helpers) |
| cx-people/tl-tasks-page.tsx | 16 reviewed | 3 (217,222,777) | `pw-flex-120` % complete (constrained) | `.pw-g-*` gantt widgets (bespoke) | 3 G1 |
| cx-people/{one-on-ones-api.ts,one-on-ones-helpers.ts} + lib/*.ts ×15 | — | — | — | — | N/A (non-UI) |
| cx-productivity/my-status-page.tsx | none | none | none | `.stat` tiles in PageShell slot → G4 n/a | 0 |
| cx-productivity/productivity-analytics-page.tsx | 2 (prev/next week) | none | none | none | 0 |
| cx-productivity/pv-shared.tsx | none | none | none | `.pv-facts` dl (compact) | 0 |
| cx-productivity/status-validation-page.tsx | 4 reviewed (Seg, list-row, submit pair) | 1 (224) | `.pv-form` single-col grid | none | 1 G1 |
| cx-productivity/tph-grid-matrix.tsx | 10 bespoke cell/panel buttons | none | none | none | 0 |
| cx-productivity/tph-grid-page.tsx | 3 (prev/next day, tabs) | none | `.tph-date` constrained | none | 0 |
| cx-productivity/tph-grid-views.tsx | 6 reviewed | none | `.tph-taskform` inline fields (min-inline-size:9rem) | `.tph-kpi` cards (display, not in form → G4 n/a) | 1 G2 |
| cx-productivity/tph-grid-shared.ts + jobs/ + lib/ | — | — | — | — | N/A (non-UI) |
| cx-queue/aging-page.tsx | 9 reviewed | none | `.cx-filters` flex fields | mixbar/matrix (bespoke) | 1 G2 |
| cx-queue/analytics-page.tsx | 4 reviewed (crumb, chip-clear, rank rows) | none | `.cx-filters` flex | `.cx-headline__num` display panel (not in form → G4 n/a) | 0 |
| cx-queue/checkins-page.tsx | reviewed | 3 (170,180,184) | `.chk-grid` single-col | none | 3 G1, 1 G3 |
| cx-queue/heatmap-page.tsx | 10 reviewed | 2 (152 `rows={5}`, 156 `rows={3}`) | `.hm-num`/`.hm-pair`/`.hm-shifts` grids | `.hm-total` result display (not in form → G4 n/a) | 0 |
| cx-queue/queue-page.tsx | 3 (Export/Refresh/All ages, consistent) | none | `cx-filter` search | `.stat` PageShell slot → G4 n/a | 0 |
| cx-queue/scheduler-page.tsx | 14 reviewed | 1 (197 `rows={5}`) | `.sch-settings`/`.sch-edit-row` constrained | none | 1 G2 |
| cx-queue/shared.tsx | ListSelect add/cancel pair (consistent) | none | `.field` select | none | 0 (helpers) |
| cx-queue/lib/*.ts ×7 | — | — | — | — | N/A (non-UI) |
| shared/components/layout/SiteChrome.tsx | none | none | none | none | 0 |
| shared/components/shell/* (AppShell, BootSplash, CommandPalette, ErrorBoundary, HashShim, NavIcon, OneOnOneAlerts, Popups, StateScreen, Toasts, Topbar, ViewAs, ui.tsx, registry.ts) | reviewed: nav/icon/disclosure/alert buttons + `Reload`/`Try again`/`Exit`/`Later`/`Log it now`/`Cancel` — all honest, consistent pairs (`btn-small` alerts, popup primary+quiet) | none | `va-search` input | none | 0 |
| shared/components/ui/* (40 files) | toolkit primitives | toolkit | toolkit | toolkit | skipped per plan |
| shared/{jobs,lib,platform,shell,migration}/** | — | — | — | — | N/A (non-UI) |

Reviewed-and-clean specifics: lone md primaries kept (`Submit/Update N check-in` checkins:189, `Assign task`/`Add task` tl-tasks:353, `Send to their team lead` coaching:95, `Close the meeting`/`Send summary` meetings:662-687, `Reload` AppShell:382, dialog footers in `pw.tsx`/`ViewAs.tsx`/`scheduler-page.tsx` DayEdit/HourEdit pairs, `SavedSets`/`UploadDialog` footers in heatmap-page) — consistent with themselves per the G2 rule. `one-on-ones-views.tsx` already uses `size="sm"` pervasively in `.oo-proj-btns`/`.pw-row-actions`. `pw-textarea--short` (oo-views:1353) is deliberately compact (3.5rem) — no finding. `.pw-inline`/`pw-max-w-*`/`.sch-settings`/`.tph-taskform`/`cx-filters` flex fields are content-constrained — no G3. All verbs honest: `Post update`, `I am blocked`/`Unblocked`/`Done`, `Send to their team lead`, `Assign anyway` (explicitly warns), `Read`/`Hide`, `Log 1:1`, `Submit record`/`Not held`, `Mark handled`, `Send`, `Ask my TL for help`, `Agree`/`Decline`/`Approve`/`Reject`, `Regenerate`/`Original roster`/`Re-read inputs`/`Save roster`, `Use this heatmap`, `Log it now`/`Later`, `Open the 1:1`/`Dismiss`/`Sound on`.

## Findings table

`file:line | class | current | evidence | severity | confidence | suggested fix`

| file:line | class | current | evidence | severity | confidence | suggested fix |
|---|---|---|---|---|---|---|
| my-actions-page.tsx:76 | G1 | `<Textarea id={*-n}>` "Where it stands", no `rows`, no class → `.cx-textarea` full-width | cx-kit.css:281,297; short status note inside an action card | M | autofix | `rows={3}` |
| coaching-page.tsx:86 | G1 | `<Textarea id="cs-r">` "What you saw", no `rows` | cx-kit.css:281; one-paragraph observation box | M | autofix | `rows={3}` |
| meetings-page.tsx:572 | G1 | Notes `.pw-textarea`, no `rows` | people.css:36 (100% width, 72px ≈ 3 lines); minutes field, `resize:vertical` already on | M | autofix | `rows={4}` |
| meetings-page.tsx:582 | G1 | Decisions `.pw-textarea`, no `rows` | same | M | autofix | `rows={3}` |
| tl-tasks-page.tsx:217 | G1 | "What done looks like" `.pw-textarea`, no `rows`, `.pw-span-all` | people.css:36; full form-grid width | M | autofix | `rows={3}` |
| tl-tasks-page.tsx:222 | G1 | "Your expectation…" `.pw-textarea`, no `rows`, `.pw-span-all` | same | M | autofix | `rows={3}` |
| tl-tasks-page.tsx:777 | G1 | status/`Note (optional)` `.pw-textarea`, no `rows` | same | M | autofix | `rows={2}` |
| one-on-ones-views.tsx:1746 | G1 | "Private note" `.pw-textarea`, no `rows` | people.css:36; sibling `Held at` already `pw-max-w-260` | M | autofix | `rows={2}` |
| one-on-ones-views.tsx:1761 | G1 | private-assessment `.pw-textarea` (renders 3×: What I saw / Concerns / My own actions), no `rows` | people.css:36 | M | autofix | `rows={2}` |
| checkins-page.tsx:170 | G1 | `.chk-note` queue note, no `rows` | queue.css:243 forces `min-block-size:6.2rem` (~4 lines); "what is driving it" fits 2–3 | M | propose | `rows={2}` + scope the 6.2rem rule (e.g. `#q-*-n,.chk-note{min-block-size:auto}`); pair-fix like the ctls precedent |
| checkins-page.tsx:180 | G1 | `#gen` handoff note, no `rows`, plain `.cx-textarea` | cx-kit.css:281 | M | autofix | `rows={2}` |
| checkins-page.tsx:184 | G1 | `#help` note, no `rows` | cx-kit.css:281 | M | autofix | `rows={2}` |
| status-validation-page.tsx:224 | G1 | Reason `<Textarea id={rs-*}>`, no `rows` inside `.pv-form` single-column grid | cx-kit.css:281 + productivity.css:46 | M | autofix | `rows={2}` |
| meetings-page.tsx:211-215 | G2 | `.pw-actions-bar` mixes `size="sm"` "Add another action" with default-md primary `Log N actions` | mixed sizes inside one bar; the precedent compacts footer pairs to `sm` | L | propose | `size="sm"` on the submit (or keep — decide the primary-vs-quiet convention once) |
| my-actions-page.tsx:88-119 | G2 | `.cxp-act__btns` trio `Post update`/`I am blocked|Unblocked`/`Done` all at md | compact per-card action row; same pattern as the compacted qa card footers | M | propose | `size="sm"` on all three |
| agents-page.tsx:447-453 | G2 | `Refresh now` + `Remove` at md inside `.cx-table` row action cell | compact table row; CTL/precedent row CTAs are sm | M | propose | `size="sm"` on both |
| aging-page.tsx:28-47 | G2 | HelpCell `Mark handled`/`Send`/`Cancel`/`Ask my TL for help` at md inside `<td>` | same table-row context | M | propose | `size="sm"` on all four |
| scheduler-page.tsx:506-521 | G2 | `.sch-actions` `Agree`/`Decline`/`Approve`/`Reject` at md inside `.cx-table` row | same table-row context | M | propose | `size="sm"` on all four (decide once for all row CTAs) |
| tph-grid-views.tsx:683 | G2 | `Remove` at md inside `.tph-tasks` `<li>` row | compact list row | L | propose | `size="sm"` |
| checkins-page.tsx:161-163 | G3 | "Agents on it now" `Input type="number"` spans the full `.chk-grid` row | queue.css:240 single-column grid → full panel width; value is 1–2 digits | M | propose | constrain: `inline-size:auto`/`max-inline-size` scoped rule or a `.chk-grid` column template (e.g. `grid-template-columns:minmax(8rem,12rem) 1fr`) |

## Notes for PM / Phase 2

- **20 findings**: 0 L, 13 G1 (12 autofix + 1 propose), 6 G2 (all propose), 1 G3, 0 G4. Autofix set = the 12 plain `rows={N}` additions.
- **No class-L rows**: every CTA verb in scope was traced to its handler and is honest. `Refresh now` (agents-page:447) shows `Rebuilding…` while busy — borderline but the action genuinely re-reads/rebuilds, so kept as a label, not a finding.
- **G2 convention**: the six propose rows are one decision — table-row and card-footer CTAs at `sm` vs `md`. Recommend one mini-shard applying the same rule everywhere (queue `sch-actions`, aging `HelpCell`, agents month row, my-actions card buttons, tph task rows, meetings action-bar pair) rather than per-file drift, mirroring the note in `inventory/cx-quality.md`.
- **G1 pairing**: matching `inventory/cx-quality.md`, several rows suggest `rows={N}` only. If the PM wants the `60ch` width cap precedent applied too, that is a CSS-side scoped rule per file — record it as part of the same fix or defer.
- No source files were modified; no `git diff` needed. No gates run (read-only FIND).
