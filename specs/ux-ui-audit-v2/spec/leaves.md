# leaves.md — overflow leaf sections (package children that exceed the 15-section file cap)

This file holds leaf sections that belong to a package but live here to keep
each `Sxx.md` under the 15-leaf-section cap. Reference: `spec/leaves.md#<id>`.

## S03-16: `<ConfirmInline>` — inline two-step confirm
Kind: mini
ID: S03-16
Parent: S03
Owner: dev
Depends: none
Criteria: QU-M/DO-M inline-confirm pattern, DO-M destructive-confirm contract
Skills: none
Budget: files=1; actions=2; changed_lines=60; minutes=4

### Goal
`ui/ConfirmInline.tsx` — one inline two-step confirm primitive: `role="group"` + `aria-labelledby` + focus moves into the confirm region on open — the honest contract `.md-confirm`'s `role="alertdialog"` fakes.

### Files
- Create: `src/features/shared/components/ui/ConfirmInline.tsx` | new primitive — full file

### Context
- `src/features/cx-desk/components/mail-desk-page.tsx:330-345` | alertdialog misuse it fixes
- `src/features/cx-desk/components/kpi-logs-page.tsx:182-203` | Remove-confirm consumer shape

### Contract
`ConfirmInline({label, detail?, confirmLabel?, onConfirm, onCancel})` — moves focus to itself (tabIndex={-1} heading) on mount; announces via labelledby/describedby; NO modal/alertdialog role.
Out of scope: adopting sites (S07-14, S08-09, S11-05/06), real `<dialog>` confirms (Dialog covers those).

### Actions
1. Implement ConfirmInline (focus-into + labelled region, NOT alertdialog).
2. Typecheck.

### Done when
- ConfirmInline renders the documented aria contract.

### Verify
- Run: `npx tsc --noEmit` -> clean.

### Handoff
Adopted in S07-14/S08-09/S11-05/S11-06; barrel export lands in S03-15. Write results/S03-16.md (<=10 lines); TL alone updates TRACKER.md.

## S03-17: Chip status feeds — narrow helpers to `ChipStatus` + shell/ui re-export — SUPERSEDED (→ #S03-18)
Kind: mini
ID: S03-17
Parent: S03
Owner: dev
Depends: S03-01, S02-07, S02-10
Status: superseded — file map stale after S13-06 (`xn`+Chip moved to quality-analytics-charts.tsx; `QA_FLAG_LABELS`/`qaCovTone` missed in Files); no edits made, tsc clean (evidence results/S03-17.md); residual → S03-18
Criteria: QL-H2 baseline, ST-M12, consolidated fix #8 (S03-03 residual half)
Skills: none
Budget: files=5; actions=6; changed_lines=45; minutes=8

### Goal
Finish S03-03 (its done part — `ui/Chip.tsx` ChipStatus union + `ui/StatusChip.tsx` — is kept, tsc clean): every `string` reaching `<Chip status>` becomes `ChipStatus`, then `shell/ui.tsx`'s local Chip becomes a re-export. The 12 TS2322 errors that forced the revert are removed by construction at their helper/record sources.

### Files
- Edit: `src/features/shared/components/shell/ui.tsx` | :199-206 — delete local `Chip`; add `export { Chip } from '@/features/shared/components/ui/Chip'` and `export type { ChipStatus } from '@/features/shared/components/ui/Chip'` (keep `/** Y */` comment)
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | :173 `qaBand` return, :177 `QA_STATUS`, :1129 `QA_CONF_TONE`, :1147 `qaVerdictTone` → ChipStatus; + type import
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | :41 `CONF_T`, :54 `qaVerdictStatus`, :83 `ATTN`, :113 `qaCountBand`, :1364 `xn` → ChipStatus; + type import
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | conditional — expected 0 lines (:242 resolves via qaBand); touch ONLY if tsc still flags it
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | :38 `DECISIONS` → `Record<string,[string,ChipStatus]>`; + type import

### Context
- `specs/ux-ui-audit-v2/results/S03-03.md` | worker evidence: 12 TS2322 sites + revert note — the exact residual
- `src/features/shared/components/ui/Chip.tsx:4-11` | ChipStatus union — DONE, do not edit
- `src/features/shared/components/shell/ui.tsx:199-206` | third Chip impl to retire
- `src/features/cx-quality/components/quality-analytics-page.tsx:1129-1139` + `tph-grid-page.tsx:249` (`xe`) | literal-union sites already safe — do NOT touch

### Contract
Records `Record<string,[string,ChipStatus]>` (QA_STATUS, ATTN, DECISIONS) or `Record<string,ChipStatus>` (CONF_T, QA_CONF_TONE); helpers `qaBand`, `qaVerdictStatus`, `qaCountBand`, `qaVerdictTone` → `: ChipStatus`; `xn` → `[string, ChipStatus]`. Same emitted strings — pure type narrowing, zero runtime change. Literal/ternary sites (`status="bad"`, `status={cond ? 'ok' : 'bad'}`) already infer the union — untouched.
Out of scope: `ui/index.ts` barrel (S03-14/15 own it; Chip/StatusChip already exported), pillCls/StatusPill deletion (S07-02), analytics dedup of :36-241 (S07-01 — absorbs these types via qa-shared imports), other call-site migrations.

### Actions
1. qa-shared.tsx: `import type { ChipStatus } from '@/features/shared/components/ui/Chip'`; retype `qaBand`→`ChipStatus`, `QA_STATUS`→`Record<string,[string,ChipStatus]>`, `QA_CONF_TONE`→`Record<string,ChipStatus>`, `qaVerdictTone`→`ChipStatus` (StatusChip :204 / ScoreChip :219 compile unchanged).
2. quality-analytics-page.tsx: same import; retype `CONF_T`/`qaVerdictStatus`/`ATTN`/`qaCountBand`/`xn`→`[string, ChipStatus]`. If S07-01 already deleted a listed local def, skip it — its qa-shared replacement is narrowed in step 1; `xn` sits outside the dedup block so it is always narrowed.
3. pv-shared.tsx: `DECISIONS` → `Record<string,[string,ChipStatus]>` + type import (DecisionChip :50 compiles unchanged).
4. shell/ui.tsx: delete local Chip (:199-206); add the two export lines for `Chip` + `type ChipStatus` from `@/features/shared/components/ui/Chip`.
5. `npx tsc --noEmit`. Any NEW Chip-status site beyond the listed ones: fix only by this same narrowing pattern; anything bigger → stop, RESHARD_NEEDED.
6. Grep guard per Verify.

### Done when
- `npx tsc --noEmit` clean — former error sites (qa-shared:204/219, analytics:450/489/541/579/635/652/1348/1501, scores:242, pv-shared:50) all pass.
- No `function Chip` remains in shell/ui.tsx; `Chip` resolves via the re-export.
- Same `data-status` values reach the DOM (pure type change).

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx vitest run tests/golden/quality.test.ts tests/golden/productivity.test.ts` -> pass (unchanged markup).

### Handoff
Completes superseded S03-03. S07-02/S06-12's dep on S03-03 was the primitive (done); S07-01 dedup imports the now-narrowed qa-shared names; S09-07/S05-15 serialize after this leaf on pv-shared/shell-ui. Write results/S03-17.md (<=10 lines); TL alone updates TRACKER.md.

## S06-16: QueueCore pure helpers → `shared/lib/queue-core.ts` (people lib decouple)
Kind: mini
ID: S06-16
Parent: S06
Owner: dev
Depends: none
Status: resharded — S06-02 residual (server-lib half); done part kept (pw.tsx Frag, PageShell adoption; evidence results/S06-02.md)
Criteria: PP-H1 (people→queue zero import edge — lib half), S02-11 contract completion
Skills: none
Budget: files=4; actions=5; changed_lines=390; minutes=8

### Goal
The contiguous QueueCore block at `cx-queue/lib/index.ts:77-262` — `DqAgingFlagOut` interface + `dqWithCurrentTl_`, `dqOpenAgingFlags_`, `dqAgingFlagOut_`, `dqSubmissionsFor_`, `dqSlotState_`, `dqCheckpoints_`, `dqSlotsToday_`, `dqBandInfo_`, `dqWeekStart_`, `dqBandLabels_` — moves verbatim to a shared home so cx-people's server libs stop importing cx-queue; every existing consumer (hub/desk/api/queue internals) keeps resolving through a re-export.

### Files
- Create: `src/features/shared/lib/queue-core.ts` | the moved block, verbatim
- Edit: `src/features/cx-queue/lib/index.ts` | delete :77-262; add import + re-export lines
- Edit: `src/features/cx-people/lib/one-on-ones-page.ts` | :39-44 import source → queue-core
- Edit: `src/features/cx-people/lib/one-on-ones.ts` | :22 import source → queue-core

### Context
- `src/features/cx-queue/lib/index.ts:77-262` | the exact block — its callees are all inside the block or in `shared/lib/adapters`
- `src/features/cx-queue/lib/index.ts:363,:740-747` | `dqSlotIn_`/`dqRollupInflow_` call `dqCheckpoints_`/`dqWeekStart_` — index.ts must IMPORT those two back (a `export … from` re-export does NOT bind names locally)
- `src/features/cx-people/lib/one-on-ones-page.ts:39-44` + `one-on-ones.ts:22` | the people→queue edges this severs
- `specs/ux-ui-audit-v2/results/S06-02.md` | residual evidence

### Contract
queue-core.ts = `import 'server-only'` + `import { dqAddDays_, dqDateKey_, dqKeyPart_, dqSetting_, dqWallToUtc_, normEmail_, type Cfg } from './adapters'` + the moved block verbatim (names keep trailing `_`). index.ts adds `import { dqCheckpoints_, dqWeekStart_ } from '@/features/shared/lib/queue-core'` (for its own callers) + `export { dqWithCurrentTl_, dqOpenAgingFlags_, dqAgingFlagOut_, dqSubmissionsFor_, dqSlotState_, dqCheckpoints_, dqSlotsToday_, dqBandInfo_, dqBandLabels_, dqWeekStart_ } from '@/features/shared/lib/queue-core'` + `export type { DqAgingFlagOut } from '@/features/shared/lib/queue-core'`. cx-queue's public surface unchanged. People libs import the same names from `@/features/shared/lib/queue-core`.
Out of scope: other dq helpers and DQ_* constants (stay in index.ts), queue component re-exports (S08), any behavior change — pure move.

### Actions
1. Create queue-core.ts: header comment (QueueCore.js pure parts moved from cx-queue/lib — shared by queue/people/hub/desk), server-only + adapters import, paste block verbatim.
2. index.ts: delete :77-262; add the import line + the two export lines beside the existing imports.
3. one-on-ones-page.ts: `} from '@/features/cx-queue/lib'` → `'@/features/shared/lib/queue-core'` (names identical).
4. one-on-ones.ts: same re-point at :22.
5. `npx tsc --noEmit`; fix only moved-block resolution errors — anything bigger → stop, RESHARD_NEEDED.

### Done when
- `grep -rn "cx-queue" src/features/cx-people/lib/` -> none; cx-queue's exported API unchanged (tsc proves every caller resolves).

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx vitest run tests/golden/people.test.ts tests/golden/queue.test.ts` -> pass (pure move, unchanged output).

### Handoff
S06-17 finishes the component-side edge and runs the full zero-edge grep. Write results/S06-16.md (<=10 lines); TL alone updates TRACKER.md.

## S06-17: people `shared.tsx` queue re-export → local defs + my-actions `Head` → `PageShell`
Kind: mini
ID: S06-17
Parent: S06
Owner: dev
Depends: S06-16
Status: resharded — S06-02 residual (component half); done part kept (evidence results/S06-02.md)
Criteria: PP-H1 (people→queue zero import edge — component half; completes S06-02)
Skills: none
Budget: files=2; actions=4; changed_lines=45; minutes=6

### Goal
`cx-people/components/shared.tsx:32`'s `export { Head, AsOfHint, fmt, hm, dayAt } from '@/features/cx-queue/components/shared'` dies — the three live consumers get local equivalents: `AsOfHint`/`dayAt`/`hm`/`fmt` become tiny local defs (~16 lines, the decouple price — intentional dup of queue's formatters; a future dedup may revisit) and my-actions' `Head` swaps to `PageShell` directly.

### Files
- Edit: `src/features/cx-people/components/shared.tsx` | :2-4 stale comment + :32 re-export → local defs
- Edit: `src/features/cx-people/components/my-actions-page.tsx` | :6 import + :135 `<Head>` → `<PageShell>`

### Context
- `src/features/cx-queue/components/shared.tsx:22-25,:34,:48-56` | the tiny defs to mirror (kwTime/kwDay/hm/dayAt/fmt/AsOfHint)
- `src/features/cx-queue/components/shared.tsx:44-46` | `Head` = `<PageShell title purpose={sub} aside id="page-title">` — swap is verbatim
- `specs/ux-ui-audit-v2/results/S06-02.md` | consumer evidence: `AsOfHint` (agents-page:6,423,622), `dayAt`+`Head` (my-actions:6,72,135); `fmt`/`hm` have NO cx-people consumers

### Contract
shared.tsx keeps exporting `dayAt`, `hm`, `fmt`, `AsOfHint` (now local — `kwTime`/`kwDay` module-private Intl formatters; AsOfHint identical markup `.cx-section__hint`); `Head` NOT re-exported. my-actions :135 → `<PageShell title={route.title} purpose="What you agreed to in 1:1s and meetings — post where each stands before it is reviewed." id="page-title" />`; :6 drops `Head`; :9 gains `PageShell` in the `@/features/shared/components/ui` import.
Out of scope: centralizing the formatters into a client-safe shared home (recorded as follow-up — queue's own copy is S08's territory), other pages.

### Actions
1. shared.tsx: replace :32 with local `kwTime`/`kwDay`/`hm`/`dayAt`/`fmt`/`AsOfHint` defs mirroring queue's; update the :2-4 comment (queue chrome now local, Head retired).
2. my-actions: fix imports (:6 drop Head, :9 add PageShell); swap :135 Head → PageShell per contract.
3. `npx tsc --noEmit`.
4. Full zero-edge grep per Verify — if ANY `cx-queue` hit remains inside `src/features/cx-people/`, do NOT patch around it: stop, RESHARD_NEEDED.

### Done when
- `grep -rn "cx-queue" src/features/cx-people/` -> zero hits — the PP-H1 decouple completes.
- `/my-actions` head renders via PageShell (same title/purpose markup).

### Verify
- Run: `npx tsc --noEmit` -> clean; `grep -rn "cx-queue" src/features/cx-people/` -> none; `npx vitest run tests/golden/people.test.ts` -> pass.

### Handoff
Closes superseded S06-02. Write results/S06-17.md (<=10 lines); TL alone updates TRACKER.md.

## S09-16: `PaintGrid` contract ext — column headers, row/head class hooks, style prop, stroke-end commit + `cx-paintgrid` base CSS
Kind: mini
ID: S09-16
Parent: S09
Owner: dev
Depends: S03-09, S05-06, S12-01
Status: resharded — S09-03 residual (foundation half, S03-09 follow-up)
Criteria: PV-H3 (primitive contract completion — enables adoption)
Skills: none
Budget: files=3; actions=5; changed_lines=130; minutes=8

### Goal
PaintGrid can express a column-header row + consumer class hooks so adopters keep their existing visual contract: new props `columnHeaders`, `cornerLabel`, `rowClassName`, `rowHeadClassName`, `style`; `onCommit` also fires when a pointer stroke ends (grid pointerup / pointerleave); `.cx-paintgrid*` base rules land in cx-kit.css (the primitive shipped with NO CSS).

### Files
- Edit: `src/features/shared/components/ui/PaintGrid.tsx` | props interface + head-row render + commit-on-stroke-end
- Edit: `tests/ui/paint-grid.test.tsx` | cases: columnheaders render (role + span), pointerup-after-stroke commits once
- Edit: `src/app/cx-kit.css` | append `.cx-paintgrid*` base rules near the other `.cx-*` control rules

### Context
- `src/features/shared/components/ui/PaintGrid.tsx:26-34,:124-183` | current props/markup — `style` flows via `{...rest}` once declared
- `src/features/cx-productivity/components/tph-grid-page.tsx:953-1011` | the consumer shape (header row `tph-row--head`, `.tph-name` rowheads, `.tph-hour` colheads spanning 4, `--tph-n` root var)
- `specs/ux-ui-audit-v2/results/S09-03.md` | the blocker this removes
- `tests/ui/paint-grid.test.tsx` | React-stub suite — NO DOM: do not add window/document listeners or effects (would crash the stub)

### Contract
`columnHeaders?: { label: ReactNode; span?: number; className?: string }[]` + `cornerLabel?: ReactNode` — when present, a leading `<div role="row" className={cx('cx-paintgrid-row','cx-paintgrid-row--head',rowClassName)}>` renders `<span role="columnheader" className={cx('cx-paintgrid-rowhead','cx-paintgrid-colhead',rowHeadClassName)}>{cornerLabel}</span>` then per-header `<span role="columnheader" className={cx('cx-paintgrid-colhead',h.className)} style={h.span?{gridColumn:'span '+h.span}:undefined}>`. `rowClassName?: string`/`rowHeadClassName?: string` append to every row/rowheader (head row included). `style?: React.CSSProperties` declared on props (flows via rest). `stopPainting` = `if (!paintingRef.current) return; paintingRef.current = false; onCommit?.()` — stroke end commits on release OR grid-exit (equivalent saves, possibly split; document in results). Keyboard Enter/Space commit unchanged. Backward-compatible: existing call signature/tests keep working.
Out of scope: tph adoption (S09-17), pointer-capture/window-listener upgrades, cell `disabled` support (readOnly is the contract).

