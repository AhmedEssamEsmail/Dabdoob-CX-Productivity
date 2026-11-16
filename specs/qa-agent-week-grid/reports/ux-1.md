# ux report - qa-agent-week-grid - round 1 (FULL)

Verdict: FAIL
Open: 0B/0H/1M/2L

States checked: loading (page-level via `QaPage busy`), error (page-level `LoadError`), empty (`colSpan={13}` row, copy accurate vs. `colSpan` math 1+12 ✓), success, long text (agent `td` wraps; `thead th` `white-space:nowrap`), mobile (scrolls inside `TableScroll` region, `tabIndex=0`, `aria-label`), dark (all token colors, no ad-hoc), keyboard (no interactive elements in table; scroll region reachable), focus (`tblscroll:focus-visible` outline).

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|----|-----|----------------------------|----------|-----------|------------|
| ux-1 | MED | quality-analytics-page.tsx:483 | Row-identifying cell is `<td>{g.label}</td>` in a 13-column data grid. Codebase's own scrolling-grid pattern (`audit-queue-coverage.tsx:67`, `quality-analytics-charts.tsx:502`, `scheduler-page.tsx`, `tph-grid-views.tsx`) uses `<th scope="row">`; `scope="col"` headers alone leave screen-reader users without the agent-name association (1.3.1). Also loses the established sticky-name styling, so at ≤~60rem content width the name scrolls out of view while week cells are read. | `<th scope="row" className="qa-cov__name">{g.label}</th>` — `qa-cov__name` (quality.css:161) is not scoped to `.qa-cov`, gives `scope="row"` semantics + sticky first column + strong weight for free. | dev |
| ux-2 | LOW | quality-analytics-page.tsx:468-475 | Week-start/full-date info lives only in `title` on a non-focusable `th`; keyboard/touch users never see the tooltip. Mitigated: section hint carries "Weeks run Sunday–Saturday" (behind "How scores work" toggle, same as siblings). | Acceptable as-is; optionally drop a focusable element or keep — log only. | dev |
| ux-3 | LOW | quality-analytics-page.tsx:453-507 vs 1273-1275 | At `grain==='month'` the section still shows 12 week columns while the page-level `qa-basisnote` "Weeks run…" sentence is suppressed; only the (default-hidden) section hint explains. Per PLAN month view is out of scope — cosmetic surprise only. | None required within PLAN; if desired, append the week-run clause to the section hint unconditionally (already done). | dev |

## Consistency pass
- `QaSection`+`TableScroll`+`table.cx-table`, `Chip status={qaBand(c.avg,false)}`, `cx-faint qa-sub` audits count, `–` empty cells, `qa-hints-off` behaviour, `h2`+`aria-labelledby` — all verbatim per `Agents`/`Attention` pattern. ✓
- Rendered before `<Columns/>` at line 1303-1304 per PLAN. `agentWeeks` follows `dateOf`/basis server-side — toggle rebuckets for free. ✓
- `awLabel` = `toLocaleString('en-GB',…,UTC)` — deterministic SSR/client, `dd-Mmm` output correct. ✓
- Copy tone ("Plain average of…, like the audit quota") matches sibling hints; no placeholder text. ✓

## Contrast (measured from theme.css tokens)
- `cx-faint` = `--cx-ink-3` (92% `#4f5d6b` + 8% `#fff`) on `#fff` ≈ 5.3:1 ✓ (>4.5); dark `#9aa9b4` on `#1a232b` ≈ 6.6:1 ✓.
- `thead th` same token ✓. Chip text e.g. ok `#17744a`/`#e4f4ec` ≈ 5.1:1 ✓. `--line-strong` annotated ≥3:1 (1.4.11) ✓.

## Not verified / assumptions
- Rendered 375/1024px screenshots: not run; horizontal overflow is handled by the shared `TableScroll` pattern (region+keyboard scroll), pending e2e `page-contract.spec.ts` check (QA gate, anchor `qa-agentweeks-h`).
- 1.4.4 (200% text), 2.4.11 (focus-not-obscured): not rendered; no sticky page chrome overlays this section.
- `columns.agentWeeks` payload shape assumed per analytics.ts:224-232 (`periods` always 12; `agents` pre-sorted).
