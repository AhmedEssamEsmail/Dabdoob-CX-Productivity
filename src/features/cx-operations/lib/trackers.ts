/**
 * Trackers — verbatim port of Operations_deprecated/Trackers.js onto
 * Next.js + Supabase (the Operations app's only real page, #/trackers).
 *
 * Storage, as the legacy header comment sets it out:
 *  - Registry tabs "Trackers"/"TrackerFields" -> `trackers`/`tracker_fields`
 *    tables (supabase/migrations/009_operations.sql), seeded with the four
 *    built-ins + the refund ledger.
 *  - "native" trackers: one record per row in `tracker_records` — the Postgres
 *    counterpart of "one tab in the trackers spreadsheet". Values are a jsonb
 *    keyed by field id; submitted_by/at are always stamped server-side.
 *  - "external" trackers keep their Google Sheets as the source of truth. Live
 *    sheet access goes through the `sheetIo` seam (D-GOOGLE): with no adapter
 *    configured reads/writes fail closed with a deterministic error — nothing
 *    is fabricated. The refund ledger stays read-only by registry flag AND by
 *    spreadsheet id, whatever the registry row says.
 *  - Dropdown/dependent choices live in the platform Options store under
 *    "tracker.<tracker_id>.<field_id>" (".<hash of parent answer>" for
 *    dependents — trackerDepKey_, mirrored in the page client).
 *  - Header mapping is by header TEXT (normHeader), never position; a missing
 *    mapped header fails closed into headerProblems.
 *  - CacheService's 5-minute registry / 60-second row caches are not ported —
 *    every call reads fresh (documented divergence; Postgres reads are cheap
 *    at these sizes).
 */

import { db, isTrue, newId, normHeader } from '@/features/shared/platform/repo'
import { readStore } from '@/features/shared/platform/stores'
import {
  actorEmail,
  normEmail,
  requireRole,
  type PlatformUser,
} from '@/features/shared/platform/identity'
import { assertWritable } from '@/features/shared/platform/viewas'
import { addOption, allOptions, optionsFor, OPTION_MAX_LEN } from '@/features/shared/platform/options'

const TRACKERS_TABLE = 'trackers'
const TRACKER_FIELDS_TABLE = 'tracker_fields'
const TRACKER_RECORDS_TABLE = 'tracker_records'

export const REFUND_LEDGER_SPREADSHEET_ID = '1ZaJnCVOmZF42KAYpd3YwDrsr1gY7fIEwTxUeAESgGU8'
export const TRACKER_MAX_ROWS = 300 // newest rows sent to the page; search runs over these
export const TRACKER_TEXT_MAX = 2000
export const TRACKER_USER_TYPES = ['date', 'text', 'number', 'money', 'link', 'dropdown', 'dependent'] as const
export const TRACKER_MONEY_DECIMALS = 3 // KWD has fils (3 decimals); 2-decimal currencies fit too
const TRACKER_V2_COLS = { record_id: 'record_id', submitted_by: 'submitted_by', submitted_at: 'submitted_at' }
const TRACKER_MAX_FIELDS = 40
const TRACKER_NAME_MAX = 60
const TRACKER_FIELD_LABEL_MAX = 60

export type TrackerType = (typeof TRACKER_USER_TYPES)[number] | 'computed'

export interface TrackerField {
  id: string
  label: string
  header: string
  type: string
  required: boolean
  listKey: string
  parentFieldId: string
  auto: string
  position: number
}

export interface Tracker {
  id: string
  name: string
  storage: string // 'external' | 'native'
  spreadsheetId: string
  tab: string
  headerRow: number
  accessMode: string // 'edit' | 'view_only'
  formBacked: boolean
  recordIdHeader: string
  recordIdFormat: string
  submittedByHeader: string
  submittedAtHeader: string
  viewerRoles: string[]
  editorRoles: string[]
  builderRoles: string[]
  ownerEmail: string
  archived: boolean
  fields: TrackerField[]
}

export interface TrackerRow {
  recordId: string
  values: Record<string, unknown>
  submittedBy: string
  submittedAt: string
  outside: boolean
}

export interface TrackerData {
  tracker: ReturnType<typeof trackerSummary_>
  fields: ReturnType<typeof trackerFieldsOut_>
  rows: TrackerRow[]
  total: number
  limited: boolean
  headerProblems: string[]
  choices: Record<string, string[]>
}

type Row = Record<string, unknown>

// ---------------------------------------------------------------------------
// Small pure helpers (shared with the golden tests)
// ---------------------------------------------------------------------------

export function slugId_(s: unknown, max?: number): string {
  const out = String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max || 16)
  return out.replace(/_+$/, '') || 'x'
}

/** djb2 over the normalised answer, base36, 6 chars. Mirrored in the page client. */
export function trackerValueHash_(v: unknown): string {
  const s = String(v == null ? '' : v)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0
  return ('000000' + h.toString(36)).slice(-6)
}

export function trackerListKey_(trackerId: string, fieldId: string): string {
  return 'tracker.' + trackerId + '.' + fieldId
}

