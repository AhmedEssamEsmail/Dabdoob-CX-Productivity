# perf1-02 result
Status: DONE. File: src/features/cx-queue/lib/tlqueue.ts (import + maqsamRows/fdActivityRows bodies only).
Both window reads now page via readAllPaged; no unpaged windowed select remains in tlqIo_.
Checks: vitest queue-tlqueue (50) + read-all-paged (13) — 63/63 green; npx tsc --noEmit — 0 errors.
Scope held: 1 file, 2 bodies, TlqIo signatures unchanged. No blockers.
