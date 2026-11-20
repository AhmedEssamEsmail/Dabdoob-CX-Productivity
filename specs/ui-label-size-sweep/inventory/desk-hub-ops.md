# Inventory: ui-label-size-sweep — desk / hub / operations
Phase 1 FIND · read-only · 2026-11-20
Scope: `src/features/cx-desk/**`, `src/features/cx-hub/**`, `src/features/cx-operations/**`
Rubric: L + G1–G4 per `specs/ui-label-size-sweep/PLAN.md`.

## Coverage checklist

All 13 component files reviewed line-by-line (except `ecosystem-scene.tsx`, reviewed by
targeted grep — it is a ~3,100-line three.js canvas file whose only interactive UI is
delegated to `ecosystem-ui.tsx`). `lib/*.ts` files contain no JSX (impossible in `.ts`);
verified by grep — nothing to audit.

| file | reviewed | textareas vs G1 | CTAs vs L | footers vs G2 | fields vs G3 | stats vs G4 | findings |
|---|---|---|---|---|---|---|---|
| cx-desk/components/kb-tracker-page.tsx | ✅ full | n/a | ✅ all dk-sm consistent | ✅ | `.dk-kb-form` grid 200px cells — OK | `.dk-stats` display-only — OK | 0 |
| cx-desk/components/kpi-logs-page.tsx | ✅ full | n/a | ✅ "Log the case/leave/Leave out" accurate | ✅ all dk-sm | dates in 200px grid cells — OK | n/a | 0 |
| cx-desk/components/mail-desk-page.tsx | ✅ full | 1 (`md-text-*`, rows=2, card-capped) — OK | ⚠ "Approved"/"Rejected" — see L-1 | ✅ all size="sm" | n/a | n/a | 1 |
| cx-desk/components/tl-performance-page.tsx | ✅ full | 1 (`dk-note-*`, rows=2, `.dk-rate` ≤520px) — OK | ✅ | ✅ all dk-sm | OTD numbers in 110px grid cells — OK | `.dk-overall`/`.dk-stats` page-level, not in-form — N/A per rubric | 0 |
| cx-desk/lib/{jobshared,kpilogs,maildesk,tlperformance}.ts | ✅ grep | — | — | — | — | — | 0 |
| cx-hub/components/admin-page.tsx | ✅ full | 1 (`setting-json`, dynamic rows≤14, `.setting-edit` capped) — OK | ✅ "Set to false/true", "Edit", "Save" accurate | ✅ all btn-small | `.setting-edit` capped (hub.css:214) | n/a | 0 |
| cx-hub/components/admin-config-page.tsx | ✅ full | n/a | ✅ | ✅ default-md consistent | ⚠ 3 number inputs — see G3-2 | n/a | 1 |
| cx-hub/components/admin-roster-page.tsx | ✅ full | n/a | ✅ | ✅ default-md consistent | text fields in `.cx-grid-2` — OK | n/a | 0 |
| cx-hub/components/ecosystem-data.ts | ✅ | data module, no JSX | | | | | 0 |
| cx-hub/components/ecosystem-dynamic.tsx | ✅ full | dynamic-import wrapper, no controls | | | | | 0 |
| cx-hub/components/ecosystem-page.tsx | ✅ full | n/a | ✅ "Try again", "Hub home" | n/a | n/a | n/a | 0 |
| cx-hub/components/ecosystem-scene.tsx | ✅ grep | n/a | delegates UI to ecosystem-ui | n/a | scene slider — OK | n/a | 0 |
| cx-hub/components/ecosystem-ui.tsx | ✅ full | n/a | ✅ tag buttons = system names; "Now"/"Auto-rotate" aria-pressed toggles | n/a | scene slider — OK | n/a | 0 |
| cx-hub/components/hub-shared.tsx | ✅ full | n/a | ⚠ `If` jump button label — see L-3 | ⚠ `.other-row` stretched buttons — see G2-1 | `Oo` select/input in `.field` — OK | stat helpers display-only — OK | 2 |
| cx-hub/components/my-day-page.tsx | ✅ full | n/a | ⚠ "Done" on follow-up rows — see L-2 | ✅ btn classes consistent | ⚠ settings form inputs — see G3-3 | `.md-ring` display-only — OK | 2 |
| cx-hub/components/overview-page.tsx | ✅ full | n/a | ✅ "Show all queues" btn-small | ✅ | search filter — OK | `.stat`/`.cx-stat` dashboard tiles, not in-form — N/A | 0 |
| cx-hub/components/people-holidays-page.tsx | ✅ full | n/a | ✅ "Edit"/"Remove"/"Add holiday"/"Sync roster from HCT now" | ✅ default-md consistent | ⚠ `hd-hdate` date input — see G3-1 | n/a | 1 |
| cx-hub/lib/{admin,aggregates,home-cards,myday,myday-google,roster}.ts | ✅ grep | — | — | — | — | — | 0 |
| cx-operations/components/trackers-page.tsx | ✅ full | n/a | ✅ "Add record/field/choice", "Create tracker", "Save changes" accurate | ✅ default-md consistent | ⚠ dynamic date/num fields — see G3-4 | n/a | 1 |
| cx-operations/lib/trackers.ts | ✅ grep | — | — | — | — | — | 0 |

