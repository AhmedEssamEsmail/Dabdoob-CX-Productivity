# P2FSH-03 — Topbar crumbTitle
Status: DONE
Files: src/features/shared/components/shell/Topbar.tsx (destructure + .crumbs JSX)
Change: crumbs now render `{crumbGroup ? <>{crumbGroup} / </> : null}<b>{crumbTitle}</b>` per mock contract; no new props, callers unchanged.
Checks: `npx eslint Topbar.tsx` → 0 problems; `npx tsc --noEmit` → exit 0.
Browser re-check of /overview + /trackers @375/1024 left to auditor (no browser in this env); code path verified by inspection.
Handoff: global Q1 wayfinding fix; auditor re-runs Q1 on representative routes.
