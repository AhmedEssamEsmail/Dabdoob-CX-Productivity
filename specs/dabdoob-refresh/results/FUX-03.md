# FUX-03 results
Status: done
Files: src/features/shared/components/shell/CommandPalette.tsx; src/features/shared/components/shell/AppShell.tsx
Changes: added first `onKeyDown` branch preventing `Tab`/`Shift+Tab` in `.cpk`; added `railSearchRef` (L99), `ref={railSearchRef}` on `.rail-search` (L424); `onClose` now `setPaletteOpen(false)` + `railSearchRef.current?.focus()` (L603).
Checks: `npx eslint` both files -> exit 0; `npx tsc --noEmit` -> exit 0 clean.
Handoff: palette close paths (Esc/backdrop/Enter) all focus `.rail-search`; ⌘K toggle and route-change close untouched. Blockers: none.
