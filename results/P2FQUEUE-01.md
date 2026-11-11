# P2FQUEUE-01 — refresh status on dedicated row
Status: DONE (code + static checks; browser bbox re-audit deferred to auditor)
Files: queue-page.tsx (aside wrapped in .page-actions, className="aging-page-head" via Head),
  shared.tsx (Head optional className -> PageShell), overview-page.tsx (className="cxp aging-page-head"),
  refresh.css (.page-actions > [role=status] flex-basis:100% rule for .md-fresh on /).
Checks: eslint 3 touched .tsx -> 0 problems; npx tsc --noEmit -> EXIT:0.
Verified by inspection: .md-fresh is a direct .page-actions child; queue/overview .cx-refresh markup unchanged.
Handoff: auditor re-runs Q1 on /queue @1440, /overview @375/768/1024, / @1024, /aging regression @1440.
