# S05-01: tph-grid page -> cx-productivity/components/tph-grid-page.tsx
Kind: mini
ID: S05-01
Parent: S05
Owner: dev
Depends: S01-03
Criteria: PLAN #5
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=2; actions=2; changed_lines=30; minutes=10

## Goal
`src/app/tph-grid/page.tsx` (~1998 lines) becomes a thin route; its whole body
moves verbatim to `cx-productivity/components/tph-grid-page.tsx`.

## Files
- Edit: `src/app/tph-grid/page.tsx` | becomes the thin wrapper below
- Create: `src/features/cx-productivity/components/tph-grid-page.tsx` | the moved page body

## Context
- `src/app/tph-grid/page.tsx:1-25` | current header: `'use client'` + css + imports
- `src/app/queue/page.tsx` | target convention (component import + css + Page wrapper)
- `src/app/tph/page.tsx` | `export { default } from '../tph-grid/page'` — do NOT touch; it keeps resolving
- `node_modules/next/dist/docs/01-getting-started/05-server-and-client-components.md` | boundary rules

## Contract
Component file: `'use client'` line 1, then ALL original imports except the css
line (they are absolute `@/` paths — unchanged, including `fetchJson` from
`@/features/shared/lib/fetch-json` per S01-03), then the entire body verbatim;
the page's default export becomes `export function TphGridPage()`.
Route file becomes:
```tsx
import { TphGridPage } from '@/features/cx-productivity/components/tph-grid-page'
import '@/app/styles/productivity.css'

export default function Page() {
  return <TphGridPage />
}
```
Out of scope: `/tph` route (unchanged re-export), DOM/behavior edits, css moves.

## Actions
1. Create the component file with `'use client'` + moved body, named export `TphGridPage`.
2. Rewrite the route to the thin wrapper above (keep the css import).

## Done when
- Route is ~6 lines; component renders identically; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
`TphGridPage` named export available; `/tph` re-export still works.
Write results/S05-01.md (<=10 lines); TL alone updates TRACKER.md.
