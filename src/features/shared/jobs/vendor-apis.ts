/**
 * Vendor API -> mirror-row mappers. Each mapper emits the same 7-cell `cols`
 * shape the sheet mirrors stored, so every reader (tphCallMinutesFromRows_,
 * tphChatCases_) works unchanged. Timestamps go out as ISO strings — the sheet
 * formats were ambiguous (Maqsam col D is DD-MM-YYYY while col E is MM-DD-YYYY
 * in the same row), ISO instants cannot misparse.
 */

import 'server-only'
import { DescribedError } from '@/features/shared/lib/errors'
import { epochMs, isoMs } from '@/features/shared/vendor/http'
import { listMaqsamCalls, maqsamCredsFromEnv } from '@/features/shared/vendor/maqsam'
import { listFreshchatConversations, freshchatCredsFromEnv } from '@/features/shared/vendor/freshchat'
import { FD_STATUS_NAMES } from './freshdesk'

const str = (v: unknown) => String(v === null || v === undefined ? '' : v).trim()
const num = (v: unknown) => {
  const n = Number(v)
  return isFinite(n) ? n : 0
}
const pick = (o: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]
  return undefined
}

/** seconds -> 'H:MM:SS' (the sheet's Call duration display). */
function hms(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec))
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Maqsam call -> mirror cells matching sheet cols D..J:
 *   [0] start ISO | [1] end ISO | [2] duration 'H:MM:SS' | [3] agent email |
 *   [4] call state | [5] direction | [6] total handling time, fractional days
 * [6] blank falls back to end−start inside tphCallMinutesFromRows_.
 */
export function maqsamCallToCols(call: Record<string, unknown>): unknown[] | null {
  const start = epochMs(pick(call, 'timestamp', 'start_time', 'start', 'started_at', 'created_at', 'created_time'))
  if (!start) return null
  const durationSec = num(pick(call, 'duration', 'call_duration'))
  const explicitEnd = epochMs(pick(call, 'end_time', 'end', 'ended_at', 'finished_at'))
  const end = explicitEnd || (durationSec > 0 ? start + durationSec * 1000 : 0)
  const agent = call.agent as Record<string, unknown> | undefined
  const agents = Array.isArray(call.agents) ? (call.agents[0] as Record<string, unknown> | undefined) : undefined
  const email = str(
    pick(call, 'agent_email', 'email', 'agentEmail') || (agent && pick(agent, 'email')) || (agents && pick(agents, 'email'))
  ).toLowerCase()
  const state = str(pick(call, 'state', 'call_state', 'status'))
  const direction = str(pick(call, 'direction', 'call_direction', 'type'))
  // handling time: seconds in the API, fractional days in the sheet
  const handlingSec = num(pick(call, 'handlingTime', 'handling_time', 'total_handling_time', 'handling', 'handling_time_seconds'))
  return [isoMs(start), end ? isoMs(end) : '', hms(durationSec), email, state, direction, handlingSec > 0 ? String(handlingSec / 86400) : '']
}

/** Freshchat conversation -> mirror cells matching sheet cols A..G:
 *   [0] initiated ISO | [1] status ('' open / 'AGENT_RESOLVE' resolved) |
 *   [2] '<convId>-<createdMs>' (epoch-suffix fallback) | [3] updated ISO |
 *   [4] resolved ISO | [5] channel | [6] conversation id
 */
export function freshchatConvToCols(conv: Record<string, unknown>): unknown[] | null {
  const id = str(pick(conv, 'conversation_id', 'id'))
  const created = epochMs(pick(conv, 'created_time', 'created_at'))
  if (!id || !created) return null
  const updated = epochMs(pick(conv, 'updated_time', 'updated_at'))
  const resolved = epochMs(pick(conv, 'resolved_time', 'status_resolved_time', 'resolved_at'))
  const status = str(conv.status).toLowerCase()
  const isResolved = resolved > 0 || status === 'resolved' || status === 'closed'
  const channel = str(pick(conv, 'channel_id', 'channel', 'source'))
  return [isoMs(created), isResolved ? 'AGENT_RESOLVE' : '', `${id}-${created}`, updated ? isoMs(updated) : '', isResolved && resolved ? isoMs(resolved) : '', channel, id]
}

/** maqsam_calls SPECS.fetch: calls created in [sinceMs, untilMs) — one sync window. */
export async function fetchMaqsamRows(sinceMs?: number, untilMs?: number): Promise<unknown[][]> {
  const creds = maqsamCredsFromEnv()
  if (!creds) {
    throw new DescribedError({
      code: 'missing_credentials',
      message: 'MAQSAM_API_KEY / MAQSAM_API_SECRET / MAQSAM_DOMAIN are not configured',
      hint: 'Set the Maqsam API credentials in Vercel env (Maqsam Account Settings > API Credentials).',
    })
  }
  const calls = await listMaqsamCalls(creds, { startMs: sinceMs, endMs: untilMs, maxPages: 400 })
  const rows: unknown[][] = []
  for (const c of calls) {
    const cols = maqsamCallToCols(c)
    if (cols) rows.push(cols)
  }
  return rows
}

/** freshchat SPECS.fetch: conversations updated since `sinceMs` (all when absent). */
export async function fetchFreshchatRows(sinceMs?: number): Promise<unknown[][]> {
  const creds = freshchatCredsFromEnv()
  if (!creds) {
    throw new DescribedError({
      code: 'missing_credentials',
      message: 'FRESHCHAT_API_KEY / FRESHCHAT_DOMAIN are not configured',
      hint: 'Set the Freshchat API credentials in Vercel env (Freshchat Admin Settings > API Settings).',
    })
  }
  const convs = await listFreshchatConversations(creds, { sinceMs })
  const rows: unknown[][] = []
  for (const c of convs) {
    const cols = freshchatConvToCols(c)
    if (cols) rows.push(cols)
  }
  return rows
}

