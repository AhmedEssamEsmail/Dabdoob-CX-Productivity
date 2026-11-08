# S01-05: golden desk oracle — brand-normalize the legacy `(via CX Helm)` signature
Kind: mini
ID: S01-05
Parent: S01
Owner: test-engineer
Depends: none
Criteria: PLAN #1
Skills: none
Budget: files=2; actions=4; changed_lines=40; minutes=10

## Goal
`tests/golden/desk.test.ts` goes green again: the two parity failures
(`decision bodies`, `configured send … identical RFC 2822 bytes`) are caused
by ONE documented divergence — frozen `_archive` MailDesk.js L146 signs
decision bodies `(via CX Helm)` while the rebranded port emits
`(via Dabdoob CX)` (maildesk.ts L267, applied by S01-03). Normalize that
exact suffix on the LEGACY oracle side only; every other byte still compares.

## Files
- Edit: `tests/golden/desk-fakes.ts` | new `normLegacyBrand` export + `deskSame` legacyRes seam (L336-343)
- Edit: `tests/golden/desk.test.ts` | desk-fakes import list + `legacyMime` compare in 'configured send' test (~L1931-1932)

## Context
- `tests/golden/desk-fakes.ts:336-343` | `deskSame` compares `legacyRes` vs `portRes` via `expectSame`
- `tests/golden/desk.test.ts:1924-1932` | `legacyMime` base64-decoded, compared `.toBe(sentBodies[0].raw)`
- `src/features/cx-desk/lib/maildesk.ts:267` | port signature `(via Dabdoob CX)` (read-only)
- `specs/dabdoob-refresh/results/S01-03.md` | the 2 failing test names + root cause

## Contract
Test-harness ONLY: no `src/` edits, no `_archive` edits, no other test files.
`normLegacyBrand` deep-maps strings replacing `(via CX Helm)` -> `(via Dabdoob CX)`
and is applied to LEGACY/oracle output only — never port output, never inputs.
Suggested shape:

```ts
/** D-BRAND (documented divergence): frozen _archive MailDesk.js:146 signs
 * "(via CX Helm)"; the rebranded port emits "(via Dabdoob CX)" (maildesk.ts:267).
 * Rewrites that exact suffix inside LEGACY oracle output only; all other
 * bytes must still match. Remove if _archive is regenerated post-rebrand. */
export function normLegacyBrand<T>(v: T): T {
  if (typeof v === 'string') return v.replace(/\(via CX Helm\)/g, '(via Dabdoob CX)') as T
  if (Array.isArray(v)) return v.map(normLegacyBrand) as T
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const k of Object.keys(v)) o[k] = normLegacyBrand((v as Record<string, unknown>)[k])
    return o as T
  }
  return v
}
```

Out of scope: source files, `_archive`, `notify.test.ts`, other divergence
seams (`''`/null, pwTxt_, D-GOOGLE), fixture data.

## Actions
1. desk-fakes.ts: add the exported `normLegacyBrand` helper with the D-BRAND comment above.
2. desk-fakes.ts `deskSame`: change to `expectSame(portRes, normLegacyBrand(legacyRes), label || fn)`.
3. desk.test.ts: add `normLegacyBrand` to the `from './desk-fakes'` import; in the 'configured send' test change the compare to `expect(normLegacyBrand(legacyMime)).toBe(sentBodies[0].raw)`.
4. `npx vitest run tests/golden/desk.test.ts` -> all green (was exactly 2 failures).

## Done when
- `decision bodies` and `configured send` tests pass; the file is fully green.
- `git diff` touches only the two test files (no `src/`, no `_archive`).
- The D-BRAND comment documents the divergence at the helper.

## Verify
- Run: `npx vitest run tests/golden/desk.test.ts` -> all tests pass

## Handoff
Restores PLAN #1 test parity for S01-03's applied edits; the null/'' and
pwTxt_ seams are untouched.
Write results/S01-05.md (<=10 lines); TL alone updates TRACKER.md.
