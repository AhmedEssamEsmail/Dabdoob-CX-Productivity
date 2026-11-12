# fix-qa-1 — headcount-access-split qa round 1 (blocking findings)

Source: `../reports/qa-1.md`. Findings qa-1..qa-6 routed to `dev`; qa-7 (LOW)
deferred. Org axis = `dqTitleLevel_(position, role)`; access axis = `role`.
Do not touch access/caller gates. Each leaf imports `dqTitleLevel_` from
`@/features/shared/platform/identity` (or `./identity`) — it is already
exported there and stays exported after qa1-01's extraction.

## qa1-01: pwDirectory_ (adapters) gains titleLevel; managerOf/agentsOf/tls go title-keyed
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #5 (access vs org axis); qa-1.md finding qa-1
Skills: none
Budget: files=4; actions=5; changed_lines=60; minutes=10

### Goal
The pure `pwDirectory_` port in adapters.ts resolves managerOf/agentsOf/tls on
the org axis (`titleLevel`) exactly like `pwDirectory` in identity.ts, so
tlqueue.ts team rows and jobs/env.ts tl_email see title-TLs regardless of role.

### Files
- Edit: `src/features/shared/lib/adapters.ts` | DirectoryPerson + pwDirectory_ (lines ~497-568)
- Create: `src/features/shared/lib/title-level.ts` | dqTitleLevel_ moved here verbatim (pure, no imports)
- Edit: `src/features/shared/platform/identity.ts` | drop local dqTitleLevel_ def; import + re-export from title-level.ts (lines ~47-55)
- Edit: `tests/golden/queue-tlqueue.test.ts` | ONLY if a fixture's role/position divergence breaks oracle parity — add/adjust `position` in that fixture, nothing else

### Context
- `src/features/shared/platform/identity.ts:47-55` | dqTitleLevel_ definition to move verbatim
- `src/features/shared/platform/identity.ts:195-285` | target semantics: person.titleLevel, lookup(), managerOf/agentsOf/tls
- `src/features/shared/lib/adapters.ts:497-568` | DirectoryPerson, pwDirectory_, the 3 role-keyed methods
- `src/features/cx-queue/lib/tlqueue.ts:599` + `src/features/shared/jobs/env.ts:286` | live consumers

### Contract
- New file exports `dqTitleLevel_(position: unknown, role: string): 'agent' | 'tl' | 'manager'` — the identity.ts:47-55 body verbatim, comment included.
- identity.ts: `import { dqTitleLevel_ } from '@/features/shared/lib/title-level'` and `export { dqTitleLevel_ }` so every existing `... from '.../identity'` import still resolves; internal uses at :239/:259 unchanged.
- adapters DirectoryPerson gains `titleLevel: 'agent' | 'tl' | 'manager'`; each roster row sets `dqTitleLevel_(r.position, String(r.role || ''))` at build; the synthetic non-rostered admin entry gets `dqTitleLevel_('', 'admin')`.
- Rewire inside pwDirectory_: `managerOf` -> `titleLevel === 'agent'` returns tlEmail, `titleLevel === 'tl'` returns admins[0], else null; `agentsOf` filters `titleLevel === 'agent' && active && tlEmail === t`; `tls` filters `titleLevel === 'tl' && active`. Mirrors identity.ts:272-285.
- Out of scope: identity pwDirectory body beyond the dqTitleLevel_ extraction; any other adapters function; callers.

### Actions
1. Create title-level.ts with dqTitleLevel_ verbatim; update identity.ts to import + re-export it.
2. Add `titleLevel` to adapters DirectoryPerson and populate it in both build sites.
3. Re-point managerOf/agentsOf/tls predicates to titleLevel.
4. Reconcile the one named golden fixture only if parity breaks from divergent role/position.
5. Run Verify; write results/qa1-01.md.

### Done when
- `tls()` includes a person with role='admin' + position='Customer Experience Team Leader'; `managerOf` of that person returns admins[0]; role-keyed predicates gone from the 3 methods.
- tsc + eslint clean; named golden tests pass (fixture reconciled only if needed).

### Verify
- Run: `npx vitest run tests/golden/queue-tlqueue.test.ts tests/golden/people-jobs.test.ts && npx tsc --noEmit` -> exit 0

### Handoff
Downstream leaves import dqTitleLevel_ from identity as today (re-export keeps it); adapters DirectoryPerson now has titleLevel for any future port.
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-02: pwPair_ gates + kind on title axis
Kind: mini
ID: qa1-02
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #5; qa-1.md finding qa-2
Skills: none
Budget: files=2; actions=3; changed_lines=15; minutes=5

