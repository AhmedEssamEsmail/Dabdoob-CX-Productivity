# P1B-02: Controls — B10 field labels, B9 shared dialogs, B2 icon buttons, B14 disabled state
Kind: package
ID: P1B-02
Dispatch: NEVER

## Goal and contract
Raw `<input>/<select>/<textarea>` elements get routed through the shared `Input`/`Select`/`Textarea` primitives (`src/features/shared/components/ui/`, barrel `ui/index.ts`) wrapped in `Field` (`label` + `htmlFor`) or carrying an `aria-label`. Custom `<dialog>` usages migrate to the shared `Dialog` (`Dialog.tsx`: `open`, `onClose`, `labelledby`, `label`, `describedby`, `lightDismiss`, className merged onto `.popup`). Icon-only `Button`s must expose an accessible name (`aria-label`); disabled/readonly controls must show a distinct `:disabled` state (shared primitives already style it — cx-kit.css has 19 `:disabled` rules).
Non-goals: restyling controls, touching files not listed, changing the shared primitives' APIs.

## Children
| ID | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| B10-01 | dev | B12-01, B12-04 | B10 hub+desk+shared (6 files) | 6/9/120/10 |
| B10-02 | dev | B12-03, B12-04, B12-05 | B10 quality+people+ops (7 files) | 7/10/160/10 |
| B10-03 | dev | B12-02 | B10 queue (4 files) | 4/8/120/10 |
| B9-01 | dev | B10-02, B10-03, B12-06 | B9 dialogs→Dialog (3 files) | 3/6/100/10 |
| B2-01 | dev | none | B2 no-op verify | 0/2/0/3 |
| B14-01 | dev | B8-06, B8-02, B15-01 | B14 residual verify (3 files) | 3/4/30/6 |

## B10-01: labeled controls — cx-hub, cx-desk, shared shell
Kind: mini
ID: B10-01
Parent: P1B-02
Owner: dev
Depends: B12-01, B12-04
Criteria: PLAN B10 (+A3 routing)
Skills: none
Budget: files=6; actions=9; changed_lines=120; minutes=10

### Goal
Every `<input>/<select>/<textarea>` in the listed files uses a shared control and has a programmatic label (`Field`/`htmlFor` or `aria-label`).

### Files
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | raw controls :178,292
- Edit: `src/features/cx-hub/components/admin-page.tsx` | raw controls :266,279,286,290,298
- Edit: `src/features/cx-hub/components/admin-roster-page.tsx` | raw control :177
- Edit: `src/features/cx-hub/components/ecosystem-ui.tsx` | raw control :64
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | raw control :159
- Edit: `src/features/shared/components/shell/CommandPalette.tsx` | raw input :196

### Context
- `src/features/shared/components/ui/Input.tsx` / `Select.tsx` / `Textarea.tsx` / `Field.tsx` | shared wrappers; `ui/index.ts` barrel
- `src/features/shared/components/ui/Toggle.tsx:27` / `Seg.tsx:35` | precedent: shared primitive hiding the raw input

### Contract
Replace each raw element with `Input`/`Select`/`Textarea` inside `Field` (preferred — gives visible label) or with `aria-label` when no visible label exists by design (search boxes). Keep ids referenced by existing `htmlFor`/`aria-*`. Preserve value/onChange/disabled props verbatim.
Out of scope: `<button>` elements (A3/B15 leaves), files not listed.

### Actions
1. `people-holidays-page.tsx`: migrate raw controls :178,292 to shared primitives with `Field` label or `aria-label`.
2. `admin-page.tsx`: label/migrate the :266,279,298 swatch-radio groups (keep any intentionally-raw marks; ensure a programmatic group label).
3. `admin-page.tsx`: migrate :286,290 checkboxes to labelled shared controls.
4. `admin-roster-page.tsx`: migrate raw control :177.
5. `ecosystem-ui.tsx`: migrate or verify aria-label on raw control :64.
6. `tl-performance-page.tsx`: migrate raw control :159.
7. `CommandPalette.tsx`: migrate or aria-label the palette input :196.
8. Re-grep the listed files: every remaining raw control exposes an accessible name.
9. `npx eslint` + `npx tsc --noEmit` on edited files.

