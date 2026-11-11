# fix-ux3-1: local/no-raw-controls honors `intentionally raw` markers
Kind: package
Dispatch: NEVER
Criteria: PLAN A3/S02 — kept-raw controls carry `// intentionally raw:` markers; eslint gate requires 0 warnings on touched files without `eslint-disable`.

## Children
| ID | Owner | Depends | Criteria | Budget |
|---|---|---|---|---|
| fx-01 | dev | none | marker-aware rule + remove S02-02 disables | 2 files / 6 actions / ~50 lines / 8 min |

## fx-01: marker-aware no-raw-controls rule
Kind: mini
ID: fx-01
Parent: fix-ux3-1
Owner: dev
Depends: none
Criteria: PLAN A3 + gate `npx eslint <files>` 0 warnings
Skills: none
Budget: files=2; actions=6; changed_lines=50; minutes=8

### Goal
`local/no-raw-controls` (eslint.config.mjs) skips JSX elements carrying an `intentionally raw` marker comment, so S02/B10 keep-raw conventions reach 0 warnings without `eslint-disable` directives (forbidden by PLAN conventions).

### Files
- Edit: `eslint.config.mjs` | `rawControlsRule` create() ~:123-136
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | remove the two `eslint-disable-next-line local/no-raw-controls` lines (keep the `{/* intentionally raw: … */}` comments)

### Context
- `eslint.config.mjs:215-228` | rule wired at `warn` repo-wide, `off` under `shared/components/ui`
- Marker usage: `{/* intentionally raw: <reason> */}` directly above the JSX element (JSX) or `// intentionally raw:` line comment.

### Contract
In `create()`: collect `context.sourceCode.getAllComments()` once; skip reporting a JSXOpeningElement when a comment whose text includes `intentionally raw` ends within ~4 lines above `node.loc.start.line` or on the same line. Behavior otherwise unchanged (still `warn`). No other rules touched.
Out of scope: changing rule severity, other local rules, any other source file.

### Actions
1. Implement the marker check in `rawControlsRule` (getAllComments scan; `intentionally raw` substring, case-sensitive).
2. Remove the two `eslint-disable-next-line local/no-raw-controls` comments in heatmap-page.tsx.
3. `npx eslint src/features/cx-queue/components/heatmap-page.tsx` → 0 warnings (markers now exempt).
4. `npx eslint src/features/cx-people/components/meetings-page.tsx` → still warns (unmarked raw hits exist) — proves the rule still fires.
5. `npx eslint src/features/cx-people/components/one-on-ones-views.tsx` → 0 warnings (S02-03's markers exempt).
6. `npx tsc --noEmit` clean.

### Done when
- marked raw elements produce 0 warnings; unmarked still warn; no `eslint-disable` remains in heatmap-page.tsx

### Verify
- Run: `npx eslint eslint.config.mjs src/features/cx-queue/components/heatmap-page.tsx` -> clean

### Handoff
All current/future S02/B10 leaves can keep-raw via markers only. Write results/fx-01.md (<=10 lines); TL alone updates TRACKER.md.
