# S06-02: integration.test.ts -> real QA dispatcher test, POST half
Kind: mini
ID: S06-02
Parent: S06
Owner: test-engineer
Depends: S03-01
Criteria: PLAN #6 (POST dispatcher cases)
Skills: none
Budget: files=1; actions=2; changed_lines=110; minutes=10

## Goal
Rewrite `src/app/api/__tests__/integration.test.ts` in place (431 fixture-only
lines) as a real route test of `src/app/api/qa/[action]/route.ts`, covering the
POST cases. GET and the error-status map append in S06-04 (same file, serial).
`npm run test:integration` keeps working — dir kept.

## Files
- Edit: `src/app/api/__tests__/integration.test.ts` | rewrite in place; POST suite

## Context
- `src/app/api/qa/[action]/route.ts:11-53,65-75` | HANDLERS map, run(), POST parsing (`{args:[]}` | array | malformed -> `args=[]`)
- `tests/jobs/routes.test.ts:8-24,39-54` | vi.hoisted + vi.mock seam pattern to copy
- `src/features/cx-quality/lib/server.ts` | mocked module; unexercised handler fns are referenced lazily — a small mock surface suffices

## Contract
`vi.mock('@/features/cx-quality/lib/server', () => h.fns)` with hoisted vi.fn()s
for the exercised actions (getQaAccess, passQaQueueItem, submitQaAudit).
ctx arg: `{ params: Promise.resolve({ action }) }`. POST accepts a plain
`Request` — the route only calls `req.json()`.
Cases: allowed action returns the fn's JSON (200); positional args spread into
the server fn (`passQaQueueItem` receives ('T-1','note') from `{args:['T-1','note']}`);
unknown action -> 404 `{error: 'Unknown QA action "x".'}`; malformed POST body
('not json') -> handler invoked with `args=[]`. Leave a `describe('GET ...')`
stub or comment for S06-04.
Out of scope: GET + error-map cases (S06-04), route.ts edits (S04).

## Actions
1. Rewrite the file with the mocked-server POST suite above.
2. Run it green.

## Done when
- File imports the real route module; all POST cases pass.

## Verify
- Run: `npm run test:integration` -> all tests pass

## Handoff
S06-04 appends the GET parsing + apiError status-map cases to this file.
Write results/S06-02.md (<=10 lines); TL alone updates TRACKER.md.
