/**
 * Golden tests: src/lib/prod/validation.ts + analytics.ts vs ProdValidation.js run verbatim
 * in the node:vm oracle. Every output must be identical — values, key order, strings.
 */
import { describe, it, expect } from 'vitest'
import {
  callLegacy,
  diffPath,
  json,
  rint,
  rng,
  rpick,
  same,
} from './helpers-oracle'
import {
  prodAdjustAux_,
  prodCasesByEmail_,
  prodCasesFromActivityRows_,
  prodCheckDecision_,
  prodCheckDispute_,
  prodCheckDisputeDecision_,
  prodConfidenceScore_,
  prodDetectFlags_,
  prodDueDate_,
  prodEffectiveStatus_,
  prodFlagId_,
  prodHash_,
  prodHeaderCols_,
  prodIn_,
  prodIntervalsFromRows_,
  prodIntervalKey_,
  prodIsAutoDue_,
  prodMergeSpans_,
  prodNorm_,
  prodQualifyingSpans_,
  prodRound2_,
  prodRuns_,
  prodSpansMs_,
  prodSuggestStatus_,
  prodWindowHist_,
} from '@/features/cx-productivity/lib/prod/validation'
import {
  prodAnalytics_,
  prodBand_,
  prodIdleSegments_,
  prodMedian_,
  prodPct_,
  prodWeekStart_,
  type ProdAnalyticsInput,
} from '@/features/cx-productivity/lib/prod/analytics'
import { prodDateKey_ } from '@/features/shared/lib/adapters'

const R = rng(0x9e3779b9)

describe('small helpers', () => {
  it('prodHash_ / prodFlagId_ (200 vectors)', () => {
    for (let i = 0; i < 200; i++) {
      const s = `${rpick(R, ['a@x.com', 'IDLE', 'Agent Óðinn', '', '  Pad  '])}|${rint(R, 0, 1e12)}|${i}`
      same('prodHash_', [s], () => prodHash_(s), {}, `hash ${i}`)
      const email = `e${rint(R, 0, 50)}@dabdoob.com`
      const ms = rint(R, 0, 2000000000000)
      const status = rpick(R, ['IDLE', 'idle', 'Available'])
      same('prodFlagId_', [email, ms, status], () => prodFlagId_(email, ms, status))
    }
  })

  it('prodNorm_ / prodIn_ / prodRound2_', () => {
    const vals: unknown[] = [' IDLE ', null, undefined, 42, 'Chats', ' chats ', 'IDLE', 'X']
    vals.forEach((v, i) => same('prodNorm_', [v], () => prodNorm_(v), {}, `norm ${i}`))
    for (let i = 0; i < 50; i++)
      same('prodIn_', [vals[i % vals.length], ['idle', 'chats']], () =>
        prodIn_(vals[i % vals.length], ['idle', 'chats'])
      )
    const nums = [0, 1.005, -1.005, 12.345, 0.005, 99.999, -0.0049, 1e-9, 7.125, 33.333, 2.675]
    nums.forEach((n, i) => same('prodRound2_', [n], () => prodRound2_(n), {}, `r2 ${i}`))
  })

  it('prodHeaderCols_ fallbacks + header normalization', () => {
    const wanted = {
      name: { names: ['agent name', 'agent'], fallback: 0 },
      status: { names: ['status name', 'status'], fallback: 1 },
      start: { names: ['start time', 'start'], fallback: 2 },
      end: { names: ['end time', 'end'], fallback: 3 },
    }
    const hdrs: unknown[][] = [
      ['Agent Name', 'Status Name', 'Start Time', 'End Time'],
      ['agent', 'STATUS', 'start', 'end'],
      ['  Agent   Name ', 'status name', 'Start Time', 'end time'],
      [],
      ['x', 'y'],
    ]
    hdrs.forEach((h, i) => same('prodHeaderCols_', [h, wanted], () => prodHeaderCols_(h, wanted), {}, `hdr ${i}`))
  })

  it('prodRuns_ contiguous runs, last first', () => {
    for (let i = 0; i < 100; i++) {
      const n = rint(R, 0, 40)
      const rows: number[] = []
      for (let j = 0; j < n; j++) rows.push(rint(R, 2, 200))
      same('prodRuns_', [rows], () => prodRuns_(rows), {}, `runs ${i}`)
    }
    same('prodRuns_', [[]], () => prodRuns_([]))
    same('prodRuns_', [[2, 3, 4, 7, 9, 10]], () => prodRuns_([2, 3, 4, 7, 9, 10]))
  })
})

