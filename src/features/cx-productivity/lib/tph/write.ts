import 'server-only'

import { db } from '@/features/shared/platform/repo'
import { isCxAgent_ } from '@/features/shared/platform/identity'
import { normEmail_, type Cfg } from '@/features/shared/lib/adapters'
import { prodNowIso_, prodSetting_, prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import {
  TPH_CALLS,
  TPH_OFF,
  TPH_SLOTS,
  tphCanEdit_,
  tphParseSlot_,
  tphResolveSlots_,
  tphSlotValue_,
  tphTaskSlots_,
  tphHm_,
} from './index'
import { tphActivities_, tphChannels_, tphHours_, tphJson_, type TphStore } from './page'

/* The write half of ProdTph.js: tphCheckDate_/tphCheckAgent_/tphCheckCalls_/
   tphKeys_/tphFlagCalls_/tphEditDay_/saveTphSlots/saveTphTask/saveTphCases —
   Supabase upserts instead of dqUpsert_. */

export function tphKeys_(cfg: Cfg): string[] {
  return tphChannels_(cfg)
    .map((c) => c.key)
    .concat(tphActivities_(cfg).map((a) => a.key), [TPH_OFF])
}

/** Throws unless the caller may edit `date` (tphCheckDate_). */
export function tphCheckDate_(user: { role: string }, cfg: Cfg, date: unknown): string {
  const d = String(date || '')
  const today = prodToday_(cfg)
  if (!/^\d{4}-\d\d-\d\d$/.test(d)) throw new Error('Pick a date (yyyy-MM-dd).')
  if (d > today) throw new Error(`You can log today and earlier days, not ${d}.`)
  const days = Number(prodSetting_(cfg, 'tph_tl_edit_days'))
  if (!tphCanEdit_(user.role, d, today, days))
    throw new Error(`${d} is more than ${days} days ago: only an admin can change it now.`)
  return d
}

/** Any active agent (team leads log for every team). */
export function tphCheckAgent_(
  dir: TphStore['dir'],
  email: unknown
): string {
  const p = dir.by[normEmail_(email)]
  if (!p || !isCxAgent_(p))
    throw new Error('That person is not an active agent.')
  return p.email
}

/** Throws unless the Inbound calls channel exists. */
export function tphCheckCalls_(cfg: Cfg) {
  if (tphChannels_(cfg).map((c) => c.key).indexOf(TPH_CALLS) === -1)
    throw new Error('There is no Inbound calls channel (key "calls") in tph_channels.')
}

function tphFlagCalls_(
  logged: Record<string, string>,
  src: Record<string, string>,
  slots: number[],
  on: boolean,
  tag: string
) {
  const shown = tphResolveSlotsExport(logged)
  slots.forEach((s) => {
    let primary = logged[s] ? tphParseSlot_(logged[s]).primary : shown[s] ? shown[s].channel : ''
    if (!on && primary === TPH_CALLS) primary = ''
    const v = tphSlotValue_(primary, on)
    if (v) {
      logged[s] = v
      src[s] = tag
    } else {
      delete logged[s]
      delete src[s]
    }
  })
}
const tphResolveSlotsExport = (logged: Record<string, string>) =>
  tphResolveSlots_(logged, 0, TPH_SLOTS, TPH_SLOTS) as Record<number, { channel: string } | null>

/** Writes one agent-day's slots (tphEditDay_): read, mutate, upsert. */
async function tphEditDay_(
  user: { email: string },
  date: string,
  email: string,
  edit: (logged: Record<string, string>, src: Record<string, string>) => void
): Promise<number> {
  const supabase = db()
  const now = prodNowIso_()
  const { data: rows } = await supabase
    .from('prod_tph_days')
    .select('*')
    .eq('date', date)
    .eq('agent_email', email)
    .limit(1)
  const row = rows?.[0] || {}
  const logged = tphJson_<Record<string, string>>(row.slots_json, {})
  const src = tphJson_<Record<string, string>>(row.sources_json, {})
  edit(logged, src)
  await supabase.from('prod_tph_days').upsert(
    {
      date,
      agent_email: email,
      slots_json: JSON.stringify(logged),
      sources_json: JSON.stringify(src),
      by: user.email,
      at: now,
    },
    { onConflict: 'date,agent_email' }
  )
  return Object.keys(logged).length
}

/** saveTphSlots — grid paint or the +calls/−calls flag across slots. */
export async function saveTphSlots(
  store: TphStore,
  user: { role: string; email: string },
  input: Record<string, unknown>
) {
  const cfg = store.cfg
  const date = tphCheckDate_(user, cfg, input.date)
  const email = tphCheckAgent_(store.dir, input.email)
  const flag = typeof input.calls === 'boolean'
  const ch = String(input.channel || '')
  if (flag) tphCheckCalls_(cfg)
  else if (ch && tphKeys_(cfg).indexOf(ch) === -1) throw new Error(`Unknown channel or activity ${ch}.`)
  const slots = ([] as unknown[])
    .concat((input.slots as unknown[]) || [])
    .map(Number)
    .filter((s) => s >= 0 && s < TPH_SLOTS && Math.floor(s) === s)
  if (!slots.length) throw new Error('Pick at least one slot.')
  await tphEditDay_(user, date, email, (logged, src) => {
    if (flag) return tphFlagCalls_(logged, src, slots, !!input.calls, 'grid')
    slots.forEach((s) => {
      const v = ch ? tphSlotValue_(ch, tphParseSlot_(logged[s]).calls) : ''
      if (v) {
        logged[s] = v
        src[s] = 'grid'
      } else {
        delete logged[s]
        delete src[s]
      }
    })
  })
  return { date, email, slots: slots.length }
}

/** saveTphTask — add a task (fills slots) or remove one (clears its slots). */
export async function saveTphTask(
  store: TphStore,
  user: { role: string; email: string },
  input: Record<string, unknown>
) {
  const cfg = store.cfg
  const now = prodNowIso_()
  const supabase = db()
  if (input.remove) {
    const t = store.tasks.filter((x) => x.task_id === String(input.taskId))[0]
    if (!t) throw new Error('That task does not exist.')
    tphCheckDate_(user, cfg, t.date)
    const e0 = normEmail_(t.agent_email)
    await tphEditDay_(user, String(t.date), e0, (logged, src) => {
      Object.keys(src).forEach((s) => {
        if (src[s] === `task:${t.task_id}`) {
          delete logged[s]
          delete src[s]
        }
      })
    })
    await supabase
      .from('prod_tph_tasks')
      .upsert({ ...t, removed: true, by: user.email, at: now }, { onConflict: 'task_id' })
    return { taskId: String(t.task_id), removed: true }
  }
  const date = tphCheckDate_(user, cfg, input.date)
  const email = tphCheckAgent_(store.dir, input.email)
  const ch = String(input.channel || '')
  if (tphKeys_(cfg).indexOf(ch) === -1) throw new Error('Pick a channel or activity.')
  if (input.calls) tphCheckCalls_(cfg)
  if (input.calls && ch === TPH_OFF) throw new Error('Off shift cannot be blended with calls.')
  const val = tphSlotValue_(ch, !!input.calls)
  const a = tphHm_(input.start)
  const b = tphHm_(input.end)
  if (!isFinite(a) || !isFinite(b) || b <= a) throw new Error('Start and end are HH:MM, end after start.')
  const slots = tphTaskSlots_(a, b)
  if (!slots.length) throw new Error('The task is shorter than 8 minutes of any 15-minute slot, so it fills none.')
  const id = `tph-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  await tphEditDay_(user, date, email, (logged, src) => {
    slots.forEach((s) => {
      logged[s] = val
      src[s] = `task:${id}`
    })
  })
  await supabase.from('prod_tph_tasks').upsert(
    {
      task_id: id, date, agent_email: email, channel: val,
      start: input.start, end: input.end, by: user.email, at: now, removed: false,
    },
    { onConflict: 'task_id' }
  )
  return { taskId: id, slots: slots.length }
}

/** saveTphCases — a TL's cases number for one hour and channel ('' clears it). */
export async function saveTphCases(
  store: TphStore,
  user: { role: string; email: string },
  input: Record<string, unknown>
) {
  const cfg = store.cfg
  const date = tphCheckDate_(user, cfg, input.date)
  const h = Number(input.hour)
  if (tphHours_(cfg).indexOf(h) === -1) throw new Error('Pick an hour of the day.')
  const ch = String(input.channel || '')
  if (tphChannels_(cfg).map((c) => c.key).indexOf(ch) === -1) throw new Error(`Unknown channel ${ch}.`)
  const clear = input.cases === '' || input.cases === null || input.cases === undefined
  const n = Number(input.cases)
  if (!clear && (!isFinite(n) || n < 0 || Math.floor(n) !== n))
    throw new Error('Cases are a whole number, 0 or more.')
  const now = prodNowIso_()
  const supabase = db()
  const row = store.cases.filter((r) => r.date === date && r.source === 'tl')[0] || {}
  const m = tphJson_<Record<string, number>>(row.cases_json, {})
  if (clear) delete m[`${h}|${ch}`]
  else m[`${h}|${ch}`] = n
  await supabase.from('prod_tph_cases').upsert(
    { date, source: 'tl', cases_json: JSON.stringify(m), by: user.email, at: now },
    { onConflict: 'date,source' }
  )
  return { date, hour: h, channel: ch, cases: clear ? null : n }
}
