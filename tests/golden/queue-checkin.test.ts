/**
 * WP-22: Check-in validation + submission flows.
 *  (a) dqValidateCheckin_ — QueuePages.js:193 — pure validation vectors vs the oracle.
 *  (b) submitCheckin — QueuePages.js:233 — run end-to-end on BOTH sides against
 *      deterministic state: legacy inside the vm (sheet stubs are writable), port
 *      against the hub-fakes in-memory supabase. Same payload, same frozen clock —
 *      then compare envelopes and the stored submission row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { baseFixtures, callPort, expectSame, json } from './helpers-oracle'
import { qCallLegacy, qOracle } from './queue-oracle'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'
import { dqValidateCheckin_ } from '@/features/cx-queue/lib'
import { submitCheckin } from '@/features/cx-queue/lib/pages'
import { submitQueueCheckin } from '@/features/cx-queue/lib/server'
import type { Cfg } from '@/features/shared/lib/adapters'

// ---------------------------------------------------------------- shared state

const NOW_MS = Date.parse('2026-10-15T11:20:00Z') // 14:20 Kuwait — inside the 14:00 slot window
const LATE_MS = Date.parse('2026-10-15T11:45:00Z') // 14:45 Kuwait — past the 14:00 due time
const EARLY_MS = Date.parse('2026-10-15T10:30:00Z') // 13:30 Kuwait — before the 14:00 slot opens

const SETTINGS = {
  business_tz: 'Asia/Kuwait',
  checkin_slots: ['09:30', '14:00', '21:30'],
  checkin_slot_names: { '09:30': 'Morning', '14:00': 'Afternoon', '21:30': 'Close' },
  checkin_read_delay_min: 20,
  checkin_open_before_min: 15,
  checkin_due_after_min: 30,
  admin_emails: 'boss@dabdoob.com',
  allowed_domain: 'dabdoob.com',
  ss_live_id: 'live_ss',
  mail_dry_run: true,
}

const ROSTER_TAB = [
  ['email', 'name', 'role', 'team', 'tl_email', 'active'],
  ['tl@dabdoob.com', 'TL One', 'tl', 'cx', 'boss@dabdoob.com', 'true'],
  ['admin@dabdoob.com', 'Boss', 'admin', 'cx', '', 'true'],
  ['agent@dabdoob.com', 'Agent', 'agent', 'cx', 'tl@dabdoob.com', 'true'],
]

const SNAPSHOT_HDR = ['snapshot_key', 'slot_date', 'slot', 'captured_at', 'data_as_of', 'late', 'queue',
  'open', 'actionable', 'unassigned', 'oldest_h', 'over_top', 'created_today', 'resolved_today', 'stale', 'by_status_json', 'bands_json']
const QUEUE_NOW_HDR = ['queue', 'kind', 'open', 'actionable', 'unassigned', 'oldest_h',
  'over_top', 'created_today', 'resolved_today', 'as_of', 'source_as_of', 'stale', 'by_status_json', 'bands_json']
const SUBS_HDR = ['submission_id', 'slot_date', 'slot', 'snapshot_key', 'status', 'queues_json',
  'corrections_json', 'correction_reason', 'general_note', 'help_needed', 'help_note',
  'submitted_by', 'submitted_at', 'updated_by', 'updated_at']
const POPUPS_HDR = ['popup_id', 'recipient', 'kind', 'title', 'body', 'link', 'ref', 'created_at', 'resolved_at', 'submitted_by', 'submitted_at']

const SNAP_ROWS = [
  ['2026-10-15|14:00', '2026-10-15', '14:00', '2026-10-15T11:00:00Z', '2026-10-15T11:00:00Z', '', 'Ops QA Gift', 7, 5, 0, 1.5, 0, 2, 1, '', '{}', '{}'],
  ['2026-10-15|14:00', '2026-10-15', '14:00', '2026-10-15T11:00:00Z', '2026-10-15T11:00:00Z', '', 'Inbox', 3, 3, 0, 0.5, 0, 0, 0, '', '{}', '{}'],
  ['2026-10-15|09:30', '2026-10-15', '09:30', '2026-10-15T06:30:00Z', '2026-10-15T06:30:00Z', '', 'Ops QA Gift', 9, 9, 0, 2, 0, 0, 0, '', '{}', '{}'],
]
const QUEUE_NOW_ROWS = [
  ['Ops QA Gift', 'ticket', 4, 4, 0, 1, 0, 0, 0, '2026-10-15T11:00:00Z', '', '', '{}', '{}'],
]

const snapObjects = () =>
  SNAP_ROWS.map((r) => {
    const o: Record<string, unknown> = {}
    SNAPSHOT_HDR.forEach((h, i) => (o[h] = r[i]))
    return o
  })
const queueNowObjects = () =>
  QUEUE_NOW_ROWS.map((r) => {
    const o: Record<string, unknown> = {}
    QUEUE_NOW_HDR.forEach((h, i) => (o[h] = r[i]))
    return o
  })

/** Legacy fixture: Config + Roster + live store + submissions + popups tabs. */
const FX = (over: { nowMs?: number; data?: Record<string, unknown[][]> } = {}) =>
  baseFixtures({
    nowMs: over.nowMs ?? NOW_MS,
    userEmail: 'tl@dabdoob.com',
    settings: SETTINGS,
    data: {
      Roster: ROSTER_TAB.slice(),
      queue_status_submissions: [SUBS_HDR.slice()],
      Popups: [
        POPUPS_HDR.slice(),
        ['p1', 'tl@dabdoob.com', 'queue_checkin_missed', 't', 'b', '#/checkins', '2026-10-15|14:00', '2026-10-15T11:31:00Z', '', 'system:x', '2026-10-15T11:31:00Z'],
        ['p2', 'boss@dabdoob.com', 'other_kind', 't', 'b', '', '2026-10-15|14:00', '2026-10-15T11:31:00Z', '', 'system:x', '2026-10-15T11:31:00Z'],
      ],
      ...(over.data || {}),
    },
    spreadsheets: {
      live_ss: {
        agg_snapshots_today: [SNAPSHOT_HDR.slice(), ...SNAP_ROWS.map((r) => r.slice())],
        agg_queue_now: [QUEUE_NOW_HDR.slice(), ...QUEUE_NOW_ROWS.map((r) => r.slice())],
      },
    },
  })