export function trackerDepKey_(trackerId: string, fieldId: string, parentValue: unknown): string {
  return trackerListKey_(trackerId, fieldId) + '.' + trackerValueHash_(parentValue)
}

export function rolesList_(s: unknown): string[] {
  return String(s || '')
    .split(',')
    .map((x) => x.trim())
    .filter(String)
}

/** True when any write to this tracker must be refused, whatever else is configured. */
export function trackerIsReadOnly_(t: Pick<Tracker, 'accessMode' | 'spreadsheetId'>): boolean {
  return t.accessMode !== 'edit' || String(t.spreadsheetId) === REFUND_LEDGER_SPREADSHEET_ID
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

function trackerFromRow_(r: Row): Tracker {
  return {
    id: String(r.tracker_id),
    name: String(r.name),
    storage: String(r.storage_mode || 'external'),
    spreadsheetId: String(r.spreadsheet_id || ''),
    tab: String(r.tab_name || ''),
    headerRow: Number(r.header_row) || 1,
    accessMode: String(r.access_mode || 'edit'),
    formBacked: isTrue(r.form_backed),
    recordIdHeader: String(r.record_id_header || TRACKER_V2_COLS.record_id),
    recordIdFormat: String(r.record_id_format || ''),
    submittedByHeader: String(r.submitted_by_header || TRACKER_V2_COLS.submitted_by),
    submittedAtHeader: String(r.submitted_at_header || TRACKER_V2_COLS.submitted_at),
    viewerRoles: rolesList_(r.viewer_roles),
    editorRoles: rolesList_(r.editor_roles),
    builderRoles: rolesList_(r.builder_roles),
    ownerEmail: String(r.owner_email || ''),
    archived: !!r.archived_at,
    fields: [],
  }
}

/** { order: [ids], byId: {id: tracker with fields} }. Missing tables = empty registry. */
export async function trackerRegistry_(): Promise<{ order: string[]; byId: Record<string, Tracker> }> {
  const reg: { order: string[]; byId: Record<string, Tracker> } = { order: [], byId: {} }
  const [tStore, fStore] = await Promise.all([readStore(TRACKERS_TABLE), readStore(TRACKER_FIELDS_TABLE)])
  if (!tStore.exists || !fStore.exists) return reg
  tStore.rows.forEach((r) => {
    const t = trackerFromRow_(r)
    if (t.archived || reg.byId[t.id]) return
    reg.byId[t.id] = t
    reg.order.push(t.id)
  })
  fStore.rows.forEach((r) => {
    const t = reg.byId[String(r.tracker_id)]
    if (!t || r.active === false || String(r.active).toLowerCase() === 'false') return
    t.fields.push({
      id: String(r.field_id),
      label: String(r.label),
      header: String(r.column_header || r.label),
      type: String(r.type),
      required: isTrue(r.required),
      listKey: String(r.list_key || ''),
      parentFieldId: String(r.parent_field_id || ''),
      auto: String(r.auto || ''),
      position: Number(r.position) || 0,
    })
  })
  reg.order.forEach((id) => {
    reg.byId[id].fields.sort((a, b) => a.position - b.position)
  })
  return reg
}

async function trackerOrThrow_(trackerId: unknown): Promise<Tracker> {
  const t = (await trackerRegistry_()).byId[String(trackerId || '')]
  if (!t) throw new Error('That tracker does not exist. Reload the page.')
  return t
}

export function trackerPerms_(t: Tracker, user: { role: string; email?: string | null }) {
  const view = t.viewerRoles.indexOf(user.role) !== -1
  const add = !trackerIsReadOnly_(t) && t.editorRoles.indexOf(user.role) !== -1
  const build = !trackerIsReadOnly_(t) && t.builderRoles.indexOf(user.role) !== -1
  return { viewAll: view, add: add, build: build, open: view || add }
}

export function trackerSummary_(t: Tracker, user: { role: string; email?: string | null }) {
  const p = trackerPerms_(t, user)
  return {
    id: t.id,
    name: t.name,
    accessMode: trackerIsReadOnly_(t) ? 'view_only' : 'edit',
    storage: t.storage,
    canAdd: p.add,
    canBuild: p.build,
    seesAll: p.viewAll,
    sourceUrl:
      t.storage === 'external' && user.role === 'admin'
        ? 'https://docs.google.com/spreadsheets/d/' + t.spreadsheetId
        : '',
  }
}

// ---------------------------------------------------------------------------
// Sheet binding: the io seam
// ---------------------------------------------------------------------------

/**
 * A physical record store behind one tracker. `headers` is the header row
 * (header TEXT mapping); `lines` is every data row as raw cell arrays in
 * header order (blank cells ''), mirroring a getValues() range read.
 * `setHeaders` appends system/field headers (external only; native has all
 * its headers from creation). `append` writes one record row.
 */
export interface TrackerIo {
  headers(t: Tracker): Promise<string[]>
  lines(t: Tracker): Promise<unknown[][]>
  /** Appends headers to the right of the last used column; returns the new header list. */
  appendHeaders(t: Tracker, headers: string[]): Promise<string[]>
  append(t: Tracker, rec: { recordId: string; submittedBy: string; submittedAt: string; values: Record<string, unknown> }): Promise<number>
  /** Max numeric suffix of record ids matching format (nextFormattedId_). */
  maxFormattedId(t: Tracker, format: string): number | Promise<number>
}

/** Postgres store for native trackers: headers = sys cols + field labels in position order. */
const nativeIo: TrackerIo = {
  async headers(t) {
    return [t.recordIdHeader, t.submittedByHeader, t.submittedAtHeader].concat(t.fields.map((f) => f.header))
  },
  async lines(t) {
    const { rows } = await readTrackerRecordRows(t.id)
    const hs = await nativeIo.headers(t)
    return rows.map((r) =>
      hs.map((h) => {
        const k = normHeader(h)
        if (k === normHeader(t.recordIdHeader)) return r.recordId
        if (k === normHeader(t.submittedByHeader)) return r.submittedBy
        if (k === normHeader(t.submittedAtHeader)) return r.submittedAt
        const f = t.fields.filter((x) => normHeader(x.header) === k)[0]
        return f ? (r.values[f.id] ?? '') : ''
      }),
    )
  },
  async appendHeaders(t) {
    // Native trackers were created with all their headers; nothing to append.
    return nativeIo.headers(t)
  },
  async append(t, rec) {
    const { rows } = await readTrackerRecordRows(t.id)
    const rowN = (rows.reduce((m, r) => Math.max(m, r.rowN), 1) || 1) + 1
    const { error } = await db()
      .from(TRACKER_RECORDS_TABLE)
      .insert({
        tracker_id: t.id,
        record_id: rec.recordId,
        row_n: rowN,
        submitted_by: rec.submittedBy,
        submitted_at: rec.submittedAt,
        values: rec.values,
      })
    if (error) throw new Error(error.message)
    return rowN
  },
  async maxFormattedId(t, format) {
    const { rows } = await readTrackerRecordRows(t.id)
    const re = new RegExp('^' + format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{n\\}', '(\\d+)') + '$', 'i')
    let max = 0
    rows.forEach((r) => {
      const m = re.exec(String(r.recordId).trim())
      if (m) max = Math.max(max, Number(m[1]))
    })
    return max
  },
}

interface TrackerRecordRow {
  recordId: string
  rowN: number
  submittedBy: string
  submittedAt: string
  values: Record<string, unknown>
}

async function readTrackerRecordRows(trackerId: string): Promise<{ rows: TrackerRecordRow[] }> {
  try {
    const { data, error } = await db()
      .from(TRACKER_RECORDS_TABLE)
      .select('*')
      .eq('tracker_id', trackerId)
      .order('row_n', { ascending: true })
      .limit(200000)
    if (error) return { rows: [] }
    return {
      rows: (data || []).map((r: Row) => ({
        recordId: String(r.record_id),
        rowN: Number(r.row_n) || 0,
        submittedBy: String(r.submitted_by || ''),
        submittedAt: r.submitted_at ? new Date(String(r.submitted_at)).toISOString() : '',
        values: (r.values || {}) as Record<string, unknown>,
      })),
    }
  } catch {
    return { rows: [] }
  }
}

/**
 * Sheet-backed io seam (D-GOOGLE). The legacy external trackers live in Google
 * Sheets; until live Sheets credentials are granted there is no adapter and
 * every external read/write throws — nothing is fabricated or guessed.
 */
let sheetIo: TrackerIo | null = null
export function setTrackerSheetIo(io: TrackerIo | null): void {
  sheetIo = io
}
export function getTrackerSheetIo(): TrackerIo | null {
  return sheetIo
}

function trackerIoFor_(t: Tracker): TrackerIo {
  if (t.storage === 'native') return nativeIo
  if (sheetIo) return sheetIo
  throw new Error(
    'The source sheet for ' + t.name + ' cannot be reached (Google Sheets access is not configured). Ask an admin to check the tracker source.',
  )
}

function trackerFieldsOut_(t: Tracker) {
  return t.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required,
    listKey: f.listKey,
    parentFieldId: f.parentFieldId,
    auto: f.auto,
  }))
}

