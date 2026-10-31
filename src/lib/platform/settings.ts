/**
 * Settings — port of original_deprecated/Config.js plus the seeded settings of
 * Stores.js (DQ_SETTINGS) and ProductivityApp.js (PROD_SETTINGS, lines 42-79 verbatim).
 *
 * Stored in the `config` table: key | value | description | updated_by | updated_at.
 * Values are strings; getConfig parses JSON-looking values, "true"/"false" and
 * numbers so callers get the natural type back. The whole table is cached for
 * 5 minutes in the process cache (CacheService -> in-memory Map), dropped on write.
 */

import { db, cacheGet, cachePut, cacheRemove, readRows, updateRow, isTrue } from './repo'
import { normEmail } from './identity'
import { assertWritable } from './viewas'

const CONFIG_TABLE = 'config'
const CONFIG_CACHE_KEY = 'cc_config_v1'
const CONFIG_CACHE_S = 300

/**
 * Defaults used when a key is missing from the table (CONFIG_DEFAULTS verbatim).
 */
export const CONFIG_DEFAULTS: Record<string, { value: unknown; description: string }> = {
  allowed_domain: { value: 'dabdoob.com', description: 'Only addresses on this domain can use the tool.' },
  admin_emails: { value: 'mohamed.nabil@dabdoob.com', description: 'Comma-separated admin addresses.' },
  mail_dry_run: { value: true, description: 'When true, reminders are logged to MailLog but not sent.' },
  mail_reply_to: { value: '', description: 'Reply-to address on reminder emails. Blank = sender.' },
  one_on_one_cutoff: { value: '22:00', description: 'Kuwait time. After this a 1:1 not logged on its scheduled day counts as missed.' },
  one_on_one_email_15min: { value: true, description: 'Email both people 15 minutes before a booked 1:1 (needs installOneOnOneReminderTrigger).' },
  one_on_one_inapp_15min: { value: true, description: 'In-app alert for both people 15 minutes before a booked 1:1, while the app is open.' },
  one_on_one_inapp_start: { value: true, description: 'In-app alert with a chime at the start time of a booked 1:1, while the app is open.' },
  app_url_hub: { value: '', description: 'Web app URL of the Hub app (Hub Admin > Connected apps). Blank: app_url.' },
  app_url_quality: { value: '', description: 'Web app URL of the Quality app (Hub Admin > Connected apps). The rail and the diagram open Quality there.' },
  app_url_productivity: { value: '', description: 'Web app URL of the Productivity app (Hub Admin > Connected apps). The rail and the diagram open Productivity there.' },
}

/**
 * Settings this area reads (DQ_SETTINGS verbatim, Stores.js lines 33-71). Seeded into
 * config by seedSettings so they are editable in Admin; read through dqSetting so a
 * missing row falls back to the default.
 */
