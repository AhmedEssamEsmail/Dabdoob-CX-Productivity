# ux report - headcount-access-split - round 1 (FULL)

Verdict: FAIL
Open: 0/0/1/3

States checked: loading, empty, error, success, disabled, long text, mobile, dark, keyboard, focus. Unchecked items under "Not verified".

Changed UI files reviewed (from git diff + tl-1..5 / results/*.md):
- `src/features/cx-hub/components/people-holidays-page.tsx` (S06-01/02, S10-01 context)
- `src/app/refresh.css` (S10-01 `dq-holform`)
- `src/features/cx-hub/components/admin-page.tsx` (S10-02)
- `src/features/shared/shell/i18n.ts`, `src/app/layout.tsx`, `src/app/theme.css`, `src/features/shared/components/shell/BootSplash.tsx` (S10-02 reduce-* removal)
- `src/features/cx-quality/components/qa-shared.tsx`, `audit-queue-coverage.tsx` (S05 date-only input)
- `src/features/cx-people/components/meetings-page.tsx` (qa1-06 title-keyed filters)
- Cross-checked: `roster.ts` (`setPersonV2Fields`/`getRosterAdmin`), `pure.ts`/`server.ts` (`qaCleanInteractionDate_`), `cx-kit.css` (`cx-switch`, `tblscroll`, `cx-field`), `theme.css` tokens, `title-level.ts`.

## Findings

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | people-holidays-page.tsx:241 + roster.ts:605-608 | Status select empty option reads "Leave unchanged" but client always sends `employmentStatus: emp`, and `setPersonV2Fields` writes `patch.employment_status = ''` — choosing it **clears** the stored status (harm visible only on manual-source rows; HCT rows self-heal next sync, and `active` is untouched). Label promises no write; a destructive action is dressed as a no-op. | Rename the empty option to make the write explicit, e.g. "Clear status (HCT refills)", or only send `employmentStatus` when `emp !== n.employmentStatus` so "Leave unchanged" sends `undefined` (server already skips `undefined` keys). | dev |
| ux-2 | LOW | people-holidays-page.tsx:246-248 | New `.cx-hint` "Title and headcount details come from the HCT…" auto-places in `.dq-editor` grid cell (4,2) beside the Status field, so it reads as a Status-specific note while describing the whole headcount block. | Add `grid-column: 1 / -1` (or the `cx-field--wide` pattern) so the hint spans the editor row. | dev |
| ux-3 | LOW | people-holidays-page.tsx:212-219 | Mobile field renders default `type="text"`; Web Interface Guidelines call for correct input type. | `type="tel"` + `inputMode="tel"` on the Mobile `Input`. | dev |
| ux-4 | LOW | admin-page.tsx:341 + cx-kit.css:389,461 | `.cx-switch` label keeps `cursor:pointer` while the disabled track shows `not-allowed` — hovering the label's non-track area (36px tall box) suggests an active control while `disabled={busy \|\| !row}`. Pre-existing system quirk shared with `cx-toggle`. | In `cx-kit.css`, add `:root .cx-switch:has(input:disabled) { cursor: not-allowed }` (and same for `.cx-toggle` if wanted). | dev |

## Verified OK (no findings)

- **cx-switch (E2, admin-page.tsx:341-362)**: hand-rolled markup matches docs/UI-SYSTEM.md:590; input immediately precedes track (`input:checked + .cx-switch__track` fires); implicit `<label>` + `.cx-sr` "Reminders" gives an accessible name (4.1.2); track `aria-hidden`; keyboard-operable native checkbox (2.1.1); focus ring via `input:focus-visible + .cx-switch__track` (2px `--cx-focus` #2f6fed ≈ 4.9:1 on white, 2.4.7); label min-height `--cx-target` = 2.25rem (36px ≥ 24px, 2.5.8); off-track border `--line-strong` #828a96 vs white ≈ 3.4:1 and on-fill `--pine-2` #1f6b57 ≈ 6.5:1 (1.4.11); `disabled` state styled (opacity .55); optimistic `pending ?? on` + `busy` disable + toast + Chip on/off text state kept verbatim.
- **Reduce-* removal (E3)**: `data-reduce-transparency`/`data-reduce-motion` writers = 0 in `src`; `html[data-reduce-*]` rule blocks deleted, `@media (prefers-reduced-*)` blocks + `prefersReducedMotion()` matchMedia reader + BootSplash media query retained → OS-level support intact (2.x animation); Appearance section shows Theme/Accent/Language only, fieldset/legend structure valid, stale `solid`/`still` localStorage keys inert.
- **dq-holform (E1, refresh.css:544)**: col2 `minmax(12rem,14rem)` clears native date min-content; col3 capped 20rem; `max-inline-size:52rem` bounds the form; min total ≈ 43rem < the ≤900px single-column breakpoint so no overflow band; `.cx-field { min-width:0 }` + `.cx-input { width:100% }` prevent input overflow; `.cx-error` still spans `1 / -1`.
- **People table + editor (S06)**: header rename Role→Access matches editor label; 6 new `<th scope="col">` + `colSpan={12}` matches 12 columns; `–` placeholders + `employmentStatus || active?Current:Left` fallback consistent with siblings; `TableScroll` (`role=region`, `tabIndex=0`, `aria-label`, `overflow-x:auto`, focus outline) keeps the 12-col table keyboard-scrollable — data-table exception to 1.4.10 reflow; all 6 editor inputs have `htmlFor` labels, unique `hd-*-${email}` ids; `setPersonV2Fields` validates lengths + `yyyy-mm-dd`; Status→`active` sync (Left deactivates, Current reactivates) matches spec; reports-to picklist now includes `titleLevel` tl/manager plus role tl/admin, mirroring server `mgrEligible` (roster.ts:447-449); error `role="alert"`, Save disabled with "Saving…" during flight, input retained on error.
- **Offqueue date-only (S05, qa-shared.tsx:732,826-829; audit-queue-coverage.tsx:188)**: `dateOnly` keyed to `row.source === 'offqueue'` — same predicate as server (:759); `type="date"`, label "Interaction date (Riyadh)", `required` + `max=hs().slice(0,10)` (Riyadh today) native-validated; prefill `m.slice(0,10)` handles `yyyy-MM-dd HH:mm` source values (`qaWhen_` strips the `'` marker upstream); submit `b.replace('T',' ')` is a no-op on date-only; `qaCleanInteractionDate_` re-validates, rejects future/>180d with text errors (3.3.1); non-offqueue callers keep `datetime-local`; calibration path unaffected.
- **meetings-page.tsx:60,741**: `titleLevel` present in payload (meetings.ts:122, pwDirectory identity.ts:227); blank-position fallback to role preserves pre-split eligibility.

## Not verified / assumptions

- **No live render**: all layout/contrast verdicts are computed from declared tokens and CSS, not screenshots. e2e page-contract is red pre-existing (TRACKER gate-e2e-2: 245 `.page-actions x/y moved` failures on all pages incl. untouched — suite instability, not attributable to this task). Recommend a manual spot-check of the 12-col table + editor at 375/1024px before ship.
- **Assumption — specialist on the title axis**: `dqTitleLevel_` returns `'agent'` for any non-TL/manager position, so `Enablemen Specialist` now drops from chair/owner picklists (meetings-page) where `role==='specialist'` previously qualified. Consistent with PLAN's title-axis intent (and qa-6 fix) — flagging for product confirmation, not a defect.
- **Assumption — Status options**: only `Current`/`Left` offered; if HCT `Status` holds other values, an out-of-set stored value shows as `Leave unchanged` in the select. Sheet ground truth (PLAN :49) suggests Current/Left only.
- Reduced-* users who had toggled `still`/`solid` in-app lose that preference silently — spec-accepted ("ignored harmlessly"); OS-level settings still honored.
