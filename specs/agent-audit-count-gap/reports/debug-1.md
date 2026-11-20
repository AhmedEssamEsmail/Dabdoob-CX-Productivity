# debug report - agent-audit-count-gap - 1

Verdict: ROOT_CAUSE_FOUND — the 26 is correct by design (D1 random-only count); the 17-audit delta is fully explained by `sample_basis = 'off-queue'` rows. No missing DB rows, no misclassification.

## Repro (read-only, both sources agree)

- DB (`qa_audits`, Supabase project `uugeyulccyytvgcabzzx`): 239 rows for `agent_email = kareem.salah@dabdoob.com`. Replicating the app filter chain (`qaRollupAudits_` → `qaScoreKnown_` → `qaScoreDate_(a,'interaction')` → `qaSampleBasis_ === 'random'`) verbatim gives `2026-11 | COUNTED = 26` — matches the UI.
- Sheet (`CC2 Quality`, `qa_audits` tab, 7,104 data rows): 239 rows for the same agent — identical set, no sync drift; 43 have a normalized `interaction_at` date in `2026-11`.
- Of those 43: `sb=random|src=(blank)` = 26, `sb=off-queue|src=offqueue` = 17 (stored values on BOTH sheet and DB; not derived).
- Recon script `specs/agent-audit-count-gap/logs/recon.mts` (deleted after run), exit=0; per-row table quoted below.

## Root cause

`src/features/cx-quality/lib/analytics.ts:556-558` — `isRandom = a => qaSampleBasis_(a) === 'random'`; `rnd = cur.filter(isRandom)`; then `:588` `agentsAll = by(rnd, agentOf)` and `:638` `audits: list.length`. The Agents-table `audits` column intentionally counts only the engine's random daily draw (design D1). The 17 delta rows are off-queue audits (`source='offqueue'`, `queue_id` prefix `QAO_`, stored `sample_basis='off-queue'`) — manually picked tickets, which `qaSampleBasis_` (analytics.ts:179-184) keeps out of `random`. All 17 are `kind='audit'`, all scored, none voided/disputed, all with Nov `interaction_at` — they fail ONLY the basis filter.

## Per-row classification of the 43 sheet rows (Nov interaction dates)

| Class | n | audit_ids |
| --- | --- | --- |
| COUNTED (random, in UI 26) | 26 | QA_mw52ylw3wxit, QA_mw536jrkn14y, QA_mw53a8w4v3r0, QA_mw53dsezn7ke, QA_mw53hf6rv5o5, QA_mw95xpo2yl8a, QA_mw96ediizby0, QA_mw96nwha4u1v, QA_mw96w7qwur20, QA_mwaebm684y4v, QA_mwaejhshxw48, QA_mwkkde6ch17r, QA_mwkkhnemajpv, QA_mwkklpnfz1ba, QA_mwkkqtb7akt5, QA_mwkkvhudh9jj, QA_mwlwkuqxvqbp, QA_mwlx6hh9v7ht, QA_mwlxas3mbvnr, QA_mwlxh0xq3pr8, QA_mwlxq3x9l9fc, QA_mworby6ghunx, QA_mworh15e63nv, QA_mworjkv9pkp5, QA_mwormrubo9px, QA_mworquhrlo62 |
| basis:off-queue (excluded by design) | 17 | QA_mw8vq7yzhcla, QA_mw8wf9z2l78y, QA_mw8wqz4zw2qa, QA_mw8x3ai4kg58, QA_mw8x825utfk3, QA_mwaf1j7w5ojs, QA_mwaf4s45v2ez, QA_mwjadr7575ku, QA_mwjan1i7nix8, QA_mwjazvfd5ghx, QA_mwjbawf4odcc, QA_mwjbjkak1woy, QA_mwjc8qxq18va, QA_mwlryz3vph4s, QA_mwls3n5jujwt, QA_mwlsj6803af3, QA_mwlsoyi7ul4d |

Exclusion-bucket tally vs PLAN's candidate causes: not synced to DB **0** · rollup (kind/status) **0** · blank score **0** · non-`random` sample_basis **17 (all off-queue)** · interaction-date fallback outside 2026-11 **0** · inactive-agent filter **0** (agent active — appears in the table with 26).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
| --- | --- | --- | --- | --- | --- |
| dbg-1 | INFO | analytics.ts:556-558,588,638 | 26-vs-43 gap = 17 off-queue audits excluded by design D1; DB/sheet verified identical (239 rows each, stored `sample_basis` agrees). Count is correct; this is a user-expectation/documentation gap, not a defect. | No code fix required. Optional (UX, non-blocking): the payload already emits a per-basis breakdown `bases[]` (analytics.ts:618-621) incl. `off-queue` n — surface it near the Agents table or in the drill-down so users can self-verify; `getQaAnalyticsAudits` (server.ts:1976) already returns the counted rows. | dev (optional UX only) |

## Regression test

n/a — no defect to pin. The random-only rule is already exercised by `tests/quality/qa-interaction-date.test.ts` and golden coverage in `tests/golden/quality.test.ts`. If the team wants an explicit pin of D1, a new `tests/quality/qa-agents-random-only.test.ts` asserting `byAgent[].audits` excludes `sample_basis='off-queue'` rows would document it (not created — no failing behaviour to prove).

## Siblings

Same confusion will recur for any agent with `off-queue`/`request`/`targeted`/`historical` audits — the sheet tab holds every audit; the Agents table shows only `random`. Verification path for future tickets: agent drill-down (`getQaAnalyticsAudits`) + the `bases[]` breakdown on the same analytics payload. Kareem's other months show the same pattern (`2026-10`: 29 counted vs 6 off-queue; Aug–Sep dominated by `historical` imports).