/** Port-side equivalent: identical rows in the flat supabase tables. */
function seedHub(over: { submissions?: Record<string, unknown>[] } = {}) {
  hubDbReset()
  hubSetUser('tl@dabdoob.com')
  hubSetTables({
    roster: ROSTER_TAB.slice(1).map((r) => ({ email: r[0], name: r[1], role: r[2], team: r[3], tl_email: r[4], active: r[5] })),
    config: Object.entries(SETTINGS).map(([k, v]) => ({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) })),
    agg_snapshots_today: snapObjects(),
    agg_queue_now: queueNowObjects(),
    queue_submissions: over.submissions || [],
    popups: [
      { popup_id: 'p1', recipient: 'tl@dabdoob.com', kind: 'queue_checkin_missed', title: 't', body: 'b', link: '#/checkins', ref: '2026-10-15|14:00', created_at: '2026-10-15T11:31:00Z', resolved_at: '' },
      { popup_id: 'p2', recipient: 'boss@dabdoob.com', kind: 'other_kind', title: 't', body: 'b', link: '', ref: '2026-10-15|14:00', created_at: '2026-10-15T11:31:00Z', resolved_at: '' },
    ],
    view_as: [],
    mail_log: [],
  })
}

const CFG = baseFixtures({ settings: SETTINGS }).settings as Cfg

afterEach(() => {
  vi.useRealTimers()
})

const same = (fn: string, args: unknown[], portFn: (...a: unknown[]) => unknown, label?: string, fx = FX()) =>
  expectSame(callPort(() => json(portFn(...args))), qCallLegacy(fn, args, fx), label || fn)

// ---------------------------------------------------------------- dqValidateCheckin_

