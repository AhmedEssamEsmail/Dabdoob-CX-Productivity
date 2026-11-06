/**
 * WP-22: Aggregates.js (Command_Center_V2) + the QueueCore readers that feed them —
 * dqBuildAging_, dqBuildChatQueue_, dqCountInflow_, dqRollupInflow_, dqAgentPerf_,
 * dqTickState_, dqAgingOpts_, dqStatusList_, dqEmptyQueue_, dqCountry_, dqChatCountry_,
 * dqRatio_, dqOpenAgingFlags_, dqAgingBand_ boundary vectors.
 */
import { describe, it, vi, afterEach } from 'vitest'
import { baseFixtures, callPort, expectSame, rint, rng, rpick } from './helpers-oracle'
import { qCallLegacy, qOracle } from './queue-oracle'
import {
  dqAgentPerf_,
  dqAgingBand_,
  dqAgingOpts_,
  dqBuildAging_,
  dqBuildChatQueue_,
  dqChatCountry_,
  dqCountInflow_,
  dqCountry_,
  dqEmptyQueue_,
  dqOpenAgingFlags_,
  dqRatio_,
  dqRollupInflow_,
  dqStatusList_,
  dqTickState_,
} from '@/features/cx-queue/lib'
import type { Cfg } from '@/features/shared/lib/adapters'

const NOW_MS = Date.parse('2026-10-15T09:30:00Z') // 12:30 Kuwait
const NOW = '@@ms:' + NOW_MS
const FX = () =>
  baseFixtures({
    nowMs: NOW_MS,
    settings: {
      aging_bands_h: [4, 12, 24, 48],
      open_statuses: 'Open,Pending,Pending on CX',
      actionable_statuses: 'Open,Pending on CX',
      inflow_excluded_groups: ['Freshchat', 'Inbound calls documentation'],
      queue_excluded_text: ['documentation'],
      queue_map: { 'Ops Qatar - Gift Cards': 'Ops QA Gift' },
      chat_open_max_age_h: 48,
      daily_report_stale_after_min: 90,
      checkin_slots: ['09:30', '14:00', '21:30'],
      checkin_slot_names: { '09:30': 'Morning', '14:00': 'Afternoon', '21:30': 'Close' },
      checkin_read_delay_min: 20,
      checkin_open_before_min: 15,
      checkin_due_after_min: 30,
      escalation_channel: 'Internal Escalation',
      escalation_statuses: ['Open', 'Pending'],
      chat_country_map: { whatsapp: 'KSA', 'in-app': 'Kuwait' },
    },
  })
const CFG = FX().settings as Cfg
const OPTS = qOracle().call('dqAgingOpts_', [], FX())

const same = (fn: string, args: unknown[], portFn: () => unknown, label?: string, fx = FX()) =>
  expectSame(callPort(portFn), qCallLegacy(fn, args, fx), label || fn)

describe('option readers', () => {
  it('dqAgingOpts_', () => same('dqAgingOpts_', [], () => dqAgingOpts_(CFG)))
  it('dqStatusList_ / dqEmptyQueue_ / dqCountry_ / dqChatCountry_ / dqRatio_', () => {
    const R = rng(31)
    for (let i = 0; i < 30; i++) {
      const v = rpick(R, ['a, B ,c', ['X', ' y '], '', null, 'Solo'])
      same('dqStatusList_', [v], () => dqStatusList_(v as never), 'statusList ' + i)
      const c = rpick(R, ['NA', '#N/A', 'Kuwait', ' kw ', '', null])
      same('dqCountry_', [c], () => dqCountry_(c), 'country ' + i)
      same('dqChatCountry_', ['In-App Web Chat', { whatsapp: 'KSA', 'in-app': 'Kuwait' }], () =>
        dqChatCountry_('In-App Web Chat', { whatsapp: 'KSA', 'in-app': 'Kuwait' }), 'chatCountry ' + i)
      const ra = rint(R, 0, 50)
      const rb = rpick(R, [0, 5, -1])
      same('dqRatio_', [ra, rb], () => dqRatio_(ra, rb), 'ratio ' + i)
    }
    ;[0, 3, 5].forEach((n) =>
      same('dqEmptyQueue_', ['Q' + n, 'ticket', n], () => dqEmptyQueue_('Q' + n, 'ticket', n), 'empty ' + n))
  })
  it('dqAgingBand_ boundary: age == edge belongs to the higher band', () => {
    const edges = [4, 12, 24, 48]
    ;[0, 3.999, 4, 11.9, 12, 23.99, 24, 47.9, 48, 100, -1].forEach((h, i) =>
      same('dqAgingBand_', [h, edges], () => dqAgingBand_(h, edges), 'band ' + i))
  })
})