export const DQ_SETTINGS: Record<string, { value: unknown; description: string }> = {
  business_tz: { value: 'Asia/Kuwait', description: 'Shift and check-in times are in this zone (no DST).' },
  data_tz: { value: 'Africa/Cairo', description: 'Zone of the wall-clock timestamps in the daily report (has DST).' },
  checkin_slots: { value: ['09:30', '13:00', '18:30', '22:00'], description: 'Queue check-in times, business_tz.' },
  checkin_slot_names: { value: { '09:30': 'Start of day', '13:00': 'PM shift start', '18:30': 'End of overlap', '22:00': 'End of day' }, description: 'Label for each check-in slot.' },
  checkin_read_delay_min: { value: 20, description: 'Freshdesk lag: the slot snapshot is read this many minutes after the slot. 20 lets the daily report (fetches at slot +5, Freshchat ~2 min) land first.' },
  checkin_open_before_min: { value: 15, description: 'The check-in form opens this many minutes before the slot.' },
  checkin_due_after_min: { value: 30, description: 'A check-in not submitted this long after the slot is missed.' },
  checkin_owner_emails: { value: {}, description: 'JSON: slot -> list of TL emails reminded when that check-in is missed. A slot with no list reminds every active team lead.' },
  aging_bands_h: { value: [4, 12, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240], description: 'Aging band edges in hours since created_at (neutral -> deep red): under 4 h, 4-12 h, 12-24 h, then one band per day up to day 10, then 10 days and over.' },
  queue_excluded_text: { value: ['gift card'], description: 'Any group whose name contains one of these words is left out of the queue board and aging cases (in addition to inflow_excluded_groups). Case-insensitive.' },
  our_queue_text: { value: ['customer support'], description: 'Groups whose name contains one of these words are our CX queues and are listed first; every other group is listed after them under "Other teams". Chats count as ours.' },
  open_statuses: { value: ['Open', 'Pending', 'Pending on CX', 'Pending on Ops', 'Pending on 3PL', 'Waiting on Customer', 'No Response From customer'], description: 'Statuses that count as open for aging and queue health.' },
  actionable_statuses: { value: ['Open', 'Pending', 'Pending on CX'], description: 'Open statuses that are CX work right now.' },
  inflow_excluded_groups: { value: ['FreshChat', 'Inbound Calls Documentation', 'Ops Qatar - Gift cards', 'Ops Kuwait - Gift cards'], description: 'Groups left out of inflow, aging and queue health: documentation groups (the contact is already counted) and notification-only groups. Matched ignoring case and spaces around "-".' },
  inflow_escalation_channel: { value: 'Internal Escalation', description: 'Ticket channel value that marks an internal escalation.' },
  inflow_escalation_statuses: { value: ['Pending on CX'], description: 'An internal escalation raised outside CX counts as inflow once it has ever been in one of these statuses.' },
  cx_freshdesk_ids_extra: { value: [], description: 'Freshdesk user ids of CX staff missing from Headcount (TLs). Escalations they raise are not inflow.' },
  queue_map: { value: {}, description: 'JSON: Freshdesk group -> queue name, to merge groups into one queue. Unlisted groups are their own queue.' },
  chat_open_max_age_h: { value: 48, description: 'A Freshchat conversation counts as open only if it was initiated within this many hours (abandoned chats never get a resolve event).' },
  daily_report_stale_after_min: { value: 90, description: 'Chats are flagged stale when the newest "Updated at" in the daily report Freshchat tab is older than this many minutes.' },
  chat_country_map: { value: { kuwait: 'Kuwait', ksa: 'KSA', saudi: 'KSA', riyadh: 'KSA', uae: 'UAE', qatar: 'Qatar', bahrain: 'Bahrain', oman: 'Oman' }, description: 'Freshchat channel-name fragment -> country.' },
  inflow_lookback_days: { value: 35, description: 'Days of inflow recomputed on each run.' },
  freshdesk_domain: { value: 'dabdoobapp.freshdesk.com', description: 'Freshdesk helpdesk domain.' },
  freshdesk_full_sync_start: { value: '2026-04-20T00:00:00Z', description: 'Earliest updated_at the full ticket sync pulls.' },
  daily_report_ss_id: { value: '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4', description: 'Daily report spreadsheet (Freshchat and Maqsam tabs), read-only.' },
  productivity_fallback_id: { value: '1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI', description: 'Productivity workbook used when a month has no entry in productivity_files.' },
  productivity_files: { value: {}, description: 'JSON: yyyy-MM -> productivity workbook id for that month.' },
  fd_activity_ss_id: { value: '1Fc6VCk8bLmy8ZUMCeBDPHvu7dMWDtONn6CRd9H_aHzM', description: 'Freshdesk activity log spreadsheet (Activities tab), read-only.' },
  roster_hct_ss_id: { value: '1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw', description: 'Roster master (Egypt Operations HCT), tab Sheet1, read-only.' },
  roster_scope: { value: ['Customer Experience'], description: 'HCT Section values in the CX roster (trimmed, case-insensitive). Rows in other sections are not synced.' },
  roster_manager_aliases: { value: {}, description: 'JSON: a Direct Repporter name as written in the HCT -> that manager\'s email, for names the automatic match cannot resolve, e.g. {"Khaled El Naggar":"khaled@dabdoob.com"}.' },
  roster_admin_positions: { value: ['Customer Experience Manager'], description: 'HCT Positions synced with role admin (matched ignoring case and spaces).' },
  roster_non_agent_positions: { value: ['Enablement Specialist', 'Enablemen Specialist'], description: 'HCT Positions that are not agents (role specialist: agent-level access, left out of agent lists). The HCT spells it "Enablemen".' },
  roster_non_agent_emails: { value: [], description: 'Emails synced with role specialist whatever their Position.' },
  days_off_default: { value: [], description: 'Default weekly days off when a person and their country have none. Empty: agent days off are rotational, so there is no fixed default.' },
  days_off_by_country: { value: {}, description: 'JSON: based-in country -> days off, e.g. {"Egypt":["Fri","Sat"]}. Overrides the default.' },
  activity_local_tz: { value: 'Asia/Kuwait', description: 'Zone of the MM-dd-yyyy timestamps in Activities (used only to dedupe).' },
}