### Done when
- `grep -n "<input\|<select\|<textarea" <listed files>` → 0 hits
- every control exposes an accessible name (axe/manual spot check at 375px)

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-hub/components src/features/cx-desk/components src/features/shared/components/shell` -> clean

### Handoff
B15-01 later fixes link/button misuse in CommandPalette.
Write results/B10-01.md (<=10 lines); TL alone updates TRACKER.md.

## B10-02: labeled controls — cx-quality, cx-people, cx-operations
Kind: mini
ID: B10-02
Parent: P1B-02
Owner: dev
Depends: B12-03, B12-04, B12-05
Criteria: PLAN B10 (+A3 routing)
Skills: none
Budget: files=7; actions=10; changed_lines=160; minutes=10

### Goal
Every raw form control in the listed files uses a shared control and has a programmatic label.

### Files
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | raw control :517
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | raw control :192
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | raw controls :1273,1282
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | raw control :1605
- Edit: `src/features/cx-people/components/meetings-page.tsx` | raw controls :187,640,748
- Edit: `src/features/cx-people/components/agents-page.tsx` | raw control :686
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | raw controls :274 (disabled input),349

### Context
- `src/features/shared/components/ui/Field.tsx` / `Input.tsx` / `Select.tsx` / `Textarea.tsx` | shared wrappers

### Contract
As B10-01.
Out of scope: non-listed files; Seg/Toggle/seg-radio groups that already hide inputs accessibly (verify label, keep pattern).

### Actions
1. `quality-scores-page.tsx`: route raw control :517 through a shared primitive with `Field` label or `aria-label`.
2. `ctls-page.tsx`: route raw control :192.
3. `audit-queue-detail.tsx`: route raw control :1273.
4. `audit-queue-detail.tsx`: route raw control :1282.
5. `one-on-ones-views.tsx`: route raw control :1605.
6. `meetings-page.tsx`: route raw controls :187,640,748.
7. `agents-page.tsx`: route raw control :686.
8. `trackers-page.tsx`: route disabled raw input :274 (keep `disabled` prop).
9. `trackers-page.tsx`: route raw control :349.
10. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "<input\|<select\|<textarea" <listed files>` → 0 hits

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-quality/components src/features/cx-people/components src/features/cx-operations/components` -> clean

### Handoff
trackers-page raw disabled input (:274) is migrated here — B14-01 verifies its disabled state after all edits settle.
Write results/B10-02.md (<=10 lines); TL alone updates TRACKER.md.

## B10-03: labeled controls — cx-queue
Kind: mini
ID: B10-03
Parent: P1B-02
Owner: dev
Depends: B12-02
Criteria: PLAN B10 (+A3 routing)
Skills: none
Budget: files=4; actions=8; changed_lines=120; minutes=10

### Goal
Every raw form control in the listed cx-queue files uses a shared control and has a programmatic label.

### Files
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | raw control :538
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | raw controls :226,232,285,432,677,840,851,863
- Edit: `src/features/cx-queue/components/queue-page.tsx` | raw control :156
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | raw controls :154,185

### Context
- `src/features/shared/components/ui/Field.tsx` / `Input.tsx` / `Select.tsx` / `Textarea.tsx` | shared wrappers
- `src/app/styles/queue.css:48` | `.hm-num input[type="time"]` rule to retire when the input becomes a shared control

### Contract
As B10-01. Time/number inputs keep `type`; the shared `Input` forwards it.
Out of scope: `.hm-*` css cleanup beyond the orphaned rule (remove only rules that become dead).

### Actions
1. `scheduler-page.tsx`: route raw control :538 through a shared primitive with `Field` label or `aria-label`.
2. `heatmap-page.tsx`: label the :226,232,285,432 checkbox controls (Toggle label or aria-label).
3. `heatmap-page.tsx`: label the :677,851,863 radio-group controls (Seg name/legend).
4. `heatmap-page.tsx`: confirm :840 file input keeps an accessible name (intentionally raw).
5. `queue-page.tsx`: route raw control :156.
6. `checkins-page.tsx`: route raw control :154.
7. `checkins-page.tsx`: route raw control :185; delete css selectors left with no matching element (e.g. `.hm-num input[type="time"]`).
8. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "<input\|<select\|<textarea" <listed files>` → 0 hits

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-queue/components` -> clean

### Handoff
queue-page raw disabled control (:165) migrated here — B14-01 verifies it last.
Write results/B10-03.md (<=10 lines); TL alone updates TRACKER.md.

## B9-01: custom dialogs → shared Dialog
Kind: mini
ID: B9-01
Parent: P1B-02
Owner: dev
Depends: B10-02, B10-03, B12-06
Criteria: PLAN B9
Skills: none
Budget: files=3; actions=6; changed_lines=100; minutes=10

### Goal
The three feature dialogs using hand-rolled `useRef<HTMLDialogElement>` lifecycle migrate to shared `Dialog`/`useDialogModal`.

### Files
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | `Jn` field dialog :358,403 (`<dialog className="trk-dialog cx-panel">`)
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | `hm-dialog` :753,835
- Edit: `src/features/cx-productivity/components/tph-grid-matrix.tsx` | dialog :226,252

### Context
- `src/features/shared/components/ui/Dialog.tsx:16-74` | Dialog API (open/onClose/labelledby/lightDismiss)
- `src/features/shared/lib/use-dialog-modal.ts:12-42` | lifecycle hook Dialog wraps
- `src/features/shared/components/shell/ViewAs.tsx:86-141` | precedent consumer pattern

### Contract
Replace `<dialog ref={…}>` + manual `showModal()`/`close()` with `<Dialog open labelledby|label onClose … className="…">`; keep existing dialog classNames (`.trk-dialog`, `.hm-dialog`) so styles keep applying. Keep `aria-labelledby`/ids identical; map cancel/close to `onClose`.
Out of scope: files already using Dialog/useDialogModal (ViewAs, Popups, one-on-ones-views, pw, ecosystem-*, CommandPalette); dialog restyle.

### Actions
1. `trackers-page.tsx`: swap the `Jn` field dialog (:358,403) to `Dialog`, preserving `trk-dialog cx-panel` className and labelled-by wiring.
2. `heatmap-page.tsx`: swap the `hm-dialog` (:753,835) to `Dialog`, preserving className and labelled-by wiring.
3. `tph-grid-matrix.tsx`: swap the dialog (:226,252) to `Dialog`, preserving className and labelled-by wiring.
4. Remove the now-dead `useRef`/`showModal`/`close()` plumbing in all three files.
5. `npx eslint` + `npx tsc --noEmit`.
6. Open/close each dialog once in browser; confirm modal open, Esc/cancel close, correct labelling.

### Done when
- `grep -n "<dialog" <listed files>` → 0 hits
- each dialog opens modally, closes on Esc/cancel, labelled correctly

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-operations/components/trackers-page.tsx src/features/cx-queue/components/heatmap-page.tsx src/features/cx-productivity/components/tph-grid-matrix.tsx` -> clean

