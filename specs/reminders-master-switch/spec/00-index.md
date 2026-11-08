# Spec index: reminders-master-switch
Kind: index
Size gate: PASS

| ID | Kind | Spec/index path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| RMS-01 | mini | 01-config-key.md | dev | none | #1 | 2/2/30/8 |
| RMS-02 | mini | 02-popups-gate.md | dev | RMS-01 | #3, #6 | 2/3/90/12 |
| RMS-03 | mini | 03-alerts-gate.md | dev | RMS-01 | #3, #6 | 2/2/75/10 |
| RMS-04 | mini | 04-sendonce-gate.md | dev | RMS-01 | #4, #6 | 2/2/70/10 |
| RMS-05 | mini | 05-missed-esc-gate.md | dev | RMS-02, RMS-04 | #4, #5 | 2/2/120/15 |
| RMS-06 | mini | 06-dq-checkin-gate.md | dev | RMS-01 | #4 | 2/2/80/12 |
| RMS-07 | mini | 07-qa-ctl-gate.md | dev | RMS-01 | #4 | 2/2/85/12 |
| RMS-08 | mini | 08-admin-block.md | dev | RMS-01 | #2 | 1/2/60/10 |

Ready work: RMS-01 first (publishes `reminders_enabled` + `remindersOn()`);
then RMS-02, RMS-03, RMS-04, RMS-06, RMS-07, RMS-08 in parallel (all distinct
files); RMS-05 after RMS-02 + RMS-04 (its test asserts the full off surface).
Post-leaf PM step (not a shard): after all leaves + `npx tsc --noEmit` +
`npx vitest run` pass, one `git commit` of exactly the leaf Files lists —
the user asked for a single commit; no push.

Size gate evidence: every leaf <=3 files / 3 actions / 200 lines / 15 min;
largest is RMS-05 (120 lines, fixture-heavy test). Coverage: criteria 1-7 all
mapped above; no criterion dropped. Tests live one-per-leaf in
tests/golden/reminders-off-*.test.ts (hub-fakes harness) — no shared test file,
so leaves stay parallel-safe. Golden oracle parity unaffected: gates are no-ops
while `reminders_enabled` is absent/true (default true).