describe('prodIntervalsFromRows_ / prodIntervalKey_', () => {
  it('150 row sets incl. unparsed/unmatched', () => {
    const names = ['Agent A', 'Agent B', 'Nobody Known', '']
    const statuses = ['IDLE', 'Available', 'Offline', 'idle x', '', 'BUSY']
    for (let i = 0; i < 150; i++) {
      const rows: unknown[][] = []
      const n = rint(R, 0, 8)
      for (let j = 0; j < n; j++) {
        const s = rint(R, 0, 24 * 3600 * 1000)
        const e = s + rint(R, -60000, 7200000)
        const r: unknown[] = [rpick(R, names), rpick(R, statuses)]
        r[rint(R, 0, 1)] = rpick(R, ['2026-10-29 06:00', '', 'xx', new Date(s).toISOString()])
        r[2] = new Date(s).toISOString()
        r[3] = rpick(R, [new Date(e).toISOString(), 'bad'])
        if (R() < 0.3) r[4] = 'agent.a@dabdoob.com'
        rows.push(r)
      }
      // dateKey: oracle gets the prelude double __fn_prodDateKey_ (formats in the pinned
      // script tz Africa/Cairo); the port gets its own prodDateKey_ — identical semantics.
      const opts = {
        cols: { name: 0, status: 1, start: 2, end: 3, email: 4 },
        tz: 'Asia/Kuwait',
        statusMap: { 'idle x': 'IDLE' },
        nameToEmail: { 'agent a': 'agent.a@dabdoob.com', 'agent b': 'agent.b@dabdoob.com' },
        source: 'fd_aux',
        dateKey: '@@fn:__fn_prodDateKey_',
      }
      const legacy = callLegacy('prodIntervalsFromRows_', [rows, opts])
      const port = (() => {
        try {
          return {
            ok: json(prodIntervalsFromRows_(rows, { ...opts, dateKey: prodDateKey_ })),
          }
        } catch (e) {
          return { err: String((e as Error).message) }
        }
      })()
      if (legacy.err) throw new Error('legacy threw: ' + legacy.err)
      const d = diffPath(legacy.ok, port.ok, `$[${i}]`)
      if (d) throw new Error(d)
    }
  })
})

it('prodIntervalKey_', () => {
  for (let i = 0; i < 50; i++) {
    const iv = {
      date: `2026-1${rint(R, 0, 2)}-0${rint(R, 1, 9)}`,
      agentName: rpick(R, ['A B', 'Agent a', '  X ']),
      status: rpick(R, ['IDLE', 'Available']),
      startMs: rint(R, 0, 2e12),
    }
    same('prodIntervalKey_', [iv], () => prodIntervalKey_(iv), {}, `ik ${i}`)
  }
})