describe('checkin: dqValidateCheckin_ vectors vs oracle', () => {
  const AUTO = { 'Ops QA Gift': 7, Inbox: 3 }
  const vectors: [string, Record<string, unknown>, Record<string, number> | null][] = [
    ['valid minimal', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 4, status: 'On track' }] }, AUTO],
    ['valid full', {
      slot: '14:00', generalNote: '  busy day  ', helpNeeded: true, helpNote: 'need cover',
      queues: [
        { queue: 'Ops QA Gift', agents: '4', status: '  Slipping   behind ', note: ' oos spike ' },
        { queue: 'Inbox', agents: 0, status: 'On track', note: '' },
      ],
    }, AUTO],
    ['bad slot', { slot: '10:00', queues: [{ queue: 'Q', agents: 1, status: 'On track' }] }, AUTO],
    ['no payload', {}, AUTO],
    ['empty queues', { slot: '09:30', queues: [] }, AUTO],
    ['missing queues', { slot: '09:30' }, AUTO],
    ['blank queue name', { slot: '09:30', queues: [{ queue: '  ', agents: 1, status: 'On track' }] }, AUTO],
    ['agents empty', { slot: '09:30', queues: [{ queue: 'Q', agents: '', status: 'On track' }] }, AUTO],
    ['agents null', { slot: '09:30', queues: [{ queue: 'Q', agents: null, status: 'On track' }] }, AUTO],
    ['agents text', { slot: '09:30', queues: [{ queue: 'Q', agents: 'four', status: 'On track' }] }, AUTO],
    ['agents fraction', { slot: '09:30', queues: [{ queue: 'Q', agents: 2.5, status: 'On track' }] }, AUTO],
    ['agents negative', { slot: '09:30', queues: [{ queue: 'Q', agents: -1, status: 'On track' }] }, AUTO],
    ['agents 201', { slot: '09:30', queues: [{ queue: 'Q', agents: 201, status: 'On track' }] }, AUTO],
    ['agents 200 ok', { slot: '09:30', queues: [{ queue: 'Q', agents: 200, status: 'On track' }] }, AUTO],
    ['no status', { slot: '09:30', queues: [{ queue: 'Q', agents: 1 }] }, AUTO],
    ['status ws-only', { slot: '09:30', queues: [{ queue: 'Q', agents: 1, status: '   ' }] }, AUTO],
    ['status too long', { slot: '09:30', queues: [{ queue: 'Q', agents: 1, status: 'x'.repeat(121) }] }, AUTO],
    ['status 120 ok', { slot: '09:30', queues: [{ queue: 'Q', agents: 1, status: 'x'.repeat(120), note: 'why' }] }, AUTO],
    ['not-on-track needs note', { slot: '09:30', queues: [{ queue: 'Q', agents: 1, status: 'Slipping' }] }, AUTO],
    ['not-on-track with note', { slot: '09:30', queues: [{ queue: 'Q', agents: 1, status: 'Slipping', note: 'sick day' }] }, AUTO],
    ['note sliced at 1000', { slot: '09:30', queues: [{ queue: 'Q', agents: 1, status: 'Slipping', note: ' ' + 'n'.repeat(1200) }] }, AUTO],
    ['openCorrected bad text', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: 'x' }] }, AUTO],
    ['openCorrected fraction', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: 1.5 }] }, AUTO],
    ['openCorrected negative', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: -2 }] }, AUTO],
    ['correction equal to auto', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: 7 }] }, AUTO],
    ['correction no reason', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: 4 }] }, AUTO],
    ['correction with reason', { slot: '09:30', correctionReason: ' fd recount ', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: 4 }] }, AUTO],
    ['correction unknown queue', { slot: '09:30', correctionReason: 'why', queues: [{ queue: 'Mystery', agents: 1, status: 'On track', openCorrected: 4 }] }, AUTO],
    ['correction auto null', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: 4 }] }, null],
    ['openCorrected empty str', { slot: '09:30', queues: [{ queue: 'Ops QA Gift', agents: 1, status: 'On track', openCorrected: '' }] }, AUTO],
    ['help no note', { slot: '09:30', helpNeeded: true, queues: [{ queue: 'Q', agents: 1, status: 'On track' }] }, AUTO],
    ['help with note', { slot: '09:30', helpNeeded: true, helpNote: '  escalate pls ', queues: [{ queue: 'Q', agents: 1, status: 'On track' }] }, AUTO],
    ['help note alone', { slot: '09:30', helpNeeded: false, helpNote: 'ignored?', queues: [{ queue: 'Q', agents: 1, status: 'On track' }] }, AUTO],
    ['generalNote sliced', { slot: '09:30', generalNote: 'g'.repeat(2500), queues: [{ queue: 'Q', agents: 1, status: 'On track' }] }, AUTO],
  ]
  vectors.forEach(([label, payload, auto], i) =>
    it(label, () =>
      same('dqValidateCheckin_', [payload, auto], (p, a) => dqValidateCheckin_(p as never, a as never, CFG), `validate ${i}`)))
})

// ---------------------------------------------------------------- submitCheckin