### Goal
`pwPair_` eligibility and `kind` derive from the report's org level so the
booking path matches the oneOnOnesPage list (a TL-titled admin/specialist books
a 'tl' 1:1 instead of throwing or logging 'agent').

### Files
- Edit: `src/features/cx-people/lib/one-on-ones.ts` | pwPair_ only (lines ~180-194) + import line 25
- Edit: `tests/golden/people.test.ts` | ONLY if a DIR_SEAMS fixture's role/position divergence breaks oracle parity — reconcile `position` in that fixture, nothing else

### Context
- `src/features/cx-people/lib/one-on-ones.ts:180-194` | current role-keyed gate + kind
- `src/features/cx-people/lib/one-on-ones-page.ts:106-119` | page semantics: reports = dir.tls() + titleLevel 'agent'; kind from dqTitleLevel_
- `src/features/shared/platform/identity.ts:47-55` | dqTitleLevel_ signature

### Contract
- `const level = dqTitleLevel_(report.position, report.role)`; throw the existing '1:1s are held with agents, specialists and team leads.' when level is neither 'tl' nor 'agent'; return `kind: level === 'tl' ? 'tl' : 'agent'`.
- Add `dqTitleLevel_` to the existing identity import (line 25). Keep every other check (active, self, pwIsManagerOf_) and error strings unchanged.
- Out of scope: Directory typing, oneOnOnesPage, callers, any other function.

### Actions
1. Import dqTitleLevel_; replace the role gate and kind derivation in pwPair_.
2. Reconcile the one named fixture only if parity breaks.
3. Run Verify; write results/qa1-02.md.

### Done when
- TL-titled admin report -> kind 'tl', no throw; manager-titled report still throws; tsc + golden people test green.

### Verify
- Run: `npx vitest run tests/golden/people.test.ts && npx tsc --noEmit` -> exit 0

### Handoff
None (leaf-local behaviour).
Write results/qa1-02.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-03: asTlFollowUps_ picks TL population by title
Kind: mini
ID: qa1-03
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #5; qa-1.md finding qa-3
Skills: none
Budget: files=1; actions=2; changed_lines=5; minutes=5

### Goal
The manager follow-up report scans threads from title-TLs, not `role==='tl'`
rows, so title-TLs with admin/agent access are included.

### Files
- Edit: `src/features/cx-hub/lib/myday.ts` | asTlFollowUps_ roster predicate (line ~522) + barrel import (lines 15-26)

### Context
- `src/features/cx-hub/lib/myday.ts:518-526` | current `String(r.role) === 'tl'` predicate; rows already carry `position` via readStore
- `src/features/cx-hub/lib/myday.ts:15-26` | existing `@/features/shared/platform` import block
- `src/features/shared/platform/identity.ts:47-55` | dqTitleLevel_ signature (re-exported by the platform barrel)

### Contract
- Predicate becomes `dqTitleLevel_(r.position, r.role) === 'tl' && (r.active === '' || isTrue_(r.active))`; add `dqTitleLevel_` to the platform barrel import. Nothing else changes (query, thread scan, done map untouched).
- Out of scope: every other function/filter in myday.ts.

### Actions
1. Add dqTitleLevel_ to the import; swap the predicate.
2. Run Verify; write results/qa1-03.md.

### Done when
- `role!=='tl'` + title-TL rows populate `tls`; tsc + eslint clean on myday.ts.

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-hub/lib/myday.ts` -> exit 0

### Handoff
None.
Write results/qa1-03.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-04: viewAsAuditors uses the qaAuditors_ predicate
Kind: mini
ID: qa1-04
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #5; qa-1.md finding qa-4
Skills: none
Budget: files=1; actions=2; changed_lines=5; minutes=5

### Goal
The view-as auditor set equals the real auditor set: title-TLs on any access
count as auditors, matching `qaAuditors_` in server.ts.

### Files
- Edit: `src/features/shared/platform/viewas.ts` | viewAsAuditors predicate (line ~127) + identity import (line ~19)

### Context
- `src/features/shared/platform/viewas.ts:118-137` | current `p.role === 'tl' || keyword` predicate
- `src/features/cx-quality/lib/server.ts:243-255` | qaAuditors_ target predicate: `dqTitleLevel_(p.position, p.role) === 'tl' || keys.some(...)`
- `src/features/shared/platform/identity.ts:47-55` | dqTitleLevel_ signature

### Contract
- Replace `p.role === 'tl'` with `dqTitleLevel_(p.position, p.role) === 'tl'` inside the same `p.active && (...)` guard; keep the position-keyword branch, config emails loop, and signature identical. Add `dqTitleLevel_` to the existing `./identity` import.
- Out of scope: getViewAsPeople, viewAsLog, every other export.

### Actions
1. Add dqTitleLevel_ to the identity import; swap the predicate.
2. Run Verify; write results/qa1-04.md.

### Done when
- Predicate text matches qaAuditors_'s title-axis half; tsc + eslint clean on viewas.ts.

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/shared/platform/viewas.ts` -> exit 0