describe('dqBuildAging_ (Aggregates.js:61)', () => {
  const P = {
    byFdId: {
      '101': { email: 'agent1@dabdoob.com', name: 'Agent One', tlEmail: 'tl1@dabdoob.com', tlName: 'TL One' },
      '102': { email: 'agent2@dabdoob.com', name: 'Agent Two', tlEmail: 'tl2@dabdoob.com', tlName: 'TL Two' },
    },
  }
  const tk = (id: string, group: string, status: string, createdH: number | null, resolvedH: number | null, resp?: string, extra: Record<string, unknown> = {}) => ({
    ticket_id: id,
    group_name: group,
    status,
    responder_id: resp,
    country: 'Kuwait',
    channel: 'chat',
    contact_type_1: 'CT',
    created_at: createdH === null ? '' : new Date(NOW_MS - createdH * 3600000).toISOString().replace('T', ' ').slice(0, 19),
    resolved_at: resolvedH === null ? '' : new Date(NOW_MS - resolvedH * 3600000).toISOString().replace('T', ' ').slice(0, 19),
    ...extra,
  })
  const cases: unknown[][] = [
    // Basic: open tickets over band boundaries (4h/12h/24h/48h edges).
    [[tk('1', 'Ops KSA', 'Open', 2, null, '101'), tk('2', 'Ops KSA', 'Open', 4, null, '102'),
      tk('3', 'Ops KSA', 'Pending', 13, null), tk('4', 'Ops UAE', 'Pending on CX', 30, null, '101'),
      tk('5', 'Ops UAE', 'Open', 60, null)]],
    // Excluded group + excluded text, non-open status, missing created_at, resolved today.
    [[tk('1', 'Freshchat', 'Open', 5, null), tk('2', 'My Documentation', 'Open', 5, null),
      tk('3', 'Ops KSA', 'Resolved', 5, null), tk('4', 'Ops KSA', 'Open', null, null),
      tk('5', 'Ops KSA', 'Open', 2, null), tk('6', 'Ops KSA', 'Resolved', 5, 3)]],
    // Queue map rename + unassigned + status case-insensitivity.
    [[tk('1', 'Ops Qatar - Gift Cards', 'OPEN', 2, null), tk('2', 'ops qatar - gift cards', 'open', 3, null, '999'),
      tk('3', '(blank)', 'Pending on CX', 1, null, '102')]],
    // Resolved/created today edges: exactly midnight Kuwait vs just inside.
    [[tk('1', 'Ops KSA', 'Open', 0.01, null), tk('2', 'Ops KSA', 'Open', 26, null),
      tk('3', 'Ops KSA', 'Resolved', 5, 0.01)]],
    [],
  ]
  cases.forEach((tickets, i) =>
    it('case ' + i, () =>
      same('dqBuildAging_', [tickets, NOW, OPTS, P], () => dqBuildAging_(tickets as never[], new Date(NOW_MS), OPTS, P))))
})

describe('dqBuildChatQueue_ (Aggregates.js:121)', () => {
  // chat rows: [initiated, status, name, updated, resolved, channelName, convId]
  const row = (initH: number | null, status: string, resH: number | null, updH: number, id: string, chan = 'In-App Chat', name = 'Visitor') => [
    initH === null ? '' : new Date(NOW_MS - initH * 3600000).toISOString().slice(0, 19).replace('T', ' '),
    status, name,
    new Date(NOW_MS - updH * 3600000).toISOString().slice(0, 19).replace('T', ' '),
    resH === null ? '' : new Date(NOW_MS - resH * 3600000).toISOString().slice(0, 19).replace('T', ' '),
    chan, id,
  ]
  const cases: unknown[][][] = [
    [[row(2, 'Open', null, 1, 'c1'), row(50, 'Open', null, 1, 'c2'), row(3, 'Resolved', 2, 1, 'c3')]],
    [[row(2, 'Open', null, 1, 'c1'), row(2, 'Open', null, 1, 'c1'), row(5, 'Open', null, 1, 'c4', 'In-App Chat', 'n1')]],
    [[row(47.9, 'Open', null, 1, 'c1'), row(48.1, 'Open', null, 1, 'c2'), row(49, 'New', null, 1, 'c3')]],
    [[row(0.01, 'Open', null, 0.01, 'c1'), row(0.01, 'Resolved', 0.005, 0.005, 'c2')]],
    [[row(null, 'Open', null, 1, 'c1'), row(3, 'CLOSED', null, 1, 'c2'), row(4, 'Bot Resolved', null, 1, 'c3')]],
    [],
  ]
  cases.forEach((rows, i) =>
    it('case ' + i, () =>
      same('dqBuildChatQueue_', [rows, NOW, OPTS], () => dqBuildChatQueue_(rows as never[], new Date(NOW_MS), OPTS))))
})

