# S05-03: my-status page -> components/my-status-page.tsx
Kind: mini
ID: S05-03
Parent: S05
Owner: dev
Depends: S01-04
Criteria: PLAN #5
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=2; actions=2; changed_lines=30; minutes=10

## Goal
`src/app/my-status/page.tsx` (~226 lines) becomes a thin route; body moves
verbatim to `cx-productivity/components/my-status-page.tsx`.

## Files
- Edit: `src/app/my-status/page.tsx` | becomes the thin wrapper below
- Create: `src/features/cx-productivity/components/my-status-page.tsx` | the moved page body

## Context
- `src/app/my-status/page.tsx:1-26` | header incl. split fetchJson import (S01-04) and `import type` from prod-validation (keep — unmarked)
- `src/app/queue/page.tsx` | target convention

## Contract
Component file: `'use client'` line 1, all original imports except the css line,
body verbatim; default export becomes `export function MyStatusPage()`.
Route file becomes:
```tsx
import { MyStatusPage } from '@/features/cx-productivity/components/my-status-page'
import '@/app/styles/productivity.css'

export default function Page() {
  return <MyStatusPage />
}
```
Out of scope: DOM/behavior edits, css moves.

## Actions
1. Create the component file with `'use client'` + moved body, named export `MyStatusPage`.
2. Rewrite the route to the thin wrapper above (keep the css import).

## Done when
- Route is ~6 lines; component renders identically; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
`MyStatusPage` named export available.
Write results/S05-03.md (<=10 lines); TL alone updates TRACKER.md.
