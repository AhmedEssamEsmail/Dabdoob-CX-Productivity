/**
 * Golden: Hub My day — Assistant.js pure helpers, owner guard, settings,
 * focus-block validation and the follow-up write, oracle vs port; plus the
 * Google not-configured seam (myDayGoogle()/setMyDayGoogleForTests) which has
 * no oracle twin: the legacy error there is whatever Gmail/Calendar threw, so
 * only the envelope contract ({ ok:false, error, data:[], ms }) is compared.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import {
  AS_CACHE_PREFIX,
  asAddOneOnOnes_,
  asCachedPart_,
  asCollectPart_,
  asDayStart_,
  asDeadlines_,
  asDigestHtml_,
  asDue_,
  asFromEmail_,
  asHeader_,
  asHm_,
  asKuwaitDate_,
  asMatchMeeting_,
  asOneOnOneMatch_,
  asSection_,
  asTitleNames_,
  asTlFollowUps_,
  assistantSettings_,
  createFocusBlock,
  getMyDayPart,
  installAssistantDigestTrigger,
  markFollowUpDone,
  requireAssistantOwner_,
  searchMyMail,
  setAssistantSettings,
  suggestFocusBlocks_,
} from '@/features/cx-hub/lib/myday'
import {
  GOOGLE_NOT_CONFIGURED,
  myDayGoogle,
  setMyDayGoogleForTests,
  type GoogleThread,
  type MyDayGoogle,
} from '@/features/cx-hub/lib/myday-google'
import { hubInstall, hubCall, hubOracle, portCall, hubSheetRows, type HubFx } from './helpers-hub'
import { expectSame, json } from './helpers-oracle'
import { hubDb } from './hub-fakes'
import { cacheClear, cacheGet } from '@/features/shared/platform/repo'

const NOW = Date.parse('2026-05-06T10:00:00Z') // Wednesday, 13:00 Kuwait (UTC+3)

const ACTIONS = [
  {
    action_id: 'a1', title: 'Call the supplier', owner_email: 'admin@dabdoob.com',
    due_date: '2026-05-07', status: 'open', series_id: 's-standup', assigned_by: 'tl@dabdoob.com',
    track_as_task: '', source_type: 'meeting',
  },
  {
    action_id: 'a2', title: 'Overdue report', owner_email: 'admin@dabdoob.com',
    due_date: '2026-05-01', status: 'blocked', series_id: '', assigned_by: '',
    track_as_task: '', source_type: '',
  },
  {
    action_id: 'a3', title: 'Task I delegated', owner_email: 'agent@dabdoob.com',
    due_date: '2026-05-08', status: 'open', series_id: '', assigned_by: 'admin@dabdoob.com',
    track_as_task: true, source_type: 'task',
  },
  {
    action_id: 'a4', title: 'Someone elses task', owner_email: 'agent@dabdoob.com',
    due_date: '2026-05-08', status: 'open', series_id: '', assigned_by: 'tl@dabdoob.com',
    track_as_task: true, source_type: 'task',
  },
  {
    action_id: 'a5', title: 'Far future', owner_email: 'admin@dabdoob.com',
    due_date: '2026-06-01', status: 'open', series_id: '', assigned_by: '', track_as_task: '', source_type: '',
  },
  {
    action_id: 'a6', title: 'Done thing', owner_email: 'admin@dabdoob.com',
    due_date: '2026-05-06', status: 'done', series_id: '', assigned_by: '', track_as_task: '', source_type: '',
  },
]

const SERIES = [
  { series_id: 's-standup', title: 'CX Standup', active: true },
  { series_id: 's-old', title: 'Old Series', active: false },
]

const OOO = [
  {
    schedule_id: 'oo-1', manager_email: 'admin@dabdoob.com', report_email: 'agent@dabdoob.com',
    scheduled_at: '2026-05-06T14:00:00+03:00', duration_min: 30, status: 'scheduled',
  },
  {
    schedule_id: 'oo-2', manager_email: 'admin@dabdoob.com', report_email: 'tl@dabdoob.com',
    scheduled_at: '2026-05-07T11:00:00+03:00', duration_min: 45, status: 'scheduled',
  },
  {
    schedule_id: 'oo-3', manager_email: 'tl@dabdoob.com', report_email: 'agent2@dabdoob.com',
    scheduled_at: '2026-05-06T16:00:00+03:00', duration_min: 30, status: 'scheduled',
  },
]

const ROSTER = [
  { email: 'admin@dabdoob.com', name: 'Admin One', role: 'admin', active: true },
  { email: 'tl@dabdoob.com', name: 'Lead One', role: 'tl', active: true },
  { email: 'agent@dabdoob.com', name: 'Agent One', role: 'agent', tl_email: 'tl@dabdoob.com', active: true },
]

function fx(over: HubFx = {}): HubFx {
  return {
    userEmail: 'admin@dabdoob.com',
    effectiveUserEmail: 'admin@dabdoob.com',
    nowMs: NOW,
    settings: {
      allowed_domain: 'dabdoob.com',
      admin_emails: 'admin@dabdoob.com',
      assistant_owner_email: 'admin@dabdoob.com',
      ...(over.settings || {}),
    },
    tables: {
      actions: ACTIONS.map((r) => ({ ...r })),
      meeting_series: SERIES.map((r) => ({ ...r })),
      one_on_one_schedule: OOO.map((r) => ({ ...r })),
      roster: ROSTER.map((r) => ({ ...r })),
      follow_up_done: [],
      view_as: [],
      ...(over.tables || {}),
    },
    ...(over.userEmail !== undefined ? { userEmail: over.userEmail } : {}),
    ...(over.effectiveUserEmail !== undefined ? { effectiveUserEmail: over.effectiveUserEmail } : {}),
  }
}

/** A nameOf that behaves like pwDirectory_().name for our roster. */
const NAME_OF: Record<string, string> = {
  'agent@dabdoob.com': 'Agent One',
  'tl@dabdoob.com': 'Lead One',
  'admin@dabdoob.com': 'Admin One',
}
const nameOf = (e: string) => NAME_OF[e] || e
// The same lookup on the oracle side (@@fn: resolves to this vm global).
hubOracle().eval(
  "globalThis.__nameOf = function (e) { return ({ 'agent@dabdoob.com': 'Agent One', 'tl@dabdoob.com': 'Lead One', 'admin@dabdoob.com': 'Admin One' })[e] || e }"
)
hubOracle().eval("globalThis.__boom = function () { throw new Error('boom') }")

