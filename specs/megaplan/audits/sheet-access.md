# Sheet-access probe — service-account share audit (2026-11-06)

> Evidence for WP-51 (shard-80 full migration) / WP-34 (credentials audit) / G6.
> Probe: `scripts/check-sheet-access.mts` (`npx tsx scripts/check-sheet-access.mts`) — read-only `spreadsheets.get` + Config/Trackers/`sc_months` tab reads. Re-runnable.

**Auth:** service-account JSON key `cx-kpis-513312-62811753ea9c.json` (gitignored via `cx-kpis-*.json`), SA = `migration-reader@cx-kpis-513312.iam.gserviceaccount.com`, scope `spreadsheets.readonly`. Viewer share is sufficient — the migration never writes back to sheets.

**Result: 19 readable / 3 not shared (403 "caller does not have permission").**
**Re-probe 2026-11-06 (WP-34, `audits/credentials.md` §3): 22/22 readable, 0 failures** — the 3 sheets in §"NOT shared" below are now shared. `sc_months` also gained 3 rows (2026-09/10/11 → the Oct-2026 workbook). The tables below are kept as the pre-share record.

## ✅ Shared — verified titles

| Sheet title | ID | Source |
|---|---|---|
| CC2 Core | `1PdDr3J5JECemwPAcf5sCy8b8ivZ5C6hBxBsso1bZVGs` | `GOOGLE_SHEET_ID` / MIGRATION_READINESS.md |
| CC2 Quality | `1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w` | `ss_quality_id` |
| CC2 Productivity | `1h77da05ZjlxjGCArlr1tGJv7OEtmemFGde8sBnitc-g` | `ss_productivity_id` |
| Voice QA Form V1 (Responses) | `1bna3_kNAxdaS2dPJUMTTw75NKQiwAN6NJVbxRxPKeqA` | `QA_HIST_SOURCES.voice` |
| Texting QA Form V1 (Responses) | `1BNzinvWZ_1qm5QZX-Thqk0oR3CvfkNMnJ7TPi1_wy6k` | `QA_HIST_SOURCES.text` |
| Blocked Customers | `1KFC6ENFbQWPmRSziH9gLsBQED1hnh_e9ZknsjwruPEA` | tracker `blocked_customers` |
| Dabdoob Promo Codes Documentation (Responses) | `1GsBilEGkmXqBSgmiv4jM5UHWPeW0_DpdmBVA3L1zgTw` | tracker `promocodes` |
| Operational Loss \| Dabdoob | `12jVdX8CziY9sS_AVd1kZJEnRp82I3YFLXSCUuu_e5Uc` | tracker `operational_loss` / `ol_sheet_id` |
| Customers Strikes | `1Odij24BsYeukoqdGXOmqnVq36SL7s-8pFR9Jpz3OMmQ` | tracker `customer_strikes` |
| Dabdoob Refund Ledger — data | `1ZaJnCVOmZF42KAYpd3YwDrsr1gY7fIEwTxUeAESgGU8` | tracker `refund_ledger` |
| Archive of Freshdesk Database May-2026 | `1qch1vaZP2xaiQQ3k0FFhWLGJ4gVL0i7Zx_vbX3jG_-A` | touch archive (read-only) |
| New Daily Report | `1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4` | `daily_report_ss_id` |
| Productivity (Oct-2026) | `1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI` | `productivity_fallback_id` / `productivity_files[2026-09]` |
| Freshdesk Status Activity Log — Database | `1Fc6VCk8bLmy8ZUMCeBDPHvu7dMWDtONn6CRd9H_aHzM` | `fd_activity_ss_id` |
| Egypt Operations HCT | `1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw` | `roster_hct_ss_id` |
| Freshchat Detailed Msgs | `1ZxDxS13pu0xXS3aPBfXxajtodwKIndaF0NOjZv6xacM` | `fc_messages_ss_id` |
| Freshdesk Database May-2026 | `1VtBT8kIIhK7PxKYJJQlnhxNtmz17ewhkWtpUt8jiB4s` | `qa_engine_source_ss_id` |
| Dabdoob CX Operations — Database | `1hul-T8Tc2h1nmk_9wM9bj8HmWM-_2ZeVIu_kOYpicyA` | `v1_ops_spreadsheet_id` |
| Dabdoob CX — Quality Queue Data | `1ArWBreAPYAmFX4qnWd1jw3OQ2s8MLvJpqp5024gWjYY` | `qa_queue_ss_id` (unreferenced in current code — possibly stale; shared anyway) |

## ❌ NOT shared — owner action required (share to `migration-reader@cx-kpis-513312.iam.gserviceaccount.com`, Viewer)

| Sheet title (expected) | ID | Config key | Impact |
|---|---|---|---|
| CC2 Tickets | `107vS_XyJRpelFPJOFditebZVca6TzUuYHq9rm0ermuk` | `ss_tickets_id` | `tickets` + `esc_seen` — the ~150k-row Freshdesk ticket store |
| CC2 Live | `1u_EU-LxMYzDmulIWz1cgseDaOkd8C4wXc17BFXVfNF4` | `ss_live_id` | all `agg_*`/`tlp_*`/`aging_*` aggregates, `sc_months`, Heatmap tabs |
| CC2 Data 2026 | `1BVJFMtQMSF2-zS89A-4oxoSuw0LunqAp_YQVwl0fR-I` | `ss_data_2026_id` | `queue_snapshots`, `agg_inflow_hourly`, `agg_productivity_daily`, `sc_daily`, `sc_behaviour` |

These three are the largest V2 stores — WP-51 cannot produce a complete migration without them.

## Side findings

- CC2 Core `Trackers` tab contains **only the 5 built-in trackers** — no custom tracker spreadsheets exist beyond the seeds in `009_operations.sql`.
- `sc_months` tab is empty; `productivity_files` maps only `2026-09` → the fallback workbook. New monthly workbook IDs may appear over time — re-run the probe before WP-51.
- Only one `ss_data_{year}_id` exists (`2026`) — the system started ~2026-04, so no prior-year stores.
- `otd_sheet_id` and `prod_activity_ss_id` config values are empty — nothing to share.
- `.env.local` still has no Google vars (WP-34 pending); local migration runs also need `GOOGLE_*` split vars or `GOOGLE_APPLICATION_CREDENTIALS` pointing at the key file.
