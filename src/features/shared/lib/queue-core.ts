/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * QueueCore.js pure parts moved from cx-queue/lib — shared by queue/people/hub/desk
 * (aging flags, submissions, check-in checkpoints, aging bands). Store reads arrive as
 * injected rows/cfg; names keep the trailing underscore.
 */

import 'server-only'

import {
  dqAddDays_,
  dqDateKey_,
  dqKeyPart_,
  dqSetting_,
  dqWallToUtc_,
  normEmail_,
  type Cfg,
} from '@/features/shared/lib/adapters'

/** dqWithCurrentTl_: aging rows re-stamped with tl_email / tl_name from the roster as it is now. */
export function dqWithCurrentTl_(
  rows: Record<string, unknown>[],
  rosterRows: Record<string, unknown>[] | null
): Record<string, unknown>[] {
  if (rosterRows === null) return rows // no Roster tab
  const tlOf: Record<string, string> = {}
  const nameOf: Record<string, string> = {}
  rosterRows.forEach((r) => {
    const e = normEmail_(r.email)
    if (!e) return
    tlOf[e] = normEmail_(r.tl_email)
    nameOf[e] = String(r.name || '')
  })
  return rows.map((r) => {
    const a = normEmail_(r.agent_email)
    if (!a || !(a in tlOf) || tlOf[a] === normEmail_(r.tl_email)) return r
    const c: Record<string, unknown> = {}
    Object.keys(r).forEach((k) => {
      c[k] = r[k]
    })
    c.tl_email = tlOf[a]
    c.tl_name = nameOf[tlOf[a]] || ''
    return c
  })
}

export interface DqAgingFlagOut {
  flagId: string
  ticketId: string
  note: string
  tlEmail: string
  by: string
  at: string
}

/**
 * dqOpenAgingFlags_: open flags whose ticket is still on the aging board.
 * flagRows = the dq_aging_flags rows (null = no store, []); agingRows = the
 * aging rows already read (the onBoard set).
 */
export function dqOpenAgingFlags_(
  flagRows: Record<string, unknown>[] | null,
  agingRows: Record<string, unknown>[]
): DqAgingFlagOut[] {
  if (flagRows === null) return []
  const onBoard: Record<string, boolean> = {}
  ;(agingRows || []).forEach((r) => {
    onBoard[String(r.ticket_id)] = true
  })
  return flagRows
    .filter((f) => !f.resolved_at && onBoard[String(f.ticket_id)])
    .map((f) => ({
      flagId: String(f.flag_id),
      ticketId: String(f.ticket_id),
      note: String(f.note || ''),
      tlEmail: normEmail_(f.tl_email),
      by: normEmail_(f.submitted_by),
      at: String(f.submitted_at || ''),
    }))
}

/** The client shape of one open flag (the dqOpenAgingFlags_ mapper, without the board filter). */
export function dqAgingFlagOut_(f: Record<string, unknown>): DqAgingFlagOut {
  return {
    flagId: String(f.flag_id),
    ticketId: String(f.ticket_id),
    note: String(f.note || ''),
    tlEmail: normEmail_(f.tl_email),
    by: normEmail_(f.submitted_by),
    at: String(f.submitted_at || ''),
  }
}

/** dqSubmissionsFor_: submissions of the given slot_dates (readTable_ output injected). */
export function dqSubmissionsFor_(
  submissionRows: Record<string, unknown>[] | null,
  dateKeys: string[]
): Record<string, unknown>[] {
  if (submissionRows === null) return [] // no submissions tab
  return submissionRows
    .map((r) => {
      const c = { ...r }
      c.slot_date = dqKeyPart_('slot_date', c.slot_date).slice(0, 10)
      c.slot = String(c.slot)
      return c
    })
    .filter((r) => dateKeys.indexOf(String(r.slot_date)) !== -1)
}

