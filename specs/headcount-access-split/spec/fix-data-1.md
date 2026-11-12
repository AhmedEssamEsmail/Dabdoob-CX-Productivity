# fix-data-1 — headcount-access-split data round 1 (blocking findings)

Source: `../reports/data-1.md`. Blocking: data-1, data-2 (MED). Deferred LOW:
data-3 (adapters `by` synthetic admins), data-4 (legacy tph copies role-keyed),
data-5 (`dqHctActive_` LWD guard doc + backfill check — revisit at the approved
backfill run). Unified roster `active` rule = identity's `!== 'false'` form
(`roster.active` is `BOOLEAN DEFAULT TRUE`: NULL means active).

## data1-01: tphCheckAgent_ write gate keys on isCxAgent_
Kind: mini
ID: data1-01
Parent: fix-data-1
Owner: dev
Depends: none
Criteria: PLAN #6 (headcount = position axis); data-1.md finding data-1
Skills: none
Budget: files=2; actions=3; changed_lines=80; minutes=8

### Goal
The TPH write gate accepts exactly the people the TPH people grid shows:
active `Customer Experience Agent` position holders — not access role
`agent`/`specialist`. A CX-Manager-titled row with role='agent' and an
Enablemen-Specialist-titled row can no longer be written; a CX-Agent-titled
row with a non-agent access role can.

### Files
- Edit: `src/features/cx-productivity/lib/tph/write.ts` | tphCheckAgent_ predicate (line ~47) + identity import (lines 1-17)
- Create: `tests/perf/tph-write-gate.test.ts` | focused unit pin for tphCheckAgent_

### Context
- `src/features/cx-productivity/lib/tph/write.ts:41-50` | current role-keyed gate (`p.role !== 'agent' && p.role !== 'specialist'`)
- `src/features/shared/platform/identity.ts:35-43` | `isCxAgent_(p)` — checks `active` itself; takes `{ active?: unknown; position?: unknown }`
- `src/features/cx-productivity/lib/tph/page.ts:117-129,145-152` | TphStore['dir'] persons carry `position` + `active` (built by identity pwDirectory)
- `tests/perf/tph-store.test.ts:1-56` | supabase/auth/settings mock pattern if needed ('server-only' is aliased to tests/stubs/server-only.ts)

### Contract
- Line ~47 becomes `if (!p || !isCxAgent_(p)) throw new Error('That person is not an active agent.')` — same message, same return `p.email`. Import `isCxAgent_` from `@/features/shared/platform/identity` (page.ts:5 already imports from there; no new cycle).
- Test pins: position='Customer Experience Agent' + active + role='admin' -> returns email; same position + role='agent' + active=false -> throws; position='Enablemen Specialist' + role='specialist' + active -> throws; position='Customer Experience Manager' -> throws; unknown email -> throws.
- Out of scope: legacy `tphPeople_`/`tphCheckAgent_` copies in tph/index.ts (deferred data-4); every other write.ts function; tph/page.ts.

### Actions
1. Add the isCxAgent_ import; swap the predicate in tphCheckAgent_.
2. Create the focused test file above.
3. Run Verify; write results/data1-01.md.

### Done when
- Gate passes for CX-agent-titled rows regardless of role; rejects specialist/manager-titled and inactive/unknown rows; tsc + new test green.

### Verify
- Run: `npx vitest run tests/perf/tph-write-gate.test.ts && npx tsc --noEmit` -> exit 0

### Handoff
None (leaf-local gate).
Write results/data1-01.md (<=10 lines); TL alone updates TRACKER.md.

## data1-02: roster `active` NULL predicate unified to `!== 'false'`
Kind: mini
ID: data1-02
Parent: fix-data-1
Owner: dev
Depends: none
Criteria: PLAN #6; data-1.md finding data-2
Skills: none
Budget: files=5; actions=6; changed_lines=80; minutes=10

### Goal
Every roster-row `active` coercion treats NULL as active (column is
`BOOLEAN DEFAULT TRUE`), matching identity.ts:219/123 — so the same row is
signable, listed, and counted identically by pwDirectory, pwDirectory_,
dqActiveTlEmails_, getRosterAdmin, the HCT sync deactivation check, the
report-to check and asTlFollowUps_.

### Files
- Edit: `src/features/shared/lib/adapters.ts` | pwDirectory_ active coercion (line ~528-529)
- Edit: `src/features/cx-queue/lib/jobs.ts` | dqActiveTlEmails_ active coercion (line ~277)
- Edit: `src/features/cx-hub/lib/roster.ts` | three sites: wasActive (~336), mgrActive (~444-445), people map (~517)
- Edit: `src/features/cx-hub/lib/myday.ts` | asTlFollowUps_ ROSTER_TABLE predicate (line ~523)
- Create: `tests/platform/roster-active.test.ts` | NULL -> active pin