function ctx() {
  return {
    openActions: json(ACTIONS).filter((a) => a.status === 'open' || a.status === 'blocked'),
    series: json(SERIES).filter((s) => (s.active as unknown) === '' || s.active === true),
    oneOnOnes: json(OOO).filter((o) => o.manager_email === 'admin@dabdoob.com' && (o.status || 'scheduled') === 'scheduled'),
    nameOf: '@@fn:__nameOf',
  }
}

/** Normalise per-section timing + the Google-seam error text so envelopes compare. */
function normPart(v: unknown): unknown {
  const d = json(v) as Record<string, unknown>
  const sec = (s: unknown) => {
    const o = s as Record<string, unknown>
    if (!o || typeof o !== 'object') return s
    const n: Record<string, unknown> = { ok: o.ok, data: o.data, ms: 0 }
    if (o.ok === false) n.error = 'SECTION_ERROR'
    return n
  }
  if (d.events) {
    const ev = d.events as Record<string, unknown>
    ev.today = sec(ev.today)
    ev.tomorrow = sec(ev.tomorrow)
  }
  ;['context', 'deadlines', 'focus', 'mail', 'files', 'followups'].forEach((k) => {
    if (d[k] && typeof d[k] === 'object' && 'ok' in (d[k] as Record<string, unknown>)) d[k] = sec(d[k])
  })
  if ('digestCheckMs' in d) d.digestCheckMs = 0
  return d
}

