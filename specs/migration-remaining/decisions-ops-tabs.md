# decisions-ops-tabs — S06-02 verdicts for the 5 unique ops tabs

Evidence: `logs/probe-ops-tabs.log` (exit=0, PROBED=5/5; `values.get '<tab>'!A1:AZ5`
+ col-A count per tab). Vocabulary per S06-01: `migrate:` (table + upsertOn +
column map) | `NEW:` (name + cols) | `covered:` | `rejected:`.
`NEW:` used here: **2** — shared cap 3 across both decision docs leaves <=1 for
S06-01 (flag to TL if S06-01 needs more; done-when ceiling is 5 combined).

## oct_workbook `1I29yj…` "Productivity (Oct-2026)"

### FD_AUX — `NEW: aux_spans`
colA=13,065. Live prod-engine input: `prodReadCols_(ss,'FD_AUX',1,7,1)`
(engine.ts:315) via `PROD_MONTH_TABS` (sheets.ts:20). No V2 table holds raw
agent AUX spans (`agg_agent_daily`/`sc_daily` are computed output;
`maqsam_calls` is call metadata).
- Shape (mirror-consistent, cf. `004_mirror_tables.sql`): `aux_spans(id,
  dedupe_key text unique, ts_ms bigint, cols jsonb, synced_at timestamptz)`.
- upsertOn: `dedupe_key` = sha1 of verbatim row cells (like fd_activities);
  natural key = (Email, `Start time`, `Status name`).
- Column map: `cols` = verbatim A..G `[Agent name, Status name, Start time,
  End time, Email, Minutes, Date]` (header row labels only A..D; data carries
  E=email F=minutes G=date — probe r2/r3).

### Transcript — `NEW: call_transcripts`
colA=5,607. `maqsam_calls.cols` is the fixed 7-cell Maqsam-API shape
(vendor-apis.ts `maqsamCallToCols`) — no transcription field; no other table
holds transcript text (grep 'transcri' -> engine-live.ts comment only).
- Shape: `call_transcripts(id, dedupe_key text unique, ts_ms bigint,
  cols jsonb, synced_at timestamptz)`.
- upsertOn: `dedupe_key` = sha1(`Call ID` + `Start time`) (Call ID alone may
  repeat across instances).
- Column map: `cols` = verbatim A..H `[Incoming Instance, Call ID, IVR inputs,
  Caller, Start time, Call Transcription, Helper, Correct Date Time]`.

### AUXes Exceptions — `migrate: tracker_records`
colA=59 (grid 1,007 mostly empty). Live prod input (`engine.ts:326`, cols A..D:
email,date,aux,duration override ledger). Fits the tracker seam
(`009_operations.sql:8-61`): one registry row + records.
- Registry: `trackers` row `tracker_id='aux_exceptions'` (S06-04 seeds
  trackers + tracker_fields for the 4 headers).
- upsertOn: `(tracker_id, record_id)` with `record_id = 'Agent Mail|Date|AUX'`.
- Column map: `values` = `{agent_mail:Agent Mail, date:Date, aux:AUX,
  duration:Duration}` (verbatim A..D). Fallback if S06-04 prefers typed:
  fold into `aux_spans` DDL as `aux_exceptions(email,date,aux,duration)` —
  still inside the NEW cap.

## daily_report `1Ll5Bx…` "New Daily Report"

### WA — `migrate: tracker_records`
colA=206. Parcel/order WhatsApp-address tracking — a native tracker shape.
- Registry: `trackers` row `tracker_id='wa_parcels'`.
- upsertOn: `(tracker_id, record_id)` with `record_id = Parcel ID` (unique
  per row in probe sample).
- Column map: `values` = `{country:Country, creation_date:Creation Date,
  warehouse:Warehouse, order_id:Order ID, status_3pl:3PL_status,
  whatsapp_status:whatsapp_status, invoice_id:Invoice_Id, link:Link,
  code:Code, trailed:Trailed?, confirmed:Confirmed?, date_only:Date_Only}`
  (verbatim B..M; A=Parcel ID is the record key).

### CTL & Quality — SPLIT (one tab, two verdicts)
colA=1,789; two column blocks separated by blank cols K..M.
- **Block A..J (CTL coaching tracker)** — `migrate: qa_ctls`
  (`006_quality.sql:104-132`). upsertOn `ctl_id`, derived `hist-<Call ID>`
  (Call ID present col F; audit_id unique-indexed for joins).
  Map: `agent_email`←Agent Email · `audit_id`←Call ID · `status`←Coached?
  ('Pending'->'open') · `opened_date`←Date Only (CTL) · `reminded_date`←CTL
  Date · `Age`→derived/not stored · `Call Date`/`Final Score`/`Audit Date`/
  `Call Type` → audit echo, reachable via `audit_id`→qa_audits, not stored.
- **Block N..R (audit echo)** — `rejected: ⊆ qa_audits`
  `[Timestamp, Agent Email, Audit Date, Call/ Text Date, Ticket Number]` is a
  copy of audit rows already imported via QA_HIST_SOURCES; no unique columns.

## Summary
| tab | verdict | target | upsertOn |
|---|---|---|---|
| FD_AUX | NEW | aux_spans | dedupe_key |
| Transcript | NEW | call_transcripts | dedupe_key |
| AUXes Exceptions | migrate | tracker_records ('aux_exceptions') | (tracker_id, record_id) |
| WA | migrate | tracker_records ('wa_parcels') | (tracker_id, record_id) |
| CTL & Quality | migrate + rejected | qa_ctls / (⊆ qa_audits) | ctl_id (`hist-<Call ID>`) |

NEW this doc: `aux_spans`, `call_transcripts` (2). Out of scope here: DDL
(S06-04), mapping modules (S06-08), any writes.
