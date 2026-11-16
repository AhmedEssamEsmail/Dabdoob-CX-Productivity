# fix-qa-2: qa-active-toggle round-2 FIX leaves

Source report: `specs/qa-active-toggle/reports/qa-2.md` (verdict FAIL).
Blocking findings mapped: qa-2-1 (MED) -> `qa2-01`.

## Children
| ID | Owner | Depends | Finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|
| qa2-01 | test-engineer | none (S03 verified) | qa-2-1 — zero regression coverage for `getQaQueuePage` active filter / quotaWeeks post-filter / fail-open / `qa-queue-active` Seg wiring | 2/5/400/10 |

## qa2-01: Regression tests for the S03 active filter + Seg wiring
Kind: mini
ID: qa2-01
Parent: S03 (verified; do not reopen)
Owner: test-engineer
Depends: none
Criteria: qa-2.md finding qa-2-1 (MED) — every covered behaviour must fail if the S03 code were reverted
Skills: none
Budget: files=2; actions=5; changed_lines=400; minutes=10

### Goal
Deterministic regression coverage for the S03 `/audit-queue` active toggle:
`getQaQueuePage` act filtering, the `quotaWeeks`/`quota` post-filter, the
fail-open path, the sentinel keep rule, and the `qa-queue-active` Seg ->
`P.queuePage(who, mode)` wiring. Test files only — no source edits.

### Files
- Create: `tests/perf/qa-queue-active.test.ts` | server-side `getQaQueuePage` active-filter regression suite
- Edit: `tests/perf/audit-queue-memo.test.tsx` | `useSe` stub must invoke (or capture) its loader arg (:163) + new `qa-queue-active` Seg describe block

### Context
- `src/features/cx-quality/lib/server.ts:616-722` | `qaQueuePageFor_` — `all` filter (:621), quotaWeeks `r.email` post-filter (:665), `quota: quotaWeeks[0].rows` (:679); `getQaQueuePage` computes `act` (:709): `'all'` -> null (unfiltered), else `qaActiveEmails_()`
- `src/features/cx-quality/lib/server.ts:1767-1804` | `qaActiveEmails_` — `dqReadHct_()` -> `readSheet`; null on throw/empty = fail-open; `cacheGet/Put('qa_hct_active', …, 600)` — `cacheClear()` between modes. `qaActiveKeep_` — blank/non-`'@'` keys (`'(no lead)'`) always kept
- `src/features/cx-hub/lib/roster.ts:60-75,175-179,271-287` | `dqReadHct_` projects sheet rows via `DQ_HCT_SHEET_TO_DB` (unmapped keys = lowercase header); `dqHctActive_` = `status 'current'` + `lwd` blank/`'-'`
- `tests/perf/qa-pushdown.test.ts:1-199` | copy this hoisted in-memory supabase double + `vi.mock` supabase/auth/engine + `seed()` roster/config pattern; its `readSheet` always throws — the new file needs it switchable (return rows OR throw)
- `tests/perf/audit-queue-memo.test.tsx:1-271` | React stub harness; `P.queuePage: vi.fn()` (:151) is passed to `useSe` (:163) which currently ignores the loader; `Seg` renders as `'seg'` element with `props.name`/`props.onChange`; traversal helper `collectTickets` (:255) shows the pattern

### Contract
- New file imports `getQaQueuePage` from `@/features/cx-quality/lib/server`. Auth mock = admin (`admin@dabdoob.com`), roster seeds an admin auditor + `a@dabdoob.com` (dq_hct-active) + `b@dabdoob.com` (roster-active so it reaches quota agents, but dq_hct-INACTIVE via `status`/`lwd`).
- `qa_queue` seed: rows for `a@`, `b@` (queue_date today, status open/done/passed mix), plus one sentinel row with a blank/non-`'@'` `agent_email`. `qa_audits`/`qa_forms`/`qa_ctls` may be minimal/empty.
- Mode control: hoisted fixture the mocked `readSheet` reads — e.g. `h.hct = { rows: [...] }` vs `{ err: new Error(…) }`. HCT sheet rows use real headers (`'employee name'`, `email`, `status`, `lwd`). Call `cacheClear()` in `beforeEach`/`seed` — `qa_hct_active` is TTL-cached.
- Component test: `useSe` stub change must keep the 4 existing memo tests green (invoking the loader calls `P.queuePage`, a bare `vi.fn()` — harmless to apply-count assertions). New test: render, find the `seg` element with `props.name === 'qa-queue-active'`, invoke `props.onChange('all')`, re-render, assert `P.queuePage` last call's 2nd arg is `'all'` (and was `'active'` on first render).
Out of scope: any `src/` edit; other pages/Segs; e2e specs; editing `qa-pushdown.test.ts` (foreign stream touches it); touching source to make tests pass — a red test means a real regression, report it.

### Actions
1. Create `tests/perf/qa-queue-active.test.ts`: copy the hoisted double + supabase/auth mocks; `readSheet` reads the switchable fixture; import `getQaQueuePage`; seed + `cacheClear()` in `beforeEach`.
2. Active-mode tests: default arg + explicit `'active'` drop `b@` from `rows`/`passed`/`requests` (`agent_email`/`agentEmail`), keep `a@` + sentinel row; `auditors`/`mine`/`unmatched` untouched.
3. quotaWeeks test: `b@` absent from every `quotaWeeks[].rows` `.email` and from `page.quota` in active mode; present under `'all'`.
4. `'all'` + fail-open tests: `getQaQueuePage(who, 'all')` returns `b@` rows; `readSheet` throws -> `act` null -> `b@` rows still present (fail-open).
5. Edit `tests/perf/audit-queue-memo.test.tsx` per Contract (useSe invokes loader + Seg test); run Verify; write `results/qa2-01.md`.

### Done when
- `getQaQueuePage` covered for: act fixture drops inactive, `'all'` unfiltered, throw -> unfiltered fail-open, sentinel kept; each assertion would fail on the pre-S03 code.
- `quota`/`quotaWeeks[].rows` post-filter asserted in both modes.
- Seg onChange test asserts `P.queuePage` 2nd arg `'active'` -> `'all'`; existing memo tests still pass.
- `npx tsc --noEmit` exit 0; no file under `src/` modified.
- `results/qa2-01.md` written (<=10 lines).

### Verify
- Run: `npx vitest run tests/perf/qa-queue-active.test.ts tests/perf/audit-queue-memo.test.tsx` -> all pass.
- Run: `npx tsc --noEmit` -> exit 0.

### Handoff
Closes qa-2-1 if green. Write results/qa2-01.md (<=10 lines); TL alone updates TRACKER.md.
