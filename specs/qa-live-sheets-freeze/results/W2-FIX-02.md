# W2-FIX-02 — qaReconcileQueueLog_ loud reads + chunked .in()
Status: done
Files: src/features/cx-quality/lib/migrate.ts (qaReconcileQueueLog_ body :406-462 only)
Changes: removed both `.catch(() => [] as Row[])` (qe_queue_log + qa_audits reads now throw); update loop now slices g.keys in 100-key chunks, one `.update().eq().in()` per slice, `described` error unchanged.
Checks: `npx tsc --noEmit` exit 0; `catch(() => [])` grep: 0 matches in file.
Blockers: none. Handoff: reconcile fails loudly and chunks writes; ready for TL verification.