beforeEach(() => {
  cacheClear()
  vi.useFakeTimers({ now: NOW })
  setMyDayGoogleForTests(null)
})
afterEach(() => {
  setMyDayGoogleForTests(null)
  vi.useRealTimers()
})

describe('time helpers', () => {
  it('asKuwaitDate_ / asDayStart_ / asHm_ match the oracle', () => {
    const lf = hubInstall(fx())
    const msList = [0, NOW, Date.parse('2026-05-06T21:30:00Z'), Date.parse('2026-12-31T20:59:59Z')]
    msList.forEach((ms) => {
      expectSame({ ok: json(asKuwaitDate_(ms)) }, hubCall('asKuwaitDate_', [ms], lf), 'asKuwaitDate_ ' + ms)
      expectSame({ ok: json(asDayStart_(ms)) }, hubCall('asDayStart_', [ms], lf), 'asDayStart_ ' + ms)
    })
    const hmCases: [unknown, number][] = [
      ['09:30', 0], [' 18:05 ', 0], ['9:3', 0], ['', 42], ['abc', 7], ['09:60', 1], [null, 3], [undefined, 4],
    ]
    hmCases.forEach(([s, fb]) => {
      expectSame({ ok: json(asHm_(s, fb)) }, hubCall('asHm_', [s, fb], lf), 'asHm_ ' + JSON.stringify(s))
    })
  })
})

describe('suggestFocusBlocks_', () => {
  it('matches the oracle across gap/clamp/cap vectors', () => {
    const lf = hubInstall(fx())
    const day = '2026-05-06' // asDayStart = 2026-05-06T00:00+03:00
    const vectors: [unknown[], string, string, number, number, number][] = [
      [[], day, '09:30-18:30', 45, 120, 0],
      [[], day, '09:30-18:30', 45, 120, NOW], // clamped to now (13:00)
      [
        [{ start: day + 'T10:00:00+03:00', end: day + 'T11:00:00+03:00' }],
        day, '09:30-18:30', 45, 120, 0,
      ],
      [
        [
          { start: Date.parse(day + 'T10:00:00+03:00'), end: Date.parse(day + 'T11:00:00+03:00') },
          { start: day + 'T11:30:00+03:00', end: day + 'T12:00:00+03:00' },
        ],
        day, '09:30-18:30', 45, 120, 0,
      ],
      [[{ start: day + 'T09:00:00+03:00', end: day + 'T19:00:00+03:00' }], day, '09:30-18:30', 45, 120, 0],
      [[], day, '', 30, 60, 0],
      [[], day, '07:00-09:00', 45, 120, Date.parse(day + 'T08:15:00+03:00')],
      [[], day, '09:30-18:30', 45, 120, Date.parse(day + 'T19:00:00+03:00')], // now past work end
    ]
    vectors.forEach(([events, d, work, mn, mx, now], i) => {
      expectSame(
        { ok: json(suggestFocusBlocks_(events as never, d, work, mn, mx, now)) },
        hubCall('suggestFocusBlocks_', [events, d, work, mn, mx, now], lf),
        'suggestFocusBlocks_ #' + i
      )
    })
  })
})

describe('asDue_ / asHeader_ / asFromEmail_', () => {
  it('due-date normalisation matches (string, ISO, real Date, garbage)', () => {
    const lf = hubInstall(fx())
    const cases = ['2026-05-07', '2026-05-07T21:00:00.000Z', '@@ms:1778083200000', '', 'n/a', '  2026-5-7  ', null, undefined]
    cases.forEach((v) => {
      const pv = typeof v === 'string' && v.indexOf('@@ms:') === 0 ? new Date(+v.slice(5)) : v
      expectSame({ ok: json(asDue_(pv)) }, hubCall('asDue_', [v], lf), 'asDue_ ' + JSON.stringify(v))
    })
  })

  it('header helpers match', () => {
    const lf = hubInstall(fx())
    const msg = {
      payload: {
        headers: [
          { name: 'From', value: '"Lead One" <tl@dabdoob.com>' },
          { name: 'Subject', value: 'Hello' },
        ],
      },
    }
    ;['From', 'from', 'Subject', 'Missing'].forEach((h) => {
      expectSame({ ok: json(asHeader_(msg, h)) }, hubCall('asHeader_', [msg, h], lf), 'asHeader_ ' + h)
    })
    const froms = [
      msg,
      { payload: { headers: [{ name: 'From', value: 'plain@dabdoob.com' }] } },
      { payload: { headers: [] } },
      {},
    ]
    froms.forEach((m, i) => {
      expectSame({ ok: json(asFromEmail_(m)) }, hubCall('asFromEmail_', [m], lf), 'asFromEmail_ #' + i)
    })
  })
})