describe('dqCountInflow_ (Aggregates.js:222)', () => {
  const opts = {
    bizTz: 'Asia/Kuwait', dataTz: 'Africa/Cairo',
    fromKey: '2026-10-10', toKey: '2026-10-15',
    escChannel: 'Internal Escalation', excluded: ['Freshchat'], cxIds: { '9': true },
    escStatuses: ['Open', 'Pending'], escSeen: { t7: true }, chatCountryMap: { whatsapp: 'KSA' },
  }
  const tk = (id: string, ch: string, grp: string, st: string, created: string, req?: string, country = 'Kuwait') =>
    ({ ticket_id: id, channel: ch, group_name: grp, status: st, created_at: created, requester_id: req, country })
  const cases: Record<string, unknown>[] = [
    { tickets: [tk('t1', 'Internal Escalation', 'Ops', 'Open', '2026-10-12 10:00:00', '1'),
        tk('t2', 'Phone', 'Ops', 'Open', '2026-10-12 10:00:00'), // wrong channel
        tk('t3', 'Internal Escalation', 'Freshchat', 'Open', '2026-10-12 10:00:00'), // excluded group
        tk('t4', 'Internal Escalation', 'Ops', 'Open', '2026-10-12 10:00:00', '9'), // cx requester
        tk('t5', 'Internal Escalation', 'Ops', 'Resolved', '2026-10-12 10:00:00'), // bad status
        tk('t7', 'Internal Escalation', 'Ops', 'Resolved', '2026-10-12 11:00:00'), // seen escalation
        tk('t8', 'Internal Escalation', 'Ops', 'Open', '2026-10-16 10:00:00')], // out of range
      chats: [['2026-10-12 12:00:00', 'Open', 'v', '', '', 'WhatsApp KSA', 'c1'],
              ['2026-10-12 12:30:00', 'Open', 'v', '', '', 'WhatsApp KSA', 'c1'], // dup id
              ['2026-10-12 13:00:00', 'Open', 'v', '', '', 'In-App', 'c2']],
      calls: [['k1', '2026-10-12 09:00:00', 'st', 'Inbound', 'UAE'],
              ['k1', '2026-10-12 09:05:00', 'st', 'Inbound', 'UAE'], // dup
              ['k2', '2026-10-12 09:10:00', 'st', 'Outbound', 'UAE'],
              ['k3', '2026-10-12 09:20:00', 'st', 'inbound', 'KSA']] },
    { tickets: [], chats: [], calls: [] },
    { tickets: [tk('t1', 'Internal Escalation', 'Ops', 'Open', '', undefined, 'NA')],
      chats: [['', 'Open', 'v', '', '', '', '']], calls: [['', '', 'st', 'inbound', '#N/A']] },
  ]
  cases.forEach((input, i) =>
    it('case ' + i, () =>
      same('dqCountInflow_', [input, opts], () => dqCountInflow_(input as never, opts as never))))
})

describe('dqRollupInflow_ (Aggregates.js:263)', () => {
  afterEach(() => vi.useRealTimers())
  it('week + month rollups incl. partial periods', () => {
    vi.setSystemTime(NOW_MS) // port stamps updated_at with new Date()
    const rows = [
      { date: '2026-10-04', channel: 'chat', country: 'KSA', inflow: 3 },
      { date: '2026-10-05', channel: 'chat', country: 'KSA', inflow: 2 },
      { date: '2026-10-11', channel: 'chat', country: 'KSA', inflow: 5 },
      { date: '2026-10-11', channel: 'call', country: 'UAE', inflow: 4 },
      { date: '2026-10-12', channel: 'escalation', country: 'KSA', inflow: 1 },
      { date: '2026-09-30', channel: 'chat', country: 'KSA', inflow: 7 },
    ]
    ;(['week', 'month'] as const).forEach((grain) =>
      same('dqRollupInflow_', [rows, grain, '2026-10-15'], () => dqRollupInflow_(rows as never[], grain, '2026-10-15'), 'rollup ' + grain))
  })
})

