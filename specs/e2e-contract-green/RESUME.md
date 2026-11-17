# RESUME: e2e-contract-green (session checkpoint 2026-11-16 ~23:40)

## Task
Implement `specs/e2e-contract-green/PLAN.md` in `C:\Users\AHMED\KPIs\CX-Hub`
(bugfix path of pm-workflow; PLAN.md IS the verified debug report — no debugger needed).

## Where we are (UPDATED — TL finished)
`tech-lead` agent `dcf3d791` COMPLETED: **8/8 shards done**. Report:
`specs/e2e-contract-green/reports/tl-1.md`. Chromium suite 69/82 pass —
zero real failures; all 13 fails env-class (remote-auth saturation + host
suspend). Roster/my-day/agents green both widths; live dev log 0 prerender +
0 Dropped-segment errors. S08 added (`manual-warning` opt-out, next.config.ts).
TL respawned the dev server detached → `logs/dev-server.log` (may still run;
else restart per step 2 below). Next.js security-upgrade nudge flagged to user.

Remaining: FIX round for qa-1, then QA DELTA + UX gate (step 4), then close (step 5).

GATE STATE: QA PASSED (qa-2.md). UX round 1 FAIL (ux-1.md, 0H/1M/2L):
MED = agents-page.tsx scroll-pin needs input-cancel listeners; LOWs =
en-only min-inline-size, class-scoping convention. Fresh TL mode FIX spawned
on ux-1.md — if unfinished after reboot respawn same task text. Then:
ux-ui-expert mode DELTA round 2 (prior report ux-1.md) → close per step 5.
NEEDS_USER (surface in final report): earlier run booked a real "Focus time"
Google Calendar event — user must delete it manually (no in-app delete).

TRACKER.md (`specs/e2e-contract-green/TRACKER.md`) is the source of truth.
Leaf results are in `specs/e2e-contract-green/results/S0x.md`. Last seen:

| Shard | Status at checkpoint | Notes |
|---|---|---|
| S01 bootstrap Date.now→connection() | done | bootstrap.ts +3 lines; tsc 0 |
| S02 residual sync-IO sweep | done | 41 routes 200; no in-scope offenders |
| S03 roster+my-day x-stability | in-progress | code done (4 files); pw verify was env-blocked, re-gate after S06 |
| S04 agents @375 y-shift | in-progress | RCA: Tabs scrollIntoView→scrollY 420→26; fix=800ms scroll-pin; probe DY=0; pw verify env-blocked |
| S05 webkit classification | done | env verdict; +1 scoped webkit allowlist regex; baseline updated |
| S06 env-timeout hardening | done | e2e/users.ts retry budget + SLOW_DATA 150s tier + domcontentloaded; timeouts 82→~43-50, residual |
| S08 (NEW, added by TL) | in-progress | instant-unrendered-segment unmasked by S01; fix=instantInsights.validationLevel manual-warning (next.config.ts) |
| S07 housekeeping+allowlist+baseline | pending | deps S01,S02,S05,S06,S08 |

## Resume steps
1. Read `specs/e2e-contract-green/TRACKER.md` + `results/S08.md`, `results/S06.md`
   for the exact cut-off state.
2. Dev server on :3000 will be DOWN after reboot. PM must start it:
   `cd CX-Hub && npm run dev > specs/e2e-contract-green/logs/dev-server.log 2>&1 &`
   (agent-spawned `next dev` dies under Windows Job-Object — PM-only.
   playwright.config has webServer+reuseExistingServer, so tests reuse :3000.)
   Prereq `node e2e/seed-users.mjs` already ran (real Supabase users exist).
3. (done — TL completed; skip respawn)
4. PM gates (do them yourself, in order) — QA gate may be IN FLIGHT at shutdown:
   - `qa-expert` FULL round 1 → reports/qa-1.md (always). If reports/qa-1.md
     exists and is complete, read its Verdict instead of respawning; if it is
     partial/absent, spawn a FRESH background qa-expert.
   - `ux-ui-expert` on S03/S04 toolbar changes → reports/ux-1.md (flag ui)
   - Security/Data/Perf skipped per PLAN flags.
   FAIL → spawn FRESH TL mode FIX with findings path, then DELTA re-review. Max 3 rounds.
5. Close: mark TRACKER verified; delete any `reports/qa-*.md`; report <=10 lines.
   Do NOT commit/push unless user asks.

## Watch-outs
- Foreign in-flight edits exist (jobs/sheets/migration engine, mirrors/source-health
  routes, results/qa1-*.md at ROOT, several supabase migrations) — attribute gate
  failures, never revert; stage only our files if committing.
- PLAN success criterion 1's dev-log check: previous live server wrote to a
  terminal, not logs/dev-server.log — the PM-started log above fixes that.
- S01 evidence "unstable-value 58->58" = old log count; real proof = S07's
  post-allowlist-removal green run + fresh dev log grep.
- `?? nul` was gone from git status at checkpoint (verify S07 recorded it).
- Heavy output → log files + bounded tail; never cat playwright/test-results.
