# S05: Remaining pages — head + cards + pills/empty normalization
Kind: package
ID: S05
Dispatch: NEVER

## Goal and contract
PLAN #5 second half: every page not rebuilt in S04 keeps the same
patterns — `.page-head`/`.dq-head` head (one-line `.page-sub`/
`.page-purpose`, never a prose wall), content in `.card`/`.cx-panel`,
statuses as `.pill`/`.cx-chip[data-status]`, designed `.empty` states
instead of bare text. This is NORMALIZATION, not restructuring: keep the
page's sections, helpers, `D()`, role gating and all e2e/harness hooks.
Shared `PageHead`/`dq-head` helpers already match post-S02-06 — swap
nothing wholesale; fix only what deviates. Ecosystem page is out (renders
bare, legacy-parity) — its title was rebranded in S01-02.

## Children
| Leaf | Pages |
|---|---|
| S05-01 | admin, admin/config, admin/roster |
| S05-02 | people-holidays |
| S05-03 | quality-scores, quality-analytics |
| S05-04 | my-audits, my-auditor-kpis |
| S05-05 | ctls, disputes |
| S05-06 | calibration, kb-gaps |
| S05-07 | qa-forms |
| S05-08 | productivity-analytics |
| S05-09 | checkins, analytics |
| S05-10 | heatmap, scheduler |
| S05-11 | one-on-ones, tl-tasks |
| S05-12 | meetings, my-actions |
| S05-13 | notes, coaching |
| S05-14 | trackers |
| S05-15 | tl-performance, kb-tracker |
| S05-16 | kpi-logs, mail-desk |
| S05-17 | StateScreen UnbuiltPage (all unbuilt registry pages) |

## Completion
Shot harness re-shoot (PM): no page keeps a prose-wall head, bare empty
block or unstyled status text in light or dark.
