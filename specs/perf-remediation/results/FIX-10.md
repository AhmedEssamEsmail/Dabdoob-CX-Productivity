# FIX-10 result
Status: done
Files: `supabase/migrations/20261108204952_dedupe_uniques_prod_daily_layers_queue_submissions.sql` — section-1 DELETE flipped to `a.id < b.id` (highest id / latest write survives); header comment updated to keep-latest. queue_submissions block, both unique indexes, IS NOT DISTINCT FROM logic untouched.
Checks: `grep -n "a.id < b.id" supabase/migrations/20261108204952_*.sql` -> 1 hit (line 19); visual review — valid DELETE/USING syntax, matches queue_submissions keep-latest intent.
Blockers/handoff: none; remote apply stays NEEDS_APPROVAL (migration unapplied).
