/**
 * S06-08 — oct_workbook + daily_report ops tabs -> mappings.
 *
 * Source: specs/migration-remaining/decisions-ops-tabs.md (S06-02 verdicts,
 * evidence logs/probe-ops-tabs.log). Tabs:
 *   oct_workbook "Productivity (Oct-2026)": FD_AUX, Transcript, AUXes Exceptions
 *   daily_report "New Daily Report":        WA, CTL & Quality (split verdict)
 *
 * Merge contract for S06-10 (engine.ts):
 *   1. Add `oct_workbook` / `daily_report` keys to SPREADSHEETS (ids per
 *      source-inventory; store keys land in S06-10).
 *   2. Spread `MAPPINGS` into MODULE_MAPPINGS, `ROW_TRANSFORMS` into the
 *      engine record, `DECISIONS` into MAPPING_DECISIONS.
 *
 * KNOWN GAPS (readSheet limits — see DECISIONS):
 *   - 'CTL & Quality' -> qa_ctls maps agent_email via the FIRST
 *     'Agent Email' occurrence (A..J agent block, col A). The rejected
 *     audit-echo block repeats the header (col O); post-S07-01
 *     first-occurrence-keeps-bare-name it lands under 'agent email#2',
 *     which nothing maps.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import type { TableMapping } from '../engine'

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')

/** Build the mirror-shape `cols` jsonb array (verbatim A..H cells) for the
 *  Transcript tab; headers are lowercased by readSheet. */
const TRANSCRIPT_COLS = [
  'incoming instance', 'call id', 'ivr inputs', 'caller', 'start time',
  'call transcription', 'helper', 'correct date time',
] as const

export const MAPPINGS: TableMapping[] = [
  {
    // NEW: call_transcripts (S06-04 DDL, PM-gated apply) — mirror-consistent
    // shape (id, dedupe_key UNIQUE, ts_ms, cols jsonb, synced_at) per
    // 004_mirror_tables.sql. cols = verbatim A..H array built by transform.
    spreadsheet: 'oct_workbook', sheet: 'Transcript', table: 'call_transcripts',
    columns: ['dedupe_key', 'cols', 'synced_at'],
    upsertOn: 'dedupe_key',
    require: ['dedupe_key'],
  },
  {
    // migrate: tracker_records — S06-04 seeds trackers(tracker_id=
    // 'aux_exceptions') + tracker_fields for the 4 headers (decision doc).
    // record_id = 'Agent Mail|Date|AUX' composite; values = {agent_mail,
    // date, aux, duration} verbatim A..D. All synthetic cells come from
    // ROW_TRANSFORMS['AUXes Exceptions'].
    spreadsheet: 'oct_workbook', sheet: 'AUXes Exceptions', table: 'tracker_records',
    columns: ['tracker_id', 'record_id', 'row_n', 'values', 'submitted_by', 'submitted_at'],
    upsertOn: 'tracker_id,record_id',
    require: ['tracker_id', 'record_id'],
  },
  {
    // migrate: tracker_records — tracker_id='wa_parcels'; record_id =
    // Parcel ID ('row-N' fallback); values = 12 fields verbatim B..M
    // (A=Parcel ID is the record key, not a field).
    spreadsheet: 'daily_report', sheet: 'WA', table: 'tracker_records',
    columns: ['tracker_id', 'record_id', 'row_n', 'values', 'submitted_by', 'submitted_at'],
    upsertOn: 'tracker_id,record_id',
    require: ['tracker_id', 'record_id'],
  },
  {
    // SPLIT tab — only block A..J (CTL coaching tracker) migrates:
    // migrate: qa_ctls (006_quality.sql:104-132), upsertOn ctl_id derived
    // 'hist-<Call ID>' by transform. agent_email maps to the FIRST
    // 'Agent Email' header occurrence (A..J agent block, col A); the
    // audit-echo repeat (col O) lands under 'agent email#2' and is unmapped.
    // Audit-echo cols Call Date/Final Score/Audit Date/Call Type/Age are
    // reachable via audit_id -> qa_audits and are not stored.
    // Block N..R [Timestamp, Agent Email, Audit Date, Call/ Text Date,
    // Ticket Number] is `rejected: ⊆ qa_audits` — no mapping for it.
    spreadsheet: 'daily_report', sheet: 'CTL & Quality', table: 'qa_ctls',
    columns: ['ctl_id', 'audit_id', 'opened_date', 'due_date', 'status',
      'tl_email', 'coaching_notes', 'action', 'submitted_at', 'submitted_date',
      'sla_met', 'agent_confirmed_at', 'agent_note', 'reminded_date',
      'updated_at', 'updated_by', 'outcome', 'dispute_id', 'reopened_at',
      'reopen_count', 'closed_by', 'shift_tls', 'agent_email'],
    sheetToDb: {
      audit_id: 'call id',
      opened_date: 'date only (ctl)',
      reminded_date: 'ctl date',
      status: 'coached?',
      agent_email: 'agent email',
    },
    upsertOn: 'ctl_id',
    require: ['ctl_id'],
  },
  {
    // NEW: aux_spans (S06-04 DDL, PM-gated apply) — mirror-shape
    // (id, dedupe_key UNIQUE, ts_ms, cols jsonb, synced_at) per
    // 004_mirror_tables.sql. cols = verbatim A..G built by transform;
    // headers label only A..D — E..G arrive as col_e/col_f/col_g keys
    // (engine.ts headerKeys, S07-01).
    spreadsheet: 'oct_workbook', sheet: 'FD_AUX', table: 'aux_spans',
    columns: ['dedupe_key', 'cols', 'synced_at'],
    upsertOn: 'dedupe_key',
    require: ['dedupe_key'],
  },
]

