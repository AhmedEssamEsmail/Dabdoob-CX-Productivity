# ux report - qa-active-toggle - round 3 (DELTA)

Verdict: FAIL
Open: 0B/0H/1M/4L

Scope reviewed: only the ux-6 FIX delta (tl-3 changed UI files): `audit-queue-page.tsx` (`formDirty`/`pendingAct` state :147-148, gated `onChange` :257-265, `ConfirmInline` :273-286, `onDirtyChange` :425, `y()` reset :160), `qa-shared.tsx` (`AuditForm` `onDirtyChange` prop :712-729, dirty `useMemo` :778-784, report/cleanup effect :785-792), `audit-queue-coverage.tsx` (`AuditEntry` forwards :172-253). Test file not a UI surface. Consistency spec: the form's own cancel confirm (`qa-shared.tsx:1006-1016`) and shared `ConfirmInline`/`Seg`.

**ux-6 (MED) — RESOLVED.** `onChange` no longer calls `p(null)`; clean/absent path keeps `setActMode`+`c()` so the `_`-lookup collapses only rows that left the filter (:263-264). Dirty path sets `pendingAct` and renders the same `ConfirmInline` copy as the form's own cancel (:275-276 vs `qa-shared.tsx:1008-1009`) — identical wording, same danger+quiet button pair. Seg is controlled (`checked={value===option.value}`, Seg.tsx:39), so the radio truthfully stays on the current mode while pending. Keyboard arrow-commit now lands on a focus-managed confirm (heading autofocus, `ConfirmInline.tsx:31-33`) instead of instant discard. Dirty lift is sound: `useMemo` dirty predicate shared with `I()`; effect reports transitions and cleanup fires `onDirtyChange(false)` on unmount — covers submit (`:422`) and cancel (`:413`) `p(null)` paths. Gates green (tsc, 14/14 vitest).

States checked: loading/empty/error/disabled/dark/targets unchanged from ux-2 (no new styles; shared `cx-confirm`/`cx-seg` tokens); confirm-in-aside wraps inside `.page-actions` flex-wrap (320px unverified live, unlikely overflow); keyboard (radio group + confirm buttons reachable); focus-on-mount ✓, focus-restore ✗ (ux-11).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-9 | MED | `audit-queue-page.tsx:153-171` + `audit-queue-coverage.tsx:184` | `y()` still bypasses the gate: with a dirty audit open, clicking `Start audit` on another workitem (or a requested/off-queue row via `onStart={y}` :451/:459 — rows are not `disabled` while one is open, :377) runs `P.startAudit` then `p({queueId:B})` with no confirm — the same silent discard ux-6 removed from the toggle. Worse, the new `setFormDirty(false)` (:160) desyncs: neither `AuditEntry` nor `AuditForm` is keyed, so no remount, the cleanup never fires, and `useState` answers/comment/reasons from A persist onto B's form while `prevDirty===dirty` suppresses re-report → `formDirty=false` on a dirty form → the toggle gate is defeated again. | In `y()`: if `l && formDirty` (any `w`, incl. same-id restart), show the same `ConfirmInline` and call `P.startAudit` only on confirm. Add `key={l.queueId}` on `<AuditEntry>` (:407) so a confirmed switch mounts a clean form — this also fixes the stale-answer carry-over, and lets you drop the manual `setFormDirty(false)` (unmount cleanup resets). | dev |
| ux-10 | L | `audit-queue-page.tsx:273-286` | `pendingAct` confirm can dangle: submit or form-cancel while it's showing unmounts the form but leaves the stale "Leave this audit?" panel (confirm then performs the pending switch — harmless but dead copy; cancel just dismisses). | Clear `setPendingAct(null)` in `onSubmitted`/`onCancel`, or render it only when `l && pendingAct`. | dev |
| ux-11 | L | `audit-queue-page.tsx:284` + `ConfirmInline.tsx:31-33` | On Cancel the confirm unmounts and focus falls to `<body>` — the radio the user arrowed from is not refocused. Matches existing ConfirmInline convention (form's own confirm does the same), so log-only, but the keyboard path now hits it on every arrow press while dirty. | Optional: on `onCancel`, restore focus to the `qa-queue-active` checked radio (keep the invoker in a ref like `qaInvoker`). | dev |

Carried open lows: ux-7 (`aria-label="Show agents"` rename, deferred), ux-8 (optional `actMode` lift, deferred). App-wide ux-3/ux-4/ux-5 from ux-1 unchanged.

Not verified / assumptions:
- No live run: 320/375/1024px, focus-not-obscured (2.4.11), e2e `page-contract` still deferred to QA's e2e pass.
- `onRemoved` (:452/:460) also `p(null)`s a dirty open form when its row is deleted, but the row is gone server-side so the audit is moot — pre-existing, logged not raised.
- `calibration-page.tsx:293` uses `AuditForm` without `onDirtyChange` — optional prop, that page has no toggle; unaffected.
- Assumes StrictMode-safe cleanup is acceptable: cleanup fires `onDirtyChange(false)` on each dep change, always followed by the effect's own report — order keeps `formDirty` correct.