### Actions
1. Add the five props + cornerLabel to `PaintGridProps`; render the head row before `rows.map` per contract.
2. Make stopPainting commit-aware per contract (pointerleave commits an active stroke — note divergence from Es's release-only flush in results).
3. Append cx-kit.css rules: `.cx-paintgrid{display:grid;gap:3px;touch-action:none;user-select:none}`, `.cx-paintgrid-row{display:grid;gap:1px;align-items:stretch}` (no template — consumer classes supply), `.cx-paintgrid-rowhead` (sm text, ellipsis, centered), `.cx-paintgrid-colhead` (xs ink-2), `.cx-paintgrid-cell` (26px block, crosshair, sunken bg + line ring), `:focus-visible` ring, `[aria-readonly] .cx-paintgrid-cell{cursor:default}`.
4. Extend the test file: columnheader count/role + `span 4` style; pointerdown→paint→onPointerUp → onCommit called once.
5. `npx tsc --noEmit` + targeted vitest.

### Done when
- New props compile + render per contract; stroke end fires onCommit; cx-kit.css has `.cx-paintgrid*` base rules.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/ui/paint-grid.test.tsx` -> pass incl. new cases.

### Handoff
S09-17 adopts; S05-08 now depends on this leaf (cx-kit.css serialization insert). Write results/S09-16.md (<=10 lines); TL alone updates TRACKER.md.

## S09-17: tph paint grid `Es` → `PaintGrid` adoption + productivity.css head/readonly retargets
Kind: mini
ID: S09-17
Parent: S09
Owner: dev
Depends: S09-16, S09-10, S09-12
Status: resharded — S09-03 residual (adoption half)
Criteria: PV-H3 (adoption — roving tabindex, read-only reachable, same visual grid)
Skills: none
Budget: files=2; actions=4; changed_lines=140; minutes=8

### Goal
`Es`'s inline grid markup (tph-grid-page.tsx:953-1011) renders through `<PaintGrid>` keeping the EXISTING `.tph-*` class hooks (zero visual change): agents×slots → `rows`, hours → `columnHeaders` (span 4), `paint` → `onPaint`, `flush` → `onCommit`, `!d.canEdit` → `readOnly`; the local window-pointerup listener (:882-886) and Es's `painting` ref die (PaintGrid owns stroke state); ~1000 cell tab stops collapse to one roving stop.

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | :833-1011 — delete :882-886 listener + `painting` ref; build rows/columnHeaders; swap :953-1011 to `<PaintGrid>`
- Edit: `src/app/styles/productivity.css` | :87-88 `.tph-row--head` selectors → `.cx-paintgrid-row--head`; :96 `.tph-cell:disabled` → `.tph-grid[aria-readonly] .tph-cell`

### Context
- `src/features/cx-productivity/components/tph-grid-page.tsx:833-886` | paint/flush/touched/painting — flush becomes onCommit verbatim
- `src/features/cx-productivity/components/tph-grid-page.tsx:953-1011` | exact markup to replace (labels: `y` string :977 → `cell.label`; data-ch/calls/src/now/hour :986-990 → `cell.data`)
- `src/features/shared/components/ui/PaintGrid.tsx` | post-S09-16 props (columnHeaders/cornerLabel/rowClassName/rowHeadClassName/cellClassName/style/onPaint/onCommit/readOnly)
- `src/app/styles/productivity.css:84-102` | the tph rules that must still match (hooks keep `.tph-grid/.tph-row/.tph-name/.tph-hour/.tph-cell` live)
- `specs/ux-ui-audit-v2/results/S09-03.md` | the adoption blocker

### Contract
`<PaintGrid className="tph-grid" style={{'--tph-n': n} as CSSProperties} aria-label={`Channel per agent, ${d.slotMin}-minute slots`} columnHeaders={d.hours.map(h=>({label:F(h),span:4,className:'tph-hour'}))} cornerLabel="Agent" rowClassName="tph-row" rowHeadClassName="tph-name" cellClassName="tph-cell" rows={d.agents.map(a=>({id:a.email,label:a.name,cells:(cells[a.email]||[]).map((cell,f)=>({id:a.email+':'+f,label:<the :977 y string>,data:{ch:Gt(d,cell.c),calls:cell.calls?'':undefined,src:cell.src||undefined,now:d.nowSlot===f+d.firstSlot?'':undefined,hour:(f+d.firstSlot)%4===0?'':undefined}}))}))} readOnly={!d.canEdit} onPaint={(email,idx)=>paint(email,idx)} onCommit={flush} aria-label={…same…}/>` inside the kept `.tph-gridwrap`. Cells carry NO `disabled` (readOnly grid — focusable per PV-H3). `.tph-gridwrap`, the brush `Seg`s, `paint`/`flush`/`touched`/`cells` state stay; `painting` ref + its listener are deleted.
Out of scope: brush Seg markup, save API (`ae.saveSlots`), other Es internals, `.tph-*` deletion (S12-11 — retargeted selectors stay live via hooks).

### Actions
1. Build the `rows`/`columnHeaders` consts in Es per contract.
2. Replace :953-1011 markup with `<PaintGrid>`; delete :882-886 useEffect + `painting` ref.
3. productivity.css: retarget :87 `.tph-row--head` → `.cx-paintgrid-row--head`, :88 `.tph-row--head .tph-hour` → `.cx-paintgrid-row--head .tph-hour`, :96 `.tph-cell:disabled` → `.tph-grid[aria-readonly] .tph-cell` (dead `.tph-row--head`/`:disabled` selectors are S12-11's to delete — leave, note in results).
4. `npx tsc --noEmit` + targeted vitest; on any tph-grid-page.tsx overlap with an in-flight leaf (S09-09/S09-13 serialization per TRACKER) → stop, hand back.

### Done when
- Grid renders via PaintGrid with identical `.tph-*` classes/data-attrs; one tab stop per grid; read-only cells focusable; painting + commit-save unchanged.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/golden/tph.test.ts tests/golden/productivity.test.ts tests/ui/paint-grid.test.tsx` -> pass.

### Handoff
Closes superseded S09-03; unblocks S09-04 (AutoSaveInput) + S14-01 (e2e sweep covers this grid); S12-11 now serializes after this leaf on productivity.css. Write results/S09-17.md (<=10 lines); TL alone updates TRACKER.md.

## S03-18: Chip status feeds — narrow helpers to `ChipStatus` + shell/ui re-export
Kind: mini
ID: S03-18
Parent: S03
Owner: dev
Depends: none
Status: resharded — S03-17 residual (stale file map post-S13-06; no edits made — evidence results/S03-17.md)
Criteria: QL-H2 baseline, ST-M12, consolidated fix #8 (S03-03 residual — completes it)
Skills: none
Budget: files=5; actions=6; changed_lines=45; minutes=8

### Goal
Finish S03-03 (its done part — `ui/Chip.tsx` ChipStatus union + `ui/StatusChip.tsx` — is kept, tsc clean): every `string` reaching `<Chip status>` becomes `ChipStatus`, then `shell/ui.tsx`'s local Chip becomes a re-export. The status feeds now live in qa-shared (6 symbols), the S13-06-extracted quality-analytics-charts (`xn`), and pv-shared (`DECISIONS`); every other `<Chip status>` site already feeds literals/literal unions.

### Files
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | :181 `qaBand` return, :185 `QA_STATUS`, :1152 `QA_CONF_TONE`, :1170 `qaVerdictTone`, :1200 `QA_FLAG_LABELS`, :1315 `qaCovTone` → ChipStatus; + type import
- Edit: `src/features/cx-quality/components/quality-analytics-charts.tsx` | :411 `xn` → `[string, ChipStatus]`; + type import (post-S13-06 home of the coverage Chip feed)
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | :38 `DECISIONS` → `Record<string,[string,ChipStatus]>`; + type import
- Edit: `src/features/shared/components/shell/ui.tsx` | :201-208 — delete local `Chip`; add `export { Chip } from '@/features/shared/components/ui/Chip'` and `export type { ChipStatus } from '@/features/shared/components/ui/Chip'` (keep `/** Y */` comment)
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | conditional — expected 0 lines (:243 resolves via narrowed `qaBand`); touch ONLY if tsc still flags it

### Context
- `specs/ux-ui-audit-v2/results/S03-03.md` + `specs/ux-ui-audit-v2/results/S03-17.md` | worker evidence: the 12 TS2322 sites + the post-S13-06 stale file map
- `src/features/shared/components/ui/Chip.tsx:4` | ChipStatus union — DONE, do not edit
- `src/features/shared/components/shell/ui.tsx:201-208` | third Chip impl to retire
- `src/features/cx-quality/components/quality-analytics-charts.tsx:395,:411,:444,:548` | the Chip feeds in the new file: `qaCovTone` (narrowed in qa-shared) + `xn`
- `tph-grid-page.tsx:244` (`xe`), `calibration-page.tsx:398-408`, `status-validation-page.tsx:395`, `quality-analytics-page.tsx:703-872` | literal-union sites already safe — do NOT touch

### Contract
`qaBand`, `qaVerdictTone`, `qaCovTone` → `: ChipStatus`; `QA_STATUS`, `QA_FLAG_LABELS`, `DECISIONS` → `Record<string,[string,ChipStatus]>`; `QA_CONF_TONE` → `Record<string,ChipStatus>`; `xn` → `[string, ChipStatus]`. Same emitted strings — pure type narrowing, zero runtime change. Literal/ternary sites (`status="bad"`, `status={cond ? 'ok' : 'bad'}`) already infer the union — untouched.
Out of scope: `ui/index.ts` barrel (S03-14/15 own it — `ChipStatus` is NOT barrel-exported; the type import uses the direct `./Chip` path), quality-analytics-page.tsx (its local defs were deduped by S07-01 into qa-shared imports — every remaining Chip site there resolves via narrowed symbols or literal unions; do NOT edit it), StatusPill/pillCls (done S07-02), other call-site migrations.

### Actions
1. qa-shared.tsx: `import type { ChipStatus } from '@/features/shared/components/ui/Chip'`; retype the six symbols per Contract (`StatusChip` :210 / `ScoreChip` :219 compile unchanged — `?? 'neutral'` and `qaBand` already conform).
2. quality-analytics-charts.tsx: same type import; `xn` → `[string, ChipStatus]` (literals 'warn'/'ok'/'bad' conform; :444 `!== 'ok'` and :548 `status={u}` compile).
3. pv-shared.tsx: `DECISIONS` → `Record<string,[string,ChipStatus]>` + type import (DecisionChip :50 compiles unchanged).
4. shell/ui.tsx: delete local Chip (:201-208); add the two export lines for `Chip` + `type ChipStatus` from `@/features/shared/components/ui/Chip` under the kept `/** Y */` comment.
5. `npx tsc --noEmit`. Any NEW Chip-status site beyond the listed ones: fix only by this same narrowing pattern; anything bigger → stop, RESHARD_NEEDED.
6. Grep guard per Verify.

### Done when
- `npx tsc --noEmit` clean — former error sites (qa-shared StatusChip/ScoreChip, analytics incl. charts:395/548, scores:243, pv-shared:50) all pass.
- No `function Chip` remains in shell/ui.tsx; `Chip` resolves via the re-export (qa-shared's :34/:54 re-export chain picks up the typed Chip transitively).
- Same `data-status` values reach the DOM (pure type change).

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx vitest run tests/golden/quality.test.ts tests/golden/productivity.test.ts` -> pass (unchanged markup).

### Handoff
Completes superseded S03-03/S03-17. Consumers already landed: S07-01/S07-06 (narrowed qa-shared names), S09-07 (pv-shared), S05-15 (shell/ui) — all done; pending S09-13 now Depends on this leaf (pv-shared serialization). Write results/S03-18.md (<=10 lines); TL alone updates TRACKER.md.

## S04-08: `.delta` call-site tone swap — emitted class = verdict, not direction
Kind: mini
ID: S04-08
Parent: S04
Owner: dev
Depends: none
Status: resharded — S04-07 residual (call-site half; CSS inversion already done, evidence results/S04-07.md)
Criteria: ST-L1 (.delta inversion — markup half)
Skills: none
Budget: files=3; actions=4; changed_lines=8; minutes=5

### Goal
Post-S04-07 `.delta.up`=ok tone and `.delta.down`=bad tone (refresh.css:222-229). Three emitters still name classes by direction, so a RISING open-queue count and NEGATIVE score deltas now paint ok-green. Swap the emitted tokens so the class carries the verdict; arrows, aria-labels and numbers are untouched.

### Files
- Edit: `src/features/cx-queue/components/queue-page.tsx` | :27 + :346 — `n > 0 ? 'up' : n < 0 ? 'down'` → `n > 0 ? 'down' : n < 0 ? 'up'` (more open = bad; same for `m.delta`)
- Edit: `src/features/cx-people/components/agents-page.tsx` | :628 — `d > 0 ? 'delta up good' : d < 0 ? 'delta up' : 'delta flat'` → `d > 0 ? 'delta up' : d < 0 ? 'delta down' : 'delta flat'`
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | :74 — `dPp > 0 ? 'up good' : dPp < 0 ? 'up' : 'flat'` → `dPp > 0 ? 'up' : dPp < 0 ? 'down' : 'flat'`

### Context
- `src/app/refresh.css:222-229` | the verdict-toned rules emitted classes must match
- `specs/ux-ui-audit-v2/results/S04-07.md` | handoff naming these sites (refs drifted :26/:343/:640/:135 → verified lines above)
- `src/features/cx-people/components/agents-page.tsx:761` | `d>0?'up':d<0?'down'` already emits verdict tone (score-vs-team) — do NOT touch

### Contract
`delta up` is emitted only when the delta is good news; `delta down` when bad. The `good` modifier disappears everywhere (its rule was deleted in S04-07). `▲/▼` glyphs, `aria-label` text and `deltaFmt` output unchanged — class is tone, not direction.
Out of scope: refresh.css (done), `data-dir` attributes, other stat/HeadStat tones.

### Actions
1. queue-page.tsx: swap the two ternary class names (:27, :346).
2. agents-page.tsx: replace the :628 `cls` ternary per contract.
3. my-status-page.tsx: replace the :74 `dCls` ternary per contract.
4. Typecheck + grep guard.

### Done when
- `grep -rn "up good" src/` -> zero hits; negative deltas never emit `'up'`; a rising queue delta emits `'down'`.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx vitest run tests/golden/queue.test.ts tests/golden/people.test.ts tests/golden/productivity.test.ts` -> pass (logic-only goldens; classNames not asserted).

### Handoff
Closes the S04-07 visual regression. queue-page / agents-page / my-status-page are free for S12-14/S12-15/S12-21/S12-23 which serialize behind this leaf. Write results/S04-08.md (<=10 lines); TL alone updates TRACKER.md.

## S07-15: scores empty-hero — TrendChart `O===0` Empty + `qs-hero` null-score single column
Kind: mini
ID: S07-15
Parent: S07
Owner: dev
Depends: S03-18
Status: resharded — S07-11 residual (QL-L6 sites; evidence results/S07-11.md)
Criteria: QL-L6 (empty TrendChart figure + sparse qs-hero)
Skills: none
Budget: files=2; actions=4; changed_lines=20; minutes=6

### Goal
When every bucket is filtered out (`O === 0`), TrendChart renders the canonical `Empty` instead of a full-height figure of bare axes; `.qs-hero` collapses to one column when `f.score === null` so a null score stops leaving a mostly-empty 2-col hero.

### Files
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | TrendChart :98-99 — early empty return; :540 — `qs-hero` conditional modifier; ui-barrel import — add `Empty`
- Edit: `src/app/styles/quality.css` | after :190 — add the `.qs-hero--flat` rule

### Context
- `src/features/cx-quality/components/quality-scores-page.tsx:98-164` | `O` = scored-point count; the figure markup it gates
- `src/features/cx-quality/components/quality-analytics-charts.tsx:95,:174-180` | ColsChart's precedent (`y` gate → `.empty` block) — use `<Empty>` because `.empty` is a warn loser class
- `src/app/styles/quality.css:188-190` | `.qs-hero` 2-col grid + the mobile 1-col media rule to mirror
- `specs/ux-ui-audit-v2/reports/audit-quality.md:369-385` | the finding text + recommended fix

### Contract
- After `const O = …` (:98): `if (O === 0) return (<figure className="qa-trend qa-line cc-chart" ref={a as any}>{i}<Empty title="No scored audits in these dates." /></figure>)` — `Empty` imported from `@/features/shared/components/ui`.
- :540 → `className={f.score === null ? 'qs-hero qs-hero--flat' : 'qs-hero'}`; CSS `[data-app="quality"] .qs-hero--flat { grid-template-columns:minmax(0,1fr) }` placed beside the :190 media rule.
Out of scope: other `qa-*` dead hooks (S07-16), qs-hero copy/structure changes, compare-mode behaviour.

### Actions
1. Add `Empty` to the existing ui-barrel import in quality-scores-page.tsx.
2. TrendChart: insert the `O === 0` early return per contract.
3. qs-hero: apply the conditional modifier at :540.
4. quality.css: append `.qs-hero--flat` after :190; typecheck.

### Done when
- `O===0` renders `cx-empty` inside the figure (no svg axes); null score collapses the hero to one column; eslint shows no `empty` loser-classnames-warn on this file.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/golden/quality.test.ts` -> pass.

### Handoff
quality-scores-page.tsx + quality.css stay serialized: S07-17 (quality.css), then S12-20/S12-25/S12-29. Write results/S07-15.md (<=10 lines); TL alone updates TRACKER.md.

## S07-16: analytics dead hooks — `.qa-health` + `.qa-cov-wrap` + stray `p` ref
Kind: mini
ID: S07-16
Parent: S07
Owner: dev
Depends: S03-18
Status: resharded — S07-11 residual (QL-L1 sites; post-S13-06 line drift verified)
Criteria: QL-L1 (dead class hooks + unused refs)
Skills: none
Budget: files=2; actions=4; changed_lines=8; minutes=4

### Goal
Drop the last three markup hooks that style nothing: `qa-health` on the HealthHead dl, `qa-cov-wrap` on the coverage tablewrap, and the never-read `p` ref on the drill section.

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | :55 `dq-totals qa-health` → `dq-totals`; :956 delete `const p = useRef<HTMLElement | null>(null)`; :962 drop `ref={p as any}`; :11 drop `useRef` from the react import
- Edit: `src/features/cx-quality/components/quality-analytics-charts.tsx` | :476 `cx-panel cx-tablewrap qa-cov-wrap` → `cx-panel cx-tablewrap`

### Context
- `src/features/cx-quality/components/quality-analytics-page.tsx:956-962` | `p` is written by ref but never read — whole-file grep shows zero `p.current` uses
- `specs/ux-ui-audit-v2/reports/audit-quality.md:277-298` | QL-L1 hook list (these three were out-of-scope for S07-11)

### Contract
No `qa-health`, `qa-cov-wrap` or `useRef` token remains in either file. Rendering unchanged (the classes had no rules; the ref had no readers).
Out of scope: any other hook/site, `data-skipped` (attr already removed by S07-11), CSS edits.

### Actions
1. quality-analytics-page.tsx: drop `qa-health` at :55.
2. Same file: delete the `p` ref declaration + attribute; prune `useRef` from :11.
3. quality-analytics-charts.tsx: drop `qa-cov-wrap` at :476.
4. Typecheck + targeted lint.

### Done when
- `grep -rn "qa-health\|qa-cov-wrap" src/features/cx-quality/` -> zero hits; no unused import/var warnings on the edited files.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/golden/quality.test.ts` -> pass.

### Handoff
quality-analytics-page.tsx/charts.tsx serialize onward to S12-20/S12-24. Write results/S07-16.md (<=10 lines); TL alone updates TRACKER.md.

## S07-17: `details.qa-sampling` skin → `.qa-details-panel` rename
Kind: mini
ID: S07-17
Parent: S07
Owner: dev
Depends: S07-15
Status: resharded — S07-11 residual (QL-L1 rename; quality.css serialized behind S07-15)
Criteria: QL-L1 (.qa-sampling generic skin → neutral class)
Skills: none
Budget: files=3; actions=3; changed_lines=10; minutes=5

### Goal
`.qa-sampling` is reused as the generic details-panel skin on non-sampling panels; rename it to `.qa-details-panel` in the sheet and the four markup sites so the class says what it is.

### Files
- Edit: `src/app/styles/quality.css` | :123-126 — `.qa-sampling`→`.qa-details-panel`, `.qa-sampling>summary`→`.qa-details-panel>summary`, `.qa-sampling__body`→`.qa-details-panel__body`, `.qa-sampling .qa-w`→`.qa-details-panel .qa-w`
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | :560 `qa-sampling cx-panel cx-panel--pad` → `qa-details-panel cx-panel cx-panel--pad`
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | :960 `qa-sampling__body` → `qa-details-panel__body`; :1150 + :1210 `qa-sampling` → `qa-details-panel`

### Context
- `specs/ux-ui-audit-v2/reports/audit-quality.md:284-297` | the finding + the `.qa-details-panel` suggestion
- `src/features/cx-quality/components/qa-shared.tsx:78` | `samplingPage` is an API symbol, NOT a class — untouched

### Contract
Zero `qa-sampling` class tokens remain in `src/`; selectors renamed verbatim (no property changes).
Out of scope: the `[data-skipped]` opacity alternative — S07-11 deleted the attr; a rule for a nonexistent attr is dead CSS (flag in results if the PM wants the dim back as real markup).

### Actions
1. quality.css: retarget the four selectors (:123-126).
2. Rename the class at audit-queue-page.tsx:560 and audit-queue-detail.tsx:960,1150,1210.
3. Typecheck + grep guard.

### Done when
- `grep -rn "qa-sampling" src/` -> only the `samplingPage` API symbol; panels render the same skin under the new name.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/golden/quality.test.ts` -> pass.

### Handoff
audit-queue-page.tsx/detail.tsx serialize onward to S12-20/S12-24/S12-29. Write results/S07-17.md (<=10 lines); TL alone updates TRACKER.md.

## S06-18: my-actions local `Chip` → shared `ui/Chip`
Kind: mini
ID: S06-18
Parent: S06
Owner: dev
Depends: none
Status: resharded — S06-12 residual (leaf named the wrong file; the real second local Chip is here, PM-verified)
Criteria: PP-M8 (local Chips → shared Chip)
Skills: none
Budget: files=1; actions=3; changed_lines=12; minutes=4

### Goal
Delete the last local `Chip` impl — `function Chip({status})` at my-actions-page.tsx:31-33 emitting `pill ${status}` — and resolve its three call sites through the barrel `Chip` (`cx-chip` + `data-status`).

### Files
- Edit: `src/features/cx-people/components/my-actions-page.tsx` | :30-33 — delete `/* $e */` + local `Chip`; :9 — add `Chip` to the `@/features/shared/components/ui` import

### Context
- `src/features/shared/components/ui/Chip.tsx:4-26` | `status?: 'neutral'|'info'|'ok'|'warn'|'bad'`; barrel-exported (index.ts:19)
- `src/features/cx-people/components/my-actions-page.tsx:65-67` | call sites emit `'bad'`/`'warn'`/`'warn'` — all inside the union, no narrowing needed
- `specs/ux-ui-audit-v2/results/S06-12.md` | residual evidence

### Contract
`<Chip status="bad">`/`status="warn">` compile against ChipProps; emitted markup becomes `cx-chip` + `data-status` (the DECISION-B canonical skin that replaced `.pill`; `.pill` rule deletion is S12-32's).
Out of scope: the `empty`/`card` loser classes in this file (S12-19/S12-23), Chip props/behaviour changes.

### Actions
1. Add `Chip` to the existing ui-barrel import (:9).
2. Delete the local `Chip` def + its `/* $e */` banner (:30-33).
3. Typecheck + grep guard.

### Done when
- `grep -n "function Chip\|pill" src/features/cx-people/components/my-actions-page.tsx` -> zero hits; the three call sites render `cx-chip`.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/golden/people.test.ts` -> pass.

### Handoff
Completes PP-M8 for cx-people. my-actions-page.tsx serializes onward to S12-19 then S12-23. Write results/S06-18.md (<=10 lines); TL alone updates TRACKER.md.

## S12-13: cx-kit dead rules — `.cx-filter-row`, `.cx-grid-3`, `.cx-sidelayout`, `.cx-dock`, `.cx-example`, `.cx-hc__*`, `.cx-assume__grid`, `.cx-typecards`
Kind: mini
ID: S12-13
Parent: S12
Owner: dev
Depends: none
Status: resharded — S12-08 residual (dead canonical-name rules missed by the SH-L2 list; evidence results/dead-css-sweep.md §Follow-up)
Criteria: SH-L2 / ST-H2 (dead `.cx-*` rules, 0 users)
Skills: none
Budget: files=1; actions=3; changed_lines=30; minutes=5

### Goal
Delete the eight `.cx-*` rule blocks with zero className users — canonical-named but orphaned, they still ship in cx-kit.css.

### Files
- Edit: `src/app/cx-kit.css` | :567 `.cx-grid-3`, :570 `.cx-sidelayout`, :571-581 `.cx-dock`+`h3`, :582-589 `.cx-example`, :1504 `.cx-filter-row` — full-rule deletes; :775 + :787 — whole dead selector lines (all four names share each line); :778 — drop `, :root .cx-sidelayout` only; :782 — `.cx-grid-3` media rule

### Context
- `specs/ux-ui-audit-v2/results/dead-css-sweep.md` §Follow-up | the 0-user list this leaf covers
- `src/app/cx-kit.css:775-787` | dead names share selector lines with live `.cx-grid-2`/`.cx-split` at :778 — trim, don't delete that line

### Contract
Every deleted selector has zero users — re-verify with the Verify greps BEFORE deleting. `:root .cx-grid-2, :root .cx-split, :root .cx-split--narrow` survive at :778 (remove only `.cx-sidelayout` from that list).
Out of scope: live `.cx-*` rules, `.pw-dialog` rules (S12-16), refresh/theme/area stylesheets.

### Actions
1. Run the Verify grep; if ANY listed selector has a markup user, stop — RESHARD_NEEDED.
2. Delete the listed rules/blocks and the two all-dead selector lines; trim `.cx-sidelayout` out of :778.
3. `npx tsc --noEmit` + grep guard.

### Done when
- `grep -n "cx-filter-row\|cx-grid-3\|cx-sidelayout\|cx-dock\|cx-example\|cx-hc__\|cx-assume__grid\|cx-typecards" src/app/cx-kit.css` -> zero hits; live `.cx-grid-2`/`.cx-split` rules intact.

### Verify
- Run: `grep -rn "cx-filter-row\|cx-grid-3\|cx-sidelayout\|cx-dock\|cx-example\|cx-hc__\|cx-assume__grid\|cx-typecards" src/ --include=*.tsx` -> zero hits (pre-edit proof; post-edit the css grep above is the guard).
- Run: `npx tsc --noEmit` -> clean.

### Handoff
cx-kit.css stays serialized — S12-16 edits its `.pw-dialog` block next. Write results/S12-13.md (<=10 lines); TL alone updates TRACKER.md.

## S12-14: `tag` → `Chip plain` + `page-sub` → `page-purpose` call sites
Kind: mini
ID: S12-14
Parent: S12
Owner: dev
Depends: S04-08
Status: resharded — S12-08 residual (warn-family backlog: tag×5 sites, page-sub×3)
Criteria: ST-H2 / SH-L2 warn-family migration (tag, page-sub)
Skills: none
Budget: files=4; actions=4; changed_lines=15; minutes=6

### Goal
Migrate the two smallest loser families' markup — five `className="tag"` chips in one-on-ones-views and three `page-sub` subtitles — leaving zero warn-gated `tag`/`page-sub` tokens.

### Files
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | :1092,:1097,:1556,:1819,:1986 — `<span className="tag">` → `<Chip plain>`; add `Chip` to the ui-barrel import
- Edit: `src/features/cx-hub/components/overview-page.tsx` | :437 `page-sub` → `page-purpose`
- Edit: `src/features/cx-people/components/agents-page.tsx` | :573 `page-sub` → `page-purpose`
- Edit: `src/features/cx-queue/components/aging-page.tsx` | :113 `page-sub` → `page-purpose`

### Context
- `src/app/refresh.css:261-266` | `.tag` = neutral mini-pill → `<Chip plain>` is the canonical neutral chip (no status, no dot)
- `src/features/shared/components/ui/PageShell.tsx:47` | `p.page-purpose` is the canonical head-subtitle pattern these three `page-head` blocks already use
- `eslint.config.mjs:5-8` | boundary excludes `-` — `nt-tag`/`va-tag`/`qs-tag`/`eco3-tag`/`upnext-tag`/`md-1on1-tag` do NOT match the warn regex; do not touch them

### Contract
Only bare `tag`/`tag-*` and `page-sub` className tokens change. `page-purpose` needs no CSS rule (inherits under `.page-head`).
Out of scope: `-tag`-suffixed classes, `seg`-family (S12-15/16), the `.tag`/`.page-sub` CSS rules (S12-32 deletes them once users=0).

### Actions
1. one-on-ones-views: add `Chip` import; swap the five `<span className="tag">` sites.
2. Swap `page-sub`→`page-purpose` at overview:437, agents:573, aging:113.
3. Typecheck.
4. Lint the four files — zero `tag`/`page-sub` warns.

### Done when
- `grep -rn 'className="tag"' src/` -> zero hits; `grep -rn '"page-sub"' src/` -> zero hits; eslint loser-warn count for tag/page-sub = 0 in these files.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-people/components/one-on-ones-views.tsx src/features/cx-hub/components/overview-page.tsx src/features/cx-people/components/agents-page.tsx src/features/cx-queue/components/aging-page.tsx` -> no tag/page-sub loser warnings.

### Handoff
Files serialize onward: one-on-ones-views → S12-19/S12-23/S12-28; agents → S12-23; aging → S12-15/S12-16/S12-26/S12-30; overview → S12-18/S12-22. Write results/S12-14.md (<=10 lines); TL alone updates TRACKER.md.

## S12-15: `tbl` → `cx-table` (+`cx-num-col`, TableScroll) + refresh.css descendant retargets
Kind: mini
ID: S12-15
Parent: S12
Owner: dev
Depends: S04-08, S12-14
Status: resharded — S12-08 residual (warn-family backlog: tbl×3 files)
Criteria: ST-H2 / SH-L2 warn-family migration (tbl)
Skills: none
Budget: files=4; actions=6; changed_lines=40; minutes=8

### Goal
Retire the `tbl` vocabulary: the three `.tbl` tables become `.cx-table` (canonical raw class, DECISION B), `num` cells become `cx-num-col`, aging's inline `minWidth:64rem` moves into `TableScroll`, and the still-live `.tbl`-scoped descendant hooks (`.sub`/`.lead`/`.rowlink`/`th.q-agemix`) are retargeted to `.cx-table` scope.

### Files
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | :165 `<table className="tbl">` → `cx-table`; `num` cells → `cx-num-col`
- Edit: `src/features/cx-queue/components/aging-page.tsx` | :226 `<table className="tbl" style={{minWidth:'64rem'}}>` → wrap in `<TableScroll label={…} minWidth="64rem">` + `cx-table`, drop the inline style; :231-264 `num`/`lead` cells → `cx-num-col` (lead keeps `.lead`)
- Edit: `src/features/cx-queue/components/queue-page.tsx` | :278 `tbl` → `cx-table`; :282-371 `num` cells → `cx-num-col` (keep `.q-agemix`, `.lead`, `.sub`, `.rowlink` hooks)
- Edit: `src/app/refresh.css` | :282-294 — retarget `.tbl .sub`→`.cx-table .sub`, `.tbl .lead`→`.cx-table .lead`, `.tbl .rowlink`→`.cx-table .rowlink`, `.tbl th.q-agemix`→`.cx-table th.q-agemix` (+ its :294 media twin); delete `.tbl td.num,.tbl th.num` (markup now `cx-num-col`)

### Context
- `src/app/cx-kit.css:633-665` | `.cx-table` base + `.cx-num-col{text-align:end}` — the documented replacement pair (precedent: analytics-page `cx-num-col cx-num`)
- `src/features/shared/components/ui/TableScroll.tsx` | `label`+`minWidth` props — the canonical overflow wrap (S03-07/S07-06/S07-10 adopters)
- `src/features/cx-queue/components/queue-page.tsx:294,:327-353` | live `.q-agemix`/`.lead`/`.sub`/`.rowlink` descendants inside the migrated table
- `src/app/styles/quality.css:25` | existing `.cx-table :is(th,td).num` precedent if a leftover `num` slips through

### Contract
`tbl` className tokens → `cx-table`; `num` → `cx-num-col` (+`cx-num` where tabular numerics matter — both classes allowed, analytics pattern). `.sub`/`.lead`/`.rowlink`/`.q-agemix` are NOT loser classes — keep them and retarget their rules to `.cx-table` scope. Base `.tbl`/`th`/`td`/`tbody` rules stay in refresh.css until S12-32 deletes them.
Out of scope: other tables already on `cx-table`, the `.tbl` base-rule deletion (S12-32), TableScroll adoption beyond aging's inline-minWidth site.

### Actions
1. status-validation :165 + num cells → `cx-table`/`cx-num-col`.
2. aging :226 → TableScroll wrap per contract; :231-264 cells.
3. queue-page :278 + :282-371 cells; keep non-loser hooks verbatim.
4. refresh.css: retarget the four descendant rules (+media) to `.cx-table` scope; delete the `.num` selector line.
5. Typecheck.
6. Lint the three files — zero `tbl` warns.

### Done when
- `grep -rn 'className="tbl"' src/` -> zero hits; `.cx-table`-scoped `.sub`/`.lead`/`.rowlink`/`th.q-agemix` rules exist; aging table scrolls via `tblscroll` region.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-queue/components/queue-page.tsx src/features/cx-queue/components/aging-page.tsx src/features/cx-productivity/components/status-validation-page.tsx` -> no `tbl` loser warnings.
- Run: `npx vitest run tests/golden/queue.test.ts tests/golden/productivity.test.ts` -> pass.

### Handoff
queue-page → S12-26/S12-30; aging → S12-16/S12-26/S12-30; status-validation → S12-27; refresh.css → S12-32. Write results/S12-15.md (<=10 lines); TL alone updates TRACKER.md.

## S12-16: `seg` → `Seg` (aging) + `pw-dialog` → `Dialog` + dead `.pw-dialog` CSS
Kind: mini
ID: S12-16
Parent: S12
Owner: dev
Depends: S12-15, S12-13
Status: resharded — S12-08 residual (warn-family backlog: seg×1 site, pw-dialog×1 file)
Criteria: ST-H2 / SH-L2 warn-family migration (seg, pw-dialog)
Skills: none
Budget: files=4; actions=6; changed_lines=60; minutes=8

### Goal
Retire the last two interactive-control loser tokens: aging's `button.on` `seg` group becomes the canonical `Seg` radiogroup, and `PwDialog`'s raw `<dialog className="pw-dialog">` renders through `Dialog` — then the `.pw-dialog` CSS dies.

### Files
- Edit: `src/features/cx-queue/components/aging-page.tsx` | :120-141 — `div.seg`+`button.on` map → `<Seg name="ag-assign" value={assign} onChange={(v)=>{setAssign(v);setShown(PAGE)}} options={[{value:'all',label:D('All')},{value:'ours',label:D('Ours')},{value:'unassigned',label:D('Unassigned')}]} aria-label={D('Assignment')} />`; add `Seg` to the ui import
- Edit: `src/features/cx-people/components/pw.tsx` | :363,:366-369 — delete `ref`+`useLayoutEffect` (Dialog owns modal lifecycle); :371 → `<Dialog open labelledby="pw-del-h" onClose={onClose}>` … `</Dialog>`; :395 `pw-dialog-actions` → `pwdlg-actions`; import `Dialog` from `@/features/shared/components/ui`
- Edit: `src/app/styles/people.css` | :198-201 — delete `.pw-dialog`+`::backdrop` rules; retarget `.pw-dialog-actions` → `.pwdlg-actions`
- Edit: `src/app/cx-kit.css` | :1412-1428 — delete the `.pw-dialog` block incl. `[open]` animation; :1429 — drop `,.pw-dialog` from the `dialog:is(…)::backdrop` selector list

### Context
- `src/features/shared/components/ui/Dialog.tsx` | `open`+`labelledby`+`onClose`; `useDialogModal` handles showModal/cancel — PwDialog callers mount-gate it, so `open` is hard-true inside
- `src/features/shared/components/ui/Seg.tsx` | radiogroup contract (`name`/`value`/`onChange`/`options`/`aria-label`)
- `src/features/cx-queue/components/aging-page.tsx:120-141` | the aria-pressed button group being replaced
- `eslint.config.mjs:7` | `seg`/`pw-dialog` are warn tokens; `pw-seg`, `tph-hg-seg`, `pv-seg`, `sch-seg` do NOT match — untouched

### Contract
PwDialog keeps its exported name/props (PORTING-GUIDE fn names survive); only the dialog element + skin change (`popup` base class supplies the dialog chrome, the `:1429` backdrop list keeps `.popup`). Seg's `onChange` runs the same two state writes the buttons did.
Out of scope: `pw-seg` sites (kept-raw, eslint-disabled per site), `.pw-dialog` callers' props, other dialogs.

### Actions
1. aging :120-141 → `<Seg>` per contract + import.
2. pw.tsx: swap the `<dialog>` element for `<Dialog>`; delete ref+effect; rename the actions class.
3. people.css: delete `.pw-dialog`/`::backdrop`; retarget the actions rule.
4. cx-kit.css: delete the `.pw-dialog` block; trim `,.pw-dialog` from :1429.
5. Verify every `<PwDialog` render site is conditional (grep); if one mounts always-open=false, pass `open` through — else stop, RESHARD_NEEDED.
6. Typecheck + lint.

### Done when
- `grep -rn '"seg"\|pw-dialog' src/` -> zero hits; aging filter works via radiogroup; PwDialog opens as a styled modal.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-queue/components/aging-page.tsx src/features/cx-people/components/pw.tsx` -> no seg/pw-dialog loser warnings.
- Run: `npx vitest run tests/golden/people.test.ts tests/golden/queue.test.ts` -> pass.

### Handoff
aging → S12-26/S12-30; pw.tsx + people.css + cx-kit.css free. Write results/S12-16.md (<=10 lines); TL alone updates TRACKER.md.

## S12-17: eslint ratchet — `tag|tbl|seg|page-sub|pw-dialog` warn→error + `cx-tab(s)` exemption
Kind: mini
ID: S12-17
Parent: S12
Owner: dev
Depends: S12-14, S12-15, S12-16
Status: resharded — S12-08 residual (lint-gate half; cx-tab review vs Tabs.tsx)
Criteria: ST-H1 + ST-H2 (className gate ratchet)
Skills: none
Budget: files=1; actions=3; changed_lines=6; minutes=4

### Goal
Move the five now-clean families from `warnLosers` to `errorLosers` so they can't come back, and stop the warn regex self-flagging the canonical `Tabs` primitive (`cx-tabs`/`cx-tab` are its own emitted classes).

### Files
- Edit: `eslint.config.mjs` | :7 — remove `cx-tabs?(?:-[\w-]+)?|` and `tag(?:-[\w-]+)?|tbl(?:-[\w-]+)?|seg(?:-[\w-]+)?|page-sub(?:-[\w-]+)?|pw-dialog(?:-[\w-]+)?|` from `warnLosers`; :8 — add them to `errorLosers` (keep the same `(?:-[\w-]+)?` shape and `${end}` termination)

### Context
- `src/features/shared/components/ui/Tabs.tsx:77,:89` | the canonical primitive emits `cx-tabs`/`cx-tab` — the audit's "cx-tab review" resolves to: these ARE the canonical classes, exempt them
- `eslint.config.mjs:5-8` | `boundary`/`end` construction — new entries must keep the exact alternation shape
- `specs/ux-ui-audit-v2/results/dead-css-sweep.md` §Follow-up | `cx-tab(s)` review brief

### Contract
After the edit: `tag|tbl|seg|page-sub|pw-dialog` (and their `-` suffixed forms) lint as ERRORS; `cx-tabs`/`cx-tab` in Tabs.tsx produce neither warn nor error; `empty|card|pill|cx-sr|sr-only|dq-*` stay warn (ratcheted later by S12-32 / post-S12-31).
Out of scope: any other rule/config line, `local-defs`/`feature-boundary` tuning.

### Actions
1. Edit `warnLosers` (:7) and `errorLosers` (:8) per contract.
2. `npx eslint src/features/shared/components/ui/Tabs.tsx` -> zero loser findings.
3. `npx eslint src/features/cx-queue/components/aging-page.tsx src/features/cx-people/components/pw.tsx` -> 0 errors on the migrated families.

### Done when
- Tabs.tsx lint-clean; the five families gate as errors; `npx eslint .` shows no NEW errors vs baseline (952 warn → lower; 0 errors stays 0).

### Verify
- Run: `npx eslint eslint.config.mjs src/features/shared/components/ui/Tabs.tsx` -> clean.
- Run: `npx eslint . --quiet` -> 0 errors (log tail only if it fails).

### Handoff
S12-32 moves `empty|card|pill` to error once their leaves land. Write results/S12-17.md (<=10 lines); TL alone updates TRACKER.md.

## S12-18: `empty` → `Empty` — hub + shared shell call sites
Kind: mini
ID: S12-18
Parent: S12
Owner: dev
Depends: S12-14
Status: resharded — S12-08 residual (warn-family backlog: empty family, hub+shell slice)
Criteria: ST-H2 / SH-L2 warn-family migration (empty)
Skills: none
Budget: files=9; actions=6; changed_lines=80; minutes=9

### Goal
Every `className="empty"` block in hub pages and shared shell components renders through the canonical `<Empty>` primitive (`cx-empty`).

### Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | :149,:270,:346,:370,:712,:822,:915 (7 sites)
- Edit: `src/features/cx-hub/components/overview-page.tsx` | :532,:573
- Edit: `src/features/cx-hub/components/admin-roster-page.tsx` | :209
- Edit: `src/features/cx-hub/components/admin-config-page.tsx` | :78
- Edit: `src/features/cx-hub/components/admin-page.tsx` | :197
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | :397,:489
- Edit: `src/features/shared/components/shell/ViewAs.tsx` | :177,:182
- Edit: `src/features/shared/components/shell/CommandPalette.tsx` | :250
- Edit: `src/features/shared/components/shell/StateScreen.tsx` | :38-49 (`.t`+`.s`+svg — full `icon`/`title`/`body` mapping)

### Context
- `src/features/shared/components/ui/Empty.tsx` | `icon`/`title`/`body`/`action`/`children` props; barrel-exported
- `src/app/refresh.css:58-65` | `.empty`/`.t`/`.s` anatomy being replaced
- `src/features/shared/components/shell/StateScreen.tsx:30-49` | the richest site (svg icon + title + body)

### Contract
`div.empty` → `<Empty>`: inner `.t` → `title=`, `.s` → `body=` (a lone `.s` block → `title=`), leading svg → `icon=`, extra nodes → `action`/`children`. Wrapper classes (e.g. surrounding `card`) are NOT this leaf's scope. Comments/`'empty'` string literals ignored — only className tokens.
Out of scope: `card`/`pill` classes in the same files (S12-22/S12-28), the `.empty` CSS rules (S12-32).

### Actions
1. Migrate my-day's seven sites (single `.s` lines → `title=`).
2. Migrate overview, admin-roster, admin-config, admin-page, people-holidays sites.
3. Migrate ViewAs, CommandPalette, StateScreen (icon/title/body full mapping).
4. Add `Empty` to each file's ui-barrel import.
5. Typecheck.
6. Lint all nine files — zero `empty` warns.

### Done when
- `grep -rn 'className="empty"' src/features/cx-hub src/features/shared/components/shell` -> zero hits; no `empty` loser warnings on the files.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-hub/components/ src/features/shared/components/shell/` -> no `empty` loser warnings.
- Run: `npx vitest run tests/golden/hub.test.ts tests/shell` -> pass.

### Handoff
Files serialize onward: my-day/overview/admin-roster/admin-config/admin-page/people-holidays → S12-22 then S12-28 (pill files only). Write results/S12-18.md (<=10 lines); TL alone updates TRACKER.md.

## S12-19: `empty` → `Empty` — cx-people call sites
Kind: mini
ID: S12-19
Parent: S12
Owner: dev
Depends: S06-18, S12-14
Status: resharded — S12-08 residual (warn-family backlog: empty family, people slice)
Criteria: ST-H2 / SH-L2 warn-family migration (empty)
Skills: none
Budget: files=6; actions=4; changed_lines=60; minutes=8

### Goal
Every `className="empty"` block in cx-people components renders through `<Empty>`.

### Files
- Edit: `src/features/cx-people/components/my-actions-page.tsx` | :146
- Edit: `src/features/cx-people/components/coaching-page.tsx` | :136
- Edit: `src/features/cx-people/components/notes-page.tsx` | :311
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | :1544,:2112,:2168,:2251,:2442
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | :745,:1005
- Edit: `src/features/cx-people/components/meetings-page.tsx` | :466,:562,:894

### Context
- `src/features/shared/components/ui/Empty.tsx` | prop contract (title/body/icon/action)
- `src/app/refresh.css:58-65` | `.empty`/`.t`/`.s` anatomy

### Contract
Same mapping as S12-18: `.t`→`title=`, `.s`→`body=` (lone `.s`→`title=`), svg→`icon=`, extras→`action`/`children`; className tokens only.
Out of scope: `card`/`pill`/`tag`-family leftovers in these files (S12-23/S12-28), `.empty` CSS rules (S12-32).

### Actions
1. Migrate the six files' sites per contract.
2. Add `Empty` to each file's ui-barrel import.
3. Typecheck.
4. Lint — zero `empty` warns on these files.

### Done when
- `grep -rn 'className="empty"' src/features/cx-people/` -> zero hits.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-people/components/` -> no `empty` loser warnings; `npx vitest run tests/golden/people.test.ts` -> pass.

### Handoff
Files → S12-23 then S12-28 (one-on-ones-views/tl-tasks/meetings). Write results/S12-19.md (<=10 lines); TL alone updates TRACKER.md.

## S12-20: `empty` → `Empty` — cx-quality call sites
Kind: mini
ID: S12-20
Parent: S12
Owner: dev
Depends: S07-15, S07-16, S07-17
Status: resharded — S12-08 residual (warn-family backlog: empty family, quality slice)
Criteria: ST-H2 / SH-L2 warn-family migration (empty)
Skills: none
Budget: files=9; actions=4; changed_lines=50; minutes=8

### Goal
Every `className="empty"` block in cx-quality components renders through `<Empty>`.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | :327,:366
- Edit: `src/features/cx-quality/components/qa-forms-page.tsx` | :455
- Edit: `src/features/cx-quality/components/quality-analytics-charts.tsx` | :175,:436
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | :441
- Edit: `src/features/cx-quality/components/kb-gaps-page.tsx` | :212
- Edit: `src/features/cx-quality/components/calibration-page.tsx` | :58,:419
- Edit: `src/features/cx-quality/components/disputes-page.tsx` | :212
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | :199,:222 (SideBars panels)
- Edit: `src/features/cx-quality/components/my-audits-page.tsx` | :168,:187

### Context
- `src/features/shared/components/ui/Empty.tsx` | prop contract
- `src/features/cx-quality/components/quality-analytics-charts.tsx:174-180` | `qa-cols__none` modifier class — keep it as `className` on `<Empty>` (its centering rule stays)
- `src/app/refresh.css:58-65` | anatomy

### Contract
Same mapping as S12-18; where a modifier class sits beside `empty` (e.g. `empty qa-cols__none`), move it to `<Empty className="qa-cols__none">`. className tokens only.
Out of scope: `card`/`pill` classes in these files (S12-24/25/29), `.empty` CSS (S12-32).

### Actions
1. Migrate the nine files' sites per contract (keep modifiers via `className`).
2. Add `Empty` to each file's ui-barrel import.
3. Typecheck.
4. Lint — zero `empty` warns.

### Done when
- `grep -rn 'className="empty"' src/features/cx-quality/` -> zero hits (charts' new `Empty` at :175 keeps `qa-cols__none`).

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-quality/components/` -> no `empty` loser warnings; `npx vitest run tests/golden/quality.test.ts` -> pass.

### Handoff
Files → S12-24/S12-25 then S12-29. Write results/S12-20.md (<=10 lines); TL alone updates TRACKER.md.

## S12-21: `empty` → `Empty` — desk + queue + productivity + operations call sites
Kind: mini
ID: S12-21
Parent: S12
Owner: dev
Depends: S04-08
Status: resharded — S12-08 residual (warn-family backlog: empty family, remaining-areas slice)
Criteria: ST-H2 / SH-L2 warn-family migration (empty)
Skills: none
Budget: files=9; actions=6; changed_lines=60; minutes=8

### Goal
Every `className="empty"` block in cx-desk, cx-queue, cx-productivity and cx-operations components renders through `<Empty>` — completing the family.

### Files
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | :453,:491,:501,:572
- Edit: `src/features/cx-desk/components/mail-desk-page.tsx` | :411,:481
- Edit: `src/features/cx-desk/components/kpi-logs-page.tsx` | :226,:291,:344,:365
- Edit: `src/features/cx-desk/components/kb-tracker-page.tsx` | :247
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | :177,:1077
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | :260
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | :219
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | :159,:229
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | :703,:749

### Context
- `src/features/shared/components/ui/Empty.tsx` | prop contract
- `src/app/refresh.css:58-65` | anatomy

### Contract
Same mapping as S12-18. className tokens only.
Out of scope: `card`/`pill`/`tbl` classes in these files (S12-15 done; S12-26/27/30 next), `.empty` CSS (S12-32).

### Actions
1. Migrate desk files (tl-performance, mail-desk, kpi-logs, kb-tracker).
2. Migrate queue files (heatmap, analytics, checkins).
3. Migrate my-status + trackers.
4. Add `Empty` to each file's ui-barrel import.
5. Typecheck.
6. Lint — zero `empty` warns.

### Done when
- `grep -rn 'className="empty"' src/features/cx-desk src/features/cx-queue src/features/cx-productivity src/features/cx-operations` -> zero hits; the whole `empty` warn family is at 0 users.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-desk src/features/cx-queue src/features/cx-productivity src/features/cx-operations` -> no `empty` loser warnings; `npx vitest run tests/golden/queue.test.ts tests/golden/productivity.test.ts` -> pass.

### Handoff
Files → S12-26/S12-27 then S12-30. `.empty` rule deletion waits for S12-32. Write results/S12-21.md (<=10 lines); TL alone updates TRACKER.md.

## S12-22: `card*` → `cx-panel`/`cx-section__*` — cx-hub call sites
Kind: mini
ID: S12-22
Parent: S12
Owner: dev
Depends: S12-18
Status: resharded — S12-08 residual (warn-family backlog: card family, hub slice)
Criteria: ST-H2 / SH-L2 warn-family migration (card)
Skills: none
Budget: files=7; actions=5; changed_lines=160; minutes=10

### Goal
Every `card`/`card-*` className token in cx-hub components moves to the canonical `cx-panel` + `cx-section__*` vocabulary.

### Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | ~34 `card`/`card-pad`/`card-head`/`card-title`/`card-hint` sites
- Edit: `src/features/cx-hub/components/overview-page.tsx` | ~14 sites
- Edit: `src/features/cx-hub/components/admin-roster-page.tsx` | ~9 sites
- Edit: `src/features/cx-hub/components/admin-config-page.tsx` | ~4 sites
- Edit: `src/features/cx-hub/components/admin-page.tsx` | ~4 sites
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | ~9 sites
- Edit: `src/features/cx-hub/components/ecosystem-scene.tsx` | ~1 site (:2467)

### Context
- `src/app/cx-kit.css:524-547` | `.cx-panel`/`cx-panel--pad`/`cx-section__head`/`__title`/`__hint` — the canonical surface classes (DECISION B)
- `src/features/cx-quality/components/qa-shared.tsx:166-175` | `cx-section`+head precedent (QaSection)
- `src/features/cx-hub/components/overview-page.tsx:275-285` | already-canonical panel usage to mirror
- `src/app/refresh.css:156-166` | the `.card*` rules being vacated (deletion = S12-32)

### Contract
`card` → `cx-panel`; `card-pad` → `cx-panel--pad` (`card card-pad` on one element → `cx-panel cx-panel--pad`); `card-head` → `cx-section__head`; `card-title` → `cx-section__title`; `card-hint` → `cx-section__hint` — same elements/tags, classes only. `-card`-suffixed names (`login-card`, `qa-card`, `tph-card`, `home-cards` ids) do NOT match the warn regex — untouched. Any `card-*` variant beyond the five mapped (e.g. `card-row`): stop, RESHARD_NEEDED.
Out of scope: `empty`/`pill` classes (S12-18 done / S12-28 next), `.card*` CSS rules (S12-32), structural JSX changes beyond the head class retarget.

### Actions
1. Migrate my-day's ~34 sites per contract.
2. Migrate overview + admin-roster + admin-config + admin-page.
3. Migrate people-holidays + ecosystem-scene.
4. Typecheck.
5. Lint all seven files — zero `card` warns.

### Done when
- `grep -rEn 'className="[^"]*\bcard' src/features/cx-hub/` -> only `-card`-suffixed names remain; zero `card` loser warnings on the files.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-hub/components/` -> no `card` loser warnings; `npx vitest run tests/golden/hub.test.ts tests/golden/my-day.test.ts` -> pass.

### Handoff
my-day/admin-roster/admin-page/people-holidays → S12-28 (pill). Write results/S12-22.md (<=10 lines); TL alone updates TRACKER.md.

## S12-23: `card*` → `cx-panel`/`cx-section__*` — cx-people call sites
Kind: mini
ID: S12-23
Parent: S12
Owner: dev
Depends: S12-19, S12-14
Status: resharded — S12-08 residual (warn-family backlog: card family, people slice)
Criteria: ST-H2 / SH-L2 warn-family migration (card)
Skills: none
Budget: files=7; actions=5; changed_lines=120; minutes=10

### Goal
Every `card`/`card-*` className token in cx-people components moves to `cx-panel` + `cx-section__*`.

### Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | ~5 sites (:306,:694-699)
- Edit: `src/features/cx-people/components/coaching-page.tsx` | ~4 sites
- Edit: `src/features/cx-people/components/notes-page.tsx` | ~1 site (:141)
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | ~24 sites
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | ~3 sites
- Edit: `src/features/cx-people/components/meetings-page.tsx` | ~4 sites
- Edit: `src/features/cx-people/components/my-actions-page.tsx` | ~3 sites (:59,:145 + head markup)

### Context
- `src/app/cx-kit.css:524-547` | canonical classes
- `src/app/refresh.css:156-166` | vacated rules (S12-32 deletes)
- `src/features/cx-people/components/my-actions-page.tsx:59-63` | `card card-pad` + `cx-section__title` already mixed — finish the conversion

### Contract
Same mapping as S12-22 (card→cx-panel; card-pad→cx-panel--pad; card-head/title/hint→cx-section__*). `-card`-suffixed names untouched. Unknown `card-*` variant → stop, RESHARD_NEEDED.
Out of scope: `pill`/`empty` classes (S12-19 done / S12-28 next), `.card*` CSS (S12-32).

### Actions
1. Migrate agents + coaching + notes.
2. Migrate one-on-ones-views' ~24 sites.
3. Migrate tl-tasks + meetings + my-actions.
4. Typecheck.
5. Lint all seven files — zero `card` warns.

### Done when
- `grep -rEn 'className="[^"]*\bcard' src/features/cx-people/` -> only `-card`-suffixed names remain.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-people/components/` -> no `card` loser warnings; `npx vitest run tests/golden/people.test.ts` -> pass.

### Handoff
one-on-ones-views/tl-tasks/meetings → S12-28. Write results/S12-23.md (<=10 lines); TL alone updates TRACKER.md.

## S12-24: `card*` → `cx-panel`/`cx-section__*` — cx-quality slice A
Kind: mini
ID: S12-24
Parent: S12
Owner: dev
Depends: S07-16, S07-17, S03-18, S12-20
Status: resharded — S12-08 residual (warn-family backlog: card family, quality slice A)
Criteria: ST-H2 / SH-L2 warn-family migration (card)
Skills: none
Budget: files=7; actions=5; changed_lines=80; minutes=9

### Goal
Every `card`/`card-*` className token in the listed cx-quality files moves to `cx-panel` + `cx-section__*`. (`qa-card` names do NOT match the warn regex — untouched.)

### Files
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | ~5 sites (:45-54 head + others)
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | ~5 sites (:286-292,:365)
- Edit: `src/features/cx-quality/components/qa-forms-page.tsx` | ~1 site (:401)
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | ~5 sites (:776-800)
- Edit: `src/features/cx-quality/components/calibration-page.tsx` | ~4 sites
- Edit: `src/features/cx-quality/components/my-audits-page.tsx` | ~2 sites (:25,:41)
- Edit: `src/features/cx-quality/components/my-auditor-kpis-page.tsx` | ~2 sites (:56,:110)

### Context
- `src/app/cx-kit.css:524-547` | canonical classes
- `src/features/cx-quality/components/qa-shared.tsx:167,:1364` | in-file `cx-section__head` precedent
- `src/app/refresh.css:156-166` | vacated rules (S12-32)

### Contract
Same mapping as S12-22. `qa-card`/`qa-card--strip` are area skins, NOT warn-matched — untouched.
Out of scope: `pill`/`empty` classes (S12-20 done / S12-29 next), `.card*` CSS (S12-32).

### Actions
1. Migrate quality-analytics + audit-queue heads/panels.
2. Migrate qa-forms + qa-shared (:781 card-head site → cx-section__head).
3. Migrate calibration + my-audits + my-auditor-kpis.
4. Typecheck.
5. Lint all seven files — zero `card` warns.

### Done when
- `grep -rEn 'className="[^"]*\bcard' src/features/cx-quality/` (excl. `qa-card`) -> zero hits in these files.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-quality/components/` -> no `card` loser warnings on these files; `npx vitest run tests/golden/quality.test.ts` -> pass.

### Handoff
audit-queue/qa-forms/qa-shared → S12-29. Write results/S12-24.md (<=10 lines); TL alone updates TRACKER.md.

## S12-25: `card*` → `cx-panel`/`cx-section__*` — cx-quality slice B
Kind: mini
ID: S12-25
Parent: S12
Owner: dev
Depends: S07-15, S12-20
Status: resharded — S12-08 residual (warn-family backlog: card family, quality slice B)
Criteria: ST-H2 / SH-L2 warn-family migration (card)
Skills: none
Budget: files=4; actions=5; changed_lines=90; minutes=9

### Goal
Every `card`/`card-*` className token in the remaining cx-quality files moves to `cx-panel` + `cx-section__*` — completing the family for the area.

### Files
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | ~13 sites (:266,:346-378,:449-452)
- Edit: `src/features/cx-quality/components/kb-gaps-page.tsx` | ~2 sites (:70,:150)
- Edit: `src/features/cx-quality/components/disputes-page.tsx` | ~11 sites (:137-149,:218-276)
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | ~19 sites (:174-211,:299-302,:532-614)

### Context
- `src/app/cx-kit.css:524-547` | canonical classes
- `src/features/cx-quality/components/quality-scores-page.tsx:532-616` | team-score/trend card blocks (post-S07-15 `qs-hero` markup — preserve the `qs-hero--flat` conditional)
- `src/app/refresh.css:156-166` | vacated rules (S12-32)

### Contract
Same mapping as S12-22. Keep `qs-hero`/S07-15 modifiers and `qa-card` skins untouched.
Out of scope: `pill`/`empty` classes (S12-20 done / S12-29 next), `.card*` CSS (S12-32).

### Actions
1. Migrate ctls' ~13 sites.
2. Migrate kb-gaps + disputes.
3. Migrate quality-scores' ~19 sites (preserve `qs-hero--flat` logic at :540).
4. Typecheck.
5. Lint all four files — zero `card` warns.

### Done when
- `grep -rEn 'className="[^"]*\bcard' src/features/cx-quality/` (excl. `qa-card`) -> zero hits area-wide.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-quality/components/ctls-page.tsx src/features/cx-quality/components/kb-gaps-page.tsx src/features/cx-quality/components/disputes-page.tsx src/features/cx-quality/components/quality-scores-page.tsx` -> no `card` loser warnings; `npx vitest run tests/golden/quality.test.ts` -> pass.

### Handoff
quality-scores → S12-29. Write results/S12-25.md (<=10 lines); TL alone updates TRACKER.md.

## S12-26: `card*` → `cx-panel`/`cx-section__*` — cx-desk + cx-queue call sites
Kind: mini
ID: S12-26
Parent: S12
Owner: dev
Depends: S12-16, S12-21
Status: resharded — S12-08 residual (warn-family backlog: card family, desk+queue slice)
Criteria: ST-H2 / SH-L2 warn-family migration (card)
Skills: none
Budget: files=10; actions=5; changed_lines=120; minutes=10

### Goal
Every `card`/`card-*` className token in cx-desk and cx-queue components moves to `cx-panel` + `cx-section__*`.

### Files
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | ~9 sites
- Edit: `src/features/cx-desk/components/mail-desk-page.tsx` | ~5 sites
- Edit: `src/features/cx-desk/components/kpi-logs-page.tsx` | ~3 sites
- Edit: `src/features/cx-desk/components/kb-tracker-page.tsx` | ~2 sites
- Edit: `src/features/cx-queue/components/aging-page.tsx` | ~10 sites (:160-217,:270)
- Edit: `src/features/cx-queue/components/queue-page.tsx` | ~9 sites (:206-264)
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | ~5 sites
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | ~6 sites
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | ~4 sites
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | ~8 sites

### Context
- `src/app/cx-kit.css:524-547` | canonical classes
- `src/app/refresh.css:156-166` | vacated rules (S12-32)
- `src/features/cx-queue/components/aging-page.tsx:113-120` | post-S12-15/16 markup nearby — don't disturb `page-purpose`/`Seg`

### Contract
Same mapping as S12-22. `sch-card`/`hm-card`-style `-card`-suffixed area names untouched. Unknown `card-*` variant → stop, RESHARD_NEEDED.
Out of scope: `pill`/`empty` classes (S12-21 done / S12-30 next), `.card*` CSS (S12-32), `tbl` (S12-15 done).

### Actions
1. Migrate desk files (tl-performance, mail-desk, kpi-logs, kb-tracker).
2. Migrate aging + queue-page.
3. Migrate scheduler + heatmap + analytics-page + checkins.
4. Typecheck.
5. Lint all ten files — zero `card` warns.

### Done when
- `grep -rEn 'className="[^"]*\bcard' src/features/cx-desk src/features/cx-queue/` -> only `-card`-suffixed names remain.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-desk/components/ src/features/cx-queue/components/` -> no `card` loser warnings; `npx vitest run tests/golden/queue.test.ts` -> pass.

### Handoff
kpi-logs/kb-tracker/aging/queue-page/scheduler/checkins → S12-30. Write results/S12-26.md (<=10 lines); TL alone updates TRACKER.md.

## S12-27: `card*` → `cx-panel`/`cx-section__*` — productivity + operations + auth call sites — SUPERSEDED (→ #S12-33)
Kind: mini
ID: S12-27
Parent: S12
Owner: dev
Depends: S12-15, S12-21
Status: superseded — stale Files map (`tph-grid-page.tsx` has zero `card` hits; real hits in `tph-grid-views.tsx:597-603`; login :83 = exempt `login-card`, PageStates = comment) + unmapped `card--flat` variant; no edits made (evidence results/S12-27.md); residual → S12-33
Criteria: ST-H2 / SH-L2 warn-family migration (card)
Skills: none
Budget: files=7; actions=5; changed_lines=120; minutes=10

### Goal
Every `card`/`card-*` className token in cx-productivity, cx-operations and the login page moves to `cx-panel` + `cx-section__*` — completing the family.

### Files
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | ~21 sites
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | ~13 sites
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | ~6 sites (:455,:954-960,:1245)
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | ~14 sites
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | ~5 sites
- Edit: `src/app/auth/login/page.tsx` | ~1 site (:83 — NOT `login-card`; the bare `card` class)
- Edit: `src/features/shared/components/ui/PageStates.tsx` | verify only — its `card` hits are comments; touch ONLY if a real className token exists

### Context
- `src/app/cx-kit.css:524-547` | canonical classes
- `src/features/cx-productivity/components/tph-grid-page.tsx:1245` | `cx-panel cx-panel--pad tph-card` precedent — `tph-card` area skin stays
- `src/app/refresh.css:156-166` | vacated rules (S12-32)

### Contract
Same mapping as S12-22. `tph-card`/`login-card`/`-card`-suffixed names untouched.
Out of scope: `pill`/`empty` classes (S12-21 done / S12-30 next), `.card*` CSS (S12-32).

### Actions
1. Migrate productivity-analytics + status-validation.
2. Migrate tph-grid + my-status.
3. Migrate trackers + login page (+ PageStates only if real).
4. Typecheck.
5. Lint all files — zero `card` warns.

### Done when
- `grep -rEn 'className="[^"]*\bcard' src/features/cx-productivity src/features/cx-operations src/app/auth` -> only `-card`-suffixed names remain; whole `card` family at 0 users.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-productivity/components/ src/features/cx-operations/components/ src/app/auth/login/page.tsx` -> no `card` loser warnings; `npx vitest run tests/golden/productivity.test.ts` -> pass.

### Handoff
my-status/trackers/productivity-analytics → S12-30. Write results/S12-27.md (<=10 lines); TL alone updates TRACKER.md.

## S12-28: `pill*` → `Chip` — hub + people call sites
Kind: mini
ID: S12-28
Parent: S12
Owner: dev
Depends: S12-22, S12-23
Status: resharded — S12-08 residual (warn-family backlog: pill family, hub+people slice)
Criteria: ST-H2 / SH-L2 warn-family migration (pill), DECISION-B Chip canonical
Skills: none
Budget: files=8; actions=6; changed_lines=60; minutes=9

### Goal
Every `pill`/`pill <tone>` className token in hub + cx-people components renders through `Chip` (`cx-chip` + `data-status`).

### Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | :390,:476,:893-897 (incl. `pill acc` → `status="info"`)
- Edit: `src/features/cx-hub/components/admin-roster-page.tsx` | :246,:273
- Edit: `src/features/cx-hub/components/admin-page.tsx` | :381,:383
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | :353,:367
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | ~13 sites (:299,:1093-1104,:1557-1565,:1829,:1994,:2375-2377)
- Edit: `src/features/cx-people/components/tl-tasks-page.tsx` | :338,:413-417,:681
- Edit: `src/features/cx-people/components/meetings-page.tsx` | :335,:615,:870
- Edit: `src/features/cx-people/components/carried-review.tsx` | :45,:48,:50,:52

### Context
- `src/features/shared/components/ui/Chip.tsx` | `status` union + `plain`; barrel import path `@/features/shared/components/ui`
- `src/app/refresh.css:233-259` | `.pill` tone classes → `data-status` map (`acc` → `info`; `no-dot` → `plain`)
- `src/features/cx-quality/components/quality-analytics-charts.tsx:444` | Chip literal-site precedent (S03-18)

### Contract
`pill` bare → `<Chip>` (neutral, dot kept); `pill ok|warn|bad|info` → `status=`; `pill acc` → `status="info"`; `no-dot` → `plain`. Dynamic `` `pill ${tone}` `` sites → `<Chip status={tone}>` with the S03-18 narrowing pattern (`import type { ChipStatus }` direct from `./Chip` — not the barrel) where the source is `string`; a tone outside the union → map or stop, RESHARD_NEEDED.
Out of scope: `my-actions-page.tsx` pill (done by S06-18), `empty`/`card` classes, `.pill` CSS (S12-32).

### Actions
1. Migrate the four hub files (map `acc`→`info` at my-day:895).
2. Migrate one-on-ones-views' ~13 sites + SLOT_TONES feed (narrow if needed).
3. Migrate tl-tasks + meetings + carried-review.
4. Add `Chip` imports where missing.
5. Typecheck.
6. Lint all eight files — zero `pill` warns.

### Done when
- `grep -rEn 'className=[^>]*\bpill' src/features/cx-hub src/features/cx-people/` -> zero hits (excl. `pw-chip`/suffixed names).

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-hub/components/ src/features/cx-people/components/` -> no `pill` loser warnings; `npx vitest run tests/golden/hub.test.ts tests/golden/people.test.ts` -> pass.

### Handoff
Completes pill for hub+people. Write results/S12-28.md (<=10 lines); TL alone updates TRACKER.md.

## S12-29: `pill*` → `Chip` — cx-quality call sites
Kind: mini
ID: S12-29
Parent: S12
Owner: dev
Depends: S12-24, S12-25
Status: resharded — S12-08 residual (warn-family backlog: pill family, quality slice)
Criteria: ST-H2 / SH-L2 warn-family migration (pill)
Skills: none
Budget: files=4; actions=4; changed_lines=15; minutes=5

### Goal
Every `pill`/`pill <tone>` className token in the listed cx-quality files renders through `Chip`.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | :322 (`pill${cls}` → `status={cls}` + narrow `cls` to `ChipStatus`)
- Edit: `src/features/cx-quality/components/qa-forms-page.tsx` | :439,:441
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | :797,:987
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | :250 (`pill warn` + `title` — move `title` onto `<Chip>`)

### Context
- `src/features/shared/components/ui/Chip.tsx` | props (HTMLAttributes spread — `title`/`className` pass through)
- `src/app/styles/quality.css:234` | `.qa-card--strip .cx-chip` already co-styled — visual continuity expected

### Contract
Same mapping as S12-28 (tone→status, `no-dot`→`plain`, `acc`→`info`); `title=`/`className=` extras pass through ChipProps' rest spread.
Out of scope: `card`/`empty` classes, `.pill` CSS (S12-32).

### Actions
1. Migrate audit-queue :322 + narrow the `cls` feed.
2. Migrate qa-forms :439/:441 + qa-shared :797/:987.
3. Migrate quality-scores :250 (keep `title=`).
4. Typecheck + lint — zero `pill` warns.

### Done when
- `grep -rEn 'className=[^>]*\bpill' src/features/cx-quality/` -> zero hits.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-quality/components/` -> no `pill` loser warnings; `npx vitest run tests/golden/quality.test.ts` -> pass.

### Handoff
Completes pill for quality. Write results/S12-29.md (<=10 lines); TL alone updates TRACKER.md.

## S12-30: `pill*` → `Chip` — desk + queue + productivity + operations call sites
Kind: mini
ID: S12-30
Parent: S12
Owner: dev
Depends: S12-26, S12-33
Status: resharded — S12-08 residual (warn-family backlog: pill family, remaining-areas slice)
Criteria: ST-H2 / SH-L2 warn-family migration (pill)
Skills: none
Budget: files=9; actions=6; changed_lines=40; minutes=8

### Goal
Every `pill`/`pill <tone>` className token in cx-desk, cx-queue, cx-productivity and cx-operations components renders through `Chip` — completing the family.

### Files
- Edit: `src/features/cx-desk/components/kpi-logs-page.tsx` | :216,:281,:355
- Edit: `src/features/cx-desk/components/kb-tracker-page.tsx` | :221,:223,:225,:228
- Edit: `src/features/cx-queue/components/aging-page.tsx` | :220
- Edit: `src/features/cx-queue/components/queue-page.tsx` | :271,:368 (incl. `no-dot` → `plain`)
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | :52 (helper emits `pill ${tone}` → `status={tone}` + narrow)
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | :147,:211
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | :220
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | :173
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | :735 (`trk-outside pill info` + `data-status` → `<Chip status="info" className="trk-outside">`)

### Context
- `src/features/shared/components/ui/Chip.tsx` | props (`className` merges via `cx`)
- `src/features/cx-queue/components/scheduler-page.tsx:42-52` | the `pill`-emitting helper (tone union fits ChipStatus)

### Contract
Same mapping as S12-28; sibling classes (`trk-outside`, `wi-side` hooks) pass via `className`.
Out of scope: `card`/`empty` classes, `.pill` CSS (S12-32), `dq-*` classes (S12-31 map → reshard).

### Actions
1. Migrate desk files.
2. Migrate queue files (aging, queue-page, scheduler helper, checkins).
3. Migrate my-status + productivity-analytics + trackers.
4. Add `Chip` imports where missing.
5. Typecheck.
6. Lint all nine files — zero `pill` warns; whole family at 0 users.

### Done when
- `grep -rEn 'className=[^>]*\bpill' src/features/` -> zero hits (excl. suffixed names like `pw-chip`/`hm-chip`/`trk-chip`).

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-desk src/features/cx-queue src/features/cx-productivity src/features/cx-operations` -> no `pill` loser warnings; `npx vitest run tests/golden/queue.test.ts tests/golden/productivity.test.ts` -> pass.

### Handoff
Completes pill area-wide. Write results/S12-30.md (<=10 lines); TL alone updates TRACKER.md.

## S12-31: `dq-*` canonical map — read-only discovery leaf
Kind: mini
ID: S12-31
Parent: S12
Owner: dev
Depends: none
Status: resharded — S12-08 residual (dq-* consolidation needs a target map before bounded migration leaves can be written)
Criteria: ST-H2 / SH-L2 warn-family migration (dq-* — mapping phase)
Skills: none
Budget: files=1; actions=3; changed_lines=80; minutes=9

### Goal
Produce `results/dq-map.md`: the definitive per-class table of every live `dq-*` token, its users, its owning CSS rule, and its canonical verdict — so migration leaves can be specced without re-discovery.

### Files
- Create: `specs/ux-ui-audit-v2/results/dq-map.md` | the map (table: class → files:lines → refresh.css rule → verdict)

### Context
- `src/app/refresh.css:542-605` | the `dq-*` rule block (64 rules)
- `eslint.config.mjs:7` | `dq-` warn pattern — `dq-needs|clear|spark|pct` already deleted/error-gated
- `specs/ux-ui-audit-v2/results/dead-css-sweep.md` §Follow-up | "dq-* consolidation×18 files" brief
- Users (grep `dq-` className tokens): cx-queue (analytics-page ×32, overview… verify), cx-hub overview/hub-shared/people-holidays, cx-people agents-page/my-actions, cx-quality analytics/audit-queue/qa-forms/qa-shared, cx-productivity (status-validation/tph-grid/my-status), queue shared.tsx — confirm the live list while mapping

### Contract
For each `dq-*` class with ≥1 user record one verdict: `cx-* equivalent` (name it — e.g. `dq-totals`→candidate `cx-panel`/`dq-page`→`cxp` already co-emitted), `keep-documented` (area skin worth exempting like `qa-*`/`tph-*`), or `migrate-then-delete`. Group the file by verdict; end with a proposed leaf split (≤10 files each).
Out of scope: any source/CSS edit, the migration itself, `.dq-*` rule deletion.

### Actions
1. Grep `dq-[\w-]+` className tokens across `src/**` (exclude `dq-needs|clear|spark|pct`); build the user list.
2. Match each class to its refresh.css rule + decide the verdict per contract.
3. Write `results/dq-map.md` with the table + proposed leaf split.

### Done when
- Every live `dq-*` class appears in the map with a verdict; proposed children ≤10 files each.

### Verify
- Run: `grep -rEno 'dq-[a-z][\w-]*' src/features --include=*.tsx | sort -u` -> every listed class exists in the map.

### Handoff
PM sends this spec + the map back to spec-architect (RESHARD S12-DQ) to enumerate the migration leaves; `dq-*` stays warn-gated until they land. Write results/S12-31.md (<=10 lines); TL alone updates TRACKER.md.

## S12-32: loser-rule deletion — refresh.css `.empty`/`.card*`/`.pill`/`.tag`/`.tbl`/`.seg`/`.page-sub` + eslint ratchet
Kind: mini
ID: S12-32
Parent: S12
Owner: dev
Depends: S12-17, S12-22, S12-23, S12-24, S12-25, S12-26, S12-33, S12-28, S12-29, S12-30, DQ-6
Status: resharded — S12-08 residual (final CSS deletion + gate flip); +DQ-6 — refresh.css writer order S12-15→DQ-4→DQ-5→DQ-6→S12-32
Criteria: ST-H1 + ST-H2 (deletion + enforcement for migrated families)
Skills: none
Budget: files=2; actions=4; changed_lines=90; minutes=8

### Goal
Delete the now-userless loser rules from refresh.css and flip `empty|card|pill` warn→error in the eslint gate — the family's closing step.

### Files
- Edit: `src/app/refresh.css` | :25-28 `.page-sub`, :58-65 `.empty` block, :156-166 `.card`/`card-pad`/`card-head`/`card-title`/`card-hint`, :233-259 `.pill` block, :261-266 `.tag`, :268-310 remaining `.tbl` base/`th`/`td`/`tbody`/hover/`.seg` rules (the `:282-294` descendants were retargeted by S12-15), :430 `.md .card` — delete all
- Edit: `eslint.config.mjs` | :7-8 — move `empty|card|pill` from `warnLosers` to `errorLosers`

### Context
- `src/app/refresh.css:282-294` | post-S12-15 state — `.cx-table`-scoped retargets must SURVIVE; delete only `.tbl`-scoped selectors
- `eslint.config.mjs:5-8` | same alternation shape as S12-17
- `specs/ux-ui-audit-v2/results/dead-css-sweep.md` | `cx-sr`/`sr-only`/`dq-*` deliberately stay warn

### Contract
Delete ONLY selectors whose every part is a migrated loser class; any compound rule whose non-loser descendant is still live (a `.card`-scoped rule matching real markup) → retarget to `.cx-panel` scope instead of deleting, and note it in results.
Out of scope: `.pw-dialog` (S12-16 done), `dq-*`/`cx-sr`/`sr-only` (stays warn), `.login-card`/`.qa-card`/`tph-card` (not losers), area stylesheets.

### Actions
1. Re-grep each family token in `src/**` — if ANY user remains, skip that family's deletion and note it (do NOT pad the leaf).
2. Delete the refresh.css blocks per contract (keep `.cx-table` retargets).
3. Move `empty|card|pill` to `errorLosers`.
4. `npx eslint .` — 0 errors, warn count drops; spot-check a migrated page renders (build or targeted vitest).

### Done when
- `grep -n '\.empty\b\|\.card\b\|\.pill\b\|\.tag\b\|\.tbl\b\|\.seg\b\|\.page-sub\b' src/app/refresh.css` -> zero hits; eslint gates the families as errors.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint . --quiet` -> 0 errors.

### Handoff
Warn-family program closed except `dq-*` (DQ-7 closes it — eslint ratchet Depends on this leaf) and the deliberate `cx-sr`/`sr-only` keep. Write results/S12-32.md (<=10 lines); TL alone updates TRACKER.md.

## S12-33: `card*` → `cx-panel`/`cx-section__*` — productivity + operations call sites (S12-27 re-shard)
Kind: mini
ID: S12-33
Parent: S12
Owner: dev
Depends: S12-15, S12-21, S13-08, S12-11
Status: resharded — S12-08 residual via superseded S12-27 (card family, remaining-areas slice; corrected file map + `card--flat` resolved as documented area skin)
Criteria: ST-H2 / SH-L2 warn-family migration (card)
Skills: none
Budget: files=6; actions=6; changed_lines=80; minutes=10

### Goal
Every `card`/`card-*` className token in cx-productivity and cx-operations components moves to `cx-panel` + `cx-section__*` — completing the family area-wide. (`auth`/`PageStates.tsx` needed nothing: login :83 is exempt `login-card`, PageStates' hit is a comment.)

### Files
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | 21 sites (:134-325 — `card`/`card-head`/`card-title` h2s with inline `margin:0`/`card-hint`/`card-pad`)
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | 13 sites (:122-134 `pv-detail card`+head/title/hint/`card-pad`; :161-163 `card card--flat`; :357-359; :420; :463 `card cx-tablewrap`)
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | 4 sites (:597-603 section/head/title/hint — NOT `tph-grid-page.tsx`, which has zero `card` hits)
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | 13 sites (:166-275; :21 hit is a comment)
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | 4 sites (:405 `trk-dialog card`, :577 `trk-form card`, :653 `trk-create card`, :705 `trk-table-wrap card`; :274 hit is a comment)
- Edit: `src/app/styles/productivity.css` | :232 `h2.card-title` → `h2.cx-section__title`; :233 `.card--flat` → `.pv-card--flat`

### Context
- `src/app/cx-kit.css:524-547` | `.cx-panel`/`cx-panel--pad`/`cx-section__*` — canonical surface classes
- `src/features/cx-productivity/components/tph-grid-views.tsx:943` | `cx-panel cx-panel--pad tph-card` precedent — surface canonical + `-card`-suffixed area skin co-existing
- `src/app/refresh.css:156-166` | the `.card*` rules being vacated (deletion = S12-32)
- `src/app/styles/productivity.css:232-233` | the only two `.card*` selectors in the sheet — retarget, don't delete; every other `card`-named rule is `pv-cards`/`tph-card*` (exempt)
- `src/app/styles/operations.css:28` | `trk-form`/`trk-create`/`trk-dialog` already carry their own surface chrome — `card` was redundant surface; `cx-panel` keeps identical semantics

### Contract
Same five-class mapping as S12-22: `card`→`cx-panel`; `card-pad`→`cx-panel--pad` (`card card-pad` on one element → `cx-panel cx-panel--pad`; a standalone `card-pad` div → `cx-panel--pad` alone); `card-head`/`card-title`/`card-hint`→`cx-section__head`/`__title`/`__hint` — same elements/tags, classes only.
`card--flat` resolution (DECISION B documented-raw-class contract): `card card--flat` → `cx-panel pv-card--flat` — the flat variant becomes a `-card`-suffixed productivity area skin (same pattern as `tph-card`/`qa-card`/`login-card`, and `pv-` is this area's prefix: `pv-detail`/`pv-wyc`/`pv-cards`); the paired productivity.css selector retargets `.card--flat`→`.pv-card--flat` so the `box-shadow:none`+`margin-block-end` styling follows, and `h2.card-title`→`h2.cx-section__title` keeps migrated h2 titles margin-free. Both CSS retargets ride in THIS leaf (same-file writer — no extra serialization hop).
Co-classes pass through untouched: `pv-detail`, `cx-tablewrap`, `trk-dialog`, `trk-form`, `trk-create`, `trk-table-wrap`, `pv-wyc`, `small`, `muted`. `-card`-suffixed names (`tph-card`, `pv-cards`, `login-card`) untouched. Any OTHER unmapped `card-*` variant → stop, RESHARD_NEEDED.
Out of scope: `pill`/`empty`/`dq-*` classes (S12-21 done / S12-30 / DQ-2 next), `.card*` rules in refresh.css (S12-32), structural JSX changes.

### Actions
1. Migrate productivity-analytics' 21 sites.
2. Migrate status-validation's 13 sites (incl. `card card--flat` → `cx-panel pv-card--flat` and `card cx-tablewrap` → `cx-panel cx-tablewrap`).
3. Migrate tph-grid-views' 4 sites + my-status' 13 sites.
4. Migrate trackers' 4 sites (`trk-* card` → `trk-* cx-panel`).
5. productivity.css: retarget `h2.card-title`→`h2.cx-section__title` (:232) and `.card--flat`→`.pv-card--flat` (:233).
6. Typecheck + lint the five component files — zero `card` warns.

### Done when
- `grep -rEn 'className="[^"]*\bcard' src/features/cx-productivity src/features/cx-operations src/app/auth` -> only `-card`-suffixed names (`tph-card`, `pv-cards`, `login-card`, `trk-*`, `pv-card--flat`) remain; whole `card` family at 0 users.
- `grep -n 'card' src/app/styles/productivity.css` -> only `pv-cards`/`tph-card*`/`pv-card--flat` selectors.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-productivity/components/ src/features/cx-operations/components/` -> no `card` loser warnings; `npx vitest run tests/golden/productivity.test.ts` -> pass.

### Handoff
my-status/trackers/productivity-analytics/status-validation → S12-30 (pill) then DQ-2 (`dq-page`). `pv-card--flat` is a documented keep (area skin, warn-exempt like `tph-card`); refresh.css `.card*` deletion stays S12-32's. Write results/S12-33.md (<=10 lines); TL alone updates TRACKER.md.

## S12-DQ: `dq-*` warn-family consolidation — PACKAGE NOTE (never dispatchable)
Kind: package
ID: S12-DQ
Parent: S12
Owner: -
Depends: S12-31
Status: resharded — S12-08 residual; children DQ-1..DQ-7 specced per results/dq-map.md (S12-31 done, verified)
Criteria: ST-H2 / SH-L2 (dq-* consolidation ×18 files)
Dispatch: NEVER — package note; dispatch only the DQ-* leaves below.

### Children (map verdicts → leaves; same-file writers serialized via Depends)
| ID | Owner | Depends | Map scope | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| DQ-1 | dev | S12-23, S12-28 | `dq-page`→`page`: hub+people ×4 | 4/5/7/5 |
| DQ-2 | dev | S12-33, S12-29, S12-30 | `dq-page`→`page`: productivity+quality ×7 | 7/6/9/6 |
| DQ-3 | dev | S12-16, S12-30 | `dq-page`→`page` queue ×3 + dead `dq-help` + orphan `.dq-head*` CSS | 4/7/25/7 |
| DQ-4 | dev | DQ-1, DQ-3, S12-15, S12-24 | shared-helper `dq-*`→`cx-*` (totals/stats/stat/agebar/rowhead/sub/groupbreak/statusline/correct) + refresh.css rules | 7/8/110/10 |
| DQ-5 | dev | DQ-4, S12-26 | queue-analytics `dq-*`→`cx-*` (~30 sites) + refresh.css rules; `dq-split`→`cx-chsplit` | 2/7/170/10 |
| DQ-6 | dev | DQ-5 | `dq-refresh`→`cx-refresh` ×2 + comment + refresh.css rule | 3/4/8/4 |
| DQ-7 | dev | DQ-2, DQ-6, S12-32 | keep-documented exemption + `dq-*` warn→error ratchet + `.page,.dq-page` selector collapse | 3/5/18/6 |

### Contract
Deviations from the raw map proposal (coverage/completeness fixes, all bounds kept): quality-analytics-page's `dq-totals*` sites join DQ-4 (proposal listed only overview); queue-page's `dq-agebar`/`dq-groupbreak` join DQ-4 so every markup rename lands with its CSS rule in the same leaf; the shared.tsx:4 comment cleanup rides with DQ-6's `dq-refresh` rename (one write, no serialization hop); `dq-split`→`cx-chsplit` NOT `cx-split` (`.cx-split` is the live 2-col layout class, cx-kit.css:567 — the map's name would collide); the `.page,.dq-page`→`.page` selector simplification waits in DQ-7 until every `dq-page` markup user is gone (grep-gated). refresh.css writer order: S12-15 → DQ-4 → DQ-5 → DQ-6 → S12-32 (Depends updated). eslint.config.mjs order: S12-17 → S12-32 → DQ-7. `dq-editor`/`dq-editor__actions`/`dq-days`/`dq-holform` are documented keeps — markup untouched, exempted in DQ-7 like `qa-*`/`tph-*`.
Out of scope: `cx-sr`/`sr-only` (deliberate keep per dead-css-sweep §Surviving), `dq-needs|clear|spark|pct` (already error-gated, untouched), `.trk-table` block at refresh.css:603+ (NOT a dq-* rule — never rename).

## DQ-1: `dq-page` → `page` token swap — hub + cx-people pages
Kind: mini
ID: DQ-1
Parent: S12-DQ
Owner: dev
Depends: S12-23, S12-28
Status: resharded — S12-08 residual (dq-* warn family; per results/dq-map.md split)
Criteria: ST-H2 / SH-L2 (dq-page → `.page`, map row 1)
Skills: none
Budget: files=4; actions=4; changed_lines=7; minutes=5

### Goal
The four hub/people `cxp dq-page` shell sections emit `cxp page` — the canonical class the cx-kit `.page,.dq-page` selectors already pair (zero visual change; the unstyled `cxp` hook stays).

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | :430 `cxp dq-page`→`cxp page`; :4 header comment `dq-page`→`page`
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | :254 `cxp dq-page`→`cxp page`
- Edit: `src/features/cx-people/components/agents-page.tsx` | :566 `cxp dq-page`→`cxp page`
- Edit: `src/features/cx-people/components/my-actions-page.tsx` | :129 `cxp dq-page`→`cxp page`

### Context
- `specs/ux-ui-audit-v2/results/dq-map.md` | verdict: `dq-page` is always co-emitted with the unstyled `cxp` hook; `.page,.dq-page` selectors already style both names
- `src/app/cx-kit.css:1514` | `.page,.dq-page{inline-size:100%;max-width:var(--page-max);margin-inline:auto}` — canonical pair

### Contract
Replace ONLY the `dq-page` token with `page` inside the existing className; `cxp` and every sibling token/attribute stay verbatim. overview :4 comment updated for grep-cleanliness. Lines are map-era numbers — grep-verify `dq-page` before each edit.
Out of scope: other `dq-*` tokens in these files (DQ-4), `dq-editor`/`dq-days`/`dq-holform` in people-holidays (documented keeps — never touch), `.page,.dq-page` CSS simplification (DQ-7).

### Actions
1. Swap `dq-page`→`page` at the four className sites; update the overview :4 comment.
2. `grep -rn 'dq-page'` on the four files → zero hits.
3. Typecheck.
4. Lint the four files → no `dq-page` warns.

### Done when
- Zero `dq-page` tokens in the four files; sections render the same `.page` styles.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-hub/components/overview-page.tsx src/features/cx-hub/components/people-holidays-page.tsx src/features/cx-people/components/agents-page.tsx src/features/cx-people/components/my-actions-page.tsx` -> no `dq-page` loser warnings.
- Run: `npx vitest run tests/golden/hub-overview.test.ts tests/golden/hub-people-holidays.test.ts tests/golden/people.test.ts` -> pass.

### Handoff
overview/people-holidays/agents serialize onward to DQ-4 (markup + refresh.css renames). Write results/DQ-1.md (<=10 lines); TL alone updates TRACKER.md.

## DQ-2: `dq-page` → `page` token swap — productivity + quality pages
Kind: mini
ID: DQ-2
Parent: S12-DQ
Owner: dev
Depends: S12-33, S12-29, S12-30
Status: resharded — S12-08 residual (dq-* warn family; per results/dq-map.md split)
Criteria: ST-H2 / SH-L2 (dq-page → `.page`, map row 1)
Skills: none
Budget: files=7; actions=4; changed_lines=9; minutes=6

### Goal
The seven productivity/quality `cxp dq-page` shell sections emit `cxp page` — same token-only swap as DQ-1, zero visual change.

### Files
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | :86
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | :119
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | :320
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | :222
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | :202
- Edit: `src/features/cx-quality/components/qa-forms-page.tsx` | :364
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | :141

### Context
- `specs/ux-ui-audit-v2/results/dq-map.md` | same `cxp dq-page` → `cxp page` contract as DQ-1
- `src/app/cx-kit.css:1514` | the `.page,.dq-page` paired rule

### Contract
Identical to DQ-1: replace only the `dq-page` token; `cxp` + siblings verbatim. Grep-verify before each edit (line numbers drift).
Out of scope: all other classes/tokens in these files (other families' leaves own them; `card`/`pill` migrations are predecessors already depended on), CSS edits.

### Actions
1. Swap `dq-page`→`page` at the seven className sites.
2. `grep -rn 'dq-page'` on the seven files → zero hits.
3. Typecheck.
4. Lint the seven files → no `dq-page` warns.

### Done when
- Zero `dq-page` tokens in the seven files.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-productivity/components/my-status-page.tsx src/features/cx-productivity/components/productivity-analytics-page.tsx src/features/cx-productivity/components/status-validation-page.tsx src/features/cx-productivity/components/tph-grid-page.tsx src/features/cx-quality/components/audit-queue-page.tsx src/features/cx-quality/components/qa-forms-page.tsx src/features/cx-quality/components/qa-shared.tsx` -> no `dq-page` loser warnings.
- Run: `npx vitest run tests/golden/quality.test.ts tests/golden/productivity.test.ts` -> pass.

### Handoff
These files need no further dq-* work — they are free. Write results/DQ-2.md (<=10 lines); TL alone updates TRACKER.md.

## DQ-3: queue `dq-page` → `page` + dead `dq-help` tokens + orphan `.dq-head*` CSS
Kind: mini
ID: DQ-3
Parent: S12-DQ
Owner: dev
Depends: S12-16, S12-30
Status: resharded — S12-08 residual (dq-* warn family; per results/dq-map.md split)
Criteria: ST-H2 / SH-L2 (dq-page/dq-help/dq-head — map rows 1-3)
Skills: none
Budget: files=4; actions=5; changed_lines=25; minutes=7

### Goal
Queue's three `dq-page` shells emit `page` (queue-page:392 is the ONLY site with no `cxp` hook — bare `dq-page`→`page`); the two unstyled `dq-help` spans in aging lose the token; the three orphan `.dq-head*` rules (zero markup users — the name survives only in a comment DQ-6 cleans) leave cx-kit.css.

### Files
- Edit: `src/features/cx-queue/components/aging-page.tsx` | :107 `cxp dq-page`→`cxp page`; :25 + :36 — delete the `className="dq-help"` attribute (plain inert span stays)
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | :107 `cxp dq-page`→`cxp page`
- Edit: `src/features/cx-queue/components/queue-page.tsx` | :392 `dq-page`→`page` (bare — no `cxp` here)
- Edit: `src/app/cx-kit.css` | :1188-1197 — delete `.dq-head` (:1188-1195), `.dq-head .page-purpose` (:1196), `.dq-head__aside` (:1197); grep-verify first

### Context
- `specs/ux-ui-audit-v2/results/dq-map.md` | verdicts: `dq-help` has NO css rule (unstyled wrapper); `.dq-head*` rules are orphans (comment-only user at cx-queue/shared.tsx:4)
- `src/features/cx-queue/components/shared.tsx:4` | the comment mentioning `dq-head` — DQ-6 cleans it when renaming `dq-refresh`; do NOT edit shared.tsx here
- `src/app/cx-kit.css:1514,:1534-1540` | `.page,.dq-page` selectors — kept here; DQ-7 collapses them

### Contract
`dq-page`→`page` per DQ-1's contract (queue-page is the bare-token case — `className="dq-page"`→`className="page"`). `dq-help`: drop the attribute only (`<span>` stays — deterministic, zero risk). `.dq-head*` deletion is grep-gated: `grep -rn 'dq-head' src/features --include=*.tsx` must show only the shared.tsx:4 comment BEFORE deleting — any markup user → stop, RESHARD_NEEDED.
Out of scope: `.page,.dq-page` selectors (DQ-7), `dq-agebar`/`dq-groupbreak`/`dq-statusline`/`dq-correct` in queue-page/checkins (DQ-4), analytics-page (DQ-5), refresh.css.

### Actions
1. aging: `:107` swap; delete `className="dq-help"` at :25 and :36 (attribute only).
2. checkins `:107` + queue-page `:392` swaps.
3. Run the `dq-head` markup grep — expect the comment hit only; then delete the three cx-kit rules.
4. `grep -rn 'dq-page\|dq-help'` on the three tsx files → zero.
5. Typecheck + lint.

### Done when
- Zero `dq-page`/`dq-help` tokens in the three files; `grep -n 'dq-head' src/app/cx-kit.css` → zero hits; `.page` styles unchanged.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-queue/components/aging-page.tsx src/features/cx-queue/components/checkins-page.tsx src/features/cx-queue/components/queue-page.tsx` -> no dq-page/dq-help loser warnings.
- Run: `npx vitest run tests/golden/queue.test.ts` -> pass.

### Handoff
queue-page/checkins serialize onward to DQ-4; cx-kit.css to DQ-7. Write results/DQ-3.md (<=10 lines); TL alone updates TRACKER.md.

## DQ-4: shared-helper `dq-*` → `cx-*` renames + refresh.css rules
Kind: mini
ID: DQ-4
Parent: S12-DQ
Owner: dev
Depends: DQ-1, DQ-3, S12-15, S12-24
Status: resharded — S12-08 residual (dq-* warn family; per results/dq-map.md split; coverage widened to quality-analytics + queue-page per the map's own user lists)
Criteria: ST-H2 / SH-L2 (dq-totals*/dq-stats/dq-stat*/dq-agebar/dq-rowhead/dq-sub/dq-groupbreak/dq-statusline/dq-correct → cx-*)
Skills: none
Budget: files=7; actions=8; changed_lines=110; minutes=10

### Goal
The nine shared-helper `dq-*` families become `cx-*` in markup AND in refresh.css atomically: `dq-totals`/`__item`→`cx-totals`/`__item`, `dq-stats`→`cx-stats`, `dq-stat`(+`__label`/`__row`/`__value`/`__delta`)→`cx-stat*`, `dq-agebar`→`cx-agebar`, `dq-rowhead`→`cx-rowhead`, `dq-sub`→`cx-sub`, `dq-groupbreak`→`cx-groupbreak`, `dq-statusline`→`cx-statusline`, `dq-correct`→`cx-correct` — pure token renames, no structural/visual change.

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | :151,153 (totals), :165,168(comment),171,176,177,178,182 (stat*), :197 (agebar, keep `cc-sweep-bar`), :334 (groupbreak), :341 (rowhead), :351 (statusline)
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | :55,57,84,91,102,109,120,130,569,570,577,585 (`dq-totals`/`__item` only)
- Edit: `src/features/cx-hub/components/people-holidays-page.tsx` | :333 (rowhead), :335,:343,:358 (`cx-faint dq-sub`→`cx-faint cx-sub`)
- Edit: `src/features/cx-people/components/agents-page.tsx` | :379,:731,:860 (rowhead); :74,:124,:128,:132,:136,:384,:390,:399,:752 (`dq-sub`; keep `cx-hint`/`cx-faint`)
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | :148,:211 (statusline); :153,:154,:184,:185 (`dq-correct` + its `kept raw:` comments)
- Edit: `src/features/cx-queue/components/queue-page.tsx` | :110 (comment),:115 (agebar, keep `cc-sweep-bar`), :319 (groupbreak)
- Edit: `src/app/refresh.css` | rename in place: :539,542-556,599 (totals*/statusline/stats/stat*), :558-562 (agebar/rowhead/sub/correct), :602 (groupbreak) — same lines, `dq-`→`cx-` prefix only

### Context
- `specs/ux-ui-audit-v2/results/dq-map.md` | the class→file:line→rule→verdict table this leaf executes verbatim
- `src/app/refresh.css:539-602` | the dq rule block — rename ONLY the listed selectors; `.dq-editor`/`__actions`/`.dq-days`/`.dq-holform` (:594-598,:600) and `.dq-refresh` (:541) and the analytics family (:563-593,:601) are NOT this leaf's
- `eslint.config.mjs:7` | `dq-` warn pattern — renamed tokens produce zero warns

### Contract
Mechanical `dq-X`→`cx-X` per the map's rename column — same declarations, same order, `:root` prefix kept. `kept raw:`/eslint-disable comments that name `dq-*` get the new `cx-` name in their text (they remain valid — the primitives stay raw classes). Co-emitted classes (`cc-sweep-bar`, `cx-num`, `cx-faint`, `cx-hint`, `card*`) never touched. Any `dq-*` token found outside the listed sites in these files → stop, RESHARD_NEEDED.
Out of scope: analytics family + `dq-refresh` + `dq-page` (DQ-5/DQ-6/DQ-1-3), keep-documented `dq-editor`/`dq-days`/`dq-holform` markup+rules (DQ-7 exempts), `.trk-table` block (:603+).

### Actions
1. overview-page.tsx: rename the 13 markup sites + :168 disable comment.
2. quality-analytics-page.tsx: rename the 12 `dq-totals`/`__item` sites.
3. people-holidays-page.tsx: rename 4 sites (NOT the keeps).
4. agents-page.tsx: rename the 12 sites.
5. checkins-page.tsx: rename the 6 sites + comment mentions.
6. queue-page.tsx: rename 3 sites.
7. refresh.css: rename the ~24 selectors per Contract (verify each against the map before editing).
8. Typecheck + lint the seven files → zero `dq-` warns on the renamed families.

### Done when
- `grep -rEno 'dq-(totals|stats|stat|agebar|rowhead|sub|groupbreak|statusline|correct)[\w-]*' src/` → zero hits; refresh.css shows the matching `cx-*` rules.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-hub/components/overview-page.tsx src/features/cx-hub/components/people-holidays-page.tsx src/features/cx-people/components/agents-page.tsx src/features/cx-quality/components/quality-analytics-page.tsx src/features/cx-queue/components/checkins-page.tsx src/features/cx-queue/components/queue-page.tsx` -> no warns on the nine renamed families.
- Run: `npx vitest run tests/golden/hub-overview.test.ts tests/golden/hub-people-holidays.test.ts tests/golden/people.test.ts tests/golden/quality.test.ts tests/golden/queue.test.ts` -> pass.

### Handoff
refresh.css serializes onward to DQ-5 (analytics family) → DQ-6 → S12-32. Write results/DQ-4.md (<=10 lines); TL alone updates TRACKER.md.

## DQ-5: queue-analytics `dq-*` → `cx-*` family rename + refresh.css rules
Kind: mini
ID: DQ-5
Parent: S12-DQ
Owner: dev
Depends: DQ-4, S12-26
Status: resharded — S12-08 residual (dq-* warn family; per results/dq-map.md split)
Criteria: ST-H2 / SH-L2 (queue-analytics skin — chart*/ch*/headline*/split/legend/rank*/crumb/countries/details/dq-page)
Skills: none
Budget: files=2; actions=5; changed_lines=170; minutes=10

### Goal
cx-queue/analytics-page's bespoke skin (~32 `dq-*` tokens) becomes `cx-*` in markup and refresh.css atomically — EXCEPT `dq-split`→`cx-chsplit` (`.cx-split` is the live 2-col layout class at cx-kit.css:567 — the map's `cx-split` name would collide and restyle the element as a grid split). Its `dq-page` at :318 also swaps to `page` per DQ-1's contract.

