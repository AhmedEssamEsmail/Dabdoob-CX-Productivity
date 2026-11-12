# RESUME — headcount-access-split (checkpoint 2026-11-12 ~17:4x)
Project root: C:\Users\AHMED\KPIs\CX-Hub · Spec dir: specs\headcount-access-split\
Mode: PM (pm-workflow skill). Status: **review gates in progress** — QA round 1 running.

## Original task (user)
1. Offqueue audits (qa_queue.source='offqueue' / sample_basis 'off-queue'): audit form asks `interaction_at` as DATE-ONLY input (replaces datetime-local for offqueue); stored `yyyy-MM-dd` in qa_audits.interaction_at.
2. /people-holidays headcount mgmt: roster gains gender, mobile, HR ID, employment_status (hiring_date exists) — synced from dq_hct + editable in Edit dialog; split access (roster.role admin/tl/agent/specialist) from title (roster.position); all agent counts = `active && position==='Customer Experience Agent'` (exact).
   - Architect decision (DECISION.md): role stays access; position = title; org features re-point to position-derived `dqTitleLevel_`/`isCxAgent_` in identity.ts with role fallback.

## Build state
- BUILD DONE: all leaves S01–S09 landed (TRACKER.md). tl-1.md, tl-2.md in reports/.
- Gates r2 (tl-2.md): tsc PASS, eslint PASS, vitest PASS (only 4 PRE-EXISTING audit-queue-memo fails), security PASS. e2e 264/715 fails = pre-existing page-contract layout-stability instability (same code failed worse before) — QA gate to confirm attribution.
- New migration: `supabase/migrations/20261112142701_headcount_access_split.sql` (local only).
- Backfill script ready: `scripts/ops/backfill-hct-headcount.mts` (dry-run verified: 51 dq_hct upserts; position=51, code=46, gender=51, contactNumber=45).

## Gates pipeline (PM runs these, in order)
1. **QA round 1 — RUNNING**: background agent id `8d7cb38a` (qa-expert). After IDE restart it is GONE — re-spawn fresh: `Review task headcount-access-split, mode FULL, round 1. Plan: specs\headcount-access-split\PLAN.md. TL report: specs\headcount-access-split\reports\tl-2.md. Write specs\headcount-access-split\reports\qa-1.md.` (check if qa-1.md already exists first).
2. Then **security-expert** (auth flag) → **data-analyst** (data flag) → **ux-ui-expert** (ui flag). Perf skipped. Same spawn pattern, report prefixes sec/data/ux. FAIL → tech-lead mode FIX + DELTA re-review, max 3 rounds.
3. Any fix round changing code after QA passed → one qa-expert DELTA.

## Blocked: remote DB write (USER ACTION PENDING)
- User approved "apply migration + run backfill", then chose **"I'll re-login supabase CLI"** (local login can't see org vpuijfisgbfilvtdactp → 403; no DB password in env). See reports\release-1.md.
- **Next**: verify `env -u SUPABASE_ACCESS_TOKEN npx supabase migration list --remote` works (Target: uugeyulccyytvgcabzzx). NOTE: 4 OTHER untracked pending migrations exist — do NOT `db push`; apply ONLY our file (e.g. direct SQL or targeted push), then run `npx tsx scripts/ops/backfill-hct-headcount.mts` live. Re-dispatch devops or do directly with approval already granted.

## NEW scope added by user mid-flight (not yet specced/built)
1. **Holiday form layout** in /people-holidays: holiday box too wide, date input too narrow — `src/features/cx-hub/components/people-holidays-page.tsx` ~line 521 form `dq-holform` (CSS likely in a .css file — grep `dq-holform`).
2. **Admin Reminders master switch**: currently a `Reminders` BUTTON — `src/features/cx-hub/components/admin-page.tsx` ~321-363 (`reminders_enabled` config, `Ln.saveConfigSetting`). User wants an off/on TOGGLE (use existing `Toggle` component from shared/ui).
3. **Remove "Reduce transparency" + "Reduce motion"** buttons AND their functions — found in `src/features/cx-hub/components/admin-page.tsx` (grep `Reduce transparency|Reduce motion|reduceTransparency|reduceMotion` src).
   → Dispatch as 1-2 dev mini-shards (small UI edits); ux gate covers them.

## Final step (user instruction)
**Commit + push ONLY after ALL work finishes** (main task + 3 UI fixes + gates green). After push: poll the Vercel deployment to READY/ERROR per workflow.md deploy gate.

## Reminders for next session
- Subagents: `run_subagent` is_background:true only; never resume; fresh spawn + file paths for follow-ups.
- Lessons live in CX-Hub/.devin/lessons.md + global lessons.md — read first.
- Remote supabase CLI: `env -u SUPABASE_ACCESS_TOKEN ... --remote`, check `Target:` line.