describe('dqAgentPerf_ (Aggregates.js:348)', () => {
  const P = {
    'a1@x.com': { name: 'Agent One', tlEmail: 'tl1@x.com', tlName: 'TL One' },
    'a2@x.com': { name: '', tlEmail: 'tl2@x.com', tlName: 'TL Two' },
  }
  const pr = (email: string, date: string, over: Record<string, unknown> = {}) => ({
    email, date, agentName: 'N ' + email,
    productiveMinResolution: 100, productiveMinAux: 200, inboundAchieved: 10, inboundTarget: 12,
    inboundMissed: 2, textingAchieved: 8, textingTarget: 10, waAchieved: 3, waTarget: 4,
    idleMin: 30, totalAudits: 2, avgScore: 80, overallProdPct: 66.6, ...over,
  })
  const cases: unknown[][] = [
    [[pr('A1@X.com', '2026-10-14'), pr('a1@x.com', '2026-10-13'), pr('a1@x.com', '2026-10-08'),
      pr('a1@x.com', '2026-10-07'), pr('a1@x.com', '2026-10-01'), pr('a1@x.com', '2026-09-16'), pr('a1@x.com', '2026-09-15'),
      pr('a2@x.com', '2026-10-14', { totalAudits: 0, avgScore: '' })]],
    [[pr('a1@x.com', '2026-10-15'), pr('', '2026-10-14'), pr('a1@x.com', ''), pr('a1@x.com', '2026-10-14', { inboundTarget: '', textingTarget: null, waTarget: 0 })]],
    [[pr('a1@x.com', '2026-10-14', { overallProdPct: '' })]],
    [],
  ]
  cases.forEach((rows, i) =>
    it('case ' + i, () =>
      same('dqAgentPerf_', [rows, P, '2026-10-15'], () => dqAgentPerf_(rows as never[], P as never, '2026-10-15'))))
})

describe('dqTickState_ (Aggregates.js:413)', () => {
  const cases: [unknown, unknown][] = [
    [null, null],
    [{ skipped: 'no key' }, null],
    [{ skipped: '' }, null],
    [{ rows: 5 }, null],
    [{ rows: 5 }, { builtAt: '2026-10-15T09:00:00Z' }],
    [{ skipped: 'quota' }, { builtAt: '2026-10-15T09:00:00Z' }],
    [{}, {}],
  ]
  cases.forEach(([sync, agg], i) =>
    it('case ' + i, () => same('dqTickState_', [sync, agg], () => dqTickState_(sync as never, agg as never))))
})

describe('dqOpenAgingFlags_ (QueueCore.js:74)', () => {
  const FLAGS = [
    ['flag_id', 'ticket_id', 'note', 'tl_email', 'resolved_at', 'resolved_by', 'resolved_note', 'submitted_by', 'submitted_at'],
    ['f1', 't1', 'check this', 'TL1@X.com', '', '', '', 'Admin@X.com', '2026-10-14 10:00:00'],
    ['f2', 't2', '', 'tl2@x.com', '2026-10-14 12:00:00', 'a@x.com', 'done', 'u@x.com', '2026-10-13 09:00:00'], // resolved
    ['f3', 't9', 'off board', 'tl1@x.com', '', '', '', 'u@x.com', '2026-10-14 11:00:00'], // not on board
  ]
  const AGING = [{ ticket_id: 't1' }, { ticket_id: 't2' }]
  it('open flags on board vs resolved / off-board', () => {
    const fx = FX()
    fx.data = { aging_flags: FLAGS }
    const flagRows = qOracle().table('aging_flags', fx)
    same('dqOpenAgingFlags_', [AGING], () => dqOpenAgingFlags_(flagRows as never[], AGING as never[]), 'flags', fx)
  })
  it('aging rows null -> legacy reads the live store', () => {
    const fx = FX()
    fx.data = { aging_flags: FLAGS }
    fx.spreadsheets = { 'live-store': { aging_open_tickets: [['ticket_id', 'status'], ['t1', 'Open'], ['t9', 'Open']] } }
    const flagRows = qOracle().table('aging_flags', fx)
    const agingRows = qOracle().objects('aging_open_tickets', fx)
    same('dqOpenAgingFlags_', [null], () => dqOpenAgingFlags_(flagRows as never[], agingRows as never[]), 'flags store', fx)
  })
  it('missing flags tab -> []', () => {
    // No aging_flags tab in the fixture: legacy getSheetByName guard returns [], and the
    // port's caller passes flagRows=null for the same outcome.
    same('dqOpenAgingFlags_', [AGING], () => dqOpenAgingFlags_(null, AGING as never[]), 'flags missing tab')
  })
})
