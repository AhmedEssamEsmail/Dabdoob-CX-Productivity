# FUX-15 — DONE
Files: src/features/shared/components/shell/AppShell.tsx; specs/legacy-parity/data/legacy-i18n-ar.json
Done: rail-search label wrapped in .rail-search-label; kbd hint platform-aware via effect (SSR-safe '⌘K', 'Ctrl K' post-mount); falling-edge focus-restore effect on paletteOpen covers all close paths, onClose simplified; 4 AR keys added.
Checks: eslint AppShell.tsx clean (1 inline disable for set-state-in-effect); npx tsc --noEmit exit 0; JSON parse + 4 keys verified.
Handoff: none. Completes ux-11/12/13/14; FUX-14 owns the CSS hooks.
