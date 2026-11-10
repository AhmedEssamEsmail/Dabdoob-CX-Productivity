status: done
files: src/features/shared/components/ui/PageShell.tsx; src/features/shared/components/shell/Toasts.tsx; src/features/shared/components/shell/OneOnOneAlerts.tsx
checks: npx eslint <3 changed files> -> clean; npx tsc --noEmit -> clean; npx vitest run tests/shell -> 8/8 passed
notes: PageShell useId hoisted unconditionally; Toast onDone ref synced in effect; OneOnOneAlerts mute preference moved to useSyncExternalStore + localStorage notifier
handoff: none
