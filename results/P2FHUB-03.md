# P2FHUB-03 — /admin section retry + reminders error state

Status: DONE (code). Browser abort-probe left to auditor per shard Handoff.
Files: src/features/cx-hub/components/admin-page.tsx (only).
Changes: extracted `loadConfig` (useCallback, clears error then refetches);
settings section keeps styled `field-error` + quiet "Try again" Button;
`Rb` gained `error`/`onRetry` props — `rows===null && error` renders
`<Chip status="bad">error</Chip>` + Try again instead of perpetual "loading".
Checks: `npx eslint admin-page.tsx` 0 problems; `npx tsc --noEmit` exit 0.
Note: `Oo` dropdown load errors untouched (separate path, per out-of-scope).
Handoff: auditor re-probes /admin with `/api/admin*` blocked; retry should refetch.
