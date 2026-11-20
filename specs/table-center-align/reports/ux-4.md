# ux report - table-center-align - round 8 (DELTA vs reports/ux-3.md, tl-6 leaves)

Verdict: PASS
Open: 0B/0H/0M/1L
States checked: mixed-content cells, per-row variant flips, cascade/specificity, mobile (CSS reasoning), dark (tokens unchanged). Not verified: live render/screenshots.

Scope reviewed: `cx-kit.css:661-662` (`td:has(.cx-chip)` + new `td.cx-txt` opt-out), `quality.css:208` (`.qa-whylist li`), the 8 `cx-txt` call sites, `tests/css/table-center-align.test.ts` (22 tests incl. new cx-txt source-order + qa-whylist assertions).

## Prior findings — verification

| ID | Status | Evidence |
|---|---|---|
| ux-1 (MED) checkins:208 | FIXED | `td.cx-txt` inside `.cx-table` (:204); `.cx-statusline` note now start-aligned under the chip. |
| ux-2 (MED) queue:326 | FIXED | `td.cx-txt` inside `.cx-table` (:278); stale-StatusChip rows no longer flip the queue-name column. |
| ux-3 (MED) audit-queue:417 | FIXED | `td.cx-txt` inside `.cx-table` (:376); agent name stays start when warn chip renders. |
| ux-5 (LOW) Why cell | FIXED | `quality.css:208` `.qa-whylist li` gained `justify-content:center`; flex items now center with the td's chip rule. Baseline alignment kept; chip+reason reads consistently with sibling chip cells. |
| ux-4 (LOW) mixed variants | PARTIAL | Fixed: people-holidays:453+468, quality-analytics:991, productivity:169 (see notes). Open residual below. |

## Open

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-4 | LOW | `trackers-page.tsx:722` — "Added by" td in `trk-table` (:699) | `cx-txt` is inert here: opt-out is scoped `:root .cx-table td.cx-txt` but ancestor is `.trk-table`. Chip rule `:is(.cx-table, table) td:has(.cx-chip)` (0,3,1) still wins over `.trk-table td { text-align:start }` (0,2,1), so "Entered in the sheet" chip rows center while name+`trk-when` rows stay start — the original per-row flip persists. | Widen opt-out to `:root :is(.cx-table, table) td.cx-txt` (equal 0,3,1, still declared after the chip rule), or add `.trk-table` to the selector. Classname itself is fine. | dev |

## Verified OK (delta)

- Cascade math correct: `td:has(.cx-chip)` = (0,3,1); `td.cx-txt` = (0,3,1) and declared after → opt-out wins on `.cx-table`; test asserts source order (test:141-148).
- All 7 effective `cx-txt` sites sit inside `.cx-table` ancestors — no overreach; chip-primary cells untouched.
- `people-holidays:453`: `cx-muted cx-txt` — chip/email/override-note variants all start-aligned; consistent column.
- `productivity-analytics:169`: `cx-txt` applied; PM declined `cx-num`, so the "+N pp" column stays start while 7 siblings center — stable alignment, mild numeric-column inconsistency accepted per direction (no action).
- `.qa-whylist li` centering: `display:flex` + `flex-wrap` + `justify-content:center` centers each reason row within the cell; matches the centered-chip convention; no readability/a11y impact (text is short).
- No new color/size/motion/focus changes; contrast, targets, keyboard path unaffected (CSS text-align + one className only).
- Web Interface Guidelines (fetched): semantic `<table>`/`<td>` markup retained; no violations applicable to this delta.

## Not verified / assumptions

- No runtime screenshots; alignment judged from cascade math + ancestor table classes (`grep <table` per file).
- Foreign dirty-tree edits (agents-page, tph-grid-page, quality libs, Tabs.tsx) present but outside this task's leaves — not reviewed.
- ux-4 residual assumes `.trk-table` rows mix chip and text variants in practice (markup confirms both branches).