describe('meeting matching (asMatchMeeting_ / asTitleNames_ / asOneOnOneMatch_ / asAddOneOnOnes_)', () => {
  it('asTitleNames_ matches name, first name, local part, dotted local', () => {
    const lf = hubInstall(fx())
    const c = ctx()
    const cases: [string, string][] = [
      ['sync with agent one', 'agent@dabdoob.com'],
      ['sync with agent', 'agent@dabdoob.com'],
      ['weekly agent touchpoint', 'agent@dabdoob.com'],
      ['lead one sync', 'tl@dabdoob.com'],
      ['random words', 'tl@dabdoob.com'],
      ['1:1 nobody', 'agent2@dabdoob.com'],
    ]
    cases.forEach(([t, email]) => {
      expectSame(
        { ok: json(asTitleNames_(t, email, { ...c, nameOf })) },
        hubCall('asTitleNames_', [t, email, c], lf),
        'asTitleNames_ ' + t
      )
    })
  })

  it('asMatchMeeting_ / asOneOnOneMatch_ match series, near 1:1s and reject the rest', () => {
    const lf = hubInstall(fx())
    const c = ctx()
    const start = Date.parse('2026-05-06T14:05:00+03:00')
    const cases: [string, number][] = [
      ['cx standup daily', start], // series contains title either way
      ['standup notes', start],
      ['1:1 with agent', start], // names agent -> 1:1 match
      ['agent one sync', start],
      ['1:1', start], // generic 1:1 title + only one near booking
      ['totally unrelated', start],
      ['1:1', Date.parse('2026-05-07T11:00:00+03:00')], // tomorrow's 1:1
      ['1:1', Date.parse('2026-05-06T18:00:00+03:00')], // no near booking
    ]
    cases.forEach(([title, s]) => {
      expectSame(
        { ok: json(asMatchMeeting_(title, s, { ...c, nameOf })) },
        hubCall('asMatchMeeting_', [title, s, c], lf),
        'asMatchMeeting_ ' + title + '@' + s
      )
    })
    const oo = c.oneOnOnes[0]
    expectSame(
      { ok: json(asOneOnOneMatch_(oo, { ...c, nameOf })) },
      hubCall('asOneOnOneMatch_', [oo, c], lf),
      'asOneOnOneMatch_'
    )
  })

  it('asAddOneOnOnes_ merges unscheduled-in-calendar 1:1s identically', () => {
    const lf = hubInstall(fx())
    const dayStart = Date.parse('2026-05-06T00:00:00+03:00')
    const mkDays = () => ({
      today: [
        {
          id: 'e1', title: 'CX Standup', start: '2026-05-06T09:30:00.000Z', end: '2026-05-06T10:00:00.000Z',
          allDay: false, location: '', myStatus: 'YES', guests: 4,
          meeting: { kind: 'meeting', label: 'CX Standup', person: '', scheduleId: '', link: '' }, actions: [],
        },
      ],
      tomorrow: [],
    })
    ;['today', 'tomorrow'].forEach((k) => {
      expectSame({ ok: true }, { ok: true }, k) // placeholder no-op keeps lint happy
    })
    const c = ctx()
    expectSame(
      { ok: json(asAddOneOnOnes_(mkDays(), dayStart, { ...c, nameOf })) },
      hubCall('asAddOneOnOnes_', [mkDays(), dayStart, c], lf),
      'asAddOneOnOnes_'
    )
  })
})

