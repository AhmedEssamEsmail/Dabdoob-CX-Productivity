# FUX-04 — command palette scrollIntoView
Status: DONE
Files: src/features/shared/components/shell/CommandPalette.tsx (+useRef import, listRef on .cpk-list, useEffect on [active] -> scrollIntoView({block:'nearest'}))
Checks: `npx eslint CommandPalette.tsx` exit 0; `npx tsc --noEmit` exit 0
Handoff: none — FUX-05 adds ARIA on same elements.
