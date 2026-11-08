# S06-04: QA dispatcher test, GET + error-map half
Kind: mini
ID: S06-04
Parent: S06
Owner: test-engineer
Depends: S06-02
Criteria: PLAN #6 (GET parsing + apiError status map)
Skills: none
Budget: files=1; actions=2; changed_lines=80; minutes=10

## Goal
Extend `src/app/api/__tests__/integration.test.ts` (rewritten by S06-02) with the
GET `?args=`/`?argN=` parsing cases and the thrown-error -> apiError status map.

## Files
- Edit: `src/app/api/__tests__/integration.test.ts` | append the GET + error cases

## Context
- `src/app/api/qa/[action]/route.ts:77-102` | GET parsing: `?args=<json-array|scalar>`, else `?arg0=..&argN=` indexed spread
- `src/app/api/qa/[action]/route.ts:55-63` | run(): thrown error -> apiError
- `src/features/shared/lib/api-error.ts:23-42` | 'Unauthorized' -> 401; 'do not have access' -> 403; other -> 500
- `tests/jobs/routes.test.ts:8-24` | hoisted-mock pattern (server fns already mocked in S06-02)

## Contract
GET needs `new NextRequest(url)` from `next/server` (route reads
`req.nextUrl.searchParams`); ctx `{ params: Promise.resolve({ action }) }`.
Cases: `?args=["t"]` -> fn gets ('t'); `?args=<scalar>` -> single-element array;
`?arg0=t&arg1=n` -> fn gets ('t','n'); a throwing handler fn -> `new
Error('Unauthorized')` -> 401, the legacy 'do not have access' message -> 403,
a plain Error -> 500 (the apiError map through the real route's catch).
Out of scope: POST cases (S06-02), route.ts edits.

## Actions
1. Append the GET-parsing + error-map cases to the file.
2. Run it green.

## Done when
- GET `?args=`/`?argN=` cases and all three error-status cases pass.

## Verify
- Run: `npm run test:integration` -> all tests pass

## Handoff
PLAN #6 dispatcher coverage complete (POST + GET + status map).
Write results/S06-04.md (<=10 lines); TL alone updates TRACKER.md.
