# fix-adm-1 — admin+TL scope findings (ctls-page-cleanup)

Source report: `specs/ctls-page-cleanup/reports/fix-admin-scope.md`
Decision: the My CTLs / All CTLs Seg shows for TLs AND admins; 'mine' =
tl_email === me for every role. Admins who are also TLs default to their own
agents' CTLs.
Leaf map: F1+F3 (server helper + its test) -> adm1-01. F2 (client Seg) -> adm1-02.

## adm1-01: Drop admin bypass in qaCtlScopeVisible_ and update scope test
Kind: mini
ID: adm1-01
Parent: fix-adm-1
Owner: dev
Depends: none
Criteria: reports/fix-admin-scope.md findings F1 + F3 (blocking)
Skills: none
Budget: files=2; actions=3; changed_lines=30; minutes=5

### Goal
Make `qaCtlScopeVisible_` treat admins like any other role: 'mine' shows only
rows whose tl_email matches the user's email; 'all' still returns every row.
Update the admin expectations in the existing unit test.

### Files
- Edit: `src/features/cx-quality/lib/core.ts` | only `qaCtlScopeVisible_` body (lines ~330-333)
- Edit: `tests/quality/qa-ctl-scope.test.ts` | only the admin `it(...)` case (lines ~12-15)

### Context
- `src/features/cx-quality/lib/core.ts:330-333` | current helper: `user.role==='admin' || scope==='all' || normEmail_(c.tl_email)===user.email`
- `reports/fix-admin-scope.md` | F1/F3 exact required shape
- `tests/quality/qa-ctl-scope.test.ts:4-15` | `admin = { email:'boss@x.com', role:'admin' }`; `ownRow.tl_email='TL@x.com'` is NOT the admin's email

### Contract
New predicate: `scope==='all' || normEmail_(c.tl_email)===user.email` — remove
the `user.role==='admin'` disjunct only; keep normEmail_ comparison and the
scope check order. Update the function's doc comment to match ('all' returns
every row; 'mine' = own tl_email for all roles). In the test, the admin case
becomes: admin + 'mine' is true only for a row whose tl_email equals
`boss@x.com` (add or reuse such a row), false for `ownRow`/`otherRow`; admin +
'all' is true for every row. TL and unknown-scope cases stay unchanged.
Out of scope: `qaCtlVisibleTo_`, `qaCanCloseCtl_`, `qaFindOpenCtls_`,
ctls-page.tsx, server.ts, any other file, TRACKER.md.

### Actions
1. Remove `user.role === 'admin' || ` from `qaCtlScopeVisible_` and adjust its doc comment.
2. Update the admin `it` block: add an admin-owned row (`tl_email: 'boss@x.com'`), assert 'mine' true only for it, false for ownRow/otherRow; keep 'all' true for all.
3. Run the targeted vitest file and confirm green.

### Done when
- No `role==='admin'` special case remains in `qaCtlScopeVisible_`.
- Admin 'mine' test asserts own-tl_email-only visibility; 'all' unchanged.
- TL and unknown-scope test cases untouched and still passing.

### Verify
- Run: `npx vitest run tests/quality/qa-ctl-scope.test.ts` -> all tests pass.

### Handoff
Helper signature unchanged (`(c, user, scope) => boolean`); server.ts callers
need no change. Write results/adm1-01.md (<=10 lines); TL alone updates TRACKER.md.

## adm1-02: Show Mine/All Seg for admins on the CTLs page
Kind: mini
ID: adm1-02
Parent: fix-adm-1
Owner: dev
Depends: none
Criteria: reports/fix-admin-scope.md finding F2 (blocking)
Skills: none
Budget: files=1; actions=1; changed_lines=10; minutes=5

### Goal
Render the My CTLs / All CTLs Seg in the CTLs page toolbar for every role,
including admins (currently hidden when `n.isAdmin`).

### Files
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | only the `toolbar={ ... }` expression (lines ~345-361)

### Context
- `src/features/cx-quality/components/ctls-page.tsx:345-361` | current: `toolbar={ n && !n.isAdmin ? <Seg .../> : null }`
- `reports/fix-admin-scope.md` | F2: render the Seg whenever `n` is truthy

### Contract
Change the toolbar guard to `n ? <Seg .../> : null` — remove only the
`!n.isAdmin` condition; keep the Seg props, options, onChange and aria-label
unchanged. If `isAdmin` becomes unused in this file, remove no other code —
leave the flag alone (server still returns it; harmless).
Out of scope: Seg component, options/labels, scope state, core.ts, server.ts,
tests, TRACKER.md.

### Actions
1. Replace `n && !n.isAdmin ?` with `n ?` in the toolbar prop.

### Done when
- Seg renders for admins (no isAdmin guard on the toolbar).
- Default scope stays 'mine'; switching still calls `P.ctlPage(scope)` via reload.
- No other change in the file.

### Verify
- Run: `npx tsc --noEmit` -> clean; `git diff src/features/cx-quality/components/ctls-page.tsx` -> one-line guard change.

### Handoff
Works together with adm1-01: admin + default 'mine' now shows the admin's own
tl_email rows once the helper fix lands. Write results/adm1-02.md (<=10 lines);
TL alone updates TRACKER.md.
