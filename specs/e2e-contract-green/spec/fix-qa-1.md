# Fix leaves: e2e-contract-green (QA round 1)
Source report: `../reports/qa-1.md` finding qa-1 (HIGH). qa-2 (LOW) deferred.
Project root: `C:\Users\AHMED\KPIs\CX-Hub`. Results dir: `../results/`.

**Environment rules (all leaves):**
- A dev server is ALREADY running on http://localhost:3000. NEVER run
  `next dev` or `next build` (dies under Windows Job-Object). Live output goes
  to the server's own terminal (`logs/dev-server.log` is stale since Nov 12).
- No new deps. No package.json/lockfile/.env*/cx-kpis-*.json edits. No commits.
- Heavy command output (tsc/eslint/playwright) -> redirect to `logs/<name>.log`,
  report exit code + bounded tail only.
- Playwright reuses the existing server (`reuseExistingServer`) — just run
  `npx playwright test ...` directly.

## qa1-01: /my-day skipToolbar quirk (stop real mutating POST)
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: test-engineer
Depends: none
Criteria: qa-1 (contract green without firing POST /api/hub/my-day focusBlock)
Skills: none
Budget: files=2; actions=3; changed_lines=15; minutes=10

### Goal
The `/my-day` contract's primary-action click fires a REAL `POST
/api/hub/my-day {action:focusBlock}` -> `createFocusBlock` writes a real Google
Calendar event (one was already booked during the S07 run; later runs 500 on
clash/owner checks). Add `/my-day` to `QUIRKS` with `skipToolbar: true`,
mirroring the `/kb-tracker` precedent, so no mutating request can ever fire
from the contract again — and record the now-unverified x-stability in the
baseline.

### Files
- Edit: `e2e/routes.ts` | QUIRKS map :45-53 — add the `/my-day` entry
- Edit: `specs/ux-ui-audit-v3/results/page-contract-baseline.md` | /my-day rows/notes (:9, :16, :31, :38 area) — annotate the skip

### Context
- `e2e/routes.ts:45-53` | QUIRKS + the `/kb-tracker` precedent entry to mirror
- `e2e/page-contract.spec.ts:124-157` | `r.skipToolbar` skips the primary click entirely (toolbar-skip annotation); console-error check still runs
- `src/app/api/hub/my-day/route.ts:39-42` | `focusBlock` -> `createFocusBlock` (real calendar write, `src/features/cx-hub/lib/myday.ts:737`)
- `reports/qa-1.md` | finding qa-1 evidence (POST 200 booked an event; later runs 500)

### Contract
Entry shape identical to `/kb-tracker`:
`'/my-day': { skipToolbar: true, note: 'primary action books a real calendar event (mutating POST /api/hub/my-day)' }`.
Do NOT stub/measure the POST, do NOT touch page-contract.spec.ts logic,
my-day page code, or the API. Baseline note must say: /my-day toolbar-x is
now a deliberate skip (mutating side effect); the S03 `md-book-btn`
min-inline-size reserve stays as best-effort but its x-stability is
unverified. Out of scope: everything else; deleting the already-created
calendar event is a manual user action (TRACKER "Blocked / needs user").

### Actions
1. Add the `'/my-day'` QUIRKS entry after `/kb-tracker` in `e2e/routes.ts`.
2. Amend the baseline doc's /my-day lines/notes with the skip annotation and
   unverified-x-stability caveat.
3. `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "my-day contract"`
   -> `logs/qa1-pw.log`: 2 passed with `toolbar-skip` annotations; grep the log
   for `POST /api/hub/my-day` / focusBlock evidence — must be absent.

### Done when
- `/my-day` contract passes @375 and @1024 with a `toolbar-skip` annotation.
- No `POST /api/hub/my-day` fired during the run (no 200/500 from that route).
- Baseline doc records the skip + unverified x-stability; `npx tsc --noEmit` clean.

### Verify
- Run: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "my-day contract"` -> 2 passed.

### Handoff
Closes qa-1 code-side. Remaining: user deletes the test-created "Focus time"
event from the owner's Google Calendar (no in-app delete action exists).
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.