/**
 * Maps every field and system column to a 0-based column index by header text.
 * Returns { cols: {fieldId: idx}, sys: {record_id, submitted_by, submitted_at: idx or -1}, missing: [labels] }.
 */
export function mapTrackerColumns_(
  t: Pick<Tracker, 'fields' | 'recordIdHeader' | 'submittedByHeader' | 'submittedAtHeader'>,
  headers: string[],
) {
  const index: Record<string, number> = {}
  headers.forEach((h, i) => {
    const k = normHeader(h)
    if (k && !(k in index)) index[k] = i
  })
  const cols: Record<string, number> = {}
  const missing: string[] = []
  t.fields.forEach((f) => {
    const i = index[normHeader(f.header)]
    if (i === undefined) missing.push(f.header)
    else cols[f.id] = i
  })
  const find = (h: string) => {
    const i = index[normHeader(h)]
    return i === undefined ? -1 : i
  }
  return {
    cols,
    missing,
    sys: { record_id: find(t.recordIdHeader), submitted_by: find(t.submittedByHeader), submitted_at: find(t.submittedAtHeader) },
  }
}

/** trackerCellOut_: Date -> 'yyyy-MM-dd' | 'yyyy-MM-dd HH:mm' (Kuwait), else the raw value. */
export function trackerCellOut_(v: unknown): unknown {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return ''
    const d = new Date(v.getTime() + 3 * 3600 * 1000)
    const iso = d.toISOString()
    const hm = iso.slice(11, 16)
    return hm === '00:00' ? iso.slice(0, 10) : iso.slice(0, 10) + ' ' + hm
  }
  return v === null || v === undefined ? '' : v
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Rows as the page sees them. Fails closed when a mapped header is missing. */
export async function readTrackerData_(t: Tracker, user: PlatformUser): Promise<TrackerData> {
  const perms = trackerPerms_(t, user)
  if (!perms.open) throw new Error('You do not have access to this tracker.')
  const base: TrackerData = {
    tracker: trackerSummary_(t, user),
    fields: trackerFieldsOut_(t),
    rows: [],
    total: 0,
    limited: false,
    headerProblems: [],
    choices: {},
  }

  const io = trackerIoFor_(t)
  const headers = await io.headers(t)
  const map = mapTrackerColumns_(t, headers)
  let all: { problems: string[]; rows: TrackerRow[] }
  if (map.missing.length) {
    all = { problems: map.missing.map((h) => 'Column "' + h + '" is missing from the sheet.'), rows: [] }
  } else {
    const lines = await io.lines(t)
    const rows: TrackerRow[] = []
    lines.forEach((line, n) => {
      if (!line.some((v) => v !== '' && v !== null)) return
      const vals: Record<string, unknown> = {}
      t.fields.forEach((f) => {
        vals[f.id] = trackerCellOut_(line[map.cols[f.id]])
      })
      const by = map.sys.submitted_by >= 0 ? String(line[map.sys.submitted_by] || '') : ''
      const at = map.sys.submitted_at >= 0 ? trackerCellOut_(line[map.sys.submitted_at]) : ''
      const rid = map.sys.record_id >= 0 ? String(line[map.sys.record_id] || '') : ''
      rows.push({
        recordId: rid || 'row-' + (t.headerRow + 1 + n),
        values: vals,
        submittedBy: normEmail(by),
        submittedAt: String(at || ''),
        outside: !by,
      })
    })
    all = { problems: [], rows }
  }
  base.headerProblems = all.problems
  // Choices for this tracker's dropdowns (and every parent answer of its dependent fields).
  const opts = await allOptions()
  t.fields.forEach((f) => {
    if (!f.listKey) return
    Object.keys(opts).forEach((k) => {
      if (k === f.listKey || k.indexOf(f.listKey + '.') === 0) base.choices[k] = opts[k]
    })
  })
  let rows = all.rows
  if (!perms.viewAll) {
    rows = rows.filter((r) => r.submittedBy === user.email)
  }
  base.total = rows.length
  base.limited = rows.length > TRACKER_MAX_ROWS
  base.rows = rows.slice(-TRACKER_MAX_ROWS).reverse()
  return base
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Canonical spelling of value in list, or null. */
export function matchChoice_(list: unknown[], value: unknown): string | null {
  const v = String(value).toLowerCase()
  for (let i = 0; i < list.length; i++) if (String(list[i]).toLowerCase() === v) return String(list[i])
  return null
}

/** "1234.5", "1,234.5", "-12" -> number; "12,5", "12 KD", "" -> null. Commas only as thousands separators. */
export function parseTrackerNumber_(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null
  let s = String(v == null ? '' : v).replace(/\s+/g, '')
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null
}

/** http(s) only: no javascript:, data: or relative links ever reach an href. */
export function validTrackerUrl_(v: unknown): boolean {
  return /^https?:\/\/[^\s/?#]+[^\s]*$/i.test(String(v == null ? '' : v))
}

export function validDateText_(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/**
 * Checks a submitted record against the tracker's fields and returns the
 * cleaned values keyed by field id. Throws a message naming the field.
 */
export function validateTrackerRecord_(
  t: Pick<Tracker, 'id' | 'fields'>,
  input: Record<string, unknown>,
  opts: Record<string, string[]>,
): Record<string, unknown> {
  input = input || {}
  const byId: Record<string, TrackerField> = {}
  t.fields.forEach((f) => {
    byId[f.id] = f
  })
  Object.keys(input).forEach((k) => {
    if (!byId[k]) throw new Error('Unknown field: ' + k + '. Reload the page; the tracker may have changed.')
  })
  const out: Record<string, unknown> = {}
  t.fields.forEach((f) => {
    if (f.type === 'computed' || f.auto) return
    const raw = input[f.id]
    let v: unknown = raw === null || raw === undefined ? '' : String(raw).replace(/\r\n/g, '\n').trim()
    if (!v) {
      if (f.required) throw new Error(f.label + ' is required.')
      return
    }
    if ((v as string).length > TRACKER_TEXT_MAX) throw new Error(f.label + ' is too long (max ' + TRACKER_TEXT_MAX + ' characters).')
    if (f.type === 'date') {
      if (!validDateText_(v as string)) throw new Error(f.label + ' must be a date (year-month-day).')
    } else if (f.type === 'number' || f.type === 'money') {
      const n = parseTrackerNumber_(v)
      if (n === null) throw new Error(f.label + ' must be a number, like 1250 or 1,250.5.')
      const dec = (String(v).split('.')[1] || '').length
      if (f.type === 'money' && dec > TRACKER_MONEY_DECIMALS) throw new Error(f.label + ' takes up to ' + TRACKER_MONEY_DECIMALS + ' decimals.')
      v = n
    } else if (f.type === 'link') {
      if (!validTrackerUrl_(v)) throw new Error(f.label + ' must be a web link starting with http:// or https://.')
    } else if (f.type === 'dropdown') {
      const hit = matchChoice_(opts[f.listKey] || [], v)
      if (hit === null) throw new Error('"' + v + '" is not a choice for ' + f.label + '. Pick it from the list, or use Other to add it.')
      v = hit
    } else if (f.type === 'dependent') {
      const parent = byId[f.parentFieldId]
      if (!parent) throw new Error(f.label + ' depends on a field that no longer exists.')
      const pv = input[parent.id] === undefined || input[parent.id] === null ? '' : String(input[parent.id]).trim()
      if (!pv) throw new Error('Choose ' + parent.label + ' before ' + f.label + '.')
      const depHit = matchChoice_(opts[trackerDepKey_(t.id, f.id, pv)] || [], v)
      if (depHit === null) throw new Error('"' + v + '" is not a choice for ' + f.label + ' when ' + parent.label + ' is "' + pv + '".')
      v = depHit
    }
    out[f.id] = v
  })
  return out
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export function refuseTrackerWrite_(t: Tracker): void {
  if (trackerIsReadOnly_(t)) {
    throw new Error(t.name + ' is view only. Change it in its own sheet.')
  }
}

/** Ensures the V2 system columns exist at the right of the sheet. Caller holds the lock. */
async function ensureTrackerSystemColumns_(t: Tracker, io: TrackerIo): Promise<string[]> {
  refuseTrackerWrite_(t)
  const headers = await io.headers(t)
  const have: Record<string, boolean> = {}
  headers.forEach((h) => {
    have[normHeader(h)] = true
  })
  const missing = [t.recordIdHeader, t.submittedByHeader, t.submittedAtHeader].filter(
    (h, i, a) => !have[normHeader(h)] && a.indexOf(h) === i,
  )
  if (missing.length) return io.appendHeaders(t, missing)
  return headers
}

function newTrackerRecordId_(): string {
  return 'TRK-' + newId('').replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase()
}

/**
 * Writes one row. On Postgres (native) the "mapped cells only" write collapses
 * to a single tracker_records insert — formula columns are a sheet concept,
 * so nothing is written that the validator did not produce.
 */
async function writeTrackerRow_(
  t: Tracker,
  clean: Record<string, unknown>,
  user: PlatformUser,
): Promise<{ recordId: string; row: number; submittedBy: string; submittedAt: string }> {
  refuseTrackerWrite_(t)
  const io = trackerIoFor_(t)
  const headers = await ensureTrackerSystemColumns_(t, io)
  const map = mapTrackerColumns_(t, headers)
  if (map.missing.length) {
    throw new Error('Not saved: column "' + map.missing[0] + '" is missing from the ' + t.name + ' sheet. Ask an admin to fix the field mapping.')
  }
  const now = new Date()
  const values: Record<string, unknown> = {}
  t.fields.forEach((f) => {
    if (f.type === 'computed') return
    if (f.auto === 'actor_name') values[f.id] = user.name || user.email
    else if (f.id in clean) values[f.id] = clean[f.id]
  })
  const recordId = t.recordIdFormat
    ? t.recordIdFormat.replace('{n}', String((await io.maxFormattedId(t, t.recordIdFormat)) + 1))
    : newTrackerRecordId_()
  const submittedBy = await actorEmail()
  const submittedAt = now.toISOString()
  const row = await io.append(t, { recordId, submittedBy, submittedAt, values })
  return { recordId, row, submittedBy, submittedAt }
}

/** Adds a choice list for a new dropdown / dependent field. */
async function seedFieldChoices_(t: Tracker, fieldId: string, def: FieldDef, actor: string): Promise<void> {
  if (def.type === 'dropdown') {
    for (const c of def.choices || []) await addOption(trackerListKey_(t.id, fieldId), c, actor)
  } else if (def.type === 'dependent') {
    for (const pv of Object.keys(def.choicesByParent || {})) {
      for (const c of def.choicesByParent![pv]) await addOption(trackerDepKey_(t.id, fieldId, pv), c, actor)
    }
  }
}

export function cleanChoiceList_(list: unknown): string[] {
  const seen: Record<string, boolean> = {}
  const out: string[] = []
  const arr = Array.isArray(list) ? list : []
  arr.forEach((c) => {
    const v = String(c == null ? '' : c).replace(/\s+/g, ' ').trim()
    if (!v || v.toLowerCase() === 'other' || seen[v.toLowerCase()]) return
    if (v.length > OPTION_MAX_LEN) throw new Error('Choice "' + v.slice(0, 30) + '…" is too long.')
    seen[v.toLowerCase()] = true
    out.push(v)
  })
  return out
}

export interface FieldDef {
  label: string
  type: string
  required: boolean
  choices?: string[]
  parentFieldId?: string
  choicesByParent?: Record<string, string[]>
  id?: string
  position?: number
}

/**
 * Normalises a field definition from the builder and checks it against the
 * tracker. def: { label, type, required, choices?, parentFieldId?, choicesByParent? }
 */
export async function normaliseFieldDef_(
  t: Tracker,
  def: Partial<FieldDef>,
  pendingFields?: FieldDef[] | null,
  editing?: TrackerField | null,
): Promise<FieldDef> {
  def = def || {}
  const label = String(def.label || '').replace(/\s+/g, ' ').trim()
  if (!label) throw new Error('Give the field a name.')
  if (label.length > TRACKER_FIELD_LABEL_MAX) throw new Error('Keep field names under ' + TRACKER_FIELD_LABEL_MAX + ' characters.')
  const type = String(def.type || '')
  if ((TRACKER_USER_TYPES as readonly string[]).indexOf(type) === -1) {
    throw new Error('Choose what kind of answer the field takes: date, free text, number, money, link, dropdown or dependent.')
  }
  const fields = t.fields.concat((pendingFields as TrackerField[]) || []).filter((f) => !editing || f.id !== editing.id)
  const reserved = [t.recordIdHeader, t.submittedByHeader, t.submittedAtHeader].map(normHeader)
  if (reserved.indexOf(normHeader(label)) !== -1 || fields.some((f) => normHeader(f.label) === normHeader(label))) {
    throw new Error('This tracker already has a field called "' + label + '".')
  }
  const out: FieldDef = { label, type, required: !!def.required }
  if (type === 'dropdown') {
    out.choices = cleanChoiceList_(def.choices)
    const kept = editing ? (await optionsFor(trackerListKey_(t.id, editing.id))).length : 0
    if (!out.choices.length && !kept) throw new Error('Add at least one choice for ' + label + ', or pick Free text.')
  }
  if (type === 'dependent') {
    const parent = fields.filter((f) => f.id === def.parentFieldId)[0]
    if (!parent || (parent.type !== 'dropdown' && parent.type !== 'dependent')) {
      throw new Error(label + ' must depend on a dropdown field of this tracker.')
    }
    out.parentFieldId = parent.id
    out.choicesByParent = {}
    let total = 0
    Object.keys(def.choicesByParent || {}).forEach((pv) => {
      const key = String(pv).replace(/\s+/g, ' ').trim()
      const list = cleanChoiceList_((def.choicesByParent || {})[pv])
      if (key && list.length) {
        out.choicesByParent![key] = list
        total += list.length
      }
    })
    const keptDep = !!(editing && editing.type === 'dependent' && editing.parentFieldId === parent.id)
    if (!total && !keptDep) throw new Error('Add choices for at least one answer of ' + parent.label + '.')
  }
  return out
}

export function uniqueFieldId_(t: Pick<Tracker, 'fields'>, label: string, taken?: string[]): string {
  const base = slugId_(label, 16)
  let id = base
  let n = 2
  const used: Record<string, boolean> = {}
  t.fields.forEach((f) => {
    used[f.id] = true
  })
  ;(taken || []).forEach((x) => {
    used[x] = true
  })
  while (used[id]) id = base + '_' + n++
  return id
}

/** Appends a header for a new field at the right of the sheet (or binds an existing, unmapped one). */
async function addTrackerColumn_(t: Tracker, label: string): Promise<'bound' | 'appended' | 'native'> {
  const io = trackerIoFor_(t)
  const headers = await io.headers(t)
  if (headers.some((h) => normHeader(h) === normHeader(label))) return 'bound'
  if (t.storage === 'native') return 'native' // a native field's column is its values key — no header row to grow
  await io.appendHeaders(t, [label])
  return 'appended'
}

async function registerTrackerFields_(t: Tracker, defs: FieldDef[], actor: string): Promise<void> {
  const ids: string[] = []
  const rows = defs.map((d, i) => {
    const fid = uniqueFieldId_(t, d.label, ids)
    ids.push(fid)
    d.id = fid
    return {
      field_id: fid,
      tracker_id: t.id,
      position: t.fields.length + i + 1,
      label: d.label,
      column_header: d.label,
      type: d.type,
      required: d.required,
      list_key: d.type === 'dropdown' || d.type === 'dependent' ? trackerListKey_(t.id, fid) : '',
      parent_field_id: d.parentFieldId || '',
      auto: '',
      active: true,
      submitted_by: actor,
      submitted_at: new Date().toISOString(),
    }
  })
  const { error } = await db().from(TRACKER_FIELDS_TABLE).insert(rows)
  if (error) throw new Error(error.message)
  for (const d of defs) await seedFieldChoices_(t, d.id!, d, actor)
}

// ---------------------------------------------------------------------------
// Public API (the page facades — same names as google.script.run)
// ---------------------------------------------------------------------------

/** One call for the page: the tracker list and the chosen (or first) tracker's data. */
export async function getTrackersPage(trackerId?: string) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const reg = await trackerRegistry_()
  const list = reg.order.map((id) => reg.byId[id]).filter((t) => trackerPerms_(t, user).open)
  const chosen = list.filter((t) => t.id === trackerId)[0] || list[0]
  let current: TrackerData | null = null
  let error = ''
  if (chosen) {
    try {
      current = await readTrackerData_(chosen, user)
    } catch (e) {
      error = String((e as Error)?.message || e)
    }
  }
  return {
    trackers: list.map((t) => trackerSummary_(t, user)),
    current,
    error,
    canCreate: user.role === 'admin' || user.role === 'tl',
    me: { email: user.email, name: user.name },
  }
}

export async function getTrackerRecords(trackerId: string) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  return readTrackerData_(await trackerOrThrow_(trackerId), user)
}

/** values: { fieldId: text }. submitted_by / submitted_at / record id are set here, never by the client. */
export async function addTrackerRecord(trackerId: string, values: Record<string, unknown>) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const t = await trackerOrThrow_(trackerId)
  refuseTrackerWrite_(t)
  if (!trackerPerms_(t, user).add) throw new Error('You can view ' + t.name + ' but not add to it.')
  await assertWritable()
  const clean = validateTrackerRecord_(t, values, await allOptions())
  const res = await writeTrackerRow_(t, clean, user)
  return { recordId: res.recordId, submittedBy: res.submittedBy, submittedAt: res.submittedAt }
}

/** Adds one field to an existing tracker. Returns the tracker's fresh data. */
export async function addTrackerField(trackerId: string, def: Partial<FieldDef>) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const t = await trackerOrThrow_(trackerId)
  refuseTrackerWrite_(t)
  if (!trackerPerms_(t, user).build) throw new Error('Only ' + t.builderRoles.join(' / ') + ' can add fields to ' + t.name + '.')
  await assertWritable()
  const d = await normaliseFieldDef_(t, def)
  await addTrackerColumn_(t, d.label)
  await registerTrackerFields_(t, [d], await actorEmail())
  return readTrackerData_(await trackerOrThrow_(t.id), user)
}

