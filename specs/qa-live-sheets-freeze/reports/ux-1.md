# ux report - qa-live-sheets-freeze - round 1 (FULL)

Verdict: FAIL        (MEDs open)
Open: 0B/0H/4M/3L

Scope reviewed (wave-2 UI only, per tl-7/tl-10 changed-files):
- `src/features/cx-people/components/agents-page.tsx` — W2-SC-04: `api.addBehaviour` (:23-24), `ScorecardAdmin` source box reword + `found` panel removal + new "Log a business-behaviour case" form (:256-492)
- `src/features/cx-queue/components/heatmap-page.tsx` — W2-HM-02: `be.buildFromSource` arg-less (:23), `AdminBuild` rewritten to single live-data build (:31-59), RegTable/priorRegression/hm-sid deleted (verified absent via grep; route returns 'Unknown op.' for `regression`)

States checked: loading (Saving…/Logging…/Building…, LinesSkeleton — pass), empty (shared `Empty` "No volumes yet", `Empty` in SavedSets — pass), error (see ux-3/ux-4), success (cx-note role=status — placement issue ux-3), disabled (busyKey disables submit + row buttons — pass), long text (note field caps at 500, tables in TableScroll — pass), mobile 375 (`.cx-filters` flex-wrap, `.pw-field-grow` 288px fits ~327px content — pass; 320px risk ux-7), dark (all colors via `--cx-*`/`--st-*` tokens, zero literals in changed JSX — pass), keyboard (native form submit, `<summary>`, all controls reachable — pass), focus (universal `:focus-visible` ring cx-kit.css:120 incl. summary — pass), contrast measured (below).

| ID | Sev | file:line or route+element | Evidence (measured ratio, missing label, screenshot) | Exact fix | Owner(dev) |
|----|-----|----------------------------|----------------------------------------------------|-----------|------------|
| ux-1 | MED | heatmap-page.tsx:981 — `Empty` body | Copy still says "Upload a heatmap, or build one **from the raw tabs** below". The raw-tabs workbook path was deleted (buildHeatmapFromSource now reads DB mirrors); the sentence directly describes the AdminBuild control under it, so the empty state instructs a workflow that no longer exists | Change to `, or build one from the live data below` | dev |
| ux-2 | MED | agents-page.tsx:284 (also :296, :302, :373, ReadChip :248-253) | Save success note kept verbatim: `Saved for {m}. Press Refresh to **read** it now.` — Refresh now rebuilds from prod_daily_layers/qa_audits; the saved id is display-only and is never read. Same stale "read" vocabulary in `Reading…`, `What was read`, `read N agent-days` | Reword the note to `Saved for {m}. Press Refresh to rebuild it now.` Minimum: fix the note; optionally sweep read-vocabulary labels in a follow-up | dev |
| ux-3 | MED | agents-page.tsx:356-365 vs :438-485 | The new behaviour form shares `note`/`noteErr`, which render **above** the months table; the form sits **below** the table. `Logged for {month}.`, `Already logged.` and validation errors (`Give a valid agent email.`) appear far from the submit — at 375px with a few month rows they are offscreen. Errors not adjacent to the field (guideline: errors inline next to fields) | Give the behaviour card its own note/noteErr state rendered inside it (same `cx-note` + role=status/alert pattern), or move the shared notes under the table | dev |
| ux-4 | MED | heatmap-page.tsx:55 — AdminBuild error | Async build error renders `<p className="field-error">{i}</p>` with **no `role="alert"`** — screen readers get no announcement (WCAG 2.2 4.1.3). Every other error surface in the same file carries `role="alert"` (:776, :856, :954, :999); inconsistency introduced inside the rewritten block | Add `role="alert"` to the `field-error` `<p>` (same for CountryChips :157 / SavedSets :101 while touching the file) | dev |
| ux-5 | LOW | agents-page.tsx:450-480 — 3 new Inputs | No `name`/`autoComplete` on any of the three inputs (siblings use `name=`, e.g. heatmap-page :579/:748/:762). Email field risks password-manager autofill of the admin's own address into an agent-email write. Note field has `maxLength={500}` but no visible limit — silent truncation | Add `name="beh-email|beh-date|beh-note"`, `autoComplete="off"`, `spellCheck={false}` on the email input; add a `.cx-hint` "one line, up to 500 characters" | dev |
| ux-6 | LOW | agents-page.tsx:313 → :362 | Duplicate response shows `Already logged.` inside `data-status="ok"` (green success) — a no-op presented as success | Render the duplicate path with `data-status="info"` (supported by `.cx-note` — the deleted `found` panel used it) | dev |
| ux-7 | LOW | people.css:299 + agents-page.tsx:470 | `.pw-field-grow { min-inline-size: 18rem }` = 288px vs `.block` padding `--cx-space-5` = 24px/side → ~272px content width at 320px ⇒ marginal h-scroll (1.4.10). Contract widths (375/1024) pass: 327px available | `min-inline-size: min(18rem, 100%)` or 16rem; verify at 320px | dev |

## What passed

- Consistency: only existing classes reused (`cx-filters`, `cx-field`, `cx-label`, `cx-note`, `pw-field-grow`, `hm-admin`, `hm-hint`, `field-error`); shared `Input`/`Button` primitives; no ad-hoc colors/px in changed JSX; `D()` used exactly where the file already used it; all hm-*/cx-* surfaces are token-based so dark mode needs nothing new.
- Semantics: `<form>` + `type="submit"` (Enter works), `<label htmlFor>` on all three new inputs (4.1.2 pass), `h2 block-title` → `h3` — hierarchy valid; `<details>/<summary>` is native-keyboard + `--cx-target` 36px min-height (2.5.8 pass).
- Feedback machinery: `role="alert"` on noteErr, `role="status"` on note (agents page); busy labels `Saving…`/`Logging…`/`Building…` use `…` correctly; disabled states block double-submit.
- Measured contrast (WCAG 1.4.3): `--cx-ink-2` #4f5d6b on #fff = **6.75:1** light / #9aa9b4 on #1a232b = **6.60:1** dark; `--cx-status-bad-fg` #b3261e on #fff = **6.54:1** light / #ff9a90 on #1a232b = **7.79:1** dark — all pass ≥4.5:1.
- Deletions verified: no `RegTable`, `priorRegression`, `hm-sid`, `found`, `setFound`, `Check and save` remain in the changed files.
- Result disclosure: build window surfaces via `HmResult` `meta.window` ("Volumes from {from} to {to}. {note}") so the server's 8-week default is visible after build.

## Not verified / assumptions

- No Playwright run — per ux-review scope rules all findings were judgeable from code; 375/1024 h-scroll status inferred from flex-wrap + TableScroll wrappers (contract e2e `page-contract.spec.ts` will confirm).
- Server-side copy (e.g. `meta` "read N agent-days" strings feeding :296) is out of UI-file scope but shares the ux-2 vocabulary issue.
- `data.months` empty-array → bare `<tbody>` (pre-existing, unchanged by the leaf; admin view presumably always returns rows).
- `type="month"`/`type="date"` degrade to text inputs on older Safari — acceptable, `placeholder={data.current}` shows the pattern on the month field.
