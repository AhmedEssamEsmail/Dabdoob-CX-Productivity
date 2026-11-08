# PX-03: /status-validation — Open/Reviewed/Disputed seg + list avatar chips
Kind: mini
ID: PX-03
Parent: FIX-PARITY
Owner: dev
Depends: none (PX-04 edits the same file AFTER this merges — do not touch
`FlagDetail`, `[flagId]`, or the "Inside the window" table)
Criteria: reports/ux-parity.md H7a (HIGH) + LOW (avatar chips)
Skills: none
Budget: files=1; actions=6; changed_lines=130; minutes=8

## Goal
Mock 07 `/status-validation` has a `Open · Reviewed · Disputed` segmented
control in `.page-actions` governing which section shows. The app always
renders all three groups (pending `.md`, disputes cards, decided table).
Add the seg + per-section visibility, and add the mock's list-item avatar
chip (agent initials) to each `.pv-item` workitem.

## Files
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | `StatusValidationPage` (~L400-575): seg state, `Page` `aside` slot, section visibility, `.pv-item` avatar span

## Context
- `mockups/pages/07-status-validation.html` | seg anatomy + `.avatar` chip
  inside `.workitem`-style list rows
- `status-validation-page.tsx:94-102` | `Page` already exposes `aside`
  → renders inside `.page-actions`
- `status-validation-page.tsx:400-575` | `StatusValidationPage`: `n.pending`,
  `n.disputes`, `n.decided` arrays; `Section` helper renders each group
- `status-validation-page.tsx:441-483` | `.pv-item` Button row (`wi-main`/
  `wi-side`); `.avatar` CSS exists in refresh.css
- `Seg` import already exists in this file's imports (used by the decide
  form); the page-actions seg can reuse `.seg` + `.on` buttons like
  my-day's `pd` seg (`my-day-page.tsx:980-997`) — simpler than `Seg`

## Contract
- `const [view, setView] = useState<'open'|'reviewed'|'disputed'>('open')`
  (default `open` = today's primary flow).
- `Page` `aside` = `.seg` group (`role="group"`,
  `aria-label="Flag views"`, three buttons `aria-pressed`): labels
  `Open ({n.pending.length})` / `Reviewed ({n.decided.length})` /
  `Disputed ({n.disputes.length})`; `.on` marks active.
- Visibility: `open`→pending `Section` (`pv-q`) only;
  `reviewed`→`pv-h` decided table only; `disputed`→`pv-d` only.
  Empty sections keep their Section chrome (the 'Nothing to review'
  empty-state text already exists for pending; add equivalent muted
  text for empty reviewed/disputed rather than rendering nothing).
- `DataSource d={n}` stays rendered at the bottom in every view.
- Avatar chip: prepend `<span className="avatar" aria-hidden="true">{initials}</span>`
  as first child inside `.pv-item` (initials = first letters of first two
  words of `f.agentName`, uppercase; fallback `f.agentEmail[0]`). If a
  small size variant is needed add `style`/`data-size` — do NOT add CSS
  (another leaf owns stylesheets); the bare `.avatar` is acceptable.
- The pending `.md` detail flow (`selected`/`FlagDetail`) is UNTOUCHED —
  PX-04 owns it. Clearing `selected` when switching views is required
  (a flag decided from Open shouldn't linger in Reviewed view's left
  pane — simplest: `setSelected('')` inside `setView` handler).
- Keep all ids (`page-title`, `pv-q`, `pv-d`, `pv-h`), `aria-labelledby`,
  e2e hooks, `useSe` loading paths.

## Actions
1. Add `view` state + the `.seg` aside (counts + `aria-pressed`).
2. Wrap the three `Section` blocks in `view` conditionals.
3. Ensure each non-selected-but-empty view shows Section + muted empty text.
4. Add the `.avatar` chip inside `.pv-item` (before `.wi-main`).
5. Clear `selected` on view change.
6. `npx eslint` the file + `npx tsc --noEmit` clean.

## Done when
- `/status-validation` head shows the 3-option seg with live counts;
  each option renders only its section.
- Every pending flag row shows an initials `.avatar` chip.
- Selecting a flag still opens `FlagDetail` (Open view) — the detail pane
  and decide form are byte-identical to before.

## Verify
- Run: `npx eslint src/features/cx-productivity/components/status-validation-page.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n "view\b\|Disputed\|Reviewed\|avatar" src/features/cx-productivity/components/status-validation-page.tsx` -> seg state, three labels, avatar chip present

## Handoff
PX-04 will add the Score-effect stats inside `FlagDetail` — do not touch
that component here.
Write results/PX-03.md (<=10 lines); TL alone updates TRACKER.md.
