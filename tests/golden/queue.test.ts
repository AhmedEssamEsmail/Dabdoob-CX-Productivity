/**
 * Golden tests: src/lib/queue/index.ts vs QueueCore.js + TlSnapshots.js in the oracle.
 */
import { describe, it, expect } from 'vitest'
import { baseFixtures, callLegacy, callPort, diffPath, oracle, rint, rng, rpick, same, sheetBook } from './helpers-oracle'
import {
  dqAgingBand_,
  dqBandCounts_,
  dqBandInfo_,
  dqBandLabels_,
  dqCheckpoints_,
  dqGroupKey_,
  dqHuman_,
  dqInList_,
  dqJson_,
  dqNameHasText_,
  dqNum_,
  dqPeopleIndex_,
  dqQueueView_,
  dqReadSource_,
  dqSlotIn_,
  dqSlotsToday_,
  dqSlotState_,
  dqSortQueues_,
  dqSubmissionsFor_,
  dqTodaySnapshots_,
  dqWeekStart_,
  dqWithCurrentTl_,
  tlqCol_,
  tlqSetting_,
  tlsMailDue_,
  tlsOnQueue_,
  tlsOnShift_,
  tlsShiftOf_,
  tlsShifts_,
} from '@/features/cx-queue/lib'
import type { Cfg } from '@/features/shared/lib/adapters'

const R = rng(0x5eed42)
const CFG = baseFixtures().settings as Cfg

