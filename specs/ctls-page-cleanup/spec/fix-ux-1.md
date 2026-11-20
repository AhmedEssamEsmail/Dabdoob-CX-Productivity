# fix-ux-1 — UX round 1 blocking findings (ctls-page-cleanup)

Source report: `specs/ctls-page-cleanup/reports/ux-1.md`
Leaf map: ux-1 (MED, ref lookup ignores canClose) -> ux1-01.
ux-2 / ux-3 / ux-4 (all LOW) -> deferred per FIX rules.

## ux1-01: Gate the CTL ref lookup by canClose
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: reports/ux-1.md finding ux-1 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=15; minutes=5

### Goal
In 'all' scope the free-text ticket/audit-ID lookup must not match open CTLs
the user cannot close, so the ref entry path mirrors the per-row "Open in the
form" button gate and can never reach the dead-end server reject
("This CTL belongs to …; you can close it only while you are on shift.").

### Files
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | only the `findOpenCtls` predicate (lines ~29-41); nothing else in the file

### Context
- `src/features/cx-quality/components/ctls-page.tsx:29-41` | `findOpenCtls` filters `status === 'open'` + ref match, ignores `c.canClose`
- `src/features/cx-quality/components/ctls-page.tsx:125-126,448` | `g`/`y` derive from `findOpenCtls`; the list button is already gated on `r.canClose` — mirror it
- `src/features/cx-quality/lib/core.ts:339-356` + `lib/server.ts:1281` | server-side reference (`qaFindOpenCtls_`) and the submit-time reject that must stay unreachable from this path
- `reports/ux-1.md` finding ux-1 | evidence + fix direction (option 1)

### Contract
`findOpenCtls` returns only rows with `status === 'open'` AND `c.canClose`
truthy, in addition to the existing ticket/audit-ID/CTL-ID ref match. The
existing "No open CTL of yours matches" hint now covers non-closeable matches —
copy stays unchanged. Out of scope: `lib/server.ts`, `lib/core.ts`, copy fixes
ux-2/ux-3, busy affordance ux-4 (all deferred), TRACKER.md.

### Actions
1. Add `c.canClose` to the filter predicate in `findOpenCtls`.
2. Static check: multi-pick `Seg`, `y` derivation and the empty-match hint behave unchanged for closeable rows; non-closeable matches resolve to the existing hint.
3. Run `npx tsc --noEmit` and confirm clean.

### Done when
- Non-closeable open CTLs (another team's ticket in 'all' scope; a shift_tls
  row while off-shift) do not match the ref lookup.
- Closeable open CTLs still match by ticket number, audit ID and CTL ID;
  multi-match `Seg` lists every closeable match.
- `npx tsc --noEmit` exit 0.

### Verify
- Run: `npx tsc --noEmit` -> exit 0 (redirect output to a log if noisy).
- `git diff src/features/cx-quality/components/ctls-page.tsx` -> only the `findOpenCtls` predicate changed.

### Handoff
Write `results/ux1-01.md` (<=10 lines: status, diff excerpt, checks); TL alone
updates TRACKER.md.
