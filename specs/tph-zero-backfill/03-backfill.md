# 03 — Backfill runner (2026-07-01 → yesterday)

Chunked, resumable admin backfill that recomputes TPH + productivity layers + flags for every day since July. Depends on 01 (mirrors populated) and 02 (errors are described).

## Route — `POST /api/admin/backfill` (admin only)

```ts
{ from='2026-07-01', to=yesterday,
  kinds: ['mirrors','tph','layers','flags'],
  cursor?, force? }
→ { done: [{date,kind,rows}], failed: [{date,kind,step,error,hint}],
    skipped: [{date,reason}], next: cursor|null }
```

- Processes oldest→newest inside a ~240s budget (Vercel 300s max), then returns `next` cursor; caller (admin UI or a small script) loops until `next` is null.
- `force` recomputes already-written dates; default skips dates whose `refresh_log`/outputs show a prior successful build unless requested.

## Per-kind behavior

- **mirrors** — `syncMirror_(env, 'fd_activities', { full:true, since:from−7d, through:to })` and the same for `maqsam_calls`/`freshchat` before anything else (July − 7-day touch-history window).
- **tph** — per date, the 4 steps via canonical `tphRunStep_` (`src/lib/tph/index.ts` signature, JobEnv as io) + `env.flushWrites()`. `tphPastDay_` must allow any past date on this path — the 60-day guard only applies to interactive `run-day`; either lift `run.ts`'s version or thread a `backfill:true` flag.
- **layers** — `runProductivityRange_(chunkFrom, chunkTo, env)` per month chunk (from `src/lib/prod/engine.ts`). A month without `productivity_files[yyyy-MM]` → `skipped` with hint (the `fallback` workbook is the wrong month — do not silently use it).
- **flags** — `prodDetectDates_` per date where `prod_intervals` rows exist; else `skipped: 'no intervals — migrate or snapshot first'`.
- **`prod_tph_days` (grid) is NOT recomputed** — migrated only (04) or TL-logged; audit reports its coverage; days without slots are reported, not faked.

## Persistence / observability

- Log each chunk to `refresh_log` (`job:'backfill'`) so "Last automatic build" updates on the page.
- Mark recomputed dates dirty so `prod_daily_layers` reruns flags-aware the next day (follow the existing dirty-day mechanism in `src/lib/jobs/productivity.ts`).
- Idempotent: every write is upsert/delete+insert keyed by (date[,email[,slot]]) — rerunning the whole range must not duplicate rows.

## Ordering within the run

`mirrors` (once) → per date: `tph.touches` → `tph.calls` → `tph.cases_tickets` → `tph.cases_chats` → `layers` → `flags`. Steps continue past a failed step but record it in `failed` (same convention as `run-day`); a `touches` failure makes later TPH steps for that date pointless — mark them skipped.

## Acceptance

- `POST /api/admin/backfill {from:'2026-07-01', to:'2026-10-31', kinds:['mirrors','tph','layers','flags']}` completes across however many invocations the cursor requires.
- Days with sheet activity produce nonzero `prod_tph_touches` / `prod_tph_calls` / `prod_tph_cases`.
- Months missing `productivity_files` entries are reported in `skipped` with the config hint, not silently dropped.
- Rerun of an already-done range is a no-op unless `force`.
- `refresh_log` shows `backfill` rows per chunk.
- `60d`-guarded interactive path still rejects old dates for non-backfill callers.