describe('pure helpers', () => {
  it('dqNum_ / dqGroupKey_ / dqInList_ / dqNameHasText_ / dqJson_ / dqHuman_ / dqWeekStart_ / dqAgingBand_ / tlqCol_ / tlqSetting_ — 200 vectors', () => {
    const names = ['Ops Qatar - Gift cards', 'OPS QATAR –Gift Cards', 'ops qatar-gift cards', 'FreshChat', '  X  ', '', null, 'a—b', 'Ops–KSA']
    for (let i = 0; i < 200; i++) {
      const v = rpick(R, [null, '', 'x', 0, '42', ' 3.5 ', -7, NaN, Infinity])
      same('dqNum_', [v], () => dqNum_(v), {}, `num ${i}`)
      const n = rpick(R, names)
      same('dqGroupKey_', [n], () => dqGroupKey_(n), {}, `gk ${i}`)
      same('dqInList_', [n, ['ops qatar - gift cards', 'freshchat']], () => dqInList_(n, ['ops qatar - gift cards', 'freshchat']), {}, `il ${i}`)
      const words = rpick(R, [['gift card'], 'qatar, ops', ['customer support'], []] as (string | string[])[])
      same('dqNameHasText_', [n, words], () => dqNameHasText_(n, words), {}, `ht ${i}`)
      const jv = rpick(R, ['{"a":1}', 'bad', '', null, '[1,2]', '{"x":'])
      same('dqJson_', [jv, { fb: 1 }], () => dqJson_(jv, { fb: 1 }), {}, `js ${i}`)
      const h = rint(R, 0, 4000) / 10
      same('dqHuman_', [h], () => dqHuman_(h), {}, `hum ${i}`)
      const k = `2026-${String(rint(R, 1, 12)).padStart(2, '0')}-${String(rint(R, 1, 28)).padStart(2, '0')}`
      same('dqWeekStart_', [k], () => dqWeekStart_(k), {}, `ws ${i}`)
      const edges = [4, 12, 24, 48, 72]
      const hh = rint(R, 0, 120)
      same('dqAgingBand_', [hh, edges], () => dqAgingBand_(hh, edges), {}, `ab ${i}`)
      same('tlqCol_', [['Ticket Id', 'Status ', 'group_name', 'X'], ['status', 'group name', 'group_name']], () =>
        tlqCol_(['Ticket Id', 'Status ', 'group_name', 'X'], ['status', 'group name', 'group_name']), {}, `col ${i}`)
      const tk = rpick(R, ['tlp_call_serviced_states', 'ol_sheet_id', 'missing', 'tlp_texting_groups'])
      same('tlqSetting_', [tk], () => tlqSetting_(CFG, tk), {}, `ts ${i}`)
    }
    // labels + bandInfo with configured edges
    const fx = baseFixtures({ settings: { aging_bands_h: [4, 12, 24, 48, 72] } })
    same('dqBandLabels_', [[4, 12, 24, 48, 72]], () => dqBandLabels_([4, 12, 24, 48, 72]), {}, 'labels')
    same('dqBandInfo_', [], () => dqBandInfo_(fx.settings as Cfg), fx, 'bandInfo')
  })

  it('dqCheckpoints_ / dqSlotState_ / dqSlotIn_ — slots and states', () => {
    const fx = baseFixtures({
      settings: {
        checkin_slots: ['09:30', '13:00', '18:30'],
        checkin_slot_names: { '09:30': 'Start of day' },
        checkin_read_delay_min: 20,
        checkin_open_before_min: 15,
        checkin_due_after_min: 30,
      },
    })
    const l = callLegacy('dqCheckpoints_', ['2026-10-29'], fx)
    const p = callPort(() => dqCheckpoints_('2026-10-29', fx.settings as Cfg))
    expect(diffPath(l, p)).toBeNull()
    // slot states around each checkpoint — @@ms: markers rebind real Dates inside the vm
    const cps = (p.ok as { slot: string; opensAt: string; dueAt: string }[])
    cps.forEach((cp) => {
      const t0 = Date.parse(cp.opensAt)
      const tD = Date.parse(cp.dueAt)
      const cpArg = { opensAt: `@@ms:${t0}`, dueAt: `@@ms:${tD}` }
      const cpO = { opensAt: new Date(cp.opensAt), dueAt: new Date(cp.dueAt) }
      for (const [ms, sub] of [
        [t0 - 60000, null],
        [t0, null],
        [tD, null],
        [tD + 60000, null],
        [t0 - 60000, { submitted_by: 'x' }],
      ] as const) {
        const l2 = callLegacy('dqSlotState_', [cpArg, sub, `@@ms:${ms}`], fx)
        const p2 = callPort(() => dqSlotState_(cpO, sub, new Date(ms)))
        expect(diffPath(l2, p2)).toBeNull()
      }
    })
    // dqSlotIn_: same instant in another zone + unknown slot error
    for (const [slot, tz] of [['09:30', 'Africa/Cairo'], ['13:00', undefined], ['18:30', 'UTC'], ['99:99', 'Africa/Cairo']] as const) {
      same('dqSlotIn_', ['2026-10-29', slot, tz], () => dqSlotIn_('2026-10-29', slot, tz, fx.settings as Cfg), fx, `si ${slot}`)
    }
  })

  it('dqSubmissionsFor_ / dqSlotsToday_ — submissions seam', () => {
    const subs = [
      ['submission_id', 'slot_date', 'slot', 'submitted_by', 'submitted_at'],
      ['S1', '2026-10-29', '09:30', 'tl@x.com', '2026-10-29T06:35:00Z'],
      ['S2', '2026-10-28', '13:00', 'tl@x.com', '2026-10-28T10:05:00Z'],
      ['S3', '2026-10-29', '18:30', 'tl2@x.com', '2026-10-29T15:40:00Z'],
    ]
    const fx = baseFixtures({
      data: { queue_status_submissions: subs },
      nowMs: Date.parse('2026-10-29T16:00:00Z'),
    })
    // readTable_ rows (with _row) — feed the port exactly what the legacy reader yields
    const subObjs = oracle().table('queue_status_submissions', fx)
    const l = callLegacy('dqSubmissionsFor_', [['2026-10-29']], fx)
    const p = callPort(() => dqSubmissionsFor_(subObjs, ['2026-10-29']))
    expect(diffPath(l, p)).toBeNull()
    const l2 = callLegacy('dqSlotsToday_', [`@@ms:${fx.nowMs as number}`], fx)
    const p2 = callPort(() => dqSlotsToday_(new Date(fx.nowMs as number), fx.settings as Cfg, subObjs))
    expect(diffPath(l2, p2)).toBeNull()
    // no submissions tab -> []
    const l3 = callLegacy('dqSubmissionsFor_', [['2026-10-29']], baseFixtures())
    const p3 = callPort(() => dqSubmissionsFor_(null, ['2026-10-29']))
    expect(diffPath(l3, p3)).toBeNull()
  })
})

