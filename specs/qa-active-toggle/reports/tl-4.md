# tl-4: FIX round for ux-3 (qa-active-toggle)

Source report: `reports/ux-3.md` (FAIL; 0B/0H/1M/4L).
Fix spec created: `spec/fix-ux-3.md` — one leaf `ux3-01` (preflight PASS
structural + semantic: 2 files/5 actions/120 lines/10 min).

## Dispatched
| Leaf | Owner | Status |
|---|---|---|
| ux3-01 — route start-audit through the dirty gate + key AuditEntry by queueId (ux-9 MED) | dev | verified |

## Changed files (reviewer DELTA scope)
- `src/features/cx-quality/components/audit-queue-page.tsx` — `pendingStart`
  state; `y()` captures invoker then gates `l && formDirty` (any w, incl.
  same-id) into the shared `ConfirmInline`; start flow extracted to `start(w)`
  (no `setFormDirty(false)`); second `ConfirmInline` with identical copy;
  `pendingAct`/`pendingStart` mutually clear on set/cancel/confirm;
  `<AuditEntry key={l!.queueId}>` (:436) so a confirmed switch remounts a clean
  AuditForm and unmount cleanup resets `formDirty`.
- `tests/perf/audit-queue-memo.test.tsx` — new `start-audit dirty gate
  (ux3-01)` describe: (a) dirty onStart gated, `P.startAudit` not called until
  confirm -> called with 'q2'; (b) cancel keeps open audit, never calls
  startAudit; (c) clean entry starts immediately, no confirm.

## Findings disposition
- ux-9 (MED): RESOLVED by ux3-01.
- ux-10, ux-11 (LOW): deferred per FIX rules (with ux-7/ux-8).
- Reviewer-requested gates beyond scope: none.

## Gates (round 5, TL-run)
- `npx tsc --noEmit` -> exit 0 (logs/gate-tsc-r4.log)
- `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` -> 16/16 (logs/gate-vitest-r4.log)
- `npx eslint` on `audit-queue-page.tsx` -> exit 0 (logs/gate-eslint-r4.log)
- full unit / build / e2e / security: DEFERRED to PM gate — foreign in-flight
  streams still dirty the tree (see TRACKER baseline note).