describe('cases + spans', () => {
  const groups = { chat: ['FreshChat'], wa: ['Waiting Address'] }
  const nameToEmail = { 'agent a': 'a@dabdoob.com', 'agent b': 'b@dabdoob.com' }

  it('prodCasesFromActivityRows_ / prodCasesByEmail_ (150 sets)', () => {
    for (let i = 0; i < 150; i++) {
      const rows: unknown[][] = []
      const n = rint(R, 0, 12)
      for (let j = 0; j < n; j++) {
        const t = rint(R, Date.parse('2026-10-28T00:00:00Z'), Date.parse('2026-10-31T00:00:00Z'))
        rows.push([
          new Date(t).toISOString().replace('T', ' ').slice(0, 19),
          rpick(R, ['T1', 'T2', 'T3', '']),
          rpick(R, ['Agent A', 'Agent B', 'Someone Else']),
          'Agent',
          'Update',
          rpick(R, ['status', 'note', 'Status']),
          rpick(R, ['Open', 'Pending on CX', 'Resolved']),
          '',
          rpick(R, ['FreshChat', 'Waiting Address', 'Customer Support - Internal', '']),
          `2026-1${rint(R, 0, 0)}-${rint(R, 28, 30)}`,
        ])
      }
      const dates = ['2026-10-29']
      const args = [rows, dates, nameToEmail, 'Asia/Kuwait', groups]
      same('prodCasesFromActivityRows_', args, () =>
        prodCasesFromActivityRows_(rows, dates, nameToEmail, 'Asia/Kuwait', groups)
      , {}, `cases ${i}`)
      if (i < 20) {
        const cases = prodCasesFromActivityRows_(rows, dates, nameToEmail, 'Asia/Kuwait', groups)
        same('prodCasesByEmail_', [cases], () => prodCasesByEmail_(cases), {}, `byEmail ${i}`)
      }
    }
  })

  it('prodMergeSpans_ / prodQualifyingSpans_ / prodSpansMs_', () => {
    for (let i = 0; i < 200; i++) {
      const spans: [number, number][] = []
      for (let j = 0; j < rint(R, 0, 8); j++) {
        const a = rint(R, 0, 7200000)
        spans.push([a, a + rint(R, 0, 1800000)])
      }
      same('prodMergeSpans_', [spans], () => prodMergeSpans_(spans), {}, `merge ${i}`)
      const merged = prodMergeSpans_(spans)
      same('prodSpansMs_', [merged], () => prodSpansMs_(merged), {}, `spansMs ${i}`)

      const cases: { ms: number; id: string; channel: string }[] = []
      for (let j = 0; j < rint(R, 0, 10); j++)
        cases.push({ ms: rint(R, 0, 7200000), id: 'T' + rint(R, 1, 4), channel: 'chat' })
      cases.sort((a, b) => a.ms - b.ms)
      const s0 = rint(R, 0, 3600000)
      const args = [cases, s0, s0 + rint(R, 600000, 7200000), rint(R, 1, 4), rint(R, 300000, 1200000)]
      same('prodQualifyingSpans_', args, () =>
        prodQualifyingSpans_(cases, args[1] as number, args[2] as number, args[3] as number, args[4] as number)
      , {}, `qual ${i}`)
    }
  })

  it('half-open window: a case exactly at t+W is OUTSIDE (legacy comment)', () => {
    const cases = [
      { ms: 0, id: 'a', channel: 'chat' },
      { ms: 600000, id: 'b', channel: 'chat' }, // exactly 10 min after the anchor
    ]
    same('prodQualifyingSpans_', [cases, 0, 3600000, 2, 600000], () =>
      prodQualifyingSpans_(cases, 0, 3600000, 2, 600000)
    )
    // and both inside -> one merged qualifying span
    const cases2 = [
      { ms: 0, id: 'a', channel: 'chat' },
      { ms: 599999, id: 'b', channel: 'chat' },
    ]
    same('prodQualifyingSpans_', [cases2, 0, 3600000, 2, 600000], () =>
      prodQualifyingSpans_(cases2, 0, 3600000, 2, 600000)
    )
  })
})