/**
 * Edits one field: name, kind of answer, required, choices (added, never removed).
 * The stored cells are never rewritten: values that do not fit a new type stay
 * as typed and the page marks them.
 */
export async function updateTrackerField(trackerId: string, fieldId: string, def: Partial<FieldDef>) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const t = await trackerOrThrow_(trackerId)
  refuseTrackerWrite_(t)
  if (!trackerPerms_(t, user).build) throw new Error('Only ' + t.builderRoles.join(' / ') + ' can change fields of ' + t.name + '.')
  await assertWritable()
  const f = t.fields.filter((x) => x.id === String(fieldId || ''))[0]
  if (!f) throw new Error('That field no longer exists. Reload the page.')
  if (f.type === 'computed' || f.auto) throw new Error(f.label + ' is filled automatically and cannot be edited here.')
  const d = await normaliseFieldDef_(t, def, null, f)
  if (d.parentFieldId === f.id) throw new Error(d.label + ' cannot depend on itself.')
  const children = t.fields.filter((x) => x.parentFieldId === f.id)
  if (children.length && d.type !== f.type) {
    throw new Error(children[0].label + ' depends on ' + f.label + ', so its kind of answer cannot change.')
  }
  const listed = d.type === 'dropdown' || d.type === 'dependent'
  // patchTrackerFieldRow_: fail closed when the (tracker_id, field_id) row is gone.
  const { data: patched, error } = await db()
    .from(TRACKER_FIELDS_TABLE)
    .update({
      label: d.label,
      type: d.type,
      required: d.required,
      list_key: listed ? f.listKey || trackerListKey_(t.id, f.id) : '',
      parent_field_id: d.parentFieldId || '',
    })
    .eq('tracker_id', t.id)
    .eq('field_id', f.id)
    .neq('active', false)
    .select('field_id')
  if (error) throw new Error(error.message)
  if (!patched || !patched.length) throw new Error('That field no longer exists. Reload the page.')
  await seedFieldChoices_(t, f.id, d, await actorEmail())
  return readTrackerData_(await trackerOrThrow_(t.id), user)
}

