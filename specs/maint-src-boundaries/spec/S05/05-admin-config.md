# S05-05: admin/config page -> cx-hub/components/admin-config-page.tsx
Kind: mini
ID: S05-05
Parent: S05
Owner: dev
Depends: none
Criteria: PLAN #5
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=2; actions=2; changed_lines=30; minutes=10

## Goal
`src/app/admin/config/page.tsx` (~138 lines) becomes a thin route; body moves
verbatim to `cx-hub/components/admin-config-page.tsx` (admin routes are cx-hub-owned,
non-registry standalone pages).

## Files
- Edit: `src/app/admin/config/page.tsx` | becomes the thin wrapper below
- Create: `src/features/cx-hub/components/admin-config-page.tsx` | the moved page body

## Context
- `src/app/admin/config/page.tsx:1-15` | header: 'use client' + hub.css + react + ui imports
- `src/app/queue/page.tsx` | target convention
- `src/features/cx-hub/components/admin-page.tsx` | existing DIFFERENT file (shell admin page) — do not touch/confuse

## Contract
Component file: `'use client'` line 1, all original imports except the css line,
body verbatim; `export default function AdminConfigPage` becomes
`export function AdminConfigPage()`.
Route file becomes:
```tsx
import { AdminConfigPage } from '@/features/cx-hub/components/admin-config-page'
import '@/app/styles/hub.css'

export default function Page() {
  return <AdminConfigPage />
}
```
Out of scope: DOM/behavior edits, css moves, admin-page.tsx.

## Actions
1. Create the component file with `'use client'` + moved body, named export `AdminConfigPage`.
2. Rewrite the route to the thin wrapper above (keep the css import).

## Done when
- Route is ~6 lines; component renders identically; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
`AdminConfigPage` named export available.
Write results/S05-05.md (<=10 lines); TL alone updates TRACKER.md.