describe('prodSuggestStatus_ + prodDetectFlags_', () => {
  it('channel order tie-break ticket > chat > wa', () => {
    const mixes: Record<string, number>[] = [
      { ticket: 2, chat: 2, wa: 2 },
      { chat: 3, wa: 3 },
      { wa: 5 },
      { chat: 1, ticket: 1 },
      {},
    ]
    const ch = { ticket: 'Available', chat: 'Chats', wa: 'Waiting Address' }
    mixes.forEach((m, i) => same('prodSuggestStatus_', [m, ch], () => prodSuggestStatus_(m, ch), {}, `sug ${i}`))
  })

  it('prodDetectFlags_ (200 vectors, all flag fields byte-identical)', () => {
    const rule = {
      x: 2,
      windowMin: 10,
      minIntervalMin: 5,
      statuses: ['IDLE'],
      channelStatus: { ticket: 'Available', chat: 'Chats', wa: 'Waiting Address' },
    }
    for (let i = 0; i < 200; i++) {
      const day = '2026-10-' + String(rint(R, 27, 30)).padStart(2, '0')
      const base = Date.parse(day + 'T00:00:00Z')
      const intervals = [
        {
          date: day,
          agentEmail: 'a@dabdoob.com',
          agentName: 'Agent A',
          status: rpick(R, ['IDLE', 'Available', 'Offline', 'idle']),
          startMs: base + rint(R, 0, 43200000),
          endMs: 0,
          minutes: 0,
        },
      ]
      intervals[0].endMs = intervals[0].startMs + rint(R, 60000, 7200000)
      intervals[0].minutes = (intervals[0].endMs - intervals[0].startMs) / 60000
      const cases: Record<string, { ms: number; id: string; channel: string }[]> = { 'a@dabdoob.com': [] }
      for (let j = 0; j < rint(R, 0, 12); j++)
        cases['a@dabdoob.com'].push({
          ms: intervals[0].startMs + rint(R, -300000, intervals[0].endMs - intervals[0].startMs + 600000),
          id: 'T' + rint(R, 1, 6),
          channel: rpick(R, ['chat', 'wa', 'ticket']),
        })
      cases['a@dabdoob.com'].sort((a, b) => a.ms - b.ms)
      same('prodDetectFlags_', [intervals, cases, rule], () => prodDetectFlags_(intervals as never, cases as never, rule), {}, `flags ${i}`)
    }
  })

  it('min-interval + status filter edges', () => {
    const rule = { x: 1, windowMin: 10, minIntervalMin: 5, statuses: ['IDLE'], channelStatus: { ticket: 'Available', chat: 'Chats', wa: 'Waiting Address' } }
    for (const lenMin of [4, 5, 6]) {
      const intervals = [
        { date: '2026-10-29', agentEmail: 'a@dabdoob.com', agentName: 'A', status: 'IDLE', startMs: 0, endMs: lenMin * 60000, minutes: lenMin },
      ]
      const cases = { 'a@dabdoob.com': [{ ms: 60000, id: 't1', channel: 'chat' }] }
      same('prodDetectFlags_', [intervals, cases, rule], () => prodDetectFlags_(intervals as never, cases as never, rule), {}, `minInt ${lenMin}`)
    }
  })
})

describe('prodWindowHist_ + prodIdleSegments_', () => {
  it('200 vectors', () => {
    const classes = { idle: ['IDLE'], working: ['Available', 'Chats'] }
    for (let i = 0; i < 200; i++) {
      const intervals: { date: string; agentEmail: string; agentName: string; status: string; startMs: number; endMs: number; minutes: number }[] = []
      for (let j = 0; j < rint(R, 0, 5); j++) {
        const s = rint(R, 0, 7200000)
        intervals.push({
          date: '2026-10-29',
          agentEmail: rpick(R, ['a@x.com', 'b@x.com', '']),
          agentName: 'A',
          status: rpick(R, ['IDLE', 'Available', 'Offline', 'Chats']),
          startMs: s,
          endMs: s + rint(R, 0, 3600000),
          minutes: 0,
        })
      }
      const cases: Record<string, { ms: number; id: string }[]> = { 'a@x.com': [], 'b@x.com': [] }
      for (let j = 0; j < rint(R, 0, 10); j++)
        cases['a@x.com'].push({ ms: rint(R, 0, 10800000), id: 'T' + rint(R, 1, 4) })
      cases['a@x.com'].sort((a, b) => a.ms - b.ms)
      const wm = 10
      same('prodWindowHist_', [intervals, cases, wm, classes], () => prodWindowHist_(intervals as never, cases as never, wm, classes), {}, `wh ${i}`)

      const iv = { startMs: 0, endMs: 7200000 }
      const moved: [number, number][] = []
      for (let j = 0; j < rint(R, 0, 4); j++) {
        const a = rint(R, 0, 3600000)
        moved.push([a, a + rint(R, 60000, 3600000)])
      }
      same('prodIdleSegments_', [iv, moved], () => prodIdleSegments_(iv, moved), {}, `idleSeg ${i}`)
    }
  })
})

