# S05: thick app pages become thin routes over feature components
Kind: package
ID: S05
Dispatch: NEVER

## Goal and contract
Each thick `'use client'` page under `src/app/` moves verbatim into its owning
feature's `components/` (per `queue/page.tsx` convention): the component file
carries `'use client'` + the whole body as a named `<X>Page` export; the route
keeps ONLY the `import '@/app/styles/*.css'` line (original order) plus the thin
`export default function Page() { return <XPage /> }` wrapper. `/tph`'s
`export { default } from '../tph-grid/page'` keeps working untouched. Rendered
DOM, fetch behavior, and CSS order are unchanged. `admin/*` pages (non-registry
standalone routes) are owned by cx-hub.

## Children
Index: `S05/00-index.md`
- #5 -> S05-01 (tph-grid), S05-02 (status-validation), S05-03 (my-status),
  S05-04 (productivity-analytics), S05-05 (admin/config), S05-06 (admin/roster)

## Completion
All 6 routes are ~7-line wrappers; `next build` green; `/tph` still resolves.
