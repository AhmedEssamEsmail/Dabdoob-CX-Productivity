# S01-01: shared fetch-json module (verbatim extraction)
Kind: mini
ID: S01-01
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #1
Skills: none
Budget: files=1; actions=1; changed_lines=15; minutes=5

## Goal
The `RequestInit`/`no-store`/`{error}`-envelope `fetchJson` exists once at
`src/features/shared/lib/fetch-json.ts`, copied verbatim — consumers repoint in
later leaves; pv-shared still exports its own copy until S01-05.

## Files
- Create: `src/features/shared/lib/fetch-json.ts` | whole file

## Context
- `src/features/cx-productivity/components/pv-shared.tsx:58-65` | exact body to copy (section comment + function)
- PLAN.md #1, #22 | four variants exist; only this one moves — do NOT unify

## Contract
```ts
export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed')
  return data
}
```
Keep the `ce.google-run` section comment above it. No `import 'server-only'`
(client components import this). No other exports.
Out of scope: pv-shared edit (S01-05), consumer edits (S01-02..04), other variants.

## Actions
1. Create the file with the verbatim function + section comment; no imports needed.

## Done when
- File exists, exports only `fetchJson`, `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
Module `@/features/shared/lib/fetch-json` exports `fetchJson`; S01-02..04 repoint.
Write results/S01-01.md (<=10 lines); TL alone updates TRACKER.md.
