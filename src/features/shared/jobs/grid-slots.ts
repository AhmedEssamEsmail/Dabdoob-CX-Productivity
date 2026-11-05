/**
 * DB-derived TPH grid slots — builds prod_tph_days.slots_json from
 * prod_intervals (the Agents-Activity AUX export) instead of TL-painted slots
 * or the legacy spreadsheet. For each (date, agent) every 15-min slot inside
 * tph_day_hours takes the channel of the interval with the largest overlap.
 *
 * Status -> channel mapping:
 *   prod_channel_status config inverted ({chat:'Chats',ticket:'Available',
 *   wa:'Waiting Address'}) -> {Chats:chats, Available:internal,
 *   'Waiting Address':wa}
 *   plus: 'Inbound Calls' -> 'calls' (dedicated call time — never capped),
 *         'Break' -> 'break', 'Meeting'/'One to One' -> 'meeting',
 *         'Offline'/'Logged out' -> 'off'
 *   everything else (IDLE, Unavailable, unknown) -> no slot entry: the grid's
 *   own carry-forward fills it from the previous logged slot, same as an
 *   unlogged TL gap.
 *
 * sources_json marks every written slot 'intervals' so the page can tell
 * DB-derived slots from TL-entered ones.
 */

import { prodSetting_ } from '@/features/cx-productivity/lib/prod/engine'
import { tphHours_ } from '@/features/cx-productivity/lib/tph/page'
import type { Cfg } from '@/features/shared/lib/adapters'

const TPH_SLOT_MIN = 15
const BIZ_TZ = 'Asia/Kuwait'

/** AUX statuses that mean dedicated inbound-call time (grid 'calls' channel). */
const CALL_STATUSES = new Set(['inbound calls', 'on call'])
const BREAK_STATUSES = new Set(['break'])
const MEETING_STATUSES = new Set(['meeting', 'one to one', '1:1', 'coaching', 'training'])
const OFF_STATUSES = new Set(['offline', 'logged out'])

/** status -> slot channel value; null = leave the slot unlogged (carry-forward). */
export function gridStatusChannel_(status: string, cfg: Cfg): string | null {
  const s = status.trim().toLowerCase()
  if (!s) return null
  const cs = (prodSetting_(cfg, 'prod_channel_status') || {}) as Record<string, string>
  const byStatus: Record<string, string> = {}
  // prod_channel_status is channel-class -> status name: invert to status -> channel key.
  Object.keys(cs).forEach((klass) => {
    const chan = klass === 'ticket' ? 'internal' : klass === 'chat' ? 'chats' : klass
    byStatus[String(cs[klass]).trim().toLowerCase()] = chan
  })
  if (CALL_STATUSES.has(s)) return 'calls'
  if (BREAK_STATUSES.has(s)) return 'break'
  if (MEETING_STATUSES.has(s)) return 'meeting'
  if (OFF_STATUSES.has(s)) return 'off'
  return byStatus[s] ?? null
}

/** Kuwait minutes-from-midnight for an ISO timestamp on `date` (or -1/9999 outside it). */
function kuwaitMinute(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BIZ_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  return Number(parts.find((p) => p.type === 'hour')!.value) * 60 + Number(parts.find((p) => p.type === 'minute')!.value)
}

export interface IntervalRow {
  date: string
  agent_email: string
  status: string
  start_at: string
  end_at: string
}

export interface DerivedDay {
  date: string
  agent_email: string
  slots: Record<number, string>
}

/**
 * tphGridFromIntervals_: intervals -> per (date,email) slot map.
 * Intervals may cross midnight (clip at day end); each slot takes the channel
 * of whichever interval covers the most of it.
 */
export function tphGridFromIntervals_(
  intervals: IntervalRow[],
  cfg: Cfg
): Record<string, DerivedDay> {
  const hours = tphHours_(cfg)
  const from = hours[0] * 4
  const to = (hours[hours.length - 1] + 1) * 4
  const days: Record<string, { date: string; agent_email: string; ov: Record<number, { ch: string; min: number }> }> = {}
  intervals.forEach((iv) => {
    const ch = gridStatusChannel_(String(iv.status || ''), cfg)
    if (ch === null) return
    const key = `${iv.date}|${String(iv.agent_email).trim().toLowerCase()}`
    const day = (days[key] = days[key] || { date: iv.date, agent_email: iv.agent_email, ov: {} })
    const a = kuwaitMinute(iv.start_at)
    let b = kuwaitMinute(iv.end_at)
    if (b <= a) b = 1440
    for (let s = Math.max(from, Math.floor(a / TPH_SLOT_MIN)); s < to && s * TPH_SLOT_MIN < b; s++) {
      const ov = Math.min(b, (s + 1) * TPH_SLOT_MIN) - Math.max(a, s * TPH_SLOT_MIN)
      if (ov > 0 && ov > (day.ov[s]?.min || 0)) day.ov[s] = { ch, min: ov }
    }
  })
  const out: Record<string, DerivedDay> = {}
  Object.keys(days).forEach((k) => {
    const d = days[k]
    const slots: Record<number, string> = {}
    Object.keys(d.ov).forEach((s) => (slots[Number(s)] = d.ov[Number(s)].ch))
    out[k] = { date: d.date, agent_email: d.agent_email, slots }
  })
  return out
}
