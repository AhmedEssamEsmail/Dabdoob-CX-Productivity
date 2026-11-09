# FIX-06 results
Status: done
Files: src/features/shared/platform/repo.ts; tests/platform/repo.test.ts
Checks: vitest tests/platform/repo.test.ts -> 15/15 green. tsc --noEmit shows 1 pre-existing error in tests/jobs/routes.test.ts (Request vs NextRequest), outside shard Files; not introduced here.
Notes: upsert now sends patchByKey payloads {keyField, patch, stamps}; `out` still merged rows; constraint fallback untouched. Regression test asserts payload keys == [id,status,updated_at,updated_by].