**Totals: 17 files fully covered · 3 textareas (all pass G1) · 8 findings (4 autofix, 4 propose)**

## Findings table

`file:line | class | current | evidence | severity | confidence | suggested fix`

| # | Finding |
|---|---|
| G3-1 | `src/features/cx-hub/components/people-holidays-page.tsx:190-196` \| **G3** \| `Input type="date"` (`hd-hdate-*`) spans a ~28rem `.dq-editor` grid cell for a 10-char date \| `.cx-input{width:100%}` (cx-kit.css:281); `.dq-editor{grid-template-columns:repeat(2,minmax(0,1fr));max-inline-size:56rem}` (refresh.css:554) \| L \| **autofix** \| scoped CSS `[data-app="hub"] .dq-editor .cx-input[type="date"]{inline-size:auto;max-inline-size:100%}` — #qa-when precedent. Sibling short inputs `hd-mobile` (213) / `hd-hr` (225) are borderline-same — propose only. |
| G3-2 | `src/features/cx-hub/components/admin-config-page.tsx:227,237,247` \| **G3** \| three `type="number"` minute-target inputs (`prod-assumptions-mq/text/wa`) each span ~half of `.cx-grid-2` (~25rem+) for 1–4-digit values \| `.cx-grid-2{grid-template-columns:minmax(0,1.65fr) minmax(0,1fr)}` (cx-kit.css:584); `.input{width:100%}` \| L \| **autofix** \| scoped CSS `#prod-assumptions-mq,#prod-assumptions-text,#prod-assumptions-wa{inline-size:auto;max-inline-size:100%}` |
| G3-3 | `src/features/cx-hub/components/my-day-page.tsx:609,613,617` \| **G3** \| `.md-settings-form` inputs (`md-h` number 1–720, `md-w` "9:00-17:00" pattern, `md-m` number 15–240) stretch to the full `md-side` column \| `.md-settings-form{display:grid}` (hub.css:54); `.md-layout` side col `clamp(19rem,28vw,24rem)` (hub.css:15) \| L \| **autofix** \| scoped CSS `.md-settings-form .input{inline-size:auto;max-inline-size:100%}`. ⚠ FIX-LOCATION RISK: `src/app/styles/hub.css` is foreign-dirty per PLAN Conventions — run `git diff HEAD -- src/app/styles/hub.css` first; if foreign hunks, defer or host the rule elsewhere. |
| G3-4 | `src/features/cx-operations/components/trackers-page.tsx:603-608` \| **G3** \| dynamic record form: `type="date"` and `.trk-num` number/money inputs span the full `.trk-form` side column (~19–24rem) \| `.trk-grid` col `clamp(19rem,26vw,24rem)` (operations.css:17); `.input{width:100%}` \| L \| **autofix** \| scoped CSS `[data-app="operations"] .trk-form .input[type="date"],[data-app="operations"] .trk-form .trk-num{inline-size:auto;max-inline-size:100%}` in operations.css (not dirty) |
| G2-1 | `src/features/cx-hub/components/hub-shared.tsx:766-790` and `src/features/cx-operations/components/trackers-page.tsx:516-529` \| **G2** \| "Other…" row: `.other-row` is a single-column `display:grid` → "Add choice" + "Cancel" buttons stretch to full field width — oversized block buttons under a text input inside a compact field \| `:root .other-row{display:grid;gap:var(--cx-space-2)}` (cx-kit.css:332), no track sizing; used by shared `Oo` and page-local `Ut2` \| L \| **propose** \| needs a layout decision (flex row / `justify-self:start`); `.other-row` is a shared cx-kit rule — adjacent to the shared-primitive exclusion, so propose not autofix |
| L-1 | `src/features/cx-desk/components/mail-desk-page.tsx:328-345` \| **L** \| decision buttons labelled "Approved" / "Rejected" (state names, not verbs) next to "Send reply only" — a user can read "Approved" as a status filter rather than the send action \| `.md-actions` row on a pending-approval card; the `ConfirmInline` dialog ("Send Approved to …") disambiguates after the click \| L \| **propose** \| rename to "Approve" / "Reject" (copy decision — not a clean Pass→Skip case) |
| L-2 | `src/features/cx-hub/components/my-day-page.tsx:535-537` \| **L** \| row button "Done" on a TL follow-up mail marks it done/dismissed — item context is "mail … that has no reply yet", so "Done" can be misread as "the mail got its reply" \| `Fs.markFollowUpDone` removes the row from the waiting list \| L \| **propose** \| "Mark done" or "Handled" |
| L-3 | `src/features/cx-hub/components/hub-shared.tsx:587-592` (`If`) \| **L** \| up-next header button labelled only "Now: 14:30" / "Next: 14:30" — describes the meeting, says nothing about the consequence (scrolls + focuses `#up-next`); sits beside verb-labelled "Book focus block"/"Refresh" \| `Om` does scrollIntoView + focus (hub-shared.tsx:68-74) \| L \| **propose** \| e.g. "Jump to up next" or an aria-label clarifying the jump |

