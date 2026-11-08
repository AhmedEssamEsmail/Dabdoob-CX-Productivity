# S04: QA dispatcher loses every `as never` cast
Kind: mini
ID: S04
Parent: root (maint-src-boundaries)
Owner: dev
Depends: none
Criteria: PLAN #4
Skills: none
Budget: files=2; actions=2; changed_lines=35; minutes=10

## Goal
`src/app/api/qa/[action]/route.ts` has zero `as never`: object params typed
`Record<string, unknown>` (all the `input: Row` server fns), and
`Parameters<typeof qa.qaImportHistory>[0]` for the one differing signature.
`qa-shared.tsx` `P` payload params typed `Record<string, unknown>` where they
are plain object literals. URLs, methods, args parsing, authz unchanged.

## Files
- Edit: `src/app/api/qa/[action]/route.ts` | HANDLERS entries at :16,20-23,27,30-32,34,42,44,47
- Edit: `src/features/cx-quality/components/qa-shared.tsx` | `P` entries :71,74,76,77,81,85,88,90,91,94 — `(t: any)` object params

## Context
- `src/app/api/qa/[action]/route.ts:11-53` | the 12 `(a[0] || {}) as never` casts
- `src/features/cx-quality/lib/server.ts:59` | `type Row = Record<string, unknown>` — the fns' input type
- `src/features/cx-quality/lib/server.ts:2240` | `qaImportHistory(opts?: { budgetMs?: number; secret?: string })` — differs, use Parameters<>
- `src/features/cx-quality/components/qa-shared.tsx:50-63,68-95` | fetchJson/qa/L keep `any` (justified pass-through); only P's object params tighten

## Contract
Replace `(a[0] || {}) as never` with `(a[0] || {}) as Record<string, unknown>` for:
submitQaAudit, requestQaAudit, createQaOffQueueAudit, createQaNonTicketAudit,
submitQaCtl, decideQaDispute, createQaCalibration, submitQaCalibrationAudit,
addQaKbGap, saveQaForm, saveQaSampling (11 sites). For `qaImportHistory` use
`(a[0] || {}) as Parameters<typeof qa.qaImportHistory>[0]`.
In `P`: `submitAudit, requestAudit, createNonTicket, createOffQueue, saveSampling,
submitCtl, decideDispute, createCalibration, submitCalibration, addKbGap` params
become `(t: Record<string, unknown>)`. Call sites pass object literals — compatible.
Out of scope: HANDLERS/parsing/exports, `qa`/`L`/`fetchJson` signatures, server.ts.

## Actions
1. route.ts: replace the 11 Row-shaped `as never` casts with `as Record<string, unknown>` and qaImportHistory's with `Parameters<typeof qa.qaImportHistory>[0]`.
2. qa-shared.tsx: retype the 10 P object params to `Record<string, unknown>`.

## Done when
- `grep -n "as never" src/app/api/qa/[action]/route.ts` -> no matches; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
Dispatcher accepts `Record<string, unknown>` payloads; S06-02's route test relies
on unchanged runtime behavior.
Write results/S04.md (<=10 lines); TL alone updates TRACKER.md.