### Handoff
None.
Write results/qa1-04.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-05: coachingPage people list on title axis
Kind: mini
ID: qa1-05
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #5; qa-1.md finding qa-5
Skills: none
Budget: files=1; actions=2; changed_lines=4; minutes=5

### Goal
The coaching people list includes everyone below manager level on the org axis
(title-TLs holding specialist access appear; access role no longer decides).

### Files
- Edit: `src/features/cx-people/lib/coaching.ts` | people filter (line ~34) + identity import (line ~15)

### Context
- `src/features/cx-people/lib/coaching.ts:26-40` | current `p.role === 'agent' || p.role === 'tl'` filter; dir = identity pwDirectory (persons carry `titleLevel`)
- `src/features/shared/platform/identity.ts:195-203` | DirectoryPerson.titleLevel
- `src/features/shared/platform/identity.ts:47-55` | dqTitleLevel_ fallback semantics

### Contract
- Filter becomes `p.active && p.titleLevel !== 'manager' && p.email !== user.email` (equivalently `dqTitleLevel_(p.position, p.role) !== 'manager'` — pick the one that compiles cleanly on the DirectoryPerson type; `titleLevel` is already on the type). Caller gates (`requireRole`, `pwCanSignal_`) stay role-keyed — they are access checks.
- Out of scope: signals query, topic library, every other line.

### Actions
1. Swap the filter predicate (add the dqTitleLevel_ import only if that form is used).
2. Run Verify; write results/qa1-05.md.

### Done when
- Title-TL specialist-access persons appear in the list; tsc + eslint clean on coaching.ts.

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-people/lib/coaching.ts` -> exit 0

### Handoff
None.
Write results/qa1-05.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-06: meeting chair/owner eligibility on title axis
Kind: mini
ID: qa1-06
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #5; qa-1.md finding qa-6
Skills: none
Budget: files=2; actions=4; changed_lines=15; minutes=8

### Goal
Chair picklist, action-owner picklist and the server-side track-as-task check
all allow non-agent title levels, so title-TLs with agent/specialist access can
chair/own while title-agents with tl access cannot.

### Files
- Edit: `src/features/cx-people/lib/meetings.ts` | people payload map (line ~122) + track-as-task chair check (line ~416)
- Edit: `src/features/cx-people/components/meetings-page.tsx` | eligibleOwners (line ~60) + chair option filter (line ~741)

### Context
- `src/features/cx-people/lib/meetings.ts:117-123` | people payload `{email, name, role}` from ctx.dir (identity pwDirectory — has titleLevel)
- `src/features/cx-people/lib/meetings.ts:412-417` | `p.role !== 'tl' && p.role !== 'admin'` throw
- `src/features/cx-people/components/meetings-page.tsx:58-60` | eligibleOwners `p.role !== 'agent'`
- `src/features/cx-people/components/meetings-page.tsx:736-748` | chair `<option>` filter `p.role !== 'agent'`

### Contract
- Payload map adds `titleLevel: p.titleLevel` (keep email/name/role — role is still the access axis shown elsewhere).
- Server check: throw the same 'only team leads' actions can be tracked as tasks.' message when `p.titleLevel === 'agent'` (tl + manager allowed).
- Client: eligibleOwners -> `p.titleLevel !== 'agent' || members.some(...)`; chair filter -> `p.titleLevel !== 'agent'`. Payload items are `any` — no type lift needed.
- Out of scope: pwCanChair_, requireRole gates, attendees list, every other meeting behaviour.

### Actions
1. Add titleLevel to the meetings.ts people payload.
2. Switch the :416 check to titleLevel.
3. Switch both meetings-page.tsx filters to titleLevel.
4. Run Verify; write results/qa1-06.md.

### Done when
- All three sites key on titleLevel; role remains only on access gates; tsc + eslint clean on both files.

### Verify
- Run: `npx tsc --noEmit && npx eslint src/features/cx-people/lib/meetings.ts src/features/cx-people/components/meetings-page.tsx` -> exit 0

### Handoff
people payload now carries `titleLevel` for any future org-axis UI.
Write results/qa1-06.md (<=10 lines); TL alone updates TRACKER.md.