describe('layers + review rules', () => {
  it('prodEffectiveStatus_', () => {
    const flags = [
      { decision: 'void', suggested_status: 'Chats', validated_status: 'Busy', raw_status: 'IDLE' },
      { decision: 'pending', suggested_status: 'Chats', validated_status: '', raw_status: 'IDLE' },
      { decision: 'accepted', suggested_status: 'Chats', validated_status: 'Busy', raw_status: 'IDLE' },
      { decision: 'reverted', suggested_status: 'Chats', validated_status: 'IDLE', raw_status: 'IDLE' },
      { decision: 'auto', suggested_status: 'Chats', validated_status: 'Chats', raw_status: 'IDLE' },
      { decision: '', suggested_status: '', validated_status: '', raw_status: 'IDLE' },
      null,
      { decision: 'pending', suggested_status: null, raw_status: 'IDLE' },
    ]
    flags.forEach((f, i) => same('prodEffectiveStatus_', [f], () => prodEffectiveStatus_(f as never), {}, `eff ${i}`))
  })

  it('prodAdjustAux_ incl. clipping (150 vectors)', () => {
    for (let i = 0; i < 150; i++) {
      const fdAux = [
        { agentName: 'Agent A', email: 'a@dabdoob.com', status: 'IDLE', minutes: rint(R, 0, 120), date: '2026-10-29' },
        { agentName: 'Agent A', email: 'a@dabdoob.com', status: 'Available', minutes: rint(R, 0, 120), date: '2026-10-29' },
      ]
      const flags: Record<string, unknown>[] = []
      for (let j = 0; j < rint(R, 0, 3); j++) {
        flags.push({
          flag_id: 'PF' + j,
          agent_email: 'a@dabdoob.com',
          agent_name: 'Agent A',
          raw_status: 'IDLE',
          suggested_status: rpick(R, ['Chats', 'Available', 'IDLE']),
          validated_status: rpick(R, ['Chats', '', 'Waiting Address']),
          decision: rpick(R, ['pending', 'accepted', 'auto', 'reverted', 'void']),
          flagged_min: rint(R, 0, 90),
          date: '2026-10-29',
          interval_start: '2026-10-29T0' + rint(R, 3, 9) + ':00:00.000Z',
        })
      }
      same('prodAdjustAux_', [fdAux, flags], () => prodAdjustAux_(fdAux, flags as never), {}, `adj ${i}`)
    }
  })

  it('prodCheckDecision_ — all error messages byte-identical', () => {
    const pending = { decision: 'pending', raw_status: 'IDLE', suggested_status: 'Chats' }
    const ctx = { statuses: ['Available', 'Chats', 'Inbound Calls', 'Waiting Address', 'Busy'], reasonStatuses: ['Busy'] }
    const inputs: Record<string, unknown>[] = [
      { action: 'accept', status: 'Chats', reason: '' },
      { action: 'accept', status: 'chats', reason: '' },
      { action: 'accept', status: 'Busy', reason: '' },
      { action: 'accept', status: 'Busy', reason: 'covering shift swap' },
      { action: 'accept', status: 'IDLE', reason: '' },
      { action: 'accept', status: 'Nonexistent', reason: '' },
      { action: 'accept', status: '', reason: '' },
      { action: 'revert', status: '', reason: 'they were away' },
      { action: 'revert', status: '', reason: 'no' },
      { action: 'bogus', status: 'Chats', reason: '' },
    ]
    inputs.forEach((inp, i) =>
      same('prodCheckDecision_', [pending, inp, ctx], () => prodCheckDecision_(pending as never, inp as never, ctx as never), {}, `dec ${i}`)
    )
    same('prodCheckDecision_', [null, { action: 'accept' }, ctx], () => prodCheckDecision_(null as never, {} as never, ctx as never))
    same('prodCheckDecision_', [{ decision: 'accepted', raw_status: 'IDLE' }, { action: 'accept', status: 'Chats' }, ctx], () =>
      prodCheckDecision_({ decision: 'accepted', raw_status: 'IDLE' } as never, { action: 'accept', status: 'Chats' } as never, ctx as never)
    )
  })

  it('prodDueDate_ / prodIsAutoDue_', () => {
    for (let i = 0; i < 60; i++) {
      const k = `2026-${String(rint(R, 1, 12)).padStart(2, '0')}-${String(rint(R, 1, 28)).padStart(2, '0')}`
      const rd = rint(R, 0, 14)
      same('prodDueDate_', [k, rd], () => prodDueDate_(k, rd), {}, `due ${i}`)
      const f = { decision: rpick(R, ['pending', 'accepted', 'void']), due_date: dqAddDaysShim(k, -1) }
      same('prodIsAutoDue_', [f, k], () => prodIsAutoDue_(f, k), {}, `autoDue ${i}`)
    }
  })

  it('disabled dispute functions throw the exact message', () => {
    for (const args of [[{}, [], 'a@x.com', '2026-01-01', '', 3, 'r'], []]) {
      same('prodCheckDispute_', args, () => prodCheckDispute_(...(args as never[])), {})
      same('prodCheckDisputeDecision_', args, () => prodCheckDisputeDecision_(...(args as never[])), {})
    }
  })
})