describe('people + roster seams', () => {
  const rosterRows = [
    ['email', 'name', 'freshdesk_id', 'freshdesk_name', 'maqsam_name', 'tl_email', 'source', 'active'],
    ['a@x.com', 'Agent A', 'FD1', 'FD Agent A', 'A', 'tl@x.com', 'hct', 'true'],
    ['b@x.com', 'Agent B', 'FD2', 'FD Agent B', 'B', 'tl@x.com', 'hct', 'true'],
    ['tl@x.com', 'TL One', 'FD9', '', '', '', 'hct', 'true'],
  ]
  const fx = baseFixtures({
    data: { Roster: rosterRows },
    settings: { cx_freshdesk_ids_extra: ['FDEXTRA1', 'FDEXTRA2'] },
  })

  it('dqPeopleIndex_ — same headcount in -> same index out', () => {
    const l = callLegacy('dqPeopleIndex_', [], fx)
    const hc = [
      { email: 'a@x.com', name: 'Agent A', fdId: 'FD1', fdName: 'FD Agent A', tlEmail: 'tl@x.com', tlName: 'TL One' },
      { email: 'b@x.com', name: 'Agent B', fdId: 'FD2', fdName: 'FD Agent B', tlEmail: 'tl@x.com', tlName: 'TL One' },
      { email: 'tl@x.com', name: 'TL One', fdId: 'FD9', fdName: '', tlEmail: '', tlName: '' },
    ]
    const p = callPort(() => dqPeopleIndex_(hc, fx.settings as Cfg))
    expect(diffPath(l, p)).toBeNull()
  })

  it('dqWithCurrentTl_ — re-stamps tl from the roster (60 vectors)', () => {
    for (let i = 0; i < 60; i++) {
      const rows: Record<string, unknown>[] = []
      for (let j = 0; j < rint(R, 0, 5); j++)
        rows.push({
          ticket_id: 'T' + j,
          agent_email: rpick(R, ['a@x.com', 'b@x.com', 'ghost@x.com', '']),
          tl_email: rpick(R, ['tl@x.com', 'old-tl@x.com', '']),
          tl_name: 'Old TL',
        })
      const l = callLegacy('dqWithCurrentTl_', [rows], fx)
      const roster = rosterRows.slice(1).map((r) => ({ email: r[0], name: r[1], tl_email: r[5] }))
      const p = callPort(() => dqWithCurrentTl_(rows, roster))
      expect(diffPath(l, p)).toBeNull()
    }
    // no Roster tab -> rows pass through
    const l = callLegacy('dqWithCurrentTl_', [[{ agent_email: 'a@x.com' }]], baseFixtures())
    const p = callPort(() => dqWithCurrentTl_([{ agent_email: 'a@x.com' }], null))
    expect(diffPath(l, p)).toBeNull()
  })
})

