# data report - home-quality-cards - round 1 (FULL)
Verdict: PASS
Open: 0/0/0/1
Reconciliation: tests/hub-home-quality.test.ts recomputed independently from
fixtures and re-run by this review — exit 0, 5/5.
- admin: month (80+90+60)/3=76.7 ✓, delta 76.7−60=16.7 ✓, week (90+60)/2=75 ✓,
  openCtls 2/3 ✓ (exact tolerance).
- tl: scoped pool (80+90)/2=85 ✓, delta 85−70=15 ✓, week 90 ✓, own-tl_email
  CTLs 1 ✓. agent/specialist → `quality` key absent ✓; missing stores →
  nulls/0, no throw ✓.

## Checks vs PLAN §2 definitions (src/features/cx-hub/lib/aggregates.ts:443-489)
- Pool = `qaRollupAudits_` (kind='audit', status<>'voided', core.ts:263) ∩
  `qaScoreKnown_` (non-blank score/score_final, analytics.ts:304) — exact match.
- `quality.month` = mean of `qaFinalScore_` over `audit_date` ∈
  [monthStart..today], `qaRound1_`, null on empty — matches "audit-weighted
  mean"; same `meanOf` idiom as qaScoresRange_ (analytics.ts:1096).
- `quality.monthDelta` = `qaRound1_(month−prev)`; null when either side null —
  matches; identical delta convention to analytics.ts:1106.
- `quality.week` = mean over [qaPeriodOf_(today,'week',weekStartsOn)..today];
  weekStartsOn parsed via `qeSettingsFrom_(dqSetting_(cfg,'qa_engine_settings'))`
  collapsed `===1?1:0`, default Sunday — identical to engine convention
  (server.ts:1875). Settings read is inside the try (qa-1 fix): malformed JSON
  throws at engine.ts:328/335 → catch → `out.quality=null` ✓.
- `quality.openCtls` = `qa_ctls` status='open' count; admin all, tl
  `normEmail_(tl_email)===user.email` — equals `qaCtlScopeVisible_(…,'mine')`
  leg (core.ts:332-334); no active-agent/shift_tls leg, as PLAN documents.
  `user.email` is normalized by requireRole (identity.ts:50/75).
- Time: `today`=`dqDateKey_(now,cfg)` (Kuwait); monthStart=first of that month,
  prevMonth [prevMonthStart..monthStart−1d]; windows inclusive; partial
  week/month intended; read bounded `gte prevMonthStart, lte today`.
- Access: `quality` set only under `!specialist && role!=='agent'` — absent for
  agent/specialist; UI row gated identically (overview-page.tsx:492) and carries
  `role="group" aria-label="Quality"`, `–` for nulls, signed `Ql` delta.
- Scope: admin all agents (`pulseEmails=null`); TL self + roster rows with
  `tl_email=user` — matches Team-pulse scope (aggregates.ts:414-422).

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| data-1 | L | src/features/cx-hub/lib/aggregates.ts:465 | `mean()` compares raw `String(a.audit_date)`; sibling code slices `.slice(0,10)` (pure.ts:246, analytics.ts:156). Unreachable today (store `lte` + date-key writers), but a 'YYYY-MM-DD…' variant would misclassify. | `const d = String(a.audit_date || '').slice(0, 10)` | dev |

Not verified / assumptions:
- No live DB queries run (no MCP); reconciliation is fixture-based only — row
  counts/drift vs the real qa_audits/qa_ctls stores not audited.
- monthDelta uses already-rounded means (double rounding ≤0.1 vs raw-mean
  delta) — conforms to PLAN literal wording and matches qaScoresRange_.
- Audits with `source='offqueue'` count here per PLAN's explicit pool
  definition (qaScoresRange_ also includes them); analytics.ts:592/pure.ts:247
  exclude them — cross-feature divergence, definition-conformant.
- Non-numeric non-blank `score` would NaN the mean; shared exposure with every
  existing rollup (same helpers), stored scores are numeric.