### Files
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | ~30 sites :101-391: chartwrap :101; chart :103; chart__grid :112; chart__axis :113,:159; `dq-ch dq-ch--${J}` :155 + `dq-ch dq-ch--${y}` :369,:374; rank family :172(comment),197,198,215-216(comment+`cx-chip dq-rank__chip`),228,234,235,236,239,240,246,249-250(comment+row); crumb :202-203; dq-page :318; countries :344 (keep `cx-fieldset`); headline :354,:355,:358; split :368 (keep `cc-sweep-bar`); legend :371; details :391 (keep `card`)
- Edit: `src/app/refresh.css` | rename in place: :540 (details summary), :563-566 (chartwrap/chart/__grid/__axis), :567-569 (`dq-ch--call/chat/escalation`→`cx-ch--*`), :570-572 (headline*), :573-574 (`dq-split`/`i`→`cx-chsplit`/`i`), :575-587 + :589 media (rank*), :588 (crumb), :590-591 (legend*), :592-593 (countries*), :601 media (headline)

### Context
- `specs/ux-ui-audit-v2/results/dq-map.md` | the family table this leaf executes (analytics-page-only skin)
- `src/app/cx-kit.css:567-568` | `.cx-split`/`.cx-split--narrow` — the collision `cx-chsplit` avoids
- `eslint.config.mjs:7` | `dq-` warn pattern — renames zero its hits