describe('queue board', () => {
  it('dqBandCounts_ / dqQueueView_ / dqSortQueues_ — 120 vectors', () => {
    const fx = baseFixtures({ settings: { aging_bands_h: [4, 12, 24, 48], our_queue_text: ['customer support'] } })
    for (let i = 0; i < 120; i++) {
      const q: Record<string, unknown> = {
        queue: rpick(R, ['Customer Support - KSA', 'Ops Qatar - Gift cards', 'X Queue']),
        kind: rpick(R, ['ticket', 'chat', 'escalation']),
        open: rint(R, 0, 200),
        actionable: rint(R, 0, 100),
        unassigned: rint(R, 0, 50),
        oldest_h: rint(R, 0, 400) / 10,
        bands_json: R() < 0.6 ? JSON.stringify([rint(R, 0, 50), rint(R, 0, 30), rint(R, 0, 20), rint(R, 0, 10), rint(R, 0, 5)]) : 'bad',
        b0: rint(R, 0, 9), b1: rint(R, 0, 9), b2: rint(R, 0, 9), b3: rint(R, 0, 9), b4: rint(R, 0, 9),
        over_top: rint(R, 0, 30),
        created_today: rint(R, 0, 60),
        resolved_today: rint(R, 0, 60),
        by_status_json: '{"Open":3,"Pending":2}',
        source_as_of: '2026-10-29T06:00:00Z',
        stale: rpick(R, [true, false, 'TRUE', 'true', 'FALSE', '']),
      }
      same('dqBandCounts_', [q], () => dqBandCounts_(q, fx.settings as Cfg), fx, `bc ${i}`)
      const prevOpen = R() < 0.3 ? undefined : rint(R, 0, 300)
      // the JSON seam turns an undefined array element into null — feed the port what
      // crosses the wire (null -> delta = open - null, matching legacy verbatim)
      same('dqQueueView_', [q, prevOpen], () => dqQueueView_(q, prevOpen === undefined ? null : prevOpen, fx.settings as Cfg), fx, `qv ${i}`)
      const views = [
        { ours: 1, open: rint(R, 0, 200), queue: 'a' },
        { ours: 0, open: rint(R, 0, 200), queue: 'b' },
        { ours: true, open: rint(R, 0, 200), queue: 'c' },
      ]
      same('dqSortQueues_', [views.map((x) => ({ ...x }))], () => dqSortQueues_(views.map((x) => ({ ...x }))), {}, `sort ${i}`)
    }
  })

  it('dqTodaySnapshots_ — latest slot + prev map + series (40 vectors)', () => {
    for (let i = 0; i < 40; i++) {
      const rows: unknown[][] = [['slot_date', 'slot', 'queue', 'open', 'over_top']]
      for (let j = 0; j < rint(R, 0, 10); j++)
        rows.push([rpick(R, ['2026-10-29', '2026-10-28']), rpick(R, ['09:30', '13:00', '18:30']), rpick(R, ['Q1', 'Q2']), rint(R, 0, 100), rint(R, 0, 20)])
      const fx = baseFixtures({
        nowMs: Date.parse('2026-10-29T12:00:00Z'),
        spreadsheets: { 'live-store': { agg_snapshots_today: rows } },
      })
      const l = callLegacy('dqTodaySnapshots_', [new Date(fx.nowMs as number).toISOString()], fx)
      const objs = rows.slice(1).map((r) => ({ slot_date: r[0], slot: r[1], queue: r[2], open: r[3], over_top: r[4] }))
      const p = callPort(() => dqTodaySnapshots_(new Date(fx.nowMs as number), fx.settings as Cfg, objs))
      const d = diffPath(l, p)
      if (d) throw new Error(`snaps ${i}: ${d}`)
    }
  })

  it('dqReadSource_ — reads tab columns below the header', () => {
    const tabs = { Tab: [['h1', 'h2', 'h3'], ['a', 'b', 'c'], ['d', 'e', 'f']] }
    const fx = baseFixtures({ spreadsheets: { src: tabs } })
    const l = callLegacy('dqReadSource_', ['src', 'Tab', 1, 3], fx)
    const p = callPort(() => dqReadSource_(sheetBook(tabs) as never, 'Tab', 1, 3))
    expect(diffPath(l, p)).toBeNull()
    const l2 = callLegacy('dqReadSource_', ['src', 'Missing', 1, 2], fx)
    const p2 = callPort(() => dqReadSource_(sheetBook(tabs) as never, 'Missing', 1, 2))
    expect(diffPath(l2, p2)).toBeNull()
  })
})

