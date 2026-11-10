# Coverage probes — S06-03 (read-only evidence, PLAN #1)

Run: `npx tsx migration/probe-coverage-gaps.ts` -> `logs/coverage-gaps.log`
(exit 0). Zero writes; reads bounded to single sheet columns
(`values.get` page ranges, <=4 chunks/tab) and paged single-column
`select()`s (`reads: sheets=7 supabase=193 writes=0`).
Timestamps parsed with the mirrors.ts rule: `tphClock_` over
`config.activity_local_tz` = `Asia/Kuwait`.

Reference window — `fd_activities`: **207,811 rows**,
`ts_ms` in **[2026-07-02T16:08:22Z .. 2026-11-09T05:49:49Z]**.

## Verdicts

### 1. touch_archive `1qch1v…` / `New Tickets Daily` — **gap**

`Performed At` col A: 430,055 rows, 430,055 parsed, 0 unparseable.
Observed window **[2026-01-05T21:01:54Z .. 2028-07-08T20:43:22Z]** —
breaches fd_activities on **both** sides (`below=true above=true`):
~6 months before (Jan–Jul 2026) and ~20 months after (Nov 2026–Jul 2028)
are not covered by the fd_activities mirror.

### 2. qa_engine_source `1VtBT8…` / `New Tickets Daily` — **gap**

`Performed At` col A: 165,461 rows, 165,461 parsed, 0 unparseable.
Observed window **[2026-01-09T21:43:54Z .. 2028-07-10T20:31:08Z]** —
also breaches on **both** sides (`below=true above=true`). Same shape and
nearly the same span as touch_archive's tab; not a subset of fd_activities.

### 3. qa_queue `1ArWBr…` / `Ticket Detail Cache` — **orphans:1523**

`ID` col A: **25,295** distinct ticket ids.
`qe_fd_cache.id`: **11,645**; `tickets.ticket_id`: **176,616**.
13,650 sheet ids are absent from qe_fd_cache; of those, **1,523 are also
absent from tickets** (sample `354880, 354882, 354883, 354884, 354885,
354888, 354890, 354898, 354899, 354900, …`) — the cache holds ticket
detail rows that never landed anywhere in V2.

**S07-04 verdict — `import: qe_fd_cache`, both sets.**
`migration/backfill-qe-cache-orphans.ts --dry` →
`logs/s07-04-qe-orphans.log` (exit 0, writes=0, sheets=4 supabase=189).
Recomputed sets match this section exactly: MISSING=**13,650** (drift 0),
ORPHAN=**1,523** (drift 0). Bounded samples (50 rows/set, stride across the
set) show real detail content, not V1 residue: subject/status/created_at
fill 50/50, 50/50, 50/50, created_at 100% parseable — MISSING window
[2026-09-04 .. 2026-11-08], ORPHAN window [2026-11-07 .. 2026-11-08]
(the orphans are simply the newest cache rows, written after the last
tickets sync). Sampled rows carry live subjects/statuses
("Order TZG450525 — Gift Note"/Closed, "VWB372855"/No Response From
customer). `--write` upserts the 13,650-row MISSING set (orphans included)
in the mapping's 13-column shape, onConflict `id`, cached_at=now — PM gate.

## Handoff

- S06-09 (fd-history backfill): both NTD tabs are `gap`, dual-sided —
  uncovered ranges Jan 2026→Jul 2026 and Nov 2026→Jul 2028 vs the
  fd_activities window above.
- S06-12 (docs closeout): cite this doc for the three stores' final
  states; the cache is not fully duplicated by qe_fd_cache ∪ tickets.