### Context
- `src/features/shared/platform/identity.ts:219` | target form: `r.active !== false && String(r.active).toLowerCase() !== 'false'`
- `src/features/shared/platform/identity.ts:123` | same form in roleForEmail
- `src/features/cx-hub/lib/myday.ts:148` | `isTrue_` = `=== 'true'` semantics (do not change isTrue_ itself — swap the call site only)
- `supabase/migrations/20261030163812_*.sql:19` (per report) | `active BOOLEAN DEFAULT TRUE` nullable

### Contract
- All five sites adopt the identity form verbatim: `X.active !== false && String(X.active).toLowerCase() !== 'false'` (X = r/cur/mgr/row as named locally). For sites that already include `=== ''` the '' case is covered by the new form — drop the extra clause.
- myday.ts:523 predicate becomes `dqTitleLevel_(r.position, String(r.role || '')) === 'tl' && (r.active !== false && String(r.active).toLowerCase() !== 'false')` — keep isTrue_ defined (other callers use it, e.g. meeting_series at :349).
- Test: `pwDirectory_` from adapters (pure, importable) with `[{ email:'a@dabdoob.com', name:'A', role:'agent', tl_email:null, active:null }]` -> `by['a@dabdoob.com'].active === true`; `active:'false'` -> `active === false`.
- Out of scope: non-roster `active` reads (meeting_series, trackers, prod/qa tables, config values); `isCxAgent_` (person-level, already consistent); the optional NOT NULL migration (data1-03); any other roster.ts/myday.ts/jobs.ts code.

### Actions
1. Swap the coercion in adapters.ts pwDirectory_.
2. Swap the coercion in jobs.ts dqActiveTlEmails_.
3. Swap all three roster.ts sites (wasActive, mgrActive, people map).
4. Swap the myday.ts:523 predicate (call-site form, keep isTrue_).
5. Create the focused test file above.
6. Run Verify; write results/data1-02.md.

### Done when
- A NULL-active roster row is `active` in pwDirectory_, TL lists, getRosterAdmin people, sync deactivation and report-to checks; `'false'`/false still inactive; tsc + new test green; named golden/perf tests still pass.

### Verify
- Run: `npx vitest run tests/platform/roster-active.test.ts tests/perf/identity-roster.test.ts tests/golden/queue-tlqueue.test.ts tests/golden/people-jobs.test.ts tests/golden/hub-admin.test.ts tests/golden/hub-my-day.test.ts && npx tsc --noEmit` -> exit 0

### Handoff
NULL semantics now uniform; data1-03's NOT NULL migration is then purely
defensive (a future NULL is impossible, not merely misread).
Write results/data1-02.md (<=10 lines); TL alone updates TRACKER.md.

## data1-03: roster.active NOT NULL migration (data-2 optional hardening)
Kind: mini
ID: data1-03
Parent: fix-data-1
Owner: supabase-expert
Depends: none
Criteria: PLAN #6; data-1.md finding data-2 (optional half)
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=5

### Goal
New timestamped migration backfills `roster.active` NULLs to TRUE and sets the
column NOT NULL, so the DEFAULT TRUE contract is enforced and the unified
predicate can never meet a new NULL.

### Files
- Generated: `supabase/migrations/` | one output of `npx supabase migration new roster_active_not_null`

### Context
- `specs/headcount-access-split/results/S01-01.md` | precedent: migration file is local-only, auto-applies on merge to main via the Supabase GitHub integration — no remote commands
- `reports/data-1.md` finding data-2 | "optionally `ALTER COLUMN active SET NOT NULL` after backfilling NULLs->true"
- `src/features/shared/platform/identity.ts:219` | predicate treats NULL as active today

### Contract
- Migration body: `UPDATE public.roster SET active = TRUE WHERE active IS NULL;` then `ALTER TABLE public.roster ALTER COLUMN active SET NOT NULL;` (keep `DEFAULT TRUE`; do not drop it).
- Local file only — no `supabase db push`, no `--remote`, no dashboard SQL.
- Out of scope: any other column/table; code edits.

### Actions
1. Run `npx supabase migration new roster_active_not_null`; record the generated filename.
2. Write the two statements above into it.
3. Run Verify; write results/data1-03.md (include the filename).

### Done when
- One new migration file exists with the UPDATE-then-ALTER statements and nothing else; no remote commands were run.

### Verify
- Run: `git status --porcelain supabase/migrations` -> exactly one new timestamped file; `npx eslint supabase` not required

### Handoff
On merge, production enforces NOT NULL; code predicate (data1-02) already
matches the resulting semantics.
Write results/data1-03.md (<=10 lines); TL alone updates TRACKER.md.