describe('prodConfidenceScore_', () => {
  it('150 vectors across factor combinations + clamps', () => {
    for (let i = 0; i < 150; i++) {
      const mix: Record<string, number> = {}
      for (const ch of ['chat', 'wa', 'ticket']) if (R() < 0.5) mix[ch] = rint(R, 1, 9)
      const flag = {
        distinct_cases: rint(R, 0, 15),
        interval_min: rint(R, 0, 120),
        channel_mix_json: JSON.stringify(mix),
      }
      same('prodConfidenceScore_', [flag, null, null, null], () => prodConfidenceScore_(flag), {}, `conf ${i}`)
    }
  })
  it('score clamps: edge sets', () => {
    for (const flag of [
      { distinct_cases: 1000, interval_min: 4000, channel_mix_json: '{"chat":1}' },
      { distinct_cases: 0, interval_min: 0, channel_mix_json: '{"a":1,"b":1,"c":1,"d":1}' },
      { distinct_cases: 69, interval_min: 30, channel_mix_json: '{}' },
    ])
      same('prodConfidenceScore_', [flag, null, null, null], () => prodConfidenceScore_(flag))
  })
})

describe('analytics helpers + prodAnalytics_', () => {
  it('prodWeekStart_ (weeks start Sunday)', () => {
    for (let i = 0; i < 200; i++) {
      const k = `2026-${String(rint(R, 1, 12)).padStart(2, '0')}-${String(rint(R, 1, 28)).padStart(2, '0')}`
      same('prodWeekStart_', [k], () => prodWeekStart_(k), {}, `wk ${i}`)
    }
  })

  it('prodBand_ edges incl. non-finite quirk', () => {
    const vals: unknown[] = [0.79, 0.8, 0.85, 0.86, 0.9, 0.94, 0.95, 0.97, 1, 1.2, null, undefined, '', NaN, Infinity, -1]
    vals.forEach((v, i) => same('prodBand_', [v], () => prodBand_(v), {}, `band ${i}`))
  })

  it('prodMedian_ / prodPct_', () => {
    for (let i = 0; i < 80; i++) {
      const xs: (number | null)[] = []
      for (let j = 0; j < rint(R, 0, 9); j++) xs.push(R() < 0.15 ? null : rint(R, 0, 200) / 10)
      same('prodMedian_', [xs], () => prodMedian_(xs), {}, `med ${i}`)
      const a = rint(R, 0, 500)
      const b = rint(R, 0, 1000)
      same('prodPct_', [a, b], () => prodPct_(a, b), {}, `pct ${i}`)
    }
  })

  it('prodAnalytics_ full=false (agents/tls/trend byte-identical)', () => {
    for (let i = 0; i < 60; i++) {
      const week = '2026-10-25' // a Sunday
      const inp = {
        intervals: [] as unknown[],
        flags: [] as unknown[],
        layers: [] as unknown[],
        hist: [] as unknown[],
        people: { 'a@dabdoob.com': { name: 'Agent A', tlEmail: 'tl@dabdoob.com' } } as Record<string, { name: string; tlEmail: string }>,
        tlName: (e: string) => 'TL ' + e,
        week,
        weeks: ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'],
        todayKey: '2026-10-29',
        flagStatuses: ['IDLE'],
        offlineStatuses: ['Offline'],
        channelStatus: { ticket: 'Available', chat: 'Chats', wa: 'Waiting Address' },
        offsetMs: () => 10800000, // Kuwait +3
        full: false,
      }
      for (let j = 0; j < rint(R, 0, 6); j++) {
        const s = Date.parse('2026-10-2' + rint(R, 5, 8) + 'T0' + rint(R, 4, 9) + ':00:00Z')
        inp.intervals.push({
          date: new Date(s).toISOString().slice(0, 10),
          agentEmail: 'a@dabdoob.com',
          agentName: 'Agent A',
          status: rpick(R, ['IDLE', 'Available', 'Offline']),
          startMs: s,
          endMs: s + 3600000,
          minutes: 60,
        })
      }
      for (let j = 0; j < rint(R, 0, 4); j++) {
        inp.flags.push({
          flag_id: 'PF' + j,
          agent_email: 'a@dabdoob.com',
          date: '2026-10-' + String(rint(R, 25, 29)),
          decision: rpick(R, ['pending', 'accepted', 'auto', 'reverted', 'void']),
          raw_status: 'IDLE',
          suggested_status: 'Chats',
          validated_status: 'Chats',
          tl_email: 'tl@dabdoob.com',
          spans_json: '[]',
          interval_start: '2026-10-27T06:00:00.000Z',
          created_at: '2026-10-27T07:00:00.000Z',
          decided_at: '2026-10-28T07:00:00.000Z',
          review_open_ms: rint(R, 0, 90000),
        })
      }
      for (let j = 0; j < rint(R, 0, 4); j++) {
        inp.layers.push({
          email: 'a@dabdoob.com',
          date: '2026-10-' + String(rint(R, 25, 29)),
          layer: rpick(R, ['raw', 'effective']),
          productiveMinResolution: rint(R, 0, 400),
          productiveMinAux: rint(R, 0, 480),
        })
      }
      // tlName/offsetMs are functions — cannot cross JSON to the vm; @@fn markers rebind
      // to prelude doubles __fn_tlName__/__fn_offsetMs__ matching the port-side funcs.
      const legacy = callLegacy('prodAnalytics_', [
        {
          ...inp,
          tlName: '@@fn:__fn_tlName__',
          offsetMs: '@@fn:__fn_offsetMs__',
        },
      ])
      const port = (() => {
        try {
          return { ok: json(prodAnalytics_(inp as ProdAnalyticsInput)) }
        } catch (e) {
          return { err: String((e as Error).message) }
        }
      })()
      const d = diffPath(legacy.ok, port.ok, `$[${i}]`)
      if (d) throw new Error(d)
    }
  })

  it('prodAnalytics_ full=true populates calibration, skipping rows before weeks[0]', () => {
    const inp = {
      intervals: [
        { date: '2026-10-29', agentEmail: 'a@x.com', agentName: 'A', status: 'IDLE', startMs: 0, endMs: 3600000, minutes: 60 },
      ],
      flags: [],
      layers: [],
      hist: [
        { date: '2026-10-01', class: 'idle', counts_json: '{"9":9}' },
        { date: '2026-10-10', class: 'idle', counts_json: '{"3":2}' },
      ],
      people: {},
      tlName: '@@fn:__fn_tlName__',
      week: '2026-10-25',
      weeks: ['2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25'],
      todayKey: '2026-10-29',
      flagStatuses: ['IDLE'],
      offlineStatuses: ['Offline'],
      channelStatus: {},
      offsetMs: '@@fn:__fn_offsetMs__',
      full: true,
    }
    const legacy = callLegacy('prodAnalytics_', [inp])
    const port = callPort_(() =>
      prodAnalytics_({ ...inp, tlName: (e: string) => 'TL ' + e, offsetMs: () => 10800000 } as never)
    )
    expect(legacy.err).toMatch(/from is not defined/)
    expect(port.err).toBeUndefined()
    const cal = (port.ok as Record<string, unknown>).calibration as Record<string, Record<string, number>>
    expect(cal.idle).toEqual({ '3': 2 })
    expect(cal.working).toEqual({})
  })
})

function callPort_(fn: () => unknown) {
  try {
    return { ok: json(fn()) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}

function dqAddDaysShim(key: string, n: number) {
  const p = key.split('-')
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10)
}
