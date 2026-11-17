# W2-ADM-02: source-health — sheet probes -> DB mirror/table/config checks
Status: DONE
Files: src/app/api/admin/source-health/route.ts (only)
Checks: replaced `---- source sheets ----` + `---- legacy store audit ----` with `---- data feeds (was: source sheets) ----`: creds check renamed `sheet credentials (HCT + qa_audits allowlist)` (kind 'sheet', sheetCreds kept); `mirror fd_activities|maqsam_calls|freshchat` (count>0, detail `<count> rows; watermark <mirror_state_<t>.last_sync_at|'never'>`, hint mirrors full-sync POST); `prod_daily_layers <YYYY-MM>` gte date count; `config prod_assumptions` numeric-mq check (dedicated, not REQUIRED_CONFIG); `dq_hct roster snapshot` (count + max synced_at, kind 'external', missing/empty -> ok:false + manual-sync hint). Deleted fetchWorkbookTabs/dqSetting_/prodFileFor_/prodToday_ imports, LEGACY_* consts, requiredOk; Check.kind union dropped 'legacy'.
Verify: `npx tsc --noEmit` — 0 errors in file (1 pre-existing unrelated error tests/golden/viewas-sweep.test.ts heatmap export); grep fetchWorkbookTabs|deferred|LEGACY_|spreadsheets|requiredOk -> 0 hits.
Handoff: route is sheet-free; `deferred:` gone — feeds W2-STRICT-01.