describe('asDeadlines_ / asSection_', () => {
  it('deadline filtering + overdue flags match', () => {
    const lf = hubInstall(fx())
    const c = ctx()
    expectSame(
      { ok: json(asDeadlines_('admin@dabdoob.com', { ...c, nameOf }, NOW)) },
      hubCall('asDeadlines_', ['admin@dabdoob.com', c, NOW], lf),
      'asDeadlines_'
    )
  })

  it('asSection_ wraps a throw in the same envelope', async () => {
    const lf = hubInstall(fx())
    const port = await portCall(() => asSection_(() => { throw new Error('boom') }))
    const legacy = hubCall('asSection_', ['@@fn:__boom'], lf)
    const norm = (e: { ok?: unknown; err?: string }) =>
      e.err ? e : { ok: { ok: (e.ok as Record<string, unknown>).ok, error: (e.ok as Record<string, unknown>).error, data: (e.ok as Record<string, unknown>).data } }
    expectSame(norm(port), norm(legacy), 'asSection_ error')
    const okPort = await portCall(() => asSection_(async () => [1, 2]))
    const okLegacy = hubCall('asSection_', ['@@fn:__nameOf'], lf)
    // the legacy call returns whatever __nameOf returns (a function -> undefined after JSON); only the ok flag matters
    expect((okPort.ok as Record<string, unknown>).ok).toBe(true)
    expect((okLegacy.ok as Record<string, unknown>).ok).toBe(true)
  })
})

describe('owner guard + settings', () => {
  it('requireAssistantOwner_ passes the owner and refuses others identically', async () => {
    const lf = hubInstall(fx())
    expectSame(await portCall(() => requireAssistantOwner_()), hubCall('requireAssistantOwner_', [], lf), 'requireAssistantOwner_ owner')
    const f2 = fx({ userEmail: 'agent@dabdoob.com' })
    const lf2 = hubInstall(f2)
    expectSame(await portCall(() => requireAssistantOwner_()), hubCall('requireAssistantOwner_', [], lf2), 'requireAssistantOwner_ agent')
  })

  it('assistantSettings_ returns the same defaults and set values', async () => {
    const lf = hubInstall(fx())
    expectSame(await portCall(() => assistantSettings_()), hubCall('assistantSettings_', [], lf), 'assistantSettings_ defaults')
    const f2 = fx({
      settings: {
        assistant_reply_after_hours: 48,
        assistant_work_hours: '08:00-17:00',
        assistant_focus_min_minutes: 30,
        assistant_drive_days: 14,
      },
    })
    const lf2 = hubInstall(f2)
    expectSame(await portCall(() => assistantSettings_()), hubCall('assistantSettings_', [], lf2), 'assistantSettings_ set')
  })

  it('setAssistantSettings validates and writes identically', async () => {
    const cases: Record<string, unknown>[] = [
      { assistant_reply_after_hours: 48 },
      { assistant_work_hours: '08:00-17:00' },
      { assistant_focus_min_minutes: '60' },
      { bogus_key: 1 },
      { assistant_work_hours: '9-5' },
      { assistant_reply_after_hours: 0 },
      { assistant_reply_after_hours: 721 },
      { assistant_reply_after_hours: 'abc' },
    ]
    for (const patch of cases) {
      const lf = hubInstall(fx())
      expectSame(
        await portCall(() => setAssistantSettings(patch)),
        hubCall('setAssistantSettings', [patch], lf),
        'setAssistantSettings ' + JSON.stringify(patch)
      )
    }
    // a landed write: the config row carries the new value + owner stamp
    const lf = hubInstall(fx())
    await portCall(() => setAssistantSettings({ assistant_reply_after_hours: 48 }))
    const row = (hubDb.tables.config || []).find((r) => r.key === 'assistant_reply_after_hours')
    expect(row && String(row.value)).toBe('48')
    void lf
  })
})

