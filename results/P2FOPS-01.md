# P2FOPS-01 — /trackers zero-tracker state
Status: DONE (code); browser re-check pending auditor env.
Files: src/features/cx-operations/components/trackers-page.tsx (+~10 lines)
Change: `isEmpty = t && trackers.length===0`; aside hides `#trk-switch` when empty (no phantom `__new__`); body renders `Empty` "No trackers yet." with `action` Button "Create the first tracker" → `m(true)` mounts existing `Er` form when `canCreate`; no-create users get Empty without affordance. Non-empty path untouched.
Checks: `npx eslint trackers-page.tsx` exit 0 (results/p2fops01-eslint.log); `npx tsc --noEmit` log empty = clean (results/p2fops01-tsc.log).
Handoff: auditor re-runs Q5/Q8 on /trackers with trackers:[] fixture @375/1440; exercise create → `.trk-create` mounts; Cancel returns to Empty.
