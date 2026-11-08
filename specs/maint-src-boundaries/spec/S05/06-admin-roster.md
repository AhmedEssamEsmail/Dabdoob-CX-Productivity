# S05-06: admin/roster page -> cx-hub/components/admin-roster-page.tsx
Kind: mini
ID: S05-06
Parent: S05
Owner: dev
Depends: none
Criteria: PLAN #5
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=2; actions=2; changed_lines=30; minutes=10

## Goal
`src/app/admin/roster/page.tsx` (~284 lines) becomes a thin route; body moves
verbatim to `cx-hub/components/admin-roster-page.tsx`.

## Files
- Edit: `src/app/admin/roster/page.tsx` | becomes the thin wrapper below
- Create: `src/features/cx-hub/components/admin-roster-page.tsx` | the moved page body

## Context
- `src/app/admin/roster/page.tsx:1-25` | header: 'use client' + hub.css + react + ui imports
- `src/app/queue/page.tsx` | target convention

## Contract
Component file: `'use client'` line 1, all original imports except the css line,
body verbatim; `export default function AdminRosterPage` becomes
`export function AdminRosterPage()`.
Route file becomes:
```tsx
import { AdminRosterPage } from '@/features/cx-hub/components/admin-roster-page'
import '@/app/styles/hub.css'

export default function Page() {
  return <AdminRosterPage />
}
```
Out of scope: DOM/behavior edits, css moves.

## Actions
1. Create the component file with `'use client'` + moved body, named export `AdminRosterPage`.
2. Rewrite the route to the thin wrapper above (keep the css import).

## Done when
- Route is ~6 lines; component renders identically; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
`AdminRosterPage` named export available; all 6 routes now thin (PLAN #5 done).
Write results/S05-06.md (<=10 lines); TL alone updates TRACKER.md.
