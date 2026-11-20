# FINDINGS: admin+TL users see no Mine/All Seg and 'mine' doesn't filter for admins

User decision: the My CTLs / All CTLs Seg must be visible to TLs AND admins.
'mine' = rows where tl_email === me, for every role. Admins who are also TLs
(e.g. ahmed.ismail@dabdoob.com) must default to their own agents' CTLs.

## F1 (blocking) — server: admin bypass in qaCtlScopeVisible_
File: src/features/cx-quality/lib/core.ts (helper added by S01-02, ~L330)
Current: `user.role==='admin' || scope==='all' || normEmail_(c.tl_email)===user.email`
Required: `scope==='all' || normEmail_(c.tl_email)===user.email` — drop the admin
bypass so 'mine' means own CTLs for admins too. 'all' still returns everything.

## F2 (blocking) — client: Seg hidden for admins
File: src/features/cx-quality/components/ctls-page.tsx (~L345)
Current: `toolbar={ n && !n.isAdmin ? <Seg .../> : null }`
Required: render the Seg whenever `n` is truthy (all roles).

## F3 (blocking) — test expectations
File: tests/quality/qa-ctl-scope.test.ts
Update the admin case: admin + 'mine' sees ONLY own tl_email rows; admin + 'all'
sees all. Keep TL cases unchanged.