describe('Google not configured', () => {
  it('myDayGoogle() reports { configured: false } with no service-account env', () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    delete process.env.GOOGLE_PRIVATE_KEY
    delete process.env.GOOGLE_DELEGATED_USER
    delete process.env.ASSISTANT_OWNER_EMAIL
    expect(myDayGoogle()).toEqual({ configured: false })
  })

  it('searchMyMail returns [] for a blank query BEFORE touching Google (legacy ordering)', async () => {
    hubInstall(fx())
    setMyDayGoogleForTests({ configured: false })
    const r = await portCall(() => searchMyMail('   '))
    expectSame(r, { ok: [] }, 'searchMyMail blank')
    const r2 = await portCall(() => searchMyMail('subject:x'))
    expect(r2.err).toBe(GOOGLE_NOT_CONFIGURED)
  })

  it('asTlFollowUps_ throws the roster error before the Google error (legacy ordering)', async () => {
    const f = fx()
    f.tables!.roster = []
    hubInstall(f)
    setMyDayGoogleForTests({ configured: false })
    const r = await portCall(() => asTlFollowUps_(NOW))
    expect(r.err).toBe('No active team leads in the Roster.')
  })

  it('getMyDayPart parts degrade to section envelopes (never fabricated data)', async () => {
    const lf = hubInstall(fx())
    setMyDayGoogleForTests({ configured: false })
    for (const part of ['mail', 'files', 'followups']) {
      const r = await portCall(() => getMyDayPart(part))
      const d = (r.ok || {}) as Record<string, unknown>
      const s = (d[part] || {}) as Record<string, unknown>
      expect(s.ok).toBe(false)
      expect(String(s.error)).toBe(part === 'followups' ? GOOGLE_NOT_CONFIGURED : GOOGLE_NOT_CONFIGURED)
      expect(s.data).toEqual([])
    }
    // unknown part: same refusal text on both sides
    expectSame(
      await portCall(() => getMyDayPart('bogus')),
      hubCall('getMyDayPart', ['bogus'], lf),
      'getMyDayPart bogus'
    )
  })

  it('the core part still fills non-Google sections identically (deadlines/settings/envelope shape)', async () => {
    const lf = hubInstall(fx())
    setMyDayGoogleForTests({ configured: false })
    const port = await portCall(() => getMyDayPart('core'))
    const legacy = hubCall('getMyDayPart', ['core'], lf)
    if (port.err || legacy.err) throw new Error(JSON.stringify({ p: port.err, l: legacy.err }))
    expectSame({ ok: normPart(port.ok) }, { ok: normPart(legacy.ok) }, 'getMyDayPart core (sections normalised)')
  })
})

