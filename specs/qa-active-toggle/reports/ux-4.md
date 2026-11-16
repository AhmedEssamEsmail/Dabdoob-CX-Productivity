# ux report - qa-active-toggle - round 4 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/5L

Scope reviewed: only the ux-9 FIX delta (tl-4 changed UI files): `audit-queue-page.tsx` (`pendingStart` state :149, `start(w)` extraction :154-169, gated `y()` :170-179, second `ConfirmInline` :299-314, `<AuditEntry key={l!.queueId}>` :436, `qaInvoker` capture :171-172 + focus restore on form-cancel :443-447). Test file not a UI surface. Verified against `qa-shared.tsx` dirty-report effect :778-792 and shared `ConfirmInline`. Web Interface Guidelines re-checked on the delta — no new markup/styles; destructive action now confirmed per guidelines.

**ux-9 (MED) — RESOLVED.**
- Gate: `y()` :173-177 routes every dirty `l && formDirty` start — workitem row :406, `RequestedAudits`/`NonTicketAudits`/`OffQueueAudits` `onStart={y}` :473/:480/:488, and same-id restart — into `pendingStart` instead of `P.startAudit`. `startAudit` fires only on confirm (:303-307); cancel keeps the open audit (:309-312).
- Copy identical to the ux-6 confirm (:301-302 vs :284-285 vs form's own cancel `qa-shared.tsx:1008-1009`) — same `cx-confirm` danger+quiet pair, heading autofocus (`ConfirmInline.tsx:31-33`).
- Key: `<AuditEntry key={l!.queueId}>` :436 — a confirmed cross-item switch remounts `AuditForm` with fresh `useState` answers/comment/reasons (:732-738).
- Desync gone: `start()` no longer calls `setFormDirty(false)`; `setFormDirty` is now wired only via `onDirtyChange` :454. On key-remount the old form's cleanup fires `onDirtyChange(false)` (`qa-shared.tsx:791`) and the new mount reports its own clean state — `formDirty` can no longer lie about a dirty form.
- Mutual exclusion: `pendingAct`/`pendingStart` clear each other on set, confirm and cancel (:175, :269, :288-296, :305-312) — the two confirms can never stack.
- Bonus: `qaInvoker` is now captured in `y()` (:171-172) and focus is restored to the invoking row (or `qq-h` fallback) on form cancel (:443-448) — partial ux-11 improvement.
- Gates green per tl-4 (tsc exit 0, 16/16 vitest incl. 3 new dirty-gate tests, eslint exit 0).

States checked: loading/empty/error/disabled/dark/targets unchanged from ux-2/ux-3 (no new styles; shared `cx-confirm` tokens); keyboard (workitem buttons + confirm reachable, heading autofocus on mount ✓); focus-restore on form-cancel now ✓ for start-invoked entries.

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|----|-----|-----------|----------|-----------|------------|
| ux-12 | L | `audit-queue-page.tsx:436` + `:303-307` | Same-id restart corner: confirming "Leave without saving" on the *same* queueId re-runs `P.startAudit` but `key` is unchanged → no remount → prior answers/comment persist and `formDirty` stays true. Harmless (nothing is lost — the gate keeps working), but contradicts the confirm copy and the "Started" timestamp quietly refreshes. | Optional: key on `l!.queueId + l!.startedAt`, or pass a `resetKey` so a confirmed same-id restart remounts clean. | dev |
| ux-10 | L | `audit-queue-page.tsx:282-314` | Still open, now applies to *both* confirms: submit or form-cancel while `pendingAct`/`pendingStart` shows unmounts the form but leaves the stale "Leave this audit?" panel; a dirty→clean transition while pending leaves dead copy too (confirm then performs the pending action harmlessly). | Clear both pending states in `onSubmitted`/`onCancel`, or render each only when `l && formDirty`. | dev |
| ux-11 | L | `audit-queue-page.tsx:309-312` + `ConfirmInline.tsx:31-33` | Partially improved (form-cancel now restores to `qaInvoker`), but the confirms' own `onCancel` still drops focus to `<body>` — the workitem/Start button or Seg radio the user came from is not refocused. | Optional: on each confirm `onCancel`, focus `qaInvoker.current` if connected (radio case needs the invoker captured in Seg `onChange` too). | dev |

Carried open lows: ux-7 (`aria-label="Show agents"` rename, deferred), ux-8 (optional `actMode` lift, deferred). App-wide ux-3/ux-4/ux-5 from ux-1 unchanged.

Not verified / assumptions:
- No live run: 320/375/1024px layout, focus-not-obscured (2.4.11), e2e `page-contract` still deferred to QA's e2e pass.
- `onRemoved` (:481/:489) still `p(null)`s a dirty open form when its row is deleted — pre-existing, moot server-side, logged not raised.
- Second `ConfirmInline` wraps inside `.page-actions` flex-wrap like the first — assumed fine, unverified live.
- `calibration-page.tsx` `AuditForm` has no `onDirtyChange`/toggle — unaffected.