/**
 * Sheet-keyed row transforms on the RAW readSheet row before mapRow
 * (engine.ts:206). Each is guarded on spreadsheet+table so the generic
 * sheet names ('WA', 'Transcript') stay inert elsewhere.
 * tracker_records rows get their jsonb `values` object, composite
 * record_id, tracker_id constant, row_n (header row 1 -> ctx.index + 2)
 * and NOT-NULL-safe submitted_by/submitted_at here because the flat
 * TableMapping cannot express them.
 */
export const ROW_TRANSFORMS: Record<
  string,
  (row: Record<string, unknown>, ctx: { spreadsheet: string; table: string; index: number }) => void
> = {
  Transcript: (row, ctx) => {
    if (ctx.spreadsheet !== 'oct_workbook' || ctx.table !== 'call_transcripts') return
    const callId = row['call id']
    const start = row['start time']
    if (callId === undefined && start === undefined) return
    // dedupe_key = sha1(Call ID + Start time); '|' separator keeps the
    // concatenation unambiguous (decision doc: Call ID alone may repeat).
    row.dedupe_key = sha1(String(callId ?? '') + '|' + String(start ?? ''))
    // cols = verbatim A..H positional array (mirror shape; consumers read
    // cols[i] — headers only label the cells, order is the contract).
    row.cols = TRANSCRIPT_COLS.map((h) => row[h] ?? null)
    row.synced_at = new Date().toISOString()
    // ts_ms intentionally unset: 'Start time' is 'DD-MM-YYYY HH:mm:ss'
    // with an ambiguous zone — derive downstream from cols[4] if needed.
  },
  FD_AUX: (row, ctx) => {
    if (ctx.spreadsheet !== 'oct_workbook' || ctx.table !== 'aux_spans') return
    // cols = verbatim A..G: A..D carry headers, E..G are unlabeled cells
    // (Email/Minutes/Date per decision doc) emitted by readSheet as
    // col_e/col_f/col_g (engine.ts headerKeys, S07-01).
    const cells = [
      row['agent name'], row['status name'], row['start time'], row['end time'],
      row['col_e'], row['col_f'], row['col_g'],
    ]
    if (cells.every((v) => v === undefined || v === null || v === '')) return
    row.dedupe_key = sha1(cells.map((v) => String(v ?? '')).join('|'))
    row.cols = cells.map((v) => v ?? null)
    row.synced_at = new Date().toISOString()
    // ts_ms intentionally unset: 'Start time' zone is ambiguous —
    // Transcript precedent; derive downstream from cols[2] if needed.
  },
  'AUXes Exceptions': (row, ctx) => {
    if (ctx.spreadsheet !== 'oct_workbook' || ctx.table !== 'tracker_records') return
    const agentMail = row['agent mail']
    const date = row['date']
    const aux = row['aux']
    const duration = row['duration']
    if ([agentMail, date, aux, duration].every((v) => v === undefined || v === null || v === '')) return
    row.tracker_id = 'aux_exceptions'
    const am = String(agentMail ?? '').trim()
    const d = String(date ?? '').trim()
    const ax = String(aux ?? '').trim()
    row.record_id = (am || d || ax) ? `${am}|${d}|${ax}` : 'row-' + (ctx.index + 2)
    row.row_n = ctx.index + 2
    row.values = { agent_mail: agentMail ?? null, date: date ?? null, aux: aux ?? null, duration: duration ?? null }
    row.submitted_by = ''
    row.submitted_at = null
  },
  WA: (row, ctx) => {
    if (ctx.spreadsheet !== 'daily_report' || ctx.table !== 'tracker_records') return
    const parcelId = row['parcel id']
    const fields: [string, string][] = [
      ['country', 'country'], ['creation_date', 'creation date'],
      ['warehouse', 'warehouse'], ['order_id', 'order id'],
      ['status_3pl', '3pl_status'], ['whatsapp_status', 'whatsapp_status'],
      ['invoice_id', 'invoice_id'], ['link', 'link'], ['code', 'code'],
      ['trailed', 'trailed?'], ['confirmed', 'confirmed?'],
      ['date_only', 'date_only'],
    ]
    if ([parcelId, ...fields.map(([, h]) => row[h])].every((v) => v === undefined || v === null || v === '')) return
    row.tracker_id = 'wa_parcels'
    const pid = String(parcelId ?? '').trim()
    row.record_id = pid || 'row-' + (ctx.index + 2)
    row.row_n = ctx.index + 2
    const values: Record<string, unknown> = {}
    for (const [fieldId, header] of fields) values[fieldId] = row[header] ?? null
    row.values = values
    row.submitted_by = ''
    row.submitted_at = null
  },
  'CTL & Quality': (row, ctx) => {
    if (ctx.spreadsheet !== 'daily_report' || ctx.table !== 'qa_ctls') return
    const callId = String(row['call id'] ?? '').trim()
    if (!callId) return // no natural key -> require:['ctl_id'] drops the row
    row.ctl_id = 'hist-' + callId
    // status <- Coached?: 'Pending' -> 'open' (decision); other values pass
    // verbatim; empty -> 'open' (qa_ctls.status default vocabulary).
    const coached = String(row['coached?'] ?? '').trim()
    row['coached?'] = coached === '' || coached === 'Pending' ? 'open' : coached
    void ctx
  },
}