/**
 * Creates a native tracker with its full field list.
 * def: { name, fields: [fieldDef...] }. A dependent field may point at an
 * earlier field of the same list by giving parentFieldId = "#<index>".
 */
export async function createTracker(def: { name?: string; fields?: Partial<FieldDef>[] }) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  def = def || {}
  const name = String(def.name || '').replace(/\s+/g, ' ').trim()
  if (!name) throw new Error('Give the tracker a name.')
  if (name.length > TRACKER_NAME_MAX) throw new Error('Keep the tracker name under ' + TRACKER_NAME_MAX + ' characters.')
  const reg = await trackerRegistry_()
  if (reg.order.some((id) => normHeader(reg.byId[id].name) === normHeader(name))) {
    throw new Error('A tracker called "' + name + '" already exists. Pick it from the list.')
  }
  const rawFields = def.fields || []
  if (!rawFields.length) throw new Error('Add at least one field.')
  if (rawFields.length > TRACKER_MAX_FIELDS) throw new Error('Up to ' + TRACKER_MAX_FIELDS + ' fields per tracker.')

  const id = slugId_(name, 14) + '_' + newId('').replace(/[^a-z0-9]/gi, '').slice(0, 4)
  const t: Tracker = {
    id,
    name,
    storage: 'native',
    spreadsheetId: '',
    tab: ('Tracker ' + name).slice(0, 90),
    headerRow: 1,
    accessMode: 'edit',
    formBacked: false,
    recordIdHeader: 'record_id',
    recordIdFormat: '',
    submittedByHeader: 'submitted_by',
    submittedAtHeader: 'submitted_at',
    viewerRoles: ['admin', 'tl', 'agent'],
    editorRoles: ['admin', 'tl', 'agent'],
    builderRoles: ['admin', 'tl'],
    ownerEmail: user.email,
    archived: false,
    fields: [],
  }

  // Validate every field first (nothing is written if one is wrong).
  const defs: FieldDef[] = []
  for (let i = 0; i < rawFields.length; i++) {
    const fd = rawFields[i]
    const copy: Partial<FieldDef> = {}
    Object.keys(fd || {}).forEach((k) => {
      ;(copy as Record<string, unknown>)[k] = (fd as Record<string, unknown>)[k]
    })
    if (typeof copy.parentFieldId === 'string' && copy.parentFieldId.charAt(0) === '#') {
      const p = defs[Number(copy.parentFieldId.slice(1))]
      copy.parentFieldId = p ? p.id : ''
    }
    const d = await normaliseFieldDef_(t, copy, defs)
    d.id = uniqueFieldId_(t, d.label, defs.map((x) => x.id!))
    d.position = i + 1
    defs.push(d)
  }

  const actor = await actorEmail()
  const now = new Date().toISOString()
  const { error } = await db().from(TRACKERS_TABLE).insert({
    tracker_id: t.id,
    name,
    storage_mode: 'native',
    spreadsheet_id: '',
    tab_name: t.tab,
    header_row: 1,
    access_mode: 'edit',
    form_backed: false,
    record_id_header: 'record_id',
    record_id_format: '',
    submitted_by_header: 'submitted_by',
    submitted_at_header: 'submitted_at',
    viewer_roles: 'admin,tl,agent',
    editor_roles: 'admin,tl,agent',
    builder_roles: 'admin,tl',
    owner_email: user.email,
    archived_at: '',
    submitted_by: actor,
    submitted_at: now,
  })
  if (error) throw new Error(error.message)
  const { error: ferr } = await db()
    .from(TRACKER_FIELDS_TABLE)
    .insert(
      defs.map((d) => ({
        field_id: d.id,
        tracker_id: t.id,
        position: d.position,
        label: d.label,
        column_header: d.label,
        type: d.type,
        required: d.required,
        list_key: d.type === 'dropdown' || d.type === 'dependent' ? trackerListKey_(t.id, d.id!) : '',
        parent_field_id: d.parentFieldId || '',
        auto: '',
        active: true,
        submitted_by: actor,
        submitted_at: now,
      })),
    )
  if (ferr) throw new Error(ferr.message)
  for (const d of defs) await seedFieldChoices_(t, d.id!, d, actor)
  return getTrackersPage(t.id)
}

