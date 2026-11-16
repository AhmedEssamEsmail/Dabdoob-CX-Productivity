# fix-ux-3: qa-active-toggle ux round-3 FIX leaves

Source report: `specs/qa-active-toggle/reports/ux-3.md` (verdict FAIL).
Blocking findings mapped: ux-9 (MED) -> `ux3-01`.
Deferred (LOW, not dispatched): ux-10 (stale pendingAct confirm after
submit/cancel), ux-11 (focus restore to `qa-queue-active` radio on cancel —
matches existing ConfirmInline convention, log-only).
Carried lows ux-7/ux-8 remain deferred.

## Children
| ID | Owner | Depends | Finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| ux3-01 | dev | ux2-01 (done) | ux-9 — `y()` start-audit bypasses the dirty gate; `setFormDirty(false)` desyncs because `AuditEntry`/`AuditForm` are not keyed | 2/5/120/10 |

## ux3-01: Route start-audit through the dirty gate and key AuditEntry by queueId
Kind: mini
ID: ux3-01
Parent: S03 (verified; do not reopen)
Owner: dev
Depends: ux2-01
Criteria: ux-3.md finding ux-9 (MED) — starting another audit while a dirty form is open must show the same discard confirm instead of silently dropping typed answers; a confirmed switch must mount a clean form
Skills: none
Budget: files=2; actions=5; changed_lines=120; minutes=10

### Goal
`y()` (the single `onStart`/workitem-click entry) currently calls
`P.startAudit` then `p({queueId})` unconditionally — silently discarding a
dirty open form, and its manual `setFormDirty(false)` desyncs because the
unkeyed `AuditEntry`/`AuditForm` never remounts (A's `useState` answers persist
onto B's form while `prevDirty===dirty` suppresses re-report, leaving
`formDirty=false` on a dirty form and defeating the ux-6 toggle gate).
Route start-audit through the same `ConfirmInline` gate as the toggle and key
`AuditEntry` so a confirmed switch mounts a clean form.

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | `y()`/state (:147-171), the pendingAct `ConfirmInline` render (:273-286), `<AuditEntry>` usage (:406-426)
- Edit: `tests/perf/audit-queue-memo.test.tsx` | new regression tests next to the existing `qa-queue-active toggle with open audit (ux2-01)` describe (:385-451)

### Context
- `audit-queue-page.tsx:139-171` | `l`/`p` open-audit state, `formDirty`/`setFormDirty`, `pendingAct`, `qaInvoker` ref, `y()` start flow (`r(w)` busyId, invoker capture, `P.startAudit`, `setFormDirty(false)` :160 to remove, `p({queueId,startedAt})`, raf focus)
- `audit-queue-page.tsx:273-286` | existing `pendingAct` `ConfirmInline` (copy: "Leave this audit? Your answers are not saved and will be lost." / "Leave without saving") — the render to extend
- `audit-queue-page.tsx:364-462` | `y()` call sites: workitem `onClick` :378, `onStart={y}` x3 (:444/:451/:459); `<AuditEntry>` usage :406-426 where the key goes
- `qa-shared.tsx:778-792` | `AuditForm` dirty memo + effect: reports `onDirtyChange(dirty)` only on transitions; cleanup fires `onDirtyChange?.(false)` on unmount — a keyed remount therefore resets `formDirty` by itself
- `tests/perf/audit-queue-memo.test.tsx:136-160,385-451` | ui mock barrel (`'confirm-inline'`, `'audit-entry'`), `P` mock, `openEntry()` helper, dirty-gate test pattern

### Contract
- `y(w)` captures `qaInvoker.current` as today, then: `l && formDirty` (ANY `w`,
  including same-id restart) -> stash the pending start (new `pendingStart`
  string state), clear `pendingAct`, and RETURN — no `r(w)` busy, no
  `P.startAudit` call. Otherwise run the existing start flow.
- Extract the existing start flow (busy `r(w)`, `P.startAudit(w).then(...)`,
  `p({queueId,startedAt})`, raf scroll/focus) into a helper `start(w)` the
  confirm handler can call. `P.startAudit` must NEVER run while a pending
  confirm is unresolved.
- Remove `setFormDirty(false)` from the start flow — the keyed remount's
  unmount cleanup resets `formDirty`.
- Render the SAME `ConfirmInline` (same label/confirmLabel copy as the
  pendingAct one) when `pendingStart` is set — at most one pending panel at a
  time: `onConfirm` clears both pending states then `start(pendingStart)`;
  `onCancel` clears both pending states (open audit and its answers untouched).
  Setting a new pending (either kind) clears the other.
- `<AuditEntry>` gets `key={l!.queueId}` so a confirmed switch to a different
  item remounts `AuditForm` (fresh `useState` answers/comment, unmount cleanup
  reports `formDirty=false`). A same-id confirm keeps the mounted form — its
  answers persist, matching that nothing was lost.
Out of scope: ux-10 (pendingAct dangling after submit/cancel), ux-11 (focus
restore on cancel), ux-7/ux-8, `onRemoved` `p(null)` (pre-existing, logged),
`calibration-page.tsx`, server files, e2e specs, any other component. Everything
not listed is forbidden.

### Actions
1. `audit-queue-page.tsx`: add `pendingStart` state; split `y()` into invoker capture + dirty gate + extracted `start(w)` per Contract; remove `setFormDirty(false)`.
2. Same file: render the shared `ConfirmInline` for `pendingStart` too, with the Contract confirm/cancel semantics and mutual clearing.
3. Same file: add `key={l!.queueId}` on `<AuditEntry>` (:407).
4. `tests/perf/audit-queue-memo.test.tsx`: in a new describe (reuse `openEntry()` + `vi.mocked(P.startAudit)` from the ux2-01 describe's beforeEach pattern — replicate the stubGlobal setup): (a) dirty open entry + `onStart('q2')` -> 'confirm-inline' rendered AND `P.startAudit` NOT called; `onConfirm` -> `P.startAudit` called with 'q2' and audit-entry re-renders; (b) `onCancel` variant -> `P.startAudit` never called, audit-entry still rendered, confirm panel gone; (c) clean open entry + `onStart('q2')` -> `P.startAudit` called immediately, no confirm-inline.
5. Run Verify; write `results/ux3-01.md`.

### Done when
- `y()`/`onStart` with `l && formDirty` does not call `P.startAudit` until the confirm's `onConfirm`; cancel keeps the open audit and dirty state untouched.
- `<AuditEntry>` is keyed by `l.queueId`; no `setFormDirty(false)` remains in the start flow.
- New tests (a)(b)(c) pass and fail on the pre-fix `y()` (unconditional `P.startAudit`).
- `npx tsc --noEmit` exit 0; `npx eslint` on `audit-queue-page.tsx` exit 0.
- `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` all pass (prior 14 included).

### Verify
- Run: `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` -> all pass.
- Run: `npx tsc --noEmit` -> exit 0.

### Handoff
Closes ux-9 if green; ux-10/ux-11 remain deferred LOW alongside ux-7/ux-8.
Write results/ux3-01.md (<=10 lines); TL alone updates TRACKER.md.