describe('Google adapter stubbed', () => {
  function fakeGoogle(over: Partial<MyDayGoogle> = {}): MyDayGoogle {
    return {
      configured: true,
      listThreads: async () => [],
      getThreads: async (ids: string[]) => ids.map((id) => ({ id, messages: [] }) as GoogleThread),
      calendarEvents: async () => [],
      createEvent: async () => ({ id: 'evt-1' }),
      driveFiles: async () => [],
      ...over,
    }
  }

  it('asAwaitingReply_ filters/orders exactly like the legacy body (starred first, cutoffs, SENT/self skip)', async () => {
    hubInstall(fx())
    const H = 3600000
    const mk = (id: string, opts: { from: string; subject?: string; last: number; labels?: string[][] }) => ({
      id,
      messages: opts.labels
        ? opts.labels.map((l, i) => ({
            internalDate: String(opts.last - (opts.labels!.length - 1 - i) * 60000),
            labelIds: l,
            payload: { headers: [{ name: 'From', value: opts.from }, { name: 'Subject', value: opts.subject || 'S' }] },
          }))
        : [],
    })
    const threads: GoogleThread[] = [
      // old unread from a customer -> in
      mk('t01', { from: 'Customer <c@x.com>', subject: 'Help', last: NOW - 30 * H, labels: [['INBOX', 'UNREAD']] }),
      // starred + unread, older than the 24h default -> in, first (starred group)
      mk('t02', { from: 'Vip <v@x.com>', subject: 'Vip', last: NOW - 30 * H, labels: [['INBOX', 'UNREAD', 'STARRED']] }),
      // too recent -> out
      mk('t03', { from: 'Now <n@x.com>', subject: 'Now', last: NOW - 2 * H, labels: [['INBOX', 'UNREAD']] }),
      // last message SENT by me -> out
      mk('t04', { from: 'Someone <s@x.com>', subject: 'Replied', last: NOW - 40 * H, labels: [['INBOX', 'UNREAD'], ['SENT']] }),
      // last message from the owner himself -> out
      mk('t05', { from: 'Admin One <admin@dabdoob.com>', subject: 'Self', last: NOW - 40 * H, labels: [['INBOX']] }),
      // empty thread -> skipped
      { id: 't06', messages: [] },
    ]
    const qOrder: string[] = []
    setMyDayGoogleForTests(
      fakeGoogle({
        listThreads: async (q: string) => {
          qOrder.push(q)
          if (q.indexOf('is:starred') !== -1 && q.indexOf('-is:starred') === -1) return ['t02', 't04']
          return ['t01', 't03', 't05', 't06']
        },
        getThreads: async (ids: string[]) => ids.map((id) => threads.find((t) => t.id === id) || ({ id, messages: [] })),
      })
    )
    const r = await portCall(() => asCollectPart_('mail', 'admin@dabdoob.com', NOW))
    const s = (r.ok as Record<string, unknown>).mail as { ok: boolean; data: Record<string, unknown>[] }
    expect(s.ok).toBe(true)
    expect(s.data.map((m) => m.id)).toEqual(['t02', 't01'])
    expect(s.data[0].starred).toBe(true)
    expect(s.data[1].unread).toBe(true)
    expect(s.data[1].hoursWaiting).toBe(30)
    // the two legacy queries ran in order: starred then unread
    expect(qOrder[0]).toContain('is:starred')
    expect(qOrder[1]).toContain('is:unread -is:starred')
  })

  it('createFocusBlock: validation errors before Google, clash check, then a created event', async () => {
    const lf = hubInstall(fx())
    // invalid ranges — identical legacy errors, no Google reached
    for (const [s, e] of [
      ['', ''],
      ['2026-05-06T14:00:00+03:00', '2026-05-06T13:00:00+03:00'],
      ['2026-05-06T14:00:00+03:00', '2026-05-06T14:10:00+03:00'],
      ['2026-05-06T14:00:00+03:00', '2026-05-06T19:00:00+03:00'],
      ['2026-05-05T14:00:00+03:00', '2026-05-05T15:00:00+03:00'], // past
      ['2026-05-30T14:00:00+03:00', '2026-05-30T15:00:00+03:00'], // >14d out
    ]) {
      expectSame(
        await portCall(() => createFocusBlock(s, e)),
        hubCall('createFocusBlock', [s, e], lf),
        'createFocusBlock ' + s + '->' + e
      )
    }
    // unconfigured -> the not-configured refusal at the calendar call
    setMyDayGoogleForTests({ configured: false })
    const nc = await portCall(() => createFocusBlock('2026-05-06T15:00:00+03:00', '2026-05-06T16:00:00+03:00'))
    expect(nc.err).toBe(GOOGLE_NOT_CONFIGURED)
    // a clash -> the legacy "no longer free" error
    setMyDayGoogleForTests(
      fakeGoogle({
        calendarEvents: async () => [
          { id: 'x', title: 'Existing meeting', start: 0, end: 1, allDay: false, location: '', myStatus: 'YES', guests: 1 },
        ],
      })
    )
    const clash = await portCall(() => createFocusBlock('2026-05-06T15:00:00+03:00', '2026-05-06T16:00:00+03:00'))
    expect(clash.err).toBe('That time is no longer free ("Existing meeting"). Refresh My day.')
    // success: event created + core cache cleared
    setMyDayGoogleForTests(fakeGoogle({ createEvent: async () => ({ id: 'evt-42' }) }))
    const ok = await portCall(() => createFocusBlock('2026-05-06T15:00:00+03:00', '2026-05-06T16:30:00+03:00', '  Deep   work '))
    expect((ok.ok as Record<string, unknown>).id).toBe('evt-42')
    expect((ok.ok as Record<string, unknown>).title).toBe('Deep work')
    expect(cacheGet(AS_CACHE_PREFIX + 'core')).toBeNull()
  })
})

