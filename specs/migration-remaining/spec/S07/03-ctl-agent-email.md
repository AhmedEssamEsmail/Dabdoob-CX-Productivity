# S07-03: qa_ctls.agent_email — first-occurrence map or audit fallback
Kind: mini
ID: S07-03
Parent: S07
Owner: dev
Depends: S07-01, S07-02
Criteria: reshard row 1b; decisions-ops-tabs.md CTL agent_email gap
Skills: none
Budget: files=1; actions=4; changed_lines=60; minutes=8

## Goal
Resolve qa_ctls.agent_email: verify from probe evidence which 'Agent
Email' occurrence is the A..J agent block; if it is the FIRST, map it
(S07-01's first-occurrence-keeps-bare-name rule makes it unambiguous); if
the evidence contradicts, keep it unmapped and record the
audit_id -> qa_audits recovery verdict instead. Bounded either/or.

## Files
- Edit: `src/features/shared/migration/mappings/ops-tabs.ts` | the 'CTL & Quality' MAPPINGS entry (columns + sheetToDb), its DECISIONS line and the module-header bullet

## Context
- `specs/migration-remaining/logs/probe-ops-tabs.log` | raw 'CTL & Quality' header row — decides first-vs-second occurrence (expected: A..J block first, col-O echo second)
- `specs/migration-remaining/decisions-ops-tabs.md` CTL & Quality section | block layout A..J vs N..R
- `src/features/shared/migration/mappings/ops-tabs.ts:77-91,161-172` | the CTL mapping + transform being extended
- `supabase/migrations/006_quality.sql:104-132` | qa_ctls.agent_email (text default ''), qa_ctls.audit_id indexed join column to qa_audits.audit_id (unique)

## Contract
Primary path: append `'agent_email'` to the CTL mapping `columns` and
`agent_email: 'agent email'` to `sheetToDb` — post-S07-01 the bare key
resolves the FIRST 'Agent Email' column (the A..J agent block); the N..R
audit-echo repeats land under `'agent email#2'`, which nothing maps.
Fallback (only if the probe log shows the agent block NOT first): leave
agent_email out of columns; rewrite the DECISIONS line to
`agent_email -> rejected here: recoverable via qa_ctls.audit_id =
qa_audits.audit_id` and put that join clause in results/S07-03.md so TL
can dispatch the SQL recovery — the leaf writes no SQL itself.
Either way, rewrite the agent_email DECISIONS string + module-header
bullet to the chosen final state.
Out of scope: engine.ts; FD_AUX (S07-02); the N..R block (stays unmapped,
`rejected: ⊆ qa_audits` stands); validate.ts.

## Actions
1. Read the probe log's 'CTL & Quality' header row; record whether the A..J 'Agent Email' is the first occurrence.
2. Apply the matching path: columns + sheetToDb edit, or the fallback DECISIONS rewrite.
3. Update the module-header KNOWN-GAPS bullet + agent_email DECISIONS string to the chosen final state.
4. `npx tsc --noEmit` and log the result.

## Done when
- `npx tsc --noEmit` exits 0.
- agent_email is either mapped to the first 'agent email' occurrence, or the audit_id->qa_audits verdict is recorded with the probe evidence cited; no '(blocked)' wording remains.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s07-03-tsc.log 2>&1; echo "exit=$?"; tail -c 800 specs/migration-remaining/logs/s07-03-tsc.log` -> exit=0

## Handoff
If mapped: the PM's live `--tables qa_ctls` re-run fills agent_email via
upsert on ctl_id. If fallback: results file hands the audit_id->qa_audits
recovery to TL as a supabase-expert follow-up. Write results/S07-03.md;
TL updates TRACKER.md.
