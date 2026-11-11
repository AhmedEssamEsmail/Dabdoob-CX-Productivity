# P2FPROD-01 — DONE

- Reproduced: `/tph-grid` → `/tph` left `document.title="Dabdoob CX"` while h1/crumb/nav resolved to TPH; direct `/tph` was already correct.
- Root cause: Next's metadata title insertion lands after AppShell's title effect on client redirect.
- Fix: `src/features/shared/components/shell/AppShell.tsx` re-asserts the shared title immediately and at 0/50/200ms; removed the `visible` `useMemo` that failed React Compiler lint.
- Files: `src/features/shared/components/shell/AppShell.tsx` only.
- Checks: Playwright admin @1024 — `/tph-grid`→`/tph` title `TPH and caps · Dabdoob CX Productivity` 10/10; `/tph`, `/overview`, `/quality-scores` titles correct.
- `npx eslint src/features/shared/components/shell/AppShell.tsx` clean; `npx tsc --noEmit` exit 0.
- Handoff: TL may mark P2FPROD-01 fixed; no blockers.
