# fix-eslint-tests — DONE

Fixed all 4 eslint errors in the 3 leaf test files:
- tests/lib/use-page-data.test.ts: renamed `render`→`Render` (PascalCase component per react-hooks); moved outer `latest` assignment into `mount`/`settle` to satisfy react-hooks/globals.
- tests/ui/autosave-input.test.tsx: typed `El.props` (handler signatures + Record<string,unknown>); replaced `as any` with `as unknown as (p: Props) => El`.
- tests/ui/paint-grid.test.tsx: same treatment for `El`/`PaintGrid` cast.

Checks: `npx eslint` on 3 files exit=0; `npx vitest run` 3 files exit=0, 18/18 pass (run twice, deterministic).
Full `npx eslint .`: 3 pre-existing errors remain in PRODUCTION source (out of leaf scope, not editable):
src/features/cx-hub/components/ecosystem-scene.tsx:2469 (refs-during-render),
src/features/cx-quality/components/audit-queue-page.tsx:308 (refs-during-render),
src/features/shared/lib/use-options.ts:67 (setState-in-effect). Handoff: needs a dev FIX leaf.
No new deps, no TRACKER edit.