/**
 * PROD_SETTINGS verbatim (ProductivityApp.js lines 42-79), seeded by seedSettings.
 */
export const PROD_SETTINGS: Record<string, { value: unknown; description: string }> = {
  prod_activity_tz: { value: 'Asia/Kuwait', description: 'Zone of Start time / End time when they are text, not real dates.' },
  prod_status_map: { value: {}, description: 'JSON: status name in the import -> the name the productivity engine uses (Available, Inbound Calls, Chats, Waiting Address, IDLE), when they differ.' },
  prod_flag_cases_x: { value: 2, description: 'Distinct tickets / conversations inside one window that mark IDLE time as work (spec: 2 distinct in 10 minutes).' },
  prod_flag_window_min: { value: 10, description: 'Window length in minutes for prod_flag_cases_x.' },
  prod_flag_min_interval_min: { value: 5, description: 'IDLE intervals shorter than this many minutes are never flagged.' },
  prod_flag_statuses: { value: ['IDLE'], description: 'Statuses whose time can be flagged as work.' },
  prod_working_statuses: { value: ['Available', 'Chats'], description: 'Known working statuses: their windows are the reference in the calibration histogram.' },
  prod_offline_statuses: { value: ['Offline'], description: 'Statuses that are not logged-in time (left out of logged minutes in the analytics).' },
  prod_channel_status: { value: { chat: 'Chats', ticket: 'Available', wa: 'Waiting Address' }, description: 'JSON: the suggested status by the work channel of a flagged window: chat, ticket, wa (waiting address).' },
  prod_replacement_statuses: { value: ['Available', 'Chats', 'Inbound Calls', 'Waiting Address', 'Busy'], description: 'Statuses a team lead can pick when accepting a flag. Busy and other statuses outside the engine\'s list do not count in Productivity %.' },
  prod_reason_statuses: { value: ['Busy'], description: 'Picking one of these statuses needs a reason (reverting always does).' },
  prod_review_days: { value: 7, description: 'Days a team lead has to review a flag. Only used when prod_flag_auto_accept = false (legacy manual review mode). On the day it is due, the daily job accepts the suggested status (logged as auto: a TL review miss).' },
  prod_dispute_days: { value: 3, description: 'DEPRECATED: Dispute mechanism removed. No longer used.' },
  prod_flag_auto_accept: { value: true, description: 'When true, flags are auto-accepted immediately on detection (no TL review needed). When false, flags require TL review (legacy mode).' },
  prod_confidence_auto_threshold: { value: 50, description: 'Minimum confidence score to auto-accept. Flags below this score require manual review. Only used when prod_flag_auto_accept = true.' },
  prod_confidence_warning_threshold: { value: 30, description: 'Minimum confidence score to avoid warning. Flags below this score are flagged for attention.' },
  quarterly_report_recipients: { value: '', description: 'Comma-separated emails to receive quarterly productivity flag reports. Leave empty to disable.' },
  prod_chat_groups: { value: ['FreshChat'], description: 'Freshdesk groups whose ticket activity counts as a chat case.' },
  prod_wa_groups: { value: ['Waiting Address', 'Unreachable Customers'], description: 'Freshdesk groups whose status changes count as waiting-address cases.' },
  tph_channels: { value: [
    // Agents work the internal queues (incl. the two OOS groups) together: one channel, one case pool, one cap pool.
    { key: 'internal', name: 'Internal', kind: 'ticket', groups: ['Customer Support - Internal', 'Kuwait - Customer Support - Internal', 'KSA - Customer Support', 'Out Of Stock (OOS)', 'OOS - Kuwait'] },
    { key: 'chats', name: 'Chats', kind: 'chat', groups: ['FreshChat'] },
    { key: 'wa', name: 'Waiting address', kind: 'manual', groups: ['Waiting Address', 'Unreachable Customers'] },
    { key: 'calls', name: 'Inbound calls', kind: 'manual', groups: ['Inbound Calls Documentation'] },
  ], description: 'JSON: TPH channels. key, name, kind (ticket: automatic cases from these Freshdesk groups on the Queue board; chat: automatic from the Freshchat queue; manual: the TL enters the cases) and groups (touches in these groups count on the channel). "off" (off shift) is built in.' },
  tph_activities: { value: [{ key: 'break', name: 'Break' }, { key: 'meeting', name: 'Meeting' }], description: 'JSON: non-queue activities a TL can log in the TPH grid (key, name). Never capped.' },
  tph_ticket_statuses: { value: ['Open', 'Pending on CX'], description: 'Ticket statuses that count as required action from CX in the automatic cases number (stock at the start of the hour).' },
  tph_chat_exclude_statuses: { value: [], description: 'Freshchat statuses left out of the automatic chats number. Empty: every conversation not resolved counts, Waiting on Customer included.' },
  tph_day_hours: { value: [8, 24], description: 'JSON [from, to]: the hours of the TPH grid, Kuwait (to is exclusive; 24 = midnight).' },
  tph_minutes_per_case: { value: 3, description: 'Time study: minutes per case. An agent\'s cap is never more than their cap minutes / this (3 -> at most 20 an hour).' },
  tph_cap_window_min: { value: 55, description: 'Only minutes before :55 (this value) of each hour count toward a cap.' },
  tph_calls_minute_factor: { value: 0.5, description: 'Same-day ESTIMATE only (placeholder 0.5): share (0..1) of a slot blended with Inbound calls that still counts toward the primary channel\'s cap minutes until the next morning, when the actual Maqsam call minutes replace it. 0 = call time does not count, 1 = no reduction.' },
  tph_call_states: { value: ['Serviced'], description: 'Maqsam Calls "Call state" values that count as handled call time (the V1 engine counts answered inbound calls as Serviced).' },
  tph_tl_edit_days: { value: 3, description: 'Team leads can change TPH logs and cases for today and this many days back; older days only an admin.' },
  tph_eligible_days: { value: 28, description: 'Days of touches that list an agent as working a channel.' },
}