## Non-findings worth recording (reviewed, clean)

- **All 3 textareas pass G1**: `admin-page.tsx:72-81` (dynamic `rows≤14`, JSON editor — width justified),
  `mail-desk-page.tsx:270-277` and `tl-performance-page.tsx:209-216` (both `rows={2}`,
  `className="input dk-note"`; containers capped at ≥340px card / ≤520px `.dk-rate` — under the
  60ch precedent cap, no benefit from a fix).
- **G2 sizing is consistent within every page**: desk pages uniformly `dk-sm`/`size="sm"`;
  admin-page uniformly `btn-small`; roster/config/holidays/trackers/my-day uniformly
  default-md (including in-table Edit/Save/Cancel — consistent, rubric = consistency not
  "all md→sm").
- **No G4**: `.dk-overall` (3xl), `.stat-v`, `.cx-stat__value`, `.upnext-num`, `.md-ring` are
  page/dashboard stat displays, not inside forms (rubric scopes G4 to in-form hero blocks).
- **Short-content inputs that PASS G3** (already cell-constrained): `kpi-logs-page.tsx:216-274`
  and `kb-tracker-page.tsx:129-144` dates inside `.dk-kb-form` `minmax(200px,1fr)` cells;
  `tl-performance-page.tsx:289-300` OTD numbers in `minmax(110px,1fr)` cells;
  `people-holidays-page.tsx:527-536` `hol-date` inside `.dq-holform` 3-col grid (~16rem).

## Foreign in-flight work (defer flags for Phase 2)

Per PLAN Conventions, run `git diff HEAD -- <file>` before any edit:

- `src/app/styles/hub.css` — **dirty (foreign)**; blocks the natural fix location for G3-3.
- `src/features/cx-hub/components/overview-page.tsx` — dirty; no findings here anyway.
- `src/features/cx-hub/lib/aggregates.ts`, `jobs.ts` — dirty; out of scope (lib, no findings).
- None of the finding-bearing files (`people-holidays`, `admin-config`, `my-day`,
  `trackers-page`, `operations.css`, `mail-desk`, `hub-shared`, `my-day` settings) were on
  the dirty list, but verify per-file before editing.
