# S06-01: e2e specs + shot harness selectors reconciled to the new markup
Kind: mini
ID: S06-01
Parent: root
Owner: test-engineer
Depends: S02-05, S03-02, S03-03, S03-04, S04-11, S04-12, S04-18, S04-19
Criteria: PLAN #3 #6
Skills: C:\Users\AHMED\.agents\skills\webapp-testing\SKILL.md
Budget: files=5; actions=4; changed_lines=80; minutes=10

## Goal
After the rail/palette/login/page restructures, `npm run test:e2e` and the
shot harness run green: update only the spec/harness lines that assert
superseded markup or strings — no new test coverage, no helper rewrites.

## Files
- Edit: `e2e/auth.spec.ts` | selectors/strings only if broken by S03-04
- Edit: `e2e/responsive.spec.ts` | nav/menu hooks only if broken by S02-05/S03-02
- Edit: `e2e/status-validation.spec.ts` | `.pv-*`/`.cxp` hooks only if broken by S04-11/12
- Edit: `e2e/my-status.spec.ts` | `.pv-*`/headings only if broken by S04-18/19
- Edit: `.devin/work/shoot-new.mjs` | `READY` selectors only where a renamed hook broke readiness

## Context
- `e2e/auth.spec.ts`, `e2e/responsive.spec.ts` | hooks the login + rail work was told to preserve
- `e2e/status-validation.spec.ts:14-78`, `e2e/my-status.spec.ts:11-62` | `.pv-*` assertions
- `.devin/work/shoot-new.mjs:99-113` | READY map + READY_DEFAULT

## Contract
- Run first; change only failing assertions. Expected edits are small
  (e.g. a renamed wrapper class); if a spec fails for a REAL regression,
  do not patch the test — report `RESHARD_NEEDED` with the evidence.
- Keep every existing test name/intent; no new specs; no fixture changes;
  `E2E_USERS`/login helper untouched.
- READY map: update a selector only if the page no longer renders it and
  the replacement is stable.

## Actions
1. `npm run test:e2e` -> collect failing assertions.
2. Patch minimal selectors/strings in the 4 spec files.
3. Run `node .devin/work/shoot-new.mjs` (dev server) -> fix READY selectors that no longer match.
4. Re-run failing specs + the affected shots; all green.

## Done when
- `npm run test:e2e` green.
- Shot harness `_index.json` shows no readySel/pageerror failures.

## Verify
- Run: `npm run test:e2e` -> all specs pass

## Handoff
none — final reconciliation leaf; PM runs the remaining gates.
Write results/S06-01.md (<=10 lines); TL alone updates TRACKER.md.