### Handoff
None.
Write results/B9-01.md (<=10 lines); TL alone updates TRACKER.md.

## B2-01: icon-only buttons — no-op verification
Kind: mini
ID: B2-01
Parent: P1B-02
Owner: dev
Depends: none
Criteria: PLAN B2
Skills: none
Budget: files=0; actions=2; changed_lines=0; minutes=3

### Goal
Confirm the icon-only-button class is absent (audit grep found zero hits).

### Files
- None (verification only)

### Context
- `src/features/shared/components/ui/Button.tsx:8-31` | `icon`/`variant` props; `.cx-btn--icon` style exists for icon buttons

### Contract
Verification only — no source edits.
Out of scope: any fix (if real hits surface, record them in results and return `RESHARD_NEEDED: B2`).

### Actions
1. Run the enumeration greps and confirm zero hits; spot-check the 6 `icon={`/`cx-btn--icon` files (people-holidays :396,490; admin-page :197; admin-roster :211; admin-config :79; StateScreen :40) — they are `<Empty icon=…>` props, not buttons.

### Done when
- `grep -rn "variant=\"icon\"\|cx-btn--icon" src --include=*.tsx` → 0 icon-button hits
- `grep -rn "<Button[^>]*>\s*<[A-Z][a-zA-Z]*/>" src --include=*.tsx` → 0 hits

### Verify
- Run: `npx tsc --noEmit` -> clean (unchanged baseline)

### Handoff
Status recorded in results/B2-01.md → index keeps B2 marked `no-op`.
Write results/B2-01.md (<=10 lines); TL alone updates TRACKER.md.

## B14-01: disabled-state residual check
Kind: mini
ID: B14-01
Parent: P1B-02
Owner: dev
Depends: B8-06, B8-02, B15-01
Criteria: PLAN B14
Skills: none
Budget: files=3; actions=4; changed_lines=30; minutes=6

### Goal
The only three raw-element `disabled` sites (all migrated to shared controls by B10 leaves) render a visible disabled state; confirm shared `:disabled` styles cover them.

### Files
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | formerly raw disabled input :274
- Edit: `src/features/cx-queue/components/queue-page.tsx` | formerly raw disabled control :165
- Edit: `src/features/shared/components/shell/CommandPalette.tsx` | disabled usage :232

### Context
- `src/app/cx-kit.css` | 19 `:disabled` rules — shared primitives already styled; verify coverage, don't restyle globally

### Contract
After B10 migrations each site is a shared control — confirm `:disabled` (or `aria-disabled` + class) produces a visually distinct state at 375/1024px. If a shared control still looks enabled when disabled, add the missing state class/rule scoped to the feature css, not cx-kit.
Out of scope: `disabled` on shared components (already styled); the other ~42 files whose `disabled` hits are all on shared controls.

### Actions
1. `trackers-page.tsx` :274 site: verify the migrated control shows a distinct `:disabled` state at 375/1024px; add feature-scoped styling only if still identical to enabled.
2. `queue-page.tsx` :165 site: same verification.
3. `CommandPalette.tsx` :232 site: same verification.
4. `npx eslint` + `npx tsc --noEmit`.

### Done when
- `grep -n "<(input|button|select|textarea)[^>]*(disabled|readOnly)" src --include=*.tsx` → 0 hits outside shared/ui
- each former site shows a distinct disabled state

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-operations/components src/features/cx-queue/components src/features/shared/components/shell` -> clean

### Handoff
None.
Write results/B14-01.md (<=10 lines); TL alone updates TRACKER.md.

## Completion
All 6 child leaves done; `grep -rn "<input\|<select\|<textarea" src/features --include=*.tsx` hits only inside `shared/components/ui/`; all dialogs go through `Dialog`/`useDialogModal`; B2/B14 verification recorded.