### Contract
Mechanical `dq-X`→`cx-X` per map EXCEPT `dq-split`→`cx-chsplit`. `kept raw:` comments (:172,:202,:215,:249) get the new `cx-` names in their text. Co-emitted `card`/`cx-chip`/`cx-fieldset`/`cx-num`/`cx-faint`/`cc-chart`/`cc-sweep-bar`/`cxp` tokens stay verbatim. Template literal prefixes `dq-ch--${…}` → `cx-ch--${…}` — same template shape. Any `dq-*` token beyond the listed sites → stop, RESHARD_NEEDED.
Out of scope: the `card`/`card-pad` classes on the same elements (S12-26's — a Depends predecessor), keep-documented editor rules (:594-598,:600), `dq-refresh` (:541 — DQ-6), `.trk-table` (:603+).

### Actions
1. analytics-page: rename all ~30 markup/comment sites per Contract (dq-page→page at :318 last).
2. refresh.css: rename the ~30 selectors per Contract (`dq-split`→`cx-chsplit`).
3. `grep -rEno 'dq-[a-z][\w-]*' src/features/cx-queue/components/analytics-page.tsx` → zero hits.
4. `grep -n 'dq-'` refresh.css → only `dq-refresh` (:541) + the four keep-documented names (:594-598,:600).
5. Typecheck + lint → zero `dq-` warns on the file.

### Done when
- analytics-page has zero `dq-*` tokens; refresh.css carries the matching `cx-*` rules; `.dq-split` is gone and no `.cx-split` rule got repurposed.

### Verify
- Run: `npx tsc --noEmit` -> clean.
- Run: `npx eslint src/features/cx-queue/components/analytics-page.tsx` -> no `dq-` loser warnings.
- Run: `npx vitest run tests/golden/queue.test.ts` -> pass.

### Handoff
refresh.css serializes to DQ-6 (dq-refresh) then S12-32. Write results/DQ-5.md (<=10 lines); TL alone updates TRACKER.md.

## DQ-6: `dq-refresh` → `cx-refresh` — shared refresh-controls widget rename
Kind: mini
ID: DQ-6
Parent: S12-DQ
Owner: dev
Depends: DQ-5
Status: resharded — S12-08 residual (dq-* warn family; per results/dq-map.md split)
Criteria: ST-H2 / SH-L2 (dq-refresh → cx-refresh, map verdict)
Skills: none
Budget: files=3; actions=4; changed_lines=8; minutes=4

### Goal
The two-consumer refresh-controls span class becomes `cx-refresh` in both emitters and its refresh.css rule; the stale shared.tsx:4 header comment stops naming both dead families in one write.

### Files
- Edit: `src/features/cx-hub/components/hub-shared.tsx` | :573 `className="dq-refresh"`→`"cx-refresh"`
- Edit: `src/features/cx-queue/components/shared.tsx` | :388 `className="dq-refresh"`→`"cx-refresh"`; :4 comment `dq-head, cx-chip, cx-agechip, dq-refresh,` → `cx-chip, cx-agechip, cx-refresh,`
- Edit: `src/app/refresh.css` | :541 `:root .dq-refresh{...}` → `:root .cx-refresh{...}`

### Context
- `specs/ux-ui-audit-v2/results/dq-map.md` | verdict: rename; shared widget, 2 consumers
- `src/features/cx-queue/components/shared.tsx:4` | the comment lists `dq-head` (orphan rules DQ-3 deleted) + `dq-refresh` — both names die here

### Contract
Token rename only; span markup/children untouched. The :4 comment update removes the `dq-head` mention too (DQ-3 deleted its rules — this is the single write the package note chose over a serial second edit).
Out of scope: any other `dq-*` token, component props/logic.

### Actions
1. Rename the two className sites + the :4 comment.
2. Rename the refresh.css :541 selector.
3. `grep -rn 'dq-refresh\|dq-head' src/` → zero hits anywhere.
4. Typecheck + lint the two files → zero `dq-refresh` warns.

### Done when
- `dq-refresh`/`dq-head` appear nowhere in `src/`; `.cx-refresh` rule exists.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx eslint src/features/cx-hub/components/hub-shared.tsx src/features/cx-queue/components/shared.tsx` -> no `dq-refresh` warnings; `npx vitest run tests/golden/queue.test.ts tests/golden/hub-overview.test.ts` -> pass.

### Handoff
refresh.css free for S12-32 (its Depends updated). Write results/DQ-6.md (<=10 lines); TL alone updates TRACKER.md.

## DQ-7: `dq-*` closing gate — keep-documented exemption + warn→error ratchet + `.page,.dq-page` collapse
Kind: mini
ID: DQ-7
Parent: S12-DQ
Owner: dev
Depends: DQ-2, DQ-6, S12-32
Status: resharded — S12-08 residual (dq-* final lint ratchet; analogous to S12-17)
Criteria: ST-H1 + ST-H2 (dq-* enforcement close — DECISION B loser-family gate)
Skills: none
Budget: files=3; actions=5; changed_lines=18; minutes=6

### Goal
The `dq-*` family closes like S12-17's: every remaining `dq-*` className token lints as ERROR except the four documented keeps (`dq-editor`, `dq-editor__actions`, `dq-days`, `dq-holform` — people-holidays editor skin, exempt like `qa-*`/`tph-*`); the now-userless `.dq-page` selector half collapses out of cx-kit; refresh.css's dq block header documents the keeps.

### Files
- Edit: `eslint.config.mjs` | :7 warnLosers — delete the whole `dq-(?!(?:needs|clear|spark|pct)…)[\w-]+` alternative; :8 errorLosers — replace the `dq-(?:needs|clear|spark|pct)(?:-[\w-]+|__(?:line|goal))?` alternative with `dq-(?!(?:editor|days|holform)(?:-[\w-]+|__[\w-]+)?${end})[\w-]+` + comment citing `results/dq-map.md` keep-documented verdict
- Edit: `src/app/cx-kit.css` | :1514 `.page,.dq-page`→`.page`; :1534 `:is(.page,.dq-page)>*`→`:is(.page)>*`; :1535-1540 six `:is(.page,.dq-page)>`→`:is(.page)>`
- Edit: `src/app/refresh.css` | :538 block header comment — append one line: the `.dq-editor`/`.dq-editor__actions`/`.dq-days`/`.dq-holform` rules below are documented keeps (people-holidays editor skin); the rest of the family was renamed `cx-*` per results/dq-map.md

### Context
- `eslint.config.mjs:5-8` | `boundary`/`end` construction — keep the exact alternation shape (S12-17 precedent)
- `specs/ux-ui-audit-v2/results/dq-map.md` | verdicts the ratchet encodes
- `src/features/cx-hub/components/people-holidays-page.tsx:135,:175,:198,:417` | the four keeps' live markup users — must produce ZERO findings after the edit

### Contract
After the edit: any `dq-*` className token EXCEPT the four keeps lints ERROR (this also re-covers the already-gated `dq-needs|clear|spark|pct` — the new lookahead exempts only editor/days/holform forms); the keeps match neither regex (exempt, not merely warn). `.dq-page` selector collapse is grep-gated: run the Verify markup grep FIRST — any `dq-page` user outside comments → stop, RESHARD_NEEDED. No other rule/file changes.
Out of scope: fixing surfaced violations (none expected — DQ-1..6 cleared them), `cx-sr`/`sr-only` (stay warn), deletion of the keep rules.

### Actions
1. Run the markup grep — expect ONLY `dq-editor`/`dq-editor__actions`/`dq-days`/`dq-holform` hits in people-holidays-page.tsx; any other `dq-*` token → stop, RESHARD_NEEDED.
2. eslint.config.mjs: edit the two patterns per Contract; add the keep-documented comment.
3. cx-kit.css: collapse the eight `.dq-page` selector mentions.
4. refresh.css: append the keep-documented header line.
5. `npx eslint .` — 0 errors; people-holidays shows no dq finding.

### Done when
- `grep -rEno 'dq-[a-z][\w-]*' src/ --include=*.tsx` → only the four keeps; `grep -n 'dq-page' src/app/cx-kit.css` → zero; `npx eslint . --quiet` → 0 errors; dq-* warns = 0.

### Verify
- Run: `grep -rEno 'dq-[a-z][\w-]*' src/features src/app --include=*.tsx` -> only `dq-editor`/`dq-editor__actions`/`dq-days`/`dq-holform`.
- Run: `npx eslint src/features/cx-hub/components/people-holidays-page.tsx` -> zero dq findings; `npx eslint . --quiet` -> 0 errors.
- Run: `npx tsc --noEmit` -> clean.

### Handoff
Warn-family program fully closed — every loser family is error-gated or documented-exempt. Write results/DQ-7.md (<=10 lines) incl. final dq warn/error counts; TL alone updates TRACKER.md.

## S14-06: /tph route wiring — render `TphGridPage` directly (break the self-redirect loop)
Kind: mini
ID: S14-06
Parent: S14
Owner: dev
Depends: S13-04
Status: resharded — S14-01 residual (route-wiring half); spec+config work kept (evidence results/S14-01.md)
Criteria: S14-01 unblocker — /tph must render for the PaintGrid e2e (SH-M5 proof); pre-existing app bug, not audit scope
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=1; actions=3; changed_lines=15; minutes=4

### Goal
`/tph` renders the TPH grid page instead of re-exporting `/tph-grid`'s `redirect('/tph')` — a self-redirect loop so the route never renders. `src/app/tph/page.tsx` becomes a thin route entry identical in shape to its cx-productivity siblings.

### Files
- Edit: `src/app/tph/page.tsx` | whole file (6 lines → thin route entry)

### Context
- `src/app/tph/page.tsx` | current `export { default } from '../tph-grid/page'` imports the redirect — the loop
- `src/app/tph-grid/page.tsx` | `redirect('/tph')` — FOREIGN dirty-tree edit (user/earlier agent): do NOT touch or revert; it becomes the correct legacy-URL→canonical redirect once /tph renders
- `src/app/status-validation/page.tsx` | sibling convention to copy verbatim (named import + productivity.css side-effect import + default `Page`)
- `src/features/cx-productivity/components/tph-grid-page.tsx:1,:1988` | `'use client'` + `export function TphGridPage()` — S13-04 (serializes before this leaf) keeps this export in place per its stable-exports contract

### Contract
Final shape mirrors status-validation/page.tsx: header comment (registry path is `tph`; `/tph-grid` redirects here); `import { TphGridPage } from '@/features/cx-productivity/components/tph-grid-page'`; `import '@/app/styles/productivity.css'`; `export default function Page() { return <TphGridPage /> }`. First grep `export.*TphGridPage` under `src/features/cx-productivity/components/` — if the S13-04 split moved it, import from the file that exports it (expected: tph-grid-page.tsx unchanged).
Out of scope: `src/app/tph-grid/page.tsx` (keep redirect verbatim — foreign edit), `tph-grid-page.tsx` itself (S13-04 owns edits), route registry (`tph` already canonical), tests.

### Actions
1. `grep -rn "export.*TphGridPage" src/features/cx-productivity/components/` → confirm the export's file post-S13-04.
2. Rewrite `src/app/tph/page.tsx` per Contract.
3. `npx tsc --noEmit`.

### Done when
- `/tph`'s module renders `TphGridPage` (no redirect in its graph); `/tph-grid`'s redirect intact; tsc clean.

### Verify
- Run: `npx tsc --noEmit` -> clean; `grep -n "redirect('/tph')" src/app/tph-grid/page.tsx` -> redirect untouched; `grep -n "TphGridPage" src/app/tph/page.tsx` -> present.

### Handoff
Unblocks S14-07 (PaintGrid e2e re-run — spec already written at tests/e2e/a11y-keyboard.spec.ts). Write results/S14-06.md (<=10 lines); TL alone updates TRACKER.md.

## S14-07: e2e re-run — `a11y-keyboard.spec.ts` after the /tph route fix (PaintGrid journey)
Kind: mini
ID: S14-07
Parent: S14
Owner: dev
Depends: S14-06
Status: resharded — S14-01 residual (verification half); spec file + playwright.config.ts kept (evidence results/S14-01.md)
Criteria: S14-01 completion — Tabs/PaintGrid/focus-restore e2e proof (SH-M5)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\webapp-testing\SKILL.md
Budget: files=1; actions=2; changed_lines=10; minutes=8

### Goal
Re-run the already-written `tests/e2e/a11y-keyboard.spec.ts` (3 specs — S14-01's kept work) now that /tph renders: all three pass, including the PaintGrid journey on `/tph?tab=grid` that the redirect loop blocked.

### Files
- Create: `specs/ux-ui-audit-v2/logs/s14-07-e2e.log` | playwright output (heavy output → log + bounded tail)

### Context
- `tests/e2e/a11y-keyboard.spec.ts` | the spec under test — ALREADY CORRECT per results/S14-01.md handoff (?tab=grid + aria-busy waits); do NOT edit assertions
- `specs/ux-ui-audit-v2/results/S14-01.md` | prior run: Tabs + palette-focus specs PASSED; PaintGrid failed only on the route bug
- `specs/ux-ui-audit-v2/logs/s14-01-e2e.log` | the blocked run's evidence

### Contract
Zero source/test edits — this leaf is a verification re-run only. A PaintGrid-spec failure that is NOT the fixed route bug → stop and report a RESHARD_NEEDED-style handback; never weaken waits or assertions to pass.
Out of scope: editing tests or app code, running the full e2e suite (Phase F gate), route fixes (S14-06 did them).

### Actions
1. Run the spec file per Verify (same command as the S14-01 run — dev-server/seed handling already proven).
2. Tail the log; confirm 3 passed. On failure: classify (route bug still present vs new defect) and report — no edits.

### Done when
- All 3 specs pass — Tabs roving model, PaintGrid on /tph?tab=grid, palette focus restore.

### Verify
- Run: `npx playwright test tests/e2e/a11y-keyboard.spec.ts --project=chromium > specs/ux-ui-audit-v2/logs/s14-07-e2e.log 2>&1; tail -15 specs/ux-ui-audit-v2/logs/s14-07-e2e.log` -> "3 passed".

### Handoff
Closes the S14-01 residual — S14's e2e keyboard coverage complete. Write results/S14-07.md (<=10 lines); TL alone updates TRACKER.md.

## S13-08: `React.memo` on the post-split hot row/cell renderers (PERF-3)
Kind: mini
ID: S13-08
Parent: S13
Owner: dev
Depends: S13-03, S13-04, S13-05
Status: resharded — S13-07 residual; S13-07 made no edits (SCOPE_REQUEST, evidence results/S13-07.md). Files retargeted from the page files to the siblings the splits created; kpi-logs-page.tsx + queue-page.tsx dropped (not named in perf-3)
Criteria: PERF-3 (memo half)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\react-best-practices\SKILL.md
Budget: files=5; actions=7; changed_lines=140; minutes=8

### Goal
Memoize the leaf row/cell renderers the perf audit measured as hot — audit-queue list rows, tph-grid matrix cells + view list items, one-on-ones list items — now that they live in the split sibling modules: `memo()` on the row/cell components + `useMemo` on the derived collections they map over, so a keystroke/filter/dialog state change skips unchanged rows.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-detail.tsx` | row renderers inside `RequestedAudits`/`NonTicketAudits`/`OffQueueAudits` maps
- Edit: `src/features/cx-quality/components/audit-queue-coverage.tsx` | WeekCoverage per-agent day-cell renderer
- Edit: `src/features/cx-productivity/components/tph-grid-matrix.tsx` | `Cs` agents-by-hour day-cell/row renderer
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | hot `.map` row items inside the tab views (Xa/Es/Ts/As/Rs/Os/Ds) — rows only, not the views
- Edit: `src/features/cx-people/components/one-on-ones-views.tsx` | list-item renderers inside `BookedDue`/`LogTab`/`Records` data maps

### Context
- `specs/ux-ui-audit-v2/reports/audit-perf.md` perf-3 (~:59-65) | measured hot paths + fix pattern: "wrap row/cell renderers in `React.memo`; move derived collections into `useMemo`"
- `specs/ux-ui-audit-v2/results/S13-07.md` | which components live in which file now + the two dropped files
- `specs/ux-ui-audit-v2/results/S13-04.md` + `results/S13-05.md` | split maps — component names/locations per sibling
- `src/features/cx-quality/components/audit-queue-page.tsx:338,372-390,558` | page→sibling call sites — check prop stability before memoizing a boundary component

### Contract
`memo()` only on leaf row/cell/item renderers inside the listed files (no memo on whole views, admin panels, or dialogs). Every memo'd child must actually win: derived arrays/objects feeding its `.map` go into `useMemo` at their owner in the same file; in-file parents pass callbacks via `useCallback`. Page files are NOT editable — a page→sibling boundary component (e.g., `AuditEntry`, `Es`, `BookedDue`) gets `memo` only if every prop from the page is already stable; otherwise leave it un-memoized and record why in results. No behavior/prop/visual change.
Out of scope: the three `*-page.tsx` files, `one-on-ones-api.ts`/`one-on-ones-helpers.ts`/`tph-grid-shared.ts`/`audit-queue-helpers.ts`, kpi-logs/queue/quality-analytics/ecosystem files, context/store splits, useMemo-everything sweeps.

### Actions
1. audit-queue-detail.tsx: `useMemo` the filtered row collections (`r.apply(d.requests)`, `u.apply(rows)`, the off-queue `u.map` source) at their owners; extract each list's row body into a `memo()` row component (share one if shapes match); `useCallback` the row-level callbacks.
2. audit-queue-coverage.tsx: `useMemo` WeekCoverage's `p`/`n.apply(c)` derivations; extract + memo the per-agent coverage row/cell renderer.
3. tph-grid-matrix.tsx: extract + memo the per-agent day-cell/row renderer used by `Cs`'s `dayCell` map; `useMemo` its derived input.
4. tph-grid-views.tsx: memo the hot `.map` row items inside the tab views where they iterate data rows (skip one-off/static blocks); `useMemo` the collections iterated.
5. one-on-ones-views.tsx: memo the list-item renderers inside the `BookedDue`/`LogTab`/`Records` data maps; `useMemo` the collections iterated.
6. Boundary sweep: memo a page→sibling component only where all page props are already stable (`<WeekCoverage d={s} />`-style); record every skip + reason.
7. Typecheck + area golden tests.

### Done when
- Each of the 5 files has >=1 memo'd row/cell renderer on the audit's hot paths; no memo outside them.
- Every memo'd component's props verified stable or stabilized in-file (no fresh-closure/fresh-array props into memo children).
- Page-boundary skips documented in results; kpi-logs/queue files untouched.
- `npx tsc --noEmit` clean; area goldens pass.

### Verify
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/golden/quality.test.ts tests/golden/productivity.test.ts tests/golden/people.test.ts` -> pass; `grep -c "memo(" src/features/cx-quality/components/audit-queue-detail.tsx src/features/cx-quality/components/audit-queue-coverage.tsx src/features/cx-productivity/components/tph-grid-matrix.tsx src/features/cx-productivity/components/tph-grid-views.tsx src/features/cx-people/components/one-on-ones-views.tsx` -> >=1 each.

### Handoff
Closes the PERF-3 memo half (S13 complete). Write results/S13-08.md (<=10 lines) listing memoized components + boundary skips; TL alone updates TRACKER.md.

## ux1-01: `.cx-panel > .cx-section__head` CSS contract — restore card-head padding + divider (ux-1 MED)
Kind: mini
ID: ux1-01
Parent: ux-yours-1 (MED ux-1, reports/ux-yours-1.md)
Owner: dev
Depends: DQ-3
Status: ready — gate fix; spec decision = report option (a) CSS-contract patch, NOT (b) DOM restructure (~50 sites, >10 files — exceeds leaf caps; DECISION additive-first)
Criteria: PLAN #5 ux gate — `card-head`→`cx-section__head` codemod contract dropped `.card-head`'s padding + border-bottom on ~50 `cx-panel > cx-section__head` sites
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=4

### Goal
One additive rule in `src/app/cx-kit.css` gives a `cx-section__head` that is a direct child of `cx-panel` the `.card-head` chrome the verbatim class-swap dropped: content padding + bottom divider. Zero markup edits — all ~50 migrated sites heal at the CSS contract, and canonical `cx-section` patterns (head OUTSIDE the panel) are unaffected because the selector requires direct-child-of-panel.

### Files
- Edit: `src/app/cx-kit.css` | insert one rule immediately after `:root .cx-section__hint` (:547), before the `:root .cxp-fold` block — inside the "Panels, sections, folds, grids" section it completes

### Context
- `src/app/refresh.css:161-164` | `.card-head` = `padding:.9rem 1.25rem; border-bottom:1px solid var(--cx-line)` — the dropped chrome (rule stays live until S12-32 deletes it)
- `src/app/cx-kit.css:524-547` | `.cx-panel`/`--pad`/`.cx-section__*` — neither `.cx-panel` nor `.cx-section__head` carries padding today
- `src/features/cx-hub/components/my-day-page.tsx:351-358` | the affected shape: `section.cx-panel` > `.cx-section__head` + `.cx-panel--pad` body — head text flush to panel edge, no divider
- `src/features/cx-hub/components/overview-page.tsx:274-282` + `src/features/cx-quality/components/qa-shared.tsx:167-168` (`QaSection`) | canonical sibling pattern: head inside `cx-section`, OUTSIDE the panel — the `>` selector leaves it untouched
- `specs/ux-ui-audit-v2/reports/ux-yours-1.md` ux-1 row | the ~50-site evidence list + the option-(a) rule this leaf executes verbatim

### Contract
Insert exactly:

```css
:root .cx-panel > .cx-section__head {
  padding: var(--cx-space-3) var(--cx-space-4);
  border-block-end: 1px solid var(--cx-line);
}
```

Exact-string anchor — the existing pair `:root .cx-section__hint { font-size: var(--cx-text-xs); color: var(--cx-ink-2); }` (blank) `:root .cxp-fold { min-width: 0; }` gains the new rule between them. Tokens: `--cx-space-3` (.75rem) block / `--cx-space-4` (1rem) inline aligns head text with `cx-panel--pad` bodies (1rem — the same canonical step-down from card-pad's 1.25rem the reviewer already PASSed); `border-block-end` = house logical-prop style. No `:first-child`/`:not()` qualifier — `.card-head` carried its chrome at ANY position inside `.card`, so the unqualified descendant rule stays faithful to pre-migration rendering (including the rare `cx-panel--pad` parent case).
Out of scope: ANY markup/`.tsx` edit (restructure to `cx-section` = rejected option (b)); `.cx-panel`/`.cx-section__*` base rules; `.card*` rules in refresh.css (S12-32 owns their deletion); ux-2 `.cx-empty` + ux-3 `.trk-outside` LOW findings (explicitly deferred per FIX rules); area stylesheets (quality.css:178 `.cx-btn` tweak is unrelated).

### Actions
1. Pre-edit grep: `grep -rn "cx-section__head" src/app/*.css src/app/styles/` — expect only the `:534` base rule + quality.css:178 `.cx-btn` margin; any competing padding/border rule on `.cx-panel`-scoped `__head` → stop, RESHARD_NEEDED.
2. cx-kit.css: insert the rule per Contract (exact-string anchor on the `:547`/`:549` pair).
3. Run Verify.

### Done when
- `grep -n "cx-panel > .cx-section__head" src/app/cx-kit.css` -> exactly one rule block with both declarations, sitting between `.cx-section__hint` and `.cxp-fold`.
- `.cx-section__head` base rule (:534) untouched; zero `.tsx` or other-stylesheet edits.
- Targeted goldens pass (markup regression net — CSS-only change).

### Verify
- Run: `grep -n "cx-panel > .cx-section__head" src/app/cx-kit.css` -> one match.
- Run: `npx tsc --noEmit` -> clean; `npx vitest run tests/golden/hub-overview.test.ts tests/golden/quality.test.ts` -> pass.

### Handoff
Closes the only open blocker in reports/ux-yours-1.md (ux-1 MED); ux re-review should spot-render a migrated panel (e.g. `/my-day` MailCard :351) for the restored head padding + divider. cx-kit.css writer order: DQ-3 -> ux1-01 -> DQ-7 (this insert shifts DQ-7's :1514/:1534-1540 refs ~+4 lines — its spec is grep-gated). Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.
