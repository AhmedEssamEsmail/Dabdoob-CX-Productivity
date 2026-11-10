# Spec index: supabase-gh-migrations
Kind: index
Size gate: PASS

| ID | Kind | Spec path#section | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | - | #1-#5 | not dispatchable |

Children (in S01.md): S01-01 dev (renames 001-010); S01-02 dev (renames 011-014,
workflow.md DB rule, delete APPLY_PENDING_MIGRATIONS.sql); S01-03
supabase-expert (remote history inspect + repair, approval-gated).

Ready work: S01-01 only. S01-02 waits on S01-01 (needs 010's final version as
monotonic floor; same git index -> serial). S01-03 waits on S01-02 AND requires
user-side `supabase link`/auth plus explicit remote-write approval before
dispatch — PM gates it; not a spec blocker, no NEEDS_USER.

Size gate evidence: manual leaf review vs LIMITS.md — max 10 files, 6 actions,
~15 handwritten lines, 10 min (S01-02); renames change zero content lines;
S01-03 writes one results artifact (`results/remote-history.md`, ~30 lines);
remote history rows are the only remote change. PM/TL must still run
check_shards.py on `spec/S01.md#S01-01` `#S01-02` `#S01-03` before dispatch.