/** Every seedable setting: Config defaults + queue/workforce + productivity rules. */
export const ALL_SETTINGS: Record<string, { value: unknown; description: string }> = {
  ...DQ_SETTINGS,
  ...PROD_SETTINGS,
  ...CONFIG_DEFAULTS,
}

// ---------------------------------------------------------------- read path

export function parseConfigValue(raw: unknown): unknown {
  if (raw === '' || raw === null || raw === undefined) return ''
  if (typeof raw !== 'string') return raw
  const s = raw.trim()
  if (s === 'true') return true
  if (s === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (/^[\[{]/.test(s)) {
    try {
      return JSON.parse(s)
    } catch {
      return raw
    }
  }
  return raw
}

/** configAll_: the whole settings map, cached 5 minutes, dropped on every write. */
export async function configAll(): Promise<Record<string, unknown>> {
  const hit = cacheGet(CONFIG_CACHE_KEY)
  if (hit) return JSON.parse(hit) as Record<string, unknown>
  const map: Record<string, unknown> = {}
  Object.keys(CONFIG_DEFAULTS).forEach((k) => {
    map[k] = CONFIG_DEFAULTS[k].value
  })
  try {
    const rows = await readRows(CONFIG_TABLE)
    rows.forEach((r) => {
      if (r.key) map[String(r.key)] = parseConfigValue(r.value)
    })
  } catch {
    /* a missing config table reads as the defaults */
  }
  cachePut(CONFIG_CACHE_KEY, JSON.stringify(map), CONFIG_CACHE_S)
  return map
}

export function bustConfigCache(): void {
  cacheRemove(CONFIG_CACHE_KEY)
}

export async function getConfig(key: string, fallback?: unknown): Promise<unknown> {
  const all = await configAll()
  return key in all && all[key] !== '' ? all[key] : fallback
}

/** dqSetting_: a Stores.js setting — table value, else the DQ_SETTINGS default, else ''. */
export async function dqSetting(key: string): Promise<unknown> {
  const d = DQ_SETTINGS[key]
  return getConfig(key, d ? d.value : '')
}

/** prodSetting_: a ProductivityApp.js setting — table value, else the PROD_SETTINGS default. */
export async function prodSetting(key: string): Promise<unknown> {
  const d = PROD_SETTINGS[key]
  return getConfig(key, d ? d.value : '')
}

// ---------------------------------------------------------------- write path

const CONFIG_KEY_RE = /^[a-z0-9_]{1,64}$/

/** Writes one key (setConfig_). Caller must already have checked the user is an admin. */
export async function setConfig(
  key: string,
  value: unknown,
  description?: string,
  actor = 'system:unknown'
): Promise<Record<string, unknown> | null> {
  await assertWritable()
  if (!CONFIG_KEY_RE.test(String(key))) {
    throw new Error('Config keys are lower_snake_case, up to 64 characters.')
  }
  const stored = typeof value === 'string' ? value : JSON.stringify(value)
  const existing = await readRows(CONFIG_TABLE, { where: (r) => r.key === key })
  let result: Record<string, unknown> | null
  if (existing.length) {
    const patch: Record<string, unknown> = { value: stored }
    if (description !== undefined) patch.description = description
    result = await updateRow(CONFIG_TABLE, 'key', key, patch, { actor, stampUpdates: true })
  } else {
    const dflt = ALL_SETTINGS[key] || CONFIG_DEFAULTS[key]
    // config has no submitted_* columns: stamped via updated_by / updated_at instead.
    const { data, error } = await db()
      .from(CONFIG_TABLE)
      .insert({
        key,
        value: stored,
        description: description || (dflt ? dflt.description : ''),
        updated_by: actor,
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle()
    if (error) throw new Error(error.message)
    result = (data as Record<string, unknown> | null) ?? null
  }
  bustConfigCache()
  return result
}

/**
 * Writes every default that is not in the table yet — CONFIG_DEFAULTS + DQ_SETTINGS +
 * PROD_SETTINGS — without overwriting existing keys. Safe to run repeatedly
 * (seedConfig_ + setupV2/settings seeding + setupProductivity's missing-key writes).
 */
export async function seedSettings(actor = 'system:setup'): Promise<{ added: number; keys: string[] }> {
  const present: Record<string, boolean> = {}
  try {
    ;(await readRows(CONFIG_TABLE)).forEach((r) => {
      if (r.key) present[String(r.key)] = true
    })
  } catch {
    /* table missing: everything gets written */
  }
  const added: string[] = []
  const now = new Date().toISOString()
  const batch = Object.keys(ALL_SETTINGS)
    .filter((k) => !present[k])
    .map((k) => ({
      key: k,
      value: typeof ALL_SETTINGS[k].value === 'string' ? ALL_SETTINGS[k].value : JSON.stringify(ALL_SETTINGS[k].value),
      description: ALL_SETTINGS[k].description,
      updated_by: actor,
      updated_at: now,
    }))
  if (batch.length) {
    const { error } = await db().from(CONFIG_TABLE).insert(batch)
    if (error) throw new Error(error.message)
    batch.forEach((b) => added.push(b.key))
  }
  bustConfigCache()
  return { added: added.length, keys: added }
}

// ---------------------------------------------------------------- editable settings (Hub Admin)

/** What kind of value a setting holds, from its current value (configKind_). */
export function configKind(v: unknown): 'boolean' | 'number' | 'list' | 'json' | 'text' {
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return 'number'
  if (Array.isArray(v)) return 'list'
  if (v && typeof v === 'object') return 'json'
  return 'text'
}

export interface ConfigRow {
  key: string
  value: unknown
  kind: string
  description: string
  updatedBy: string
  updatedAt: string
}

/** Every setting for Admin: table rows plus defaults not yet written, sorted by key (configRows_). */
export async function configRows(): Promise<ConfigRow[]> {
  const seen: Record<string, boolean> = {}
  const out: ConfigRow[] = (await readRows(CONFIG_TABLE))
    .filter((r) => r.key)
    .map((r) => {
      const v = parseConfigValue(r.value)
      seen[String(r.key)] = true
      return {
        key: String(r.key),
        value: v,
        kind: configKind(v),
        description: String(r.description || ''),
        updatedBy: String(r.updated_by || ''),
        updatedAt: String(r.updated_at || ''),
      }
    })
  Object.keys(ALL_SETTINGS).forEach((k) => {
    if (seen[k]) return
    const v = ALL_SETTINGS[k].value
    out.push({ key: k, value: v, kind: configKind(v), description: ALL_SETTINGS[k].description, updatedBy: '', updatedAt: '' })
  })
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
}

/** Productivity rule settings (ProductivityApp.js): whole numbers within these bounds. */
export const PROD_LIMITS: Record<string, [number, number]> = {
  prod_flag_cases_x: [1, 20],
  prod_flag_window_min: [1, 60],
  prod_flag_min_interval_min: [0, 120],
  prod_review_days: [1, 60],
}

export const CONFIG_EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

/** Apps.js: the Apps Script web-app URL shape app_url_* keys validated against (kept verbatim). */
export const CC_APP_URL_RE =
  /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+\/|a\/[A-Za-z0-9.-]+\/macros\/|macros\/)s\/[A-Za-z0-9_-]+\/exec$/

/** Apps.js: the ecosystem's apps; app_url_<app> holds each one's URL. This app is `productivity`. */
export const CC_APPS = ['hub', 'quality', 'productivity', 'desk', 'people', 'operations', 'queue', 'fcr']

/**
 * Checks a new value for an existing setting and returns it in the type the setting
 * already has (validateConfigValue_ verbatim semantics). Throws a message that says
 * what to fix. `actor` is the admin saving: admin_emails must keep them in it.
 */
export function validateConfigValue(key: string, value: unknown, current: unknown, actor?: string): unknown {
  key = String(key || '')
  const kind = configKind(current)
  const empty = current === '' || current === null || current === undefined
  let v = value
  if (typeof v === 'string' && (kind === 'list' || kind === 'json' || (empty && /^\s*[\[{]/.test(v)))) {
    try {
      v = JSON.parse(v)
    } catch (e) {
      throw new Error(key + ': not valid JSON (' + (e as Error).message + ').')
    }
  }
  if (!empty) {
    if (kind === 'boolean') {
      if (v === 'true' || v === 'false') v = v === 'true'
      if (typeof v !== 'boolean') throw new Error(key + ' is true or false.')
    } else if (kind === 'number') {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
      if (typeof n !== 'number' || !isFinite(n)) throw new Error(key + ' is a number.')
      v = n
    } else if (kind === 'list') {
      if (!Array.isArray(v)) throw new Error(key + ' is a list: write it as JSON, e.g. ["a", "b"].')
    } else if (kind === 'json') {
      if (!v || typeof v !== 'object' || Array.isArray(v)) {
        throw new Error(key + ' is a JSON object, e.g. {"key": "value"}.')
      }
    } else if (typeof v !== 'string') {
      v = String(v === null || v === undefined ? '' : v)
    }
  }
  if (typeof v === 'string') {
    v = v.trim()
    if ((v as string).length > 5000) throw new Error(key + ' is too long (over 5,000 characters).')
  }
  // Settings whose shape is known by name.
  if (PROD_LIMITS[key]) {
    const lim = PROD_LIMITS[key]
    if (typeof v !== 'number' || v !== Math.round(v) || v < lim[0] || v > lim[1]) {
      throw new Error(key + ' is a whole number from ' + lim[0] + ' to ' + lim[1] + '.')
    }
  } else if (key === 'prod_flag_statuses' || key === 'prod_replacement_statuses') {
    v = ([] as unknown[]).concat(v as unknown[]).map((s) => String(s).trim()).filter(String)
    if (!(v as unknown[]).length) throw new Error(key + ' needs at least one status.')
  } else if (key === 'prod_channel_status') {
    ;['chat', 'ticket', 'wa'].forEach((k) => {
      const o = v as Record<string, unknown> | null
      if (!o || typeof o[k] !== 'string' || !(o[k] as string).trim()) {
        throw new Error('prod_channel_status needs a status for chat, ticket and wa, e.g. {"chat":"Chats","ticket":"Available","wa":"Waiting Address"}.')
      }
    })
  }
  if (key === 'admin_emails') {
    const list = String(v).split(',').map(normEmail).filter(String)
    if (!list.length) throw new Error('admin_emails needs at least one address.')
    list.forEach((e) => {
      if (!CONFIG_EMAIL_RE.test(e)) throw new Error('admin_emails: "' + e + '" is not an email address.')
    })
    if (actor && list.indexOf(normEmail(actor)) === -1) {
      throw new Error('admin_emails must keep your own address (' + actor + '), or you would lose access to Admin.')
    }
    v = list.join(',')
  } else if (/_email$/.test(key) && typeof v === 'string' && v && !CONFIG_EMAIL_RE.test(v)) {
    throw new Error(key + ': "' + v + '" is not an email address.')
  } else if (/_emails$/.test(key) && Array.isArray(v)) {
    v = (v as unknown[]).map(normEmail).filter(String)
    ;(v as string[]).forEach((e: string) => {
      if (!CONFIG_EMAIL_RE.test(e)) throw new Error(key + ': "' + e + '" is not an email address.')
    })
  } else if ((/_ss_id$/.test(key) || /^ss_.*_id$/.test(key)) && typeof v === 'string' && v && !/^[A-Za-z0-9_-]{20,}$/.test(v)) {
    throw new Error(key + ' is a spreadsheet id (the long code in its URL between /d/ and /edit).')
  } else if (/^app_url_/.test(key) && typeof v === 'string' && v && !CC_APP_URL_RE.test(v)) {
    throw new Error(key + ': paste the web app URL from Deploy > Manage deployments (https://script.google.com/.../exec).')
  } else if (/_since$/.test(key) && typeof v === 'string' && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(key + ' is a date written yyyy-MM-dd.')
  } else if (/_tz$/.test(key) && typeof v === 'string' && v) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: v }).format(new Date())
    } catch {
      throw new Error(key + ': "' + v + '" is not a time zone, e.g. Asia/Kuwait.')
    }
  }
  return v
}

/**
 * Admin edit of one setting: validated against its current type, then written with
 * updated_by / updated_at (saveConfigValue_). Role check happens in the caller/route
 * (requireRole(['admin']) from identity.ts).
 */
export async function saveConfigValue(key: string, value: unknown, actor: string): Promise<unknown> {
  key = String(key || '')
  const all = await configAll()
  if (!(key in all)) {
    throw new Error('There is no setting "' + key + '". Settings are added by the code that uses them.')
  }
  const clean = validateConfigValue(key, value, all[key], actor)
  await setConfig(key, clean, undefined, actor)
  return clean
}

// ---------------------------------------------------------------- app URLs (Apps.js)

/** appUrls_: web-app URL of every app, from config app_url_<app>. No ScriptApp: no self-URL. */
export async function appUrls(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const a of CC_APPS) {
    out[a] = String((await getConfig('app_url_' + a, '')) || '')
  }
  if (!out.hub) out.hub = String((await getConfig('app_url', '')) || '')
  return out
}

/** ccApp_: this project is the Productivity app (CC_APP in the legacy build). */
export function ccApp(): string {
  return 'productivity'
}

export { isTrue }