/** dqSlotState_: done / upcoming / due / missed for one checkpoint. */
export function dqSlotState_(
  cp: { opensAt: Date; dueAt: Date },
  sub: unknown,
  now: Date | number
): 'done' | 'upcoming' | 'due' | 'missed' {
  if (sub) return 'done'
  const t = now instanceof Date ? now.getTime() : now
  if (t < cp.opensAt.getTime()) return 'upcoming'
  if (t <= cp.dueAt.getTime()) return 'due'
  return 'missed'
}

/**
 * dqCheckpoints_: the check-in slots of one business date with their instants.
 * at: the slot; readAfter: earliest snapshot read; opensAt / dueAt: form window.
 */
export function dqCheckpoints_(
  dateKey: string,
  cfg: Cfg
): { slot: string; name: string; date: string; at: Date; readAfter: Date; opensAt: Date; dueAt: Date; key: string }[] {
  const tz = String(dqSetting_(cfg, 'business_tz'))
  const slots = dqSetting_(cfg, 'checkin_slots') as unknown[]
  const names = (dqSetting_(cfg, 'checkin_slot_names') || {}) as Record<string, string>
  const delay = Number(dqSetting_(cfg, 'checkin_read_delay_min'))
  const openBefore = Number(dqSetting_(cfg, 'checkin_open_before_min'))
  const dueAfter = Number(dqSetting_(cfg, 'checkin_due_after_min'))
  const p = dateKey.split('-')
  return slots.map((slot) => {
    const hm = String(slot).split(':')
    const at = dqWallToUtc_(+p[0], +p[1], +p[2], +hm[0], +hm[1], 0, tz)
    return {
      slot: String(slot),
      name: names[String(slot)] || String(slot),
      date: dateKey,
      at,
      readAfter: new Date(at.getTime() + delay * 60000),
      opensAt: new Date(at.getTime() - openBefore * 60000),
      dueAt: new Date(at.getTime() + dueAfter * 60000),
      key: dateKey + '|' + slot,
    }
  })
}

/** dqSlotsToday_: today's slot states with submitters (submissions injected). */
export function dqSlotsToday_(
  now: Date | number,
  cfg: Cfg,
  submissionRows: Record<string, unknown>[] | null
): { slot: string; name: string; at: string; dueAt: string; state: string; submittedBy: string; submittedAt: string }[] {
  const today = dqDateKey_(now instanceof Date ? now : new Date(now), cfg)
  const subs = dqSubmissionsFor_(submissionRows, [today])
  const by: Record<string, Record<string, unknown>> = {}
  subs.forEach((s) => {
    by[String(s.slot)] = s
  })
  return dqCheckpoints_(today, cfg).map((cp) => {
    const s = by[cp.slot]
    return {
      slot: cp.slot,
      name: cp.name,
      at: cp.at.toISOString(),
      dueAt: cp.dueAt.toISOString(),
      state: dqSlotState_(cp, s, now),
      submittedBy: s ? String(s.submitted_by) : '',
      submittedAt: s ? String(s.submitted_at) : '',
    }
  })
}

/** dqBandInfo_. */
export function dqBandInfo_(cfg: Cfg): { edges: unknown; labels: string[] } {
  const edges = dqSetting_(cfg, 'aging_bands_h')
  return { edges, labels: dqBandLabels_(edges as number[]) }
}

/** dqWeekStart_: Sunday that starts the week containing key (week starts Sunday). */
export function dqWeekStart_(key: string): string {
  const p = key.split('-')
  const dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()
  return dqAddDays_(key, -dow)
}

/** dqBandLabels_: "4-12 h", "12-24 h", "1-2 d", ..., "10 d and over". */
export function dqBandLabels_(edges: number[]): string[] {
  const inDays = (h: number) => h >= 24 && h % 24 === 0
  const out = ['Under ' + edges[0] + ' h']
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1]
    const b = edges[i]
    out.push(inDays(a) && inDays(b) ? a / 24 + '-' + b / 24 + ' d' : a + '-' + b + ' h')
  }
  const top = edges[edges.length - 1]
  out.push((inDays(top) ? top / 24 + ' d' : top + ' h') + ' and over')
  return out
}
