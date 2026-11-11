# fix-ux3-2: zero-warning residual sweep (raw controls, dialogs, links)
Kind: package
Dispatch: NEVER
Criteria: PLAN gate `npx eslint src` → 0 warnings; residual B9/B1-class hits closed or justified.

## Children
| ID | Owner | Depends | Criteria | Budget |
|---|---|---|---|---|
| fx-02 | dev | none | `npx eslint src` 0 warnings; tsc clean | 10 files / 10 actions / ~60 lines / 9 min |

## fx-02: close out remaining eslint warnings + residual dialog/link hits
Kind: mini
ID: fx-02
Parent: fix-ux3-2
Owner: dev
Depends: none
Criteria: `npx eslint src` → 0 errors 0 warnings; `npx tsc --noEmit` clean; no `eslint-disable` added
Skills: none
Budget: files=10; actions=10; changed_lines=60; minutes=9

### Goal
`npx eslint src` currently reports 12 `local/no-raw-controls` warnings (0 errors). For each site either convert to the shared primitive when trivially equivalent, or keep raw with a nearby `{/* intentionally raw: <reason> */}` / `// intentionally raw:` marker (the rule now honors markers — see results/fx-01.md). Two shared-shell `<dialog>` elements and two unclassed `<a>` are the same class of residual: migrate to `Dialog`/`.cx-link` if trivially equivalent, else mark/annotate.

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | raw controls at ~:541, :551, :585, :654
- Edit: `src/features/shared/components/shell/ErrorBoundary.tsx` | raw control ~:34
- Edit: `src/features/shared/components/shell/OneOnOneAlerts.tsx` | raw controls ~:257, :264
- Edit: `src/features/shared/components/shell/Toasts.tsx` | raw control ~:91
- Edit: `src/features/shared/components/shell/ViewAs.tsx` | raw controls ~:126, :188; `<dialog>` ~:139
- Edit: `src/features/shared/components/shell/Popups.tsx` | `<dialog>` ~:93
- Edit: `src/features/cx-hub/components/overview-page.tsx` | raw control ~:169
- Edit: `src/features/cx-people/components/meetings-page.tsx` | raw `<button>` ~:853-860 (S02-03 residual)
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | `<a>` ~:686 — add `.cx-link` only if not already styled by an ancestor class
- Edit: `src/features/shared/components/ui/SettingsSection.tsx` | TOC `<a>` ~:53 — only if it is not already covered by `.cx-toc` styling

### Contract
For each listed site: convert to the shared primitive (Button/Input/Dialog from `@/features/shared/components/ui`) when trivially equivalent; otherwise keep raw and add `{/* intentionally raw: <short reason> */}` directly above the element. Links get `.cx-link` only when not already covered by an ancestor/tokenized class. No `eslint-disable`, no deletions of comments, no behavior changes, no edits outside listed regions.

### Context
- Marker contract: `{/* intentionally raw: <short reason> */}` directly above the JSX element (or `// intentionally raw:` line comment). Legitimate reasons: shared-shell/ui internals that ARE the primitive layer, three.js scene widgets, file inputs, fixed-grid widgets that cannot take a primitive.
- Feature components should prefer conversion (Button/Input/etc. from `@/features/shared/components/ui`); shell infrastructure may mark.
- `eslint-disable` comments are FORBIDDEN; deleting comments to silence is forbidden.

### Actions
1. Fix AppShell.tsx hits (convert or mark).
2. Fix ErrorBoundary.tsx hit.
3. Fix OneOnOneAlerts.tsx hits.
4. Fix Toasts.tsx hit.
5. Fix ViewAs.tsx hits incl. its `<dialog>` (migrate to Dialog or mark).
6. Fix Popups.tsx `<dialog>` (migrate to Dialog or mark).
7. Fix overview-page.tsx hit.
8. Fix meetings-page.tsx:853 residual `<button>` (convert to Button or mark).
9. trackers-page.tsx:686 — `.cx-link` if unstyled.
10. SettingsSection.tsx:53 — annotate/add class only if uncovered; else no edit.

### Done when
- `npx eslint src` → 0 problems; `npx tsc --noEmit` clean; behavior unchanged.

### Verify
- Run: `npx eslint src` and `npx tsc --noEmit` (log to specs/ux-ui-audit-v3/logs/).

### Handoff
Write results/fx-02.md (<=12 lines) listing per-site convert-vs-mark decisions. TL alone updates TRACKER.md.