// ---------- fd_activities export -> 10-cell 'Activities' mirror rows ----------
// (Reference_Code.gs :236-253 filter/expansion + :297-312 sheet write.)

/**
 * parseFdActivityDate_ — the .gs parseActivityDate rules:
 *   1. ISO 8601 (YYYY-MM-DD...)          -> parse directly, unambiguous
 *   2. anything else                     -> first part DD, second MM
 *      (the export writes `DD-MM-YYYY HH:MM:SS +0000`; the offset is always
 *      UTC so the captured HH:MM:SS is emitted with `Z`)
 *   3. fallback `new Date`               -> null when unparseable
 */
export function parseFdActivityDate_(dateStr: unknown): Date | null {
  if (!dateStr) return null
  const s = String(dateStr)
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
    const d = new Date(s.replace(/\//g, '-'))
    if (!isNaN(d.getTime())) return d
  }
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[T ](\d{2}):(\d{2}):(\d{2}))?/)
  if (m) {
    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = m
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh}:${min}:${ss}Z`)
    if (!isNaN(d.getTime())) return d
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** Status cell value -> the sheet's name: numeric codes via FD_STATUS_NAMES, name strings pass through. */
function fdStatusName_(v: unknown): string {
  const n = Number(v)
  if (v !== '' && isFinite(n) && FD_STATUS_NAMES[n]) return FD_STATUS_NAMES[n]
  return str(v)
}

const FD_ACT_CONSUMED_KEYS = new Set([
  'new_ticket', 'status',
  'old_status', 'previous_status', 'status_from', 'old_value', 'from',
  'group', 'group_name', 'ticket_group', 'group_id',
])
const fdActivityWarnedKeys = new Set<string>()
/** One console.warn per unmapped old/group-shaped payload key (S03-02 research guard). */
function fdActivityWarnUnmapped_(data: Record<string, unknown>): void {
  for (const k of Object.keys(data)) {
    if (FD_ACT_CONSUMED_KEYS.has(k) || !/old|previous|from_|_from|group/i.test(k)) continue
    if (fdActivityWarnedKeys.has(k)) continue
    fdActivityWarnedKeys.add(k)
    console.warn('fdActivityToCells_: unmapped export activity key "' + k + '" — extend the pick lists if it carries old-value/group.')
  }
}

/**
 * fdActivityToCells_ — one raw `activities_data` object -> the 10-cell
 * 'Activities' mirror layout (cells 0-8 named + trailing ''), or null when
 * the activity is skipped (`performer_type !== 'user'` or nothing the sheet
 * logged). Like the legacy, ONE activity expands into up to TWO rows
 * (new_ticket then status), so the return is a LIST of 10-cell rows.
 *
 *   [0] performed_at ISO | [1] ticket_id | [2] performer name |
 *   [3] performer type | [4] activity type | [5] field changed |
 *   [6] new value | [7] old value | [8] group | [9] '' (unread).
 *
 * rosterNames: roster fd-directory byId map (`freshdesk_id` -> `freshdesk_name`),
 * `User <id>` fallback per the legacy. groupNames: optional group_id -> name
 * map (`fdGroups_`); a numeric `activity.group` without it is left '' for the
 * write-time `tickets` fallback (PLAN: current-group drift accepted).
 */
export function fdActivityToCells_(
  activity: Record<string, unknown>,
  rosterNames: Record<string, string>,
  groupNames?: Record<string, string>
): unknown[][] | null {
  if (str(activity.performer_type) !== 'user') return null
  const data = (activity.activity || {}) as Record<string, unknown>
  const d = parseFdActivityDate_(activity.performed_at)
  const at = d ? d.toISOString() : ''
  const ticketId = str(activity.ticket_id)
  const performerId = str(activity.performer_id)
  const performerName = (performerId && rosterNames[performerId]) || `User ${performerId}`
  const performerType = str(activity.performer_type) || 'system'
  // Old value: no documented export field carries it — defensive pick across
  // plausible keys (incl. `{from,to}` status objects), '' when absent.
  let statusRaw: unknown = data.status
  let oldRaw = pick(data, 'old_status', 'previous_status', 'status_from', 'old_value')
  if (statusRaw !== null && typeof statusRaw === 'object') {
    const o = statusRaw as Record<string, unknown>
    oldRaw = oldRaw ?? pick(o, 'from', 'old', 'previous')
    statusRaw = pick(o, 'to', 'new', 'value')
  }
  oldRaw = oldRaw ?? pick(data, 'from')
  const oldValue = oldRaw === undefined ? '' : fdStatusName_(oldRaw)
  // Group at activity time: the documented payload carries `activity.group`
  // as a NAME string; a numeric id resolves via groupNames else ''.
  const groupRaw = pick(data, 'group', 'group_name', 'ticket_group', 'group_id')
  let group = ''
  if (groupRaw !== undefined) {
    const g = str(groupRaw)
    group = /^\d+$/.test(g) ? str((groupNames || {})[g]) : g
  }
  fdActivityWarnUnmapped_(data)
  const rows: unknown[][] = []
  if (data.new_ticket === true) {
    rows.push([at, ticketId, performerName, performerType, 'Field Change', 'new_ticket', data.new_ticket, oldValue, group, ''])
  }
  if (statusRaw !== undefined && statusRaw !== null) {
    rows.push([at, ticketId, performerName, performerType, 'Status Change', 'status', fdStatusName_(statusRaw), oldValue, group, ''])
  }
  return rows.length ? rows : null
}