/**
 * Admin, run once: seeds each dropdown's choices from the distinct values
 * already in its column (external trackers need the Sheets adapter; skipped
 * with a note when D-GOOGLE blocks access). Returns one line per tracker.
 */
export async function setupTrackers() {
  const user = await requireRole(['admin'])
  await assertWritable()
  const reg = await trackerRegistry_()
  const out: string[] = []
  for (const id of reg.order) {
    const t = reg.byId[id]
    try {
      const io = trackerIoFor_(t)
      if (!trackerIsReadOnly_(t)) await ensureTrackerSystemColumns_(t, io)
      const headers = await io.headers(t)
      const map = mapTrackerColumns_(t, headers)
      const lines = await io.lines(t)
      let seeded = 0
      for (const f of t.fields) {
        if (f.type !== 'dropdown' || map.cols[f.id] === undefined) continue
        const seen: Record<string, boolean> = {}
        for (const line of lines) {
          const v = String(line[map.cols[f.id]] || '').replace(/\s+/g, ' ').trim()
          if (!v || v.length > OPTION_MAX_LEN || v.toLowerCase() === 'other' || seen[v.toLowerCase()]) continue
          seen[v.toLowerCase()] = true
          await addOption(f.listKey, v, user.email)
          seeded++
        }
      }
      out.push(t.name + ': ' + seeded + ' choices seeded.')
    } catch (e) {
      out.push(t.name + ': ' + ((e as Error)?.message || e))
    }
  }
  return out.join('\n')
}
