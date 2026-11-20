# Findings: home-quality-cards deferred LOWs (PM-compiled)

Source: reports/ux-1.md (rows ux-2, ux-3) + qa DELTA report (qa-2, file since
deleted per workflow). All LOW, all blocking=YES now (user asked to fix them).

| ID | Sev | Location | Finding | Expected fix | Owner |
|---|---|---|---|---|---|
| low-1 | LOW | `src/features/cx-hub/components/overview-page.tsx` ~511 (Open CTLs `.stat-v`) | When `out.quality = null` (catch path), `Hi(q.openCtls ?? 0)` renders a false `0` while sibling scores show `–` | `q.openCtls == null ? '–' : Hi(q.openCtls)` | dev |
| low-2 | LOW | `src/features/cx-hub/components/overview-page.tsx` ~502,507 (`.stat-d` copy) | `signed change` describes formatting not meaning; `quota week` is internal jargon vs sibling plain hints | Reword: `score points vs last month` and `current week` (per ux-1 suggestion) | dev |
| low-3 | LOW | `tests/hub-home-quality.test.ts` (missing coverage) | qa-2: catch path (`out.quality === null` when the quality block throws — e.g. malformed `qa_engine_settings`) and `weekStartsOn:1` week-window shift are untested | Add its: (a) settings override `qa_engine_settings` with invalid JSON → `res.err` undefined AND `quality === null`; (b) `qa_engine_settings = { weekStartsOn: 1 }` with a countable `2026-05-03` audit → week window starts Mon `2026-05-04`, excluding the 05-03 audit. NOTE: fixture `2026-05-03` is the discriminator day (Sun-start includes it, Mon-start does not); current default audits a8/a9/a10 on 05-03 are all non-counting — the new test needs its own `qa_audits` table via `fx({ tables: { qa_audits: [...] } })` | test-engineer |

Verify: `npx vitest run tests/hub-home-quality.test.ts` · `npx tsc --noEmit` · `npx eslint src/features/cx-hub/components/overview-page.tsx tests/hub-home-quality.test.ts`
LOW-findings.md
