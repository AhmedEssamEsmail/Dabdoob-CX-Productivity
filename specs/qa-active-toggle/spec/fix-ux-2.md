# fix-ux-2: qa-active-toggle ux round-2 FIX leaves

Source report: `specs/qa-active-toggle/reports/ux-2.md` (verdict FAIL).
Blocking findings mapped: ux-6 (MED) -> `ux2-01`.
Deferred (LOW, not dispatched): ux-7 (aria-label rename across 3 Segs),
ux-8 (log-only `actMode` lift to `AuditQueueRoute`).

## Children
| ID | Owner | Depends | Finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| ux2-01 | dev | none (S03 verified) | ux-6 — `qa-queue-active` Seg `onChange` calls `p(null)` unconditionally, silently discarding a mounted AuditForm | 4/6/150/10 |

## ux2-01: Gate the qa-queue-active toggle behind the open audit's dirty state
Kind: mini
ID: ux2-01
Parent: S03 (verified; do not reopen)
Owner: dev
Depends: none
Criteria: ux-2.md finding ux-6 (MED) — surviving rows keep their open form; a row leaving the filtered set must not silently discard typed answers
Skills: none
Budget: files=4; actions=6; changed_lines=150; minutes=10

### Goal
Toggling the `qa-queue-active` Seg must never unconditionally unmount the open
`AuditEntry`/`AuditForm`. Clean/absent form -> apply the toggle and let the
refetched `_`-lookup collapse only a row that actually left the filtered set.
Dirty form -> gate the toggle behind a `ConfirmInline` (same copy as
AuditForm's own cancel confirm) instead of silently discarding.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | Seg onChange (:255-259), dirty tracking + pending-toggle state, ConfirmInline render
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | `AuditForm` (:701-786) — hoist dirty predicate, add optional `onDirtyChange` prop
- Edit: `src/features/cx-quality/components/audit-queue-coverage.tsx` | `AuditEntry` (:165-179) — forward `onDirtyChange`
- Edit: `tests/perf/audit-queue-memo.test.tsx` | regression tests in the existing stub-React harness

### Context
- `src/features/cx-quality/components/audit-queue-page.tsx:140-169,251-266` | `actMode`/`l`/`p` state, `y()` start flow, Seg `onChange` — remove `p(null)` at :257
- `src/features/cx-quality/components/audit-queue-page.tsx:174-182,386-417` | `_`-memo (`l.queueId` in `sRows`/`sRequests`) drives the `{_ && k ? AuditEntry : _ ? note : Empty}` chain; `onCancel`/`onSubmitted` at :392-404
- `src/features/cx-quality/components/qa-shared.tsx:701-728,776-786,992-1002` | `AuditForm` props (incl. `onCancel: i`), `I()` dirty-check -> `C2` confirm, `ConfirmInline` copy ("Leave this audit? Your answers are not saved and will be lost." / "Leave without saving")
- `src/features/cx-quality/components/audit-queue-coverage.tsx:164-180` | `AuditEntry` signature — verbatim entry block rendering `<AuditForm>`
- `tests/perf/audit-queue-memo.test.tsx:136-176,273-292,349-363` | ui mock barrel (add `ConfirmInline`), `findSeg` tree walker, existing `qa-queue-active` wiring describe; node env — no `document`/`requestAnimationFrame`/`HTMLElement` globals

### Contract
- `onChange` of `qa-queue-active` contains NO `p(null)`. Semantics:
  `l` unset OR form clean -> `setActMode(v)` + `c()` (unchanged reload path).
  `l` set AND dirty -> stash `v` in a pending-toggle state and render
  `ConfirmInline` inside the aside `.page-actions`; onConfirm -> clear pending,
  `p(null)`, `setActMode(pending)`, `c()`; onCancel -> clear pending only (the
  controlled Seg reverts to `actMode`; focus handling per existing Seg usage).
- `AuditForm` gains OPTIONAL `onDirtyChange?: (dirty: boolean) => void`. Hoist
  the `I()` predicate (any answer key differing between `u`/`r`, or comment
  `o.trim() !== ''`) into a memo `I()` reuses; fire `onDirtyChange` in a
  `useEffect` when it transitions. Optional prop -> `calibration-page.tsx` and
  other consumers unchanged.
- `AuditEntry` accepts and forwards `onDirtyChange` to `<AuditForm>`.
- Page keeps `formDirty` (ref or state) fed by the callback; it must be false
  whenever `l` is null — reset on every `p(null)` path (`onCancel`,
  `onSubmitted`, `onRemoved` x2, CTL `onDone` :584, the new confirm) and on
  `y()` re-open; a `useEffect` on `l` is acceptable.
- Import `ConfirmInline` from the existing shared barrel (`:20`); reuse the
  qa-shared confirm copy verbatim.
Out of scope: ux-7 (`aria-label` renames on any Seg), ux-8 (lifting `actMode`),
any other Seg/file, changing the `_`-lookup collapse itself, server files,
e2e specs. Everything not listed is forbidden.

### Actions
1. `qa-shared.tsx`: hoist `I()`'s dirty predicate into a `useMemo`; `I()` reuses it; add the optional prop + `useEffect` firing `onDirtyChange(dirty)` on transitions.
2. `audit-queue-coverage.tsx`: `AuditEntry` accepts optional `onDirtyChange` and forwards it.
3. `audit-queue-page.tsx`: add `formDirty` + `pendingAct` state; pass `onDirtyChange` to `<AuditEntry>`; keep `formDirty` false whenever `l` is null (Contract reset rules).
4. Same file: replace the Seg `onChange` body per Contract (no `p(null)`; dirty -> `setPendingAct(v)`, else `setActMode(v)` + `c()`).
5. Same file: render `ConfirmInline` in the aside `.page-actions` when `pendingAct` set, per Contract confirm/cancel semantics.
6. `tests/perf/audit-queue-memo.test.tsx`: add `ConfirmInline: 'confirm-inline'` to the ui mock; `vi.stubGlobal` for `document` (`{activeElement:null,getElementById:()=>null}`), `HTMLElement` (`class {}`), `requestAnimationFrame`; mock `P.startAudit` resolved; open the entry via an audits-stub's `props.onStart('q1')` + await the promise (fixture needs `forms:[{channel:'chat'}]` for `k`). New tests: (a) clean open entry survives `onChange('all')` — 'audit-entry' still rendered AND `P.queuePage` last arg `'all'`; (b) `audit-entry.props.onDirtyChange(true)` then `onChange('all')` -> 'confirm-inline' rendered, `P.queuePage` last arg still `'active'`; `onConfirm` -> `'all'` applied + entry gone; `onCancel` variant keeps `'active'` + entry. Run Verify; write `results/ux2-01.md`.

### Done when
- `qa-queue-active` `onChange` has no `p(null)`; dirty-open toggle shows `ConfirmInline` with the qa-shared copy; clean/absent path is `setActMode` + `c()` only.
- New tests (a) and (b) pass and would fail on the pre-fix `onChange` (unconditional `p(null)` discards the entry silently).
- `npx tsc --noEmit` exit 0; `npx eslint` on the 3 src files exit 0.
- `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` all pass (prior 10 included).
- `results/ux2-01.md` written (<=10 lines).

### Verify
- Run: `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` -> all pass.
- Run: `npx tsc --noEmit` -> exit 0.

### Handoff
Closes ux-6 if green; ux-7/ux-8 remain deferred LOW. Write results/ux2-01.md
(<=10 lines); TL alone updates TRACKER.md.