describe('TL snapshots', () => {
  const shiftRows = () => {
    const rows: Record<string, unknown>[] = []
    for (let j = 0; j < rint(R, 0, 6); j++) {
      const s = Date.parse('2026-10-29T04:00:00Z') + rint(R, 0, 43200000)
      rows.push({
        tl_email: rpick(R, ['tl1@x.com', 'TL2@X.COM']),
        date: rpick(R, ['2026-10-29', '2026-10-30']),
        shift_start: s,
        shift_end: s + rint(R, 14400000, 32400000),
        queue_json: JSON.stringify([[s + 3600000, s + 7200000]]),
      })
    }
    return rows
  }

  it('tlsShifts_ / tlsShiftOf_ / tlsOnShift_ / tlsOnQueue_ / tlsMailDue_ — 100 vectors', () => {
    for (let i = 0; i < 100; i++) {
      const rows = shiftRows()
      const fx = baseFixtures({ spreadsheets: { 'live-store': { tlp_shifts: [['key', 'date', 'tl_email', 'shift_start', 'shift_end', 'queue_json', 'updated_at'], ...rows.map((r) => ['k', r.date, r.tl_email, r.shift_start, r.shift_end, r.queue_json, ''])] } } })
      const l = callLegacy('tlsShifts_', ['2026-10-29', '2026-10-30'], fx)
      const p = callPort(() => tlsShifts_(rows, '2026-10-29', '2026-10-30'))
      const d = diffPath(l, p)
      if (d) throw new Error(`shifts ${i}: ${d}`)
      const shifts = p.ok as { tl: string; startMs: number; endMs: number; queue: { startMs: number; endMs: number }[] }[]
      rows.forEach((r, j) => {
        same('tlsShiftOf_', [r], () => tlsShiftOf_(r), {}, `sof ${i}.${j}`)
      })
      const ms = Date.parse('2026-10-29T04:00:00Z') + rint(R, 0, 72000000)
      same('tlsOnShift_', [shifts, ms], () => tlsOnShift_(shifts as never, ms), {}, `on ${i}`)
      same('tlsOnQueue_', [shifts, ms], () => tlsOnQueue_(shifts as never, ms), {}, `onq ${i}`)
      same('tlsMailDue_', [shifts, ms], () => tlsMailDue_(shifts as never, ms), {}, `due ${i}`)
      // edge: ms before/after all windows
      same('tlsMailDue_', [shifts, 0], () => tlsMailDue_(shifts as never, 0), {}, `due0 ${i}`)
      same('tlsMailDue_', [shifts, 9e15], () => tlsMailDue_(shifts as never, 9e15), {}, `dueInf ${i}`)
    }
  })

  it('tlsMailDue_ hand case: mail outside queue hours -> next window TLs + nextShift', () => {
    const s = Date.parse('2026-10-29T10:00:00Z')
    const shifts = [
      { tl: 'tl1@x.com', date: '2026-10-29', startMs: s, endMs: s + 28800000, queue: [{ startMs: s + 7200000, endMs: s + 14400000 }] },
    ]
    const at = s + 3600000 // inside shift, before queue window
    same('tlsMailDue_', [shifts, at], () => tlsMailDue_(shifts as never, at), {}, 'next shift')
    same('tlsMailDue_', [shifts, s + 7200000], () => tlsMailDue_(shifts as never, s + 7200000), {}, 'window start inclusive')
    same('tlsMailDue_', [shifts, s + 14400000], () => tlsMailDue_(shifts as never, s + 14400000), {}, 'window end exclusive')
    same('tlsMailDue_', [[], at], () => tlsMailDue_([] as never, at), {}, 'empty')
  })
})