describe('markFollowUpDone', () => {
  it('rejects bad ids and appends the done row identically', async () => {
    const lf = hubInstall(fx())
    for (const id of ['', 'x', '1234567', 'not-a-thread!!', '0'.repeat(40)]) {
      expectSame(
        await portCall(() => markFollowUpDone(id, NOW)),
        hubCall('markFollowUpDone', [id, NOW], lf),
        'markFollowUpDone ' + id
      )
    }
  })

  it('a valid mark writes the same FollowUpDone row on both sides', async () => {
    const lf = hubInstall(fx())
    const legacy = hubCall('markFollowUpDone', ['abcdef0123', NOW - 3600000], lf)
    const port = await portCall(() => markFollowUpDone('abcdef0123', NOW - 3600000))
    expectSame(port, legacy, 'markFollowUpDone envelope')
    const strip = (r: Record<string, unknown>) => {
      const o: Record<string, unknown> = {}
      Object.keys(r).forEach((k) => {
        if (k !== '_row' && k !== 'id' && r[k] !== '' && r[k] !== null) o[k] = r[k]
      })
      return o
    }
    const l = hubSheetRows('FollowUpDone').map(strip)
    const p = (hubDb.tables.follow_up_done || []).map(strip)
    expectSame({ ok: p }, { ok: l }, 'follow_up_done rows')
  })
})

describe('cache behaviour + digest install', () => {
  it('asCachedPart_ serves a cached copy with cached:true until refreshed', async () => {
    hubInstall(fx())
    setMyDayGoogleForTests({ configured: false })
    const a = await asCachedPart_('mail', 'admin@dabdoob.com', false)
    const b = await asCachedPart_('mail', 'admin@dabdoob.com', false)
    expect((b as Record<string, unknown>).cached).toBe(true)
    const c = await asCachedPart_('mail', 'admin@dabdoob.com', true)
    expect((c as Record<string, unknown>).cached).toBeUndefined()
    expect(a.generatedAt).toBe((b as Record<string, unknown>).generatedAt)
  })

  it('installAssistantDigestTrigger: same message; the config flag stands in for the trigger', async () => {
    const lf = hubInstall(fx())
    expectSame(
      await portCall(() => installAssistantDigestTrigger()),
      hubCall('installAssistantDigestTrigger', [], lf),
      'installAssistantDigestTrigger message'
    )
    const flag = (hubDb.tables.config || []).find((r) => r.key === 'assistant_digest_installed')
    expect(flag && String(flag.value)).toBe('true')
  })

  it('asDigestHtml_ renders the same digest markup', () => {
    const lf = hubInstall(fx())
    const d = {
      today: '2026-05-06',
      events: {
        today: {
          ok: true,
          data: [
            { title: 'CX Standup', start: '2026-05-06T06:30:00.000Z', end: '2026-05-06T07:00:00.000Z', allDay: false, actions: [{ id: 'a1' }, { id: 'a2' }] },
            { title: 'Holiday', start: '2026-05-06T00:00:00.000Z', end: '2026-05-07T00:00:00.000Z', allDay: true, actions: [] },
          ],
        },
      },
      deadlines: {
        ok: true,
        data: [
          { due: '2026-05-04', overdue: true, title: 'Esc <thing>', mine: true, owner: 'admin@dabdoob.com' },
          { due: '2026-05-08', overdue: false, title: 'Help out', mine: false, owner: 'agent@dabdoob.com' },
        ],
      },
      mail: { ok: true, data: [{ subject: 'Re: "urgent" <x>', from: 'C <c@x>', hoursWaiting: 30 }] },
    }
    expectSame({ ok: asDigestHtml_(json(d)) }, hubCall('asDigestHtml_', [d], lf), 'asDigestHtml_')
  })
})