describe('checkin: submitCheckin end-to-end vs oracle', () => {
  const PAYLOAD = {
    slot: '14:00',
    generalNote: 'steady',
    helpNeeded: false,
    queues: [
      { queue: 'Ops QA Gift', agents: 5, status: 'On track' },
      { queue: 'Inbox', agents: 2, status: 'Slipping', note: '2 on break' },
    ],
  }

  const stripIds = (rows: Record<string, unknown>[]) =>
    rows.map((r) => {
      const rest = { ...r }
      delete rest.submission_id
      delete rest._row
      delete rest.id
      return rest
    })
  const parseStored = (rows: Record<string, unknown>[]) =>
    stripIds(rows).map((r) => {
      const o: Record<string, unknown> = {}
      // Sheets store every header cell ('' when empty); Postgres columns are simply
      // absent/null. Canonicalise "absent" to '' on both sides before comparing.
      SUBS_HDR.forEach((h) => {
        if (h === 'submission_id') return
        const v = h in r ? r[h] : ''
        const nv = v === null || v === undefined ? '' : v
        o[h] = typeof nv === 'string' && (nv[0] === '[' || nv[0] === '{') ? JSON.parse(nv) : nv
      })
      return o
    })

  const legacySubmit = async (payload: Record<string, unknown>, fx: unknown) => {
    try {
      return { ok: json(await qOracle().call('submitCheckin', [payload], fx as object)) }
    } catch (e) {
      return { err: String((e as Error).message || e) }
    }
  }
  const legacyEval = <T>(code: string): T => JSON.parse(qOracle().eval('JSON.stringify(' + code + ')') as string)
  const legacyTab = () => legacyEval<Record<string, unknown>[]>("readTable_('queue_status_submissions')")
  const portSubmit = async (payload: Record<string, unknown>) => {
    try {
      return { ok: json(await submitCheckin(payload)) }
    } catch (e) {
      return { err: String((e as Error).message || e) }
    }
  }

  it('first submission appends a stamped row (snapshot present)', async () => {
    vi.setSystemTime(new Date(NOW_MS))
    const fx = FX()
    const legacy = await legacySubmit(PAYLOAD, fx)
    seedHub()
    const port = await portSubmit(PAYLOAD)
    expectSame(port, legacy, 'submit append envelope')

    const lRows = parseStored(legacyTab())
    const pRows = parseStored(hubDb.tables['queue_submissions'])
    expect(pRows.length, 'port rows').toBe(1)
    expect(lRows.length, 'legacy rows').toBe(1)
    expect(pRows).toEqual(lRows)
    const id = hubDb.tables['queue_submissions'][0].submission_id as string
    expect(id.startsWith('qs_'), 'submission_id prefix').toBe(true)

    // The missed-check-in popup for this checkpoint resolves on both sides.
    // Compare over the V2 popups schema (the sheet's submitted_* stamp columns
    // simply don't exist as SQL columns).
    const lPop = legacyEval<Record<string, unknown>[]>("readTable_('Popups')")
    const pPop = hubDb.tables['popups']
    const overKeys = (r: Record<string, unknown>, keys: string[]) =>
      Object.fromEntries(keys.map((k) => [k, r[k] ?? '']))
    const v2Keys = Object.keys(pPop[0]).filter((k) => k !== 'id')
    expect(json(pPop.map((r) => overKeys(r, v2Keys)))).toEqual(
      lPop.map((r) => overKeys(r, v2Keys))
    )
  })

  it('second submission same slot+date updates in place (idempotent)', async () => {
    vi.setSystemTime(new Date(NOW_MS))
    const fx = FX()
    await legacySubmit(PAYLOAD, fx)
    // Second submit on the post-first-submit vm state — no __reset__ this time.
    const legacy2 = (() => {
      try {
        return { ok: legacyEval('submitCheckin(' + JSON.stringify({ ...PAYLOAD, generalNote: 'updated note' }) + ')') }
      } catch (e) {
        return { err: String((e as Error).message || e) }
      }
    })()

    seedHub()
    await portSubmit(PAYLOAD)
    const portId1 = hubDb.tables['queue_submissions'][0].submission_id
    const port2 = await portSubmit({ ...PAYLOAD, generalNote: 'updated note' })
    expectSame(port2, legacy2, 'submit update envelope')

    const lRows = parseStored(legacyTab())
    const pRows = parseStored(hubDb.tables['queue_submissions'])
    expect(lRows.length, 'legacy rows').toBe(1)
    expect(pRows.length, 'port rows').toBe(1)
    expect(pRows).toEqual(lRows)
    // The update keeps the original submission_id rather than minting a new one.
    expect(hubDb.tables['queue_submissions'][0].submission_id, 'same id').toBe(portId1)
  })

  it('a pre-existing row takes the update path; a late submit stamps "late"', async () => {
    vi.setSystemTime(new Date(LATE_MS))
    const existing = {
      submission_id: 'qs_seed1', slot_date: '2026-10-15', slot: '14:00', snapshot_key: '2026-10-15|14:00',
      status: 'submitted', queues_json: JSON.stringify([{ queue: 'Ops QA Gift', agents: 3, status: 'On track', note: '' }]),
      corrections_json: '{}', correction_reason: '', general_note: 'earlier', help_needed: false, help_note: '',
      submitted_by: 'tl@dabdoob.com', submitted_at: '2026-10-15T10:50:00.000Z', updated_by: '', updated_at: '',
    }
    const fx = FX({
      nowMs: LATE_MS,
      data: {
        queue_status_submissions: [
          SUBS_HDR.slice(),
          SUBS_HDR.map((h) => (existing as Record<string, unknown>)[h] ?? ''),
        ],
      },
    })
    const legacy = await legacySubmit({ ...PAYLOAD, helpNeeded: true, helpNote: 'need a hand' }, fx)
    seedHub({ submissions: [{ ...existing }] })
    const port = await portSubmit({ ...PAYLOAD, helpNeeded: true, helpNote: 'need a hand' })
    expectSame(port, legacy, 'submit late envelope')
    expect((legacy as { ok: { status: string } }).ok.status, 'late status').toBe('late')

    const lRows = parseStored(legacyTab())
    const pRows = parseStored(hubDb.tables['queue_submissions'])
    expect(pRows).toEqual(lRows)
    expect(hubDb.tables['queue_submissions'][0].submission_id, 'kept id').toBe('qs_seed1')
    // help mail was logged port-side (legacy MailApp is a no-op stub).
    expect((hubDb.tables['mail_log'] || []).length, 'mail logged').toBe(1)
  })

  it('no snapshot rows -> agg_queue_now fallback, snapshot_key stays empty', async () => {
    vi.setSystemTime(new Date(NOW_MS))
    const fx = FX({
      data: {},
    })
    ;(fx.spreadsheets as Record<string, Record<string, unknown[][]>>).live_ss.agg_snapshots_today = [SNAPSHOT_HDR.slice()]
    const legacy = await legacySubmit(PAYLOAD, fx)
    seedHub()
    hubDb.tables['agg_snapshots_today'] = []
    const port = await portSubmit(PAYLOAD)
    expectSame(port, legacy, 'submit fallback envelope')
    const lRows = parseStored(legacyTab())
    const pRows = parseStored(hubDb.tables['queue_submissions'])
    expect(pRows).toEqual(lRows)
  })

  it('validation + window errors match the oracle', async () => {
    vi.setSystemTime(new Date(NOW_MS))
    const cases: [string, Record<string, unknown>, number][] = [
      ['unknown slot', { ...PAYLOAD, slot: '12:00' }, NOW_MS],
      ['not open yet', PAYLOAD, EARLY_MS],
      ['correction without reason', { ...PAYLOAD, queues: [{ queue: 'Ops QA Gift', agents: 5, status: 'On track', openCorrected: 3 }] }, NOW_MS],
      ['help without note', { ...PAYLOAD, helpNeeded: true }, NOW_MS],
    ]
    for (const [label, payload, ms] of cases) {
      vi.setSystemTime(new Date(ms))
      const legacy = await legacySubmit(payload, FX({ nowMs: ms }))
      seedHub()
      const port = await portSubmit(payload)
      expectSame(port, legacy, 'submit err: ' + label)
      expect(port.err !== undefined || (port as { ok?: unknown }).ok !== undefined, label).toBe(true)
      expect(hubDb.tables['queue_submissions'].length, 'no row written: ' + label).toBe(0)
    }
  })

  it('T-suffixed stored slot_date takes the update path (no duplicate append)', async () => {
    seedHub({
      submissions: [
        {
          submission_id: 'qs_seedT',
          slot_date: '2026-10-15T08:00',
          slot: '14:00',
          snapshot_key: '2026-10-15|14:00',
          status: 'submitted',
          queues_json: '[]',
          corrections_json: '{}',
          correction_reason: '',
          general_note: '',
          help_needed: false,
          help_note: '',
          submitted_by: 'tl@dabdoob.com',
          submitted_at: '2026-10-15T10:50:00Z',
          updated_by: '',
          updated_at: '',
        },
      ],
    })
    await submitQueueCheckin(
      {
        slot_date: '2026-10-15',
        slot: '14:00',
        status: 'submitted',
        queues_json: [{ queue: 'Ops QA Gift', agents: 5, status: 'On track' }],
      },
      'tl@dabdoob.com'
    )
    expect(hubDb.tables['queue_submissions']).toHaveLength(1)
    expect(hubDb.tables['queue_submissions'][0].submission_id).toBe('qs_seedT')
  })
})