export const DECISIONS: string[] = [
  'oct_workbook:FD_AUX -> NEW: aux_spans (S06-04 DDL): columns dedupe_key/cols/synced_at; cols = verbatim A..G positional array [agent name, status name, start time, end time, Email, Minutes, Date] built in ROW_TRANSFORMS[\'FD_AUX\'] — E..G are unlabeled in the sheet and reach the row as col_e/col_f/col_g keys (engine.ts headerKeys, S07-01); dedupe_key = sha1 of the seven verbatim cells joined \'|\'; ts_ms left null — \'Start time\' zone ambiguous (Transcript precedent); synced_at stamped at transform time; fully-blank rows dropped via require.',
  'oct_workbook:Transcript -> NEW: call_transcripts (S06-04 DDL): columns dedupe_key/cols/synced_at; cols = verbatim A..H positional array built in ROW_TRANSFORMS[\'Transcript\']; dedupe_key = sha1(Call ID + \'|\' + Start time) per decision (separator added for unambiguous concat); ts_ms left null — \'Start time\' is DD-MM-YYYY HH:mm:ss with ambiguous zone, derive from cols[4] downstream if needed; synced_at stamped at transform time.',
  'oct_workbook:AUXes Exceptions -> migrate: tracker_records, tracker_id=\'aux_exceptions\' (S06-04 seeds trackers + tracker_fields for the 4 headers): record_id = \'Agent Mail|Date|AUX\' composite (row-N fallback), values = {agent_mail,date,aux,duration} verbatim A..D, row_n = sheet row (ctx.index+2), upsertOn (tracker_id,record_id); fully-blank rows dropped via require.',
  'daily_report:WA -> migrate: tracker_records, tracker_id=\'wa_parcels\': record_id = Parcel ID (row-N fallback), values = 12 fields verbatim B..M {country,creation_date,warehouse,order_id,status_3pl,whatsapp_status,invoice_id,link,code,trailed,confirmed,date_only} — A=Parcel ID is the record key, not a field; upsertOn (tracker_id,record_id).',
  'daily_report:CTL & Quality SPLIT — block A..J -> migrate: qa_ctls upsertOn ctl_id = \'hist-<Call ID>\' (derived in transform; rows without Call ID dropped via require); status <- Coached? with \'Pending\'->\'open\', empty->\'open\', other values verbatim; opened_date <- \'Date Only (CTL)\', reminded_date <- \'CTL Date\', audit_id <- Call ID; Call Date/Final Score/Audit Date/Call Type/Age NOT stored (audit echo via audit_id->qa_audits per decision).',
  'daily_report:CTL & Quality agent_email MAPPED -> qa_ctls.agent_email: probe-ops-tabs.log header row shows the A..J agent block\'s \'Agent Email\' is the FIRST occurrence (col A); the audit-echo repeat (col O) lands under \'agent email#2\' via readSheet first-occurrence naming (engine.ts headerKeys, S07-01) and is unmapped — audit echo stays reachable via audit_id -> qa_audits.',
  'daily_report:CTL & Quality block N..R [Timestamp, Agent Email, Audit Date, Call/ Text Date, Ticket Number] -> rejected: subset of qa_audits (already imported via QA_HIST_SOURCES) — no mapping emitted for it.',
  'All tracker_records mappings supply synthetic tracker_id/record_id/row_n/values/submitted_by/submitted_at via ROW_TRANSFORMS because the flat TableMapping cannot express jsonb values maps or composite keys; transforms are sheet-keyed AND guarded on spreadsheet+table so generic tab names stay inert on other stores.',
]
