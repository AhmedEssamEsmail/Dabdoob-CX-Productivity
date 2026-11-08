# FUX-07
- Status: done
- File: src/features/cx-queue/components/queue-page.tsx (L192) — mixbar segment style gains `color: var(--cx-age-ink-${ageRank(idx, d.length)})`.
- Checks: `npx eslint src/features/cx-queue/components/queue-page.tsx && npx tsc --noEmit` -> exit 0.
- Scope: only the queue `.mixbar` segment style; no CSS/legend/aging/tph changes.
- Blockers: none.
