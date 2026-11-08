# Spec index: S05 merged poll
Kind: index

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S05-01 | mini | S05/01-merged-poll-server.md | dev | S01-02, S04-02 | #5 merged GET /api/popups payload | 3/4/80/7 |
| S05-02 | mini | S05/02-merged-poll-client.md | dev | S05-01 | #5 single client poller | 3/5/120/9 |

notify.ts (S05-01) vs popups.ts (S04-02) are different files; S05-01 still
depends on S04-02 because the merged endpoint composes the filtered popups
read (contract ordering, not file serialization).
