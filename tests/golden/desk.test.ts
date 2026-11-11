/**
 * Golden: Desk — MailDesk.js, TlPerformance.js, KpiLogs.js (Desk_deprecated)
 * against src/features/cx-desk/lib/{maildesk,tlperformance,kpilogs}.ts, same
 * fixtures on both sides (desk-fakes): the legacy files run verbatim in the
 * oracle; the ports run against hub-fakes + the Gmail read-adapter seam.
 *
 * Deterministic time: NOW is frozen inside the vm (fixtures.nowMs) and on the
 * port (vi fake timers); newId_ ids match because both sides run Math.random
 * pinned to the same constant.
 *
 * Storage seams the tests document rather than hide:
 *  - '' vs null: the port writes null where the sheet stored '' (removed_at,
 *    resolved_at, done_at, cleared otd values). Object-layer compares show the
 *    raw diff first, then compare with null->'' normalization.
 *  - pwTxt_ "'2026-10": the legacy ' text marker lives in the sheet CELL; the
 *    port stores the plain value in Postgres (no formula concern). Compared
 *    after stripping a leading ' on legacy cells.
 *  - Health heartbeats: jobMailDesk on GAS always beats into the Health tab
 *    (hbRun_); the port wraps the same way since the WP-15 fix — the job test
 *    asserts the 'ok' row on both sides.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import {
  mdAddr_,
  mdAddrList_,
  mdKind_,
  mdSlaFlags_,
  mdSlaRecords_,
  mdMergeSla_,
  mdParseApprovalSubject_,
  mdDecisionBody_,
  mdHeaderValue_,
  mdReplyMime_,
  mdReplyAddresses_,
  mdBool_,
  tlsShifts_,
  tlsOnQueue_,
  tlsMailDue_,
  mdThreads_,
  mdSyncSla_,
  mdSyncApprovals_,
  jobMailDesk,
  mailDeskPage,
  mailDeskRefresh,
  mailApprovalDecide,
  mailApprovalReset,
  type MdMsg,
  type MdSlaCtx,
  type TlShift,
} from '@/features/cx-desk/lib/maildesk'
import {
  tlpWeek_,
  tlpOverall_,
  tlpMean_,
  tlpLabel_,
  tlpCheckValue_,
  tlpByName_,
  tlpKbMetrics_,
  tlpAreasFor_,
  tlPerformancePage,
  tlpRateArea,
  tlpRateProject,
  kbTrackerPage,
  kbTrackerSave,
  otdSave,
  setupDesk,
  installDeskTriggers,
} from '@/features/cx-desk/lib/tlperformance'
import { kpiLogsPage, kpiLogSave, kpiLogRemove } from '@/features/cx-desk/lib/kpilogs'
import { normEmail } from '@/features/shared/platform/identity'
import { hubDb } from './hub-fakes'
import {
  deskInstall,
  deskCall,
  deskSame,
  deskStore,
  deskTable,
  deskSheetCells,
  deskProps,
  deskOracle,
  portCall,
  normLegacyBrand,
  type DeskFx,
} from './desk-fakes'
import { expectSame, json } from './helpers-oracle'

// ---------------------------------------------------------------- shared fixtures

const NOW = Date.parse('2026-10-08T09:00:00Z') // Thu 2026-10-08 12:00 Kuwait; CX week started Sun 2026-10-04
const H = 3600000
const KW = (d: string, hhmm: string) => Date.parse(d + 'T' + hhmm + ':00+03:00') // Kuwait wall clock -> ms
const ISO = (ms: number) => new Date(ms).toISOString()

const ROSTER = [
  { email: 'admin@dabdoob.com', name: 'Admin Person', role: 'admin', tl_email: '', active: true },
  { email: 'k.elnaggar@dabdoob.com', name: 'Karim Elnaggar', role: 'admin', tl_email: '', active: true }, // approver; also admin via roster
  { email: 'noha@dabdoob.com', name: 'Noha Hassan Foaad Qandil', role: 'tl', tl_email: '', active: true },
  { email: 'menna@dabdoob.com', name: 'Menna Mekawy', role: 'tl', tl_email: '', active: true },
  { email: 'esmail@dabdoob.com', name: 'Ahmed Essam Ismail Ali', role: 'tl', tl_email: '', active: true },
  { email: 'naguib@dabdoob.com', name: 'Ahmed Naguib', role: 'tl', tl_email: '', active: true },
  { email: 'agent@dabdoob.com', name: 'Andy Agent', role: 'agent', tl_email: 'noha@dabdoob.com', active: true },
  { email: 'agent2@dabdoob.com', name: 'Beth Agent', role: 'agent', tl_email: 'menna@dabdoob.com', active: true },
  { email: 'finance@dabdoob.com', name: 'Farah Finance', role: 'agent', tl_email: 'noha@dabdoob.com', active: true },
]

/** The config a normal Desk deployment carries (defaults cover the rest). */
const SETTINGS: Record<string, unknown> = {
  allowed_domain: 'dabdoob.com',
  admin_emails: 'admin@dabdoob.com',
  mail_approver_emails: ['admin@dabdoob.com', 'k.elnaggar@dabdoob.com'],
  mail_sla_our_senders: ['shared-cx@dabdoob.com'],
  mail_approval_dry_run: true,
  tlp_area_sources: { Returns: 'freshdesk', Refunds: 'freshdesk' },
  tlp_tl_areas: {
    'noha@dabdoob.com': ['Refunds', 'Operational loss'],
    'menna@dabdoob.com': ['Knowledge base', 'WBR comments', 'Returns'],
    'esmail@dabdoob.com': ['WBR', 'Daily report', 'OTD', 'Scheduling accuracy'],
    'naguib@dabdoob.com': ['Complaints'],
  },
}

function fx(over: DeskFx = {}): DeskFx {
  const { tables, settings, ...rest } = over
  return {
    userEmail: 'admin@dabdoob.com',
    nowMs: NOW,
    scriptTz: 'Asia/Kuwait',
    settings: { ...SETTINGS, ...(settings || {}) },
    tables: { roster: ROSTER.map((r) => ({ ...r })), ...(tables || {}) },
    ...rest,
  }
}

/** A "job run" fixture: no session; the legacy actor becomes 'system:mail_desk' — the same stamp the port hardcodes for MailDesk writes. */
function jobFx(over: DeskFx = {}): DeskFx {
  return fx({ userEmail: '', effectiveUserEmail: 'mail_desk', ...over })
}

// ---------------------------------------------------------------- store compare

type Row = Record<string, unknown>

/**
 * Drop storage-only keys (port serial id, legacy sheet _row), normalize the
 * null<->'' cell seam, and fill the union of all keys with '' — dqReadObjects_
 * materializes every def header (removed_by/at, ...) while the port writes only
 * the keys it sets, so a missing key means "empty" the same way a '' cell does.
 */
function normRows(...rowSets: Row[][]): { rows: Row[]; sets: Row[][] } {
  const keys: string[] = []
  const norm = (rows: Row[]) =>
    rows.map((r) => {
      const rest = JSON.parse(JSON.stringify(r)) as Row
      delete rest.id
      delete rest._row
      Object.keys(rest).forEach((k) => { if (keys.indexOf(k) === -1) keys.push(k) })
      return rest
    })
  const sets = rowSets.map(norm)
  const out = sets.map((set) =>
    set
      .map((r) => {
        const full: Row = {}
        keys.forEach((k) => {
          const v = r[k]
          full[k] = v === null || v === undefined ? '' : v
        })
        return full
      })
      .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)),
  )
  return { rows: out[0] || [], sets: out }
}

/** Legacy V2-store objects vs the port table rows, key order and storage-only keys removed. */
function expectStoreSame(portTable: string, legacyStore: string, label: string) {
  const { sets } = normRows(hubDb.tables[portTable] || [], deskStore(legacyStore))
  try {
    expect(sets[0]).toEqual(sets[1])
  } catch (e) {
    throw new Error(label + ': ' + (e as Error).message)
  }
}

/** Legacy Core tab objects vs the port table rows. */
function expectTabSame(portTable: string, legacyTab: string, label: string) {
  const { sets } = normRows(hubDb.tables[portTable] || [], deskTable(legacyTab))
  try {
    expect(sets[0]).toEqual(sets[1])
  } catch (e) {
    throw new Error(label + ': ' + (e as Error).message)
  }
}

// ---------------------------------------------------------------- gmail helpers

/** One Gmail API message the way mdThreads_ consumes it (metadata headers + internalDate). */
function gmsg(
  threadId: string,
  id: string,
  ms: number,
  from: string,
  subject: string,
  extra: { to?: string; cc?: string; replyTo?: string; rfcId?: string; snippet?: string } = {},
) {
  const hs = [
    { name: 'From', value: from },
    { name: 'Subject', value: subject },
  ]
  if (extra.to !== undefined) hs.push({ name: 'To', value: extra.to })
  if (extra.cc !== undefined) hs.push({ name: 'Cc', value: extra.cc })
  if (extra.replyTo !== undefined) hs.push({ name: 'Reply-To', value: extra.replyTo })
  if (extra.rfcId !== undefined) hs.push({ name: 'Message-ID', value: extra.rfcId })
  return { id, threadId, internalDate: String(ms), snippet: extra.snippet || 'snippet ' + id, payload: { headers: hs } }
}

/** The tlp_shifts rows behind the mail-SLA fixture (queue-management windows per TL). */
const SHIFTS: Row[] = [
  {
    key: 'noha|2026-10-07', date: '2026-10-07', tl_email: 'noha@dabdoob.com',
    shift_start: KW('2026-10-07', '08:00'), shift_end: KW('2026-10-07', '16:00'),
    queue_json: JSON.stringify([[KW('2026-10-07', '08:00'), KW('2026-10-07', '12:00')], [KW('2026-10-07', '13:00'), KW('2026-10-07', '16:00')]]),
    updated_at: '2026-10-07T05:00:00.000Z',
  },
  {
    key: 'noha|2026-10-08', date: '2026-10-08', tl_email: 'noha@dabdoob.com',
    shift_start: KW('2026-10-08', '08:00'), shift_end: KW('2026-10-08', '16:00'),
    queue_json: JSON.stringify([[KW('2026-10-08', '08:00'), KW('2026-10-08', '12:00')], [KW('2026-10-08', '13:00'), KW('2026-10-08', '16:00')]]),
    updated_at: '2026-10-08T05:00:00.000Z',
  },
  {
    key: 'menna|2026-10-08', date: '2026-10-08', tl_email: 'menna@dabdoob.com',
    shift_start: KW('2026-10-08', '14:00'), shift_end: KW('2026-10-08', '22:00'),
    queue_json: JSON.stringify([[KW('2026-10-08', '14:00'), KW('2026-10-08', '18:00')], [KW('2026-10-08', '19:00'), KW('2026-10-08', '22:00')]]),
    updated_at: '2026-10-08T05:00:00.000Z',
  },
  {
    key: 'noha|2026-10-09', date: '2026-10-09', tl_email: 'noha@dabdoob.com',
    shift_start: KW('2026-10-09', '08:00'), shift_end: KW('2026-10-09', '16:00'),
    queue_json: JSON.stringify([[KW('2026-10-09', '08:00'), KW('2026-10-09', '12:00')]]),
    updated_at: '2026-10-09T05:00:00.000Z',
  },
]

/** The threads the fake Gmail serves (same objects feed the port's read adapter). */
const THREADS = [
  // refund_status: inbound partner mail, one our-reply, then a second inbound still open.
  { id: 't1', messages: [
    gmsg('t1', 't1m1', NOW - 2 * H, 'Noreply <noreply@myfatoorah.com>', 'Refund Status Update — order ORD-100'),
    gmsg('t1', 't1m2', NOW - 90 * 60000, 'Noha Qandil <noha@dabdoob.com>', 'Re: Refund Status Update — order ORD-100'),
    gmsg('t1', 't1m3', NOW - 45 * 60000, 'noreply@myfatoorah.com', 'Re: Refund Status Update — order ORD-100'),
  ]},
  // chargeback: inbound from outside, answered by shared-cx (mail_sla_our_senders, not the expected TL -> covering_missed).
  { id: 't2', messages: [
    gmsg('t2', 't2m1', NOW - 2 * H, 'Disputes <disputes@bank-example.com>', 'Chargeback notification #55'),
    gmsg('t2', 't2m2', NOW - 1 * H, 'shared-cx@dabdoob.com', 'Re: Chargeback notification #55'),
  ]},
  // refund_status the previous afternoon, never answered: expected noha, due end of her Oct-7 shift -> breached.
  { id: 't3', messages: [
    gmsg('t3', 't3m1', KW('2026-10-07', '15:00'), 'alerts@myfatoorah.com', 'Refund Status Update ORD-101'),
  ]},
  // refund_status after the last queue window of Oct 7: next shift's TLs (noha Oct 8) own it, due Oct 8 16:00.
  { id: 't4', messages: [
    gmsg('t4', 't4m1', KW('2026-10-07', '17:00'), 'alerts@myfatoorah.com', 'Refund Status Update ORD-102'),
  ]},
  // noise: a chargeback-looking subject from OUR side and a random mail — neither produces a record.
  { id: 't5', messages: [
    gmsg('t5', 't5m1', NOW - 4 * H, 'agent@dabdoob.com', 'Chargeback escalation draft'),
    gmsg('t5', 't5m2', NOW - 3 * H, 'news@external.com', 'Weekly digest'),
  ]},
  // approvals: a request answered in Gmail by an approver.
  { id: 't6', messages: [
    gmsg('t6', 't6m1', NOW - 3 * H, 'Farah Finance <finance@dabdoob.com>', 'Refund approval - 0501234567 - ORD-200', { rfcId: '<rfc-t6m1@mail>' }),
    gmsg('t6', 't6m2', NOW - 2 * H, 'Karim Elnaggar <k.elnaggar@dabdoob.com>', 'Re: Refund approval - 0501234567 - ORD-200'),
  ]},
  // approvals: an unanswered operational-loss request (Reply-To + Cc exercised downstream).
  { id: 't7', messages: [
    gmsg('t7', 't7m1', NOW - 5 * H, 'Partner <partner@vendor.com>', 'Fwd: Operational loss - 0507654321 - ORD-201 - spare parts', {
      replyTo: 'decisions@vendor.com',
      cc: 'team@vendor.com, finance@dabdoob.com',
      rfcId: '<rfc-t7m1@mail>',
      snippet: 'Please approve the operational loss write-off.',
    }),
  ]},
]

/** mail_sla rows that already exist before the sync (the merge keeps their first-recorded expectation). */
const SLA_OLD: Row[] = [
  {
    message_id: 't1m1', thread_id: 't1', kind: 'refund_status', subject: 'Refund Status Update — order ORD-100',
    from_email: 'noreply@myfatoorah.com', received_at: ISO(NOW - 2 * H), expected_tls: 'menna@dabdoob.com',
    status: 'open', replied_at: '', replied_by: '', minutes_to_reply: '', breached: false, by_expected: false,
    covering_missed: false, snippet: 'old', updated_at: '2026-10-08T08:00:00.000Z',
    due_at: ISO(KW('2026-10-08', '15:00')), next_shift: true,
  },
]

/** A pending approval row the way mdSyncApprovals_ writes it (for decide/reset tests). */
function approvalRow(over: Partial<Row> = {}): Row {
  return {
    thread_id: 't7', message_id: 't7m1', rfc_message_id: '<rfc-t7m1@mail>', type: 'operational_loss',
    mobile: '0507654321', order_id: 'ORD-201 - spare parts', subject: 'Fwd: Operational loss - 0507654321 - ORD-201 - spare parts',
    requester: 'partner@vendor.com', reply_to: 'decisions@vendor.com', cc: 'team@vendor.com,finance@dabdoob.com',
    received_at: ISO(NOW - 5 * H), excerpt: 'Please approve the operational loss write-off.',
    status: 'pending', decision_text: '', decided_by: '', decided_at: '', sent_status: '', sent_message_id: '',
    client_token: '', updated_at: ISO(NOW - 5 * H),
    ...over,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

// =====================================================================
// MailDesk — pure rules
// =====================================================================

describe('mdAddr_ / mdAddrList_ (MailDesk.js)', () => {
  it('bare address extraction', async () => {
    for (const v of ['Noreply <noreply@myfatoorah.com>', 'noreply@myfatoorah.com', 'a@b.c (Dab Doob)', '', null, '<odd@case.com> extra', 'Name <A@B.COM>']) {
      await deskSame('mdAddr_', [v], fx(), () => mdAddr_(v))
    }
  })
  it('header address lists', async () => {
    for (const v of ['a@b.c, D <d@e.f>', 'x@y.z; w@v.u', '', 'one@two.com', 'a@b.c "quoted, name" <c@d.e>', null]) {
      await deskSame('mdAddrList_', [v], fx(), () => mdAddrList_(v))
    }
  })
})

describe('mdKind_ (MailDesk.js)', () => {
  const vectors: [string, string, string, boolean][] = [
    ['Refund Status Update — ORD-1', 'noreply@myfatoorah.com', 'myfatoorah.com', false],
    ['refund status update', 'x@pay.myfatoorah.com', 'myfatoorah.com', false], // subdomain counts
    ['refund status update', 'x@notmyfatoorah.com', 'myfatoorah.com', false],
    ['refund status update', 'x@myfatoorah.com.evil.com', 'myfatoorah.com', false],
    ['Refund Status Update', 'a@b.c', '', false], // no partner domain configured -> never refund_status
    ['chargeback notification', 'disputes@bank.com', 'myfatoorah.com', false],
    ['Chargebacks: weekly report', 'x@y.z', 'myfatoorah.com', false],
    ['chargeback from us', 'agent@dabdoob.com', 'myfatoorah.com', true], // ours -> not a tracked chargeback
    ['random subject', 'a@b.c', 'myfatoorah.com', false],
    ['', 'a@b.c', 'myfatoorah.com', false],
    ['CHARGEBACK', 'a@b.c', 'myfatoorah.com', false],
  ]
  for (const [subject, from, partner, ours] of vectors) {
    it(`${JSON.stringify(subject)} from ${from}`, async () => {
      await deskSame('mdKind_', [subject, from, partner, ours], fx(), () => mdKind_(subject, from, partner, ours))
    })
  }
})

describe('mdSlaFlags_ (MailDesk.js): status / breached / by_expected / covering_missed', () => {
  const base = { expected_tls: 'noha@dabdoob.com', replied_at: '', replied_by: '', due_at: ISO(NOW + H) }
  const vectors: [string, Row, number][] = [
    ['open, due in the future', { ...base }, NOW],
    ['open, at the deadline (not yet breached)', { ...base, due_at: ISO(NOW) }, NOW], // nowMs > due is strict
    ['open, past the deadline', { ...base, due_at: ISO(NOW - 60000) }, NOW],
    ['replied by the expected TL, on time', { ...base, replied_at: ISO(NOW - 60000), replied_by: 'noha@dabdoob.com' }, NOW],
    ['replied late', { ...base, due_at: ISO(NOW - 2 * H), replied_at: ISO(NOW - H), replied_by: 'noha@dabdoob.com' }, NOW],
    ['replied by someone else (covering_missed)', { ...base, replied_at: ISO(NOW - 60000), replied_by: 'menna@dabdoob.com' }, NOW],
    ['no expected TLs at all', { ...base, expected_tls: '', due_at: '', replied_at: ISO(NOW), replied_by: 'x@y.z' }, NOW],
    ['replied exactly at due', { ...base, due_at: ISO(NOW - 60000), replied_at: ISO(NOW - 60000), replied_by: 'noha@dabdoob.com' }, NOW],
  ]
  for (const [label, r, ms] of vectors) {
    it(label, async () => {
      await deskSame('mdSlaFlags_', [r, ms], fx(), () => mdSlaFlags_({ ...r }, ms))
    })
  }
})

describe('mdParseApprovalSubject_ (MailDesk.js)', () => {
  const vectors = [
    'Refund approval - 0501234567 - ORD-200',
    'Operational loss - 0507654321 - ORD-201 - spare parts',
    'Re: Refund approval - 050 - ORD-1',
    'Fwd: Operational loss - 050 - ORD-2',
    'FW: Refund approval - 050 - ORD-3',
    'AW: Refund approval - 050 - ORD-4',
    'Re: Fwd: Refund approval - 050 - ORD-5',
    'refund APPROVAL - 050 - ORD-6',
    'Refund approval – 050 – ORD-7', // en-dash
    'Refund approval — 050 — ORD-8', // em-dash
    'Refund approval: 050 - ORD-9',
    'Refund approval - - ORD-10', // empty mobile
    'Refund approval - 050 -', // empty order id
    'Refund approval 050 ORD-11', // no separator
    'Weekly report - 050 - ORD-12',
    '',
    'Re: something else',
    'Refund approval - 050',
    null,
  ]
  for (const s of vectors) {
    it(JSON.stringify(s), async () => {
      await deskSame('mdParseApprovalSubject_', [s], fx(), () => mdParseApprovalSubject_(s))
    })
  }
})

describe('mdDecisionBody_ / mdHeaderValue_ / mdReplyMime_ / mdReplyAddresses_ / mdBool_ (MailDesk.js)', () => {
  it('decision bodies', async () => {
    for (const [d, t, n] of [
      ['approved', '', 'Admin Person'],
      ['approved', 'Ship it.', 'Karim Elnaggar'],
      ['rejected', 'No budget.', 'Admin Person'],
      ['reply', 'Could you resend the invoice?', 'Admin Person'],
      ['other', 'x', 'Y'],
    ] as [string, string, string][]) {
      await deskSame('mdDecisionBody_', [d, t, n], fx(), () => mdDecisionBody_(d, t, n))
    }
  })
  it('header values (CRLF stripping + RFC 2047 for non-ASCII)', async () => {
    for (const v of ['plain subject', 'line1\nline2\r\nline3', 'Möhamed Elnäggar', 'Arabic مرحبا subject', '', null, 42]) {
      await deskSame('mdHeaderValue_', [v], fx(), () => mdHeaderValue_(v))
    }
  })
  it('full RFC 2822 reply mime', async () => {
    const r = { to: 'decisions@vendor.com', cc: ['team@vendor.com', 'finance@dabdoob.com'], subject: 'Operational loss - 0507654321 - ORD-201 - spare parts', inReplyTo: '<rfc-t7m1@mail>', body: 'Approved.\n\nProceed with the write-off.\n\nAdmin Person (via Dabdoob CX)' }
    await deskSame('mdReplyMime_', [r], fx(), () => mdReplyMime_(r))
    await deskSame('mdReplyMime_', [{ to: 'x@y.z', subject: 'Re: already', body: 'hi' }], fx(), () =>
      mdReplyMime_({ to: 'x@y.z', subject: 'Re: already', body: 'hi' }),
    )
    await deskSame('mdReplyMime_', [{ to: 'x@y.z', cc: [], subject: 'ünïcödé subject', inReplyTo: '', body: 'ünïcödé body' }], fx(), () =>
      mdReplyMime_({ to: 'x@y.z', cc: [], subject: 'ünïcödé subject', inReplyTo: '', body: 'ünïcödé body' }),
    )
  })
  it('reply addresses: Reply-To wins, Cc minus us and the To', async () => {
    const row = { reply_to: 'decisions@vendor.com', requester: 'partner@vendor.com', cc: 'team@vendor.com,finance@dabdoob.com,decisions@vendor.com,team@vendor.com' }
    for (const me of ['', 'admin@dabdoob.com', 'finance@dabdoob.com']) {
      await deskSame('mdReplyAddresses_', [row, me], fx(), () => mdReplyAddresses_(row, me))
    }
    await deskSame('mdReplyAddresses_', [{ reply_to: '', requester: 'a@b.c', cc: 'a@b.c,, c@d.e,' }, 'x@y.z'], fx(), () =>
      mdReplyAddresses_({ reply_to: '', requester: 'a@b.c', cc: 'a@b.c,, c@d.e,' }, 'x@y.z'),
    )
  })
  it('mdBool_ vectors', async () => {
    for (const v of [true, false, 'true', 'TRUE', 'false', 'x', 1, 0, null, undefined]) {
      await deskSame('mdBool_', [v], fx(), () => mdBool_(v))
    }
  })
})

// =====================================================================
// TL queue windows -> who owns the mail and by when
// =====================================================================

describe('tlsShifts_ / tlsOnQueue_ / tlsMailDue_ (TlSnapshots.js readers + MailDesk.js)', () => {
  const shiftObjs = SHIFTS.map((s) => ({
    tl: normEmail(s.tl_email),
    date: String(s.date),
    startMs: Number(s.shift_start),
    endMs: Number(s.shift_end),
    queue: (JSON.parse(String(s.queue_json)) as [number, number][]).map((w) => ({ startMs: w[0], endMs: w[1] })),
  }))

  it('tlsShifts_ reads the windowed store rows identically', async () => {
    const f = fx({ tables: { tlp_shifts: SHIFTS } })
    await deskSame('tlsShifts_', ['2026-10-08', '2026-10-09'], f, () => tlsShifts_('2026-10-08', '2026-10-09'))
    await deskSame('tlsShifts_', ['2026-10-07', '2026-10-07'], f, () => tlsShifts_('2026-10-07', '2026-10-07'))
    await deskSame('tlsShifts_', ['2026-11-01', '2026-11-02'], f, () => tlsShifts_('2026-11-01', '2026-11-02'))
  })

  it('tlsOnQueue_ at representative instants', async () => {
    const cases: [string, number][] = [
      ['10:00 Kuwait: noha on her morning window', KW('2026-10-08', '10:00')],
      ['12:00 exactly: the window edge (ms < endMs fails)', KW('2026-10-08', '12:00')],
      ['15:00: both TLs on queue', KW('2026-10-08', '15:00')],
      ['18:00: menna between her windows', KW('2026-10-08', '18:00')],
      ['23:00: nobody', KW('2026-10-08', '23:00')],
      ['exactly a window start (inclusive)', KW('2026-10-08', '13:00')],
    ]
    for (const [label, ms] of cases) {
      await deskSame('tlsOnQueue_', [shiftObjs, ms], fx(), () => tlsOnQueue_(shiftObjs as TlShift[], ms), 'tlsOnQueue_ ' + label)
    }
  })

  it('tlsMailDue_: on-queue vs next-shift deadlines', async () => {
    const cases: [string, number][] = [
      ['mail at 10:00 -> noha, due end of her 16:00 shift', KW('2026-10-08', '10:00')],
      ['mail at 12:00 gap -> next window 13:00, still noha', KW('2026-10-08', '12:00')],
      ['mail at 15:00 -> both TLs, due the latest end (18:00)', KW('2026-10-08', '15:00')],
      ['mail at 18:00 -> next window menna 19:00, due 22:00', KW('2026-10-08', '18:00')],
      ['mail at 23:00 -> tomorrow 08:00 noha, due tomorrow 16:00', KW('2026-10-08', '23:00')],
      ['mail before any shift today', KW('2026-10-08', '05:00')],
      ['mail inside the very first Oct-7 window', KW('2026-10-07', '09:00')],
    ]
    for (const [label, ms] of cases) {
      await deskSame('tlsMailDue_', [shiftObjs, ms], fx(), () => tlsMailDue_(shiftObjs as TlShift[], ms), 'tlsMailDue_ ' + label)
    }
    // Empty schedule: { expected: [], dueMs NaN (serializes to null), nextShift: true }.
    await deskSame('tlsMailDue_', [[], NOW], fx(), () => tlsMailDue_([] as TlShift[], NOW))
  })
})

// =====================================================================
// mdSlaRecords_ / mdMergeSla_ — the per-thread record builder
// =====================================================================

describe('mdSlaRecords_ / mdMergeSla_ (MailDesk.js)', () => {
  const OURS = ['noha@dabdoob.com', 'menna@dabdoob.com', 'admin@dabdoob.com', 'agent@dabdoob.com', 'shared-cx@dabdoob.com']
  const ctx = (shiftObjs: unknown, nowMs = NOW): MdSlaCtx => ({
    isOurs: (e: string) => OURS.indexOf(normEmail(e)) !== -1,
    partnerDomain: 'myfatoorah.com',
    shifts: shiftObjs as TlShift[],
    nowMs,
  })
  const legacyCtx = { isOurs: '@@fn:__fn_isOurs__', partnerDomain: 'myfatoorah.com', nowMs: NOW }
  const shiftObjs = SHIFTS.map((s) => ({
    tl: normEmail(s.tl_email),
    date: String(s.date),
    startMs: Number(s.shift_start),
    endMs: Number(s.shift_end),
    queue: (JSON.parse(String(s.queue_json)) as [number, number][]).map((w) => ({ startMs: w[0], endMs: w[1] })),
  }))
  const md = (m: { id: string; threadId: string; internalDate: string; snippet: string; payload: { headers: { name: string; value: string }[] } }): MdMsg => {
    const h = (n: string) => m.payload.headers.filter((x) => x.name === n).map((x) => x.value)[0] || ''
    return {
      id: m.id, threadId: m.threadId, ms: Number(m.internalDate), from: h('From'), subject: h('Subject'),
      to: h('To'), cc: h('Cc'), replyTo: h('Reply-To'), rfcId: h('Message-ID'), snippet: m.snippet,
    }
  }

  it('records for every fixture thread', async () => {
    for (const t of THREADS) {
      const msgs = t.messages.map(md)
      await deskSame(
        'mdSlaRecords_',
        [msgs, { ...legacyCtx, shifts: shiftObjs }],
        fx({ oursEmails: OURS }),
        () => mdSlaRecords_(msgs, ctx(shiftObjs)),
        'mdSlaRecords_ ' + t.id,
      )
    }
  })
  it('out-of-order messages sort by ms first', async () => {
    const msgs = [md(THREADS[0].messages[2]), md(THREADS[0].messages[0]), md(THREADS[0].messages[1])]
    await deskSame('mdSlaRecords_', [msgs, { ...legacyCtx, shifts: shiftObjs }], fx({ oursEmails: OURS }), () => mdSlaRecords_(msgs, ctx(shiftObjs)))
  })
  it('mdMergeSla_ keeps the first-recorded expectation and re-derives flags', async () => {
    const fresh = { message_id: 'm', expected_tls: 'noha@dabdoob.com', due_at: ISO(NOW + H), next_shift: false, replied_at: '', replied_by: '', status: 'open', breached: false, by_expected: false, covering_missed: false }
    const cases: [string, Row | undefined][] = [
      ['no old row', undefined],
      ['old with its own expected/due', { expected_tls: 'menna@dabdoob.com', due_at: ISO(NOW - H), next_shift: true, replied_at: '', replied_by: '' }],
      ['old with empty expected (fresh wins)', { expected_tls: '', due_at: '', next_shift: false }],
      ['old expected, fresh now replied by the ORIGINALLY expected TL', { expected_tls: 'noha@dabdoob.com', due_at: ISO(NOW + 2 * H), next_shift: 'true' }],
    ]
    for (const [label, old] of cases) {
      const f = { ...fresh, replied_at: label.includes('replied') ? ISO(NOW - 60000) : '', replied_by: label.includes('replied') ? 'noha@dabdoob.com' : '' }
      await deskSame('mdMergeSla_', [f, old, NOW], fx(), () => mdMergeSla_({ ...f }, old && { ...old }, NOW), 'mdMergeSla_ ' + label)
    }
  })
})

// =====================================================================
// The 10-minute sync job (Gmail seam both ways)
// =====================================================================

describe('mdSyncSla_ / mdSyncApprovals_ / jobMailDesk (MailDesk.js)', () => {
  const syncFx = (over: DeskFx = {}): DeskFx =>
    jobFx({
      gmailThreads: THREADS,
      tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [] },
      ...over,
    })

  it('mdSyncSla_: envelope + written rows + raised popups all match', async () => {
    const f = syncFx({ tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [] } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncSla_', [], fixture)
    const portRes = await portCall(() => mdSyncSla_())
    expectSame(portRes, legacyRes, 'mdSyncSla_')
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla after sync')
    // Popups: open+new+<6h mails -> one per expected TL. Two here: t1m3 (45m) and
    // t5m2, which inherits 'chargeback' from the thread's FIRST subject (the
    // mdKind_ thread-context quirk both sides share).
    expectTabSame('popups', 'Popups', 'popups after sync')
    const pops = normRows(hubDb.tables.popups || []).rows
    expect(pops.length).toBe(2)
    expect(pops.every((p) => p.recipient === 'noha@dabdoob.com' && p.kind === 'mail_sla_due')).toBe(true)
  })

  it('mdSyncSla_ merges with the existing row (first-recorded expectation kept)', async () => {
    const f = syncFx({ tables: { tlp_shifts: SHIFTS, mail_sla: SLA_OLD, mail_approvals: [], popups: [], mail_approval_log: [] } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncSla_', [], fixture)
    const portRes = await portCall(() => mdSyncSla_())
    expectSame(portRes, legacyRes, 'mdSyncSla_ merge')
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla after merge')
    const row = (deskStore('mail_sla').find((r) => String(r.message_id) === 't1m1') || {}) as Row
    expect(row.expected_tls).toBe('menna@dabdoob.com') // the OLD expected, not the freshly derived one
    expect(row.due_at).toBe(ISO(KW('2026-10-08', '15:00')))
    expect(String(row.covering_missed)).toBe('true') // replied by noha, but menna was expected
  })

  it('mdSyncApprovals_: pending vs answered_in_gmail threads', async () => {
    const f = syncFx()
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncApprovals_', [], fixture)
    const portRes = await portCall(() => mdSyncApprovals_())
    expectSame(portRes, legacyRes, 'mdSyncApprovals_')
    expectStoreSame('mail_approvals', 'mail_approvals', 'mail_approvals after sync')
    const rows = deskStore('mail_approvals')
    expect(rows.length).toBe(2)
    expect(rows.find((r) => r.thread_id === 't6')!.status).toBe('answered_in_gmail')
    expect(rows.find((r) => r.thread_id === 't7')!.status).toBe('pending')
  })

  it('jobMailDesk: the note matches; the GAS health heartbeat is the documented extra write', async () => {
    const f = syncFx()
    const fixture = deskInstall(f)
    const legacyRes = deskCall('jobMailDesk', [], fixture)
    const portRes = await portCall(() => jobMailDesk())
    expectSame(portRes, legacyRes, 'jobMailDesk')
    // 6 sla records (incl. the thread-context t5m2) + 2 approval threads.
    expect(legacyRes.ok).toEqual({ note: '6 response-tracked messages from 7 threads. 2 approval threads.' })
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla after job')
    expectStoreSame('mail_approvals', 'mail_approvals', 'mail_approvals after job')
    // dqMarkRun_: legacy stamps the DQ_LAST_mail_desk script property; the port stamps
    // the dq_last_mail_desk config key (jobshared.ts — the documented stamp seam).
    expect(deskProps().DQ_LAST_mail_desk).toBe(ISO(NOW))
    const cfg = (hubDb.tables.config || []).find((r) => r.key === 'dq_last_mail_desk')
    expect(cfg && cfg.value).toBe(ISO(NOW))
    // Legacy hbRun_ always writes a Health row for mail_desk; the port wraps the
    // job in hbRun the same way (WP-15 fix): one row, last_status 'ok'.
    const legacyHealth = deskTable('Health').filter((r) => r.job === 'mail_desk')
    expect(legacyHealth.length).toBe(1)
    expect(legacyHealth[0].last_status).toBe('ok')
    const portHealth = (hubDb.tables.health || []).filter((r) => r.job === 'mail_desk')
    expect(portHealth.length).toBe(1)
    expect(portHealth[0].last_status).toBe('ok')
  })

  it('jobMailDesk under view-as refuses identically', async () => {
    const f = fx({
      gmailThreads: THREADS,
      tables: {
        tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [],
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'agent@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('jobMailDesk', [], fixture)
    const portRes = await portCall(() => jobMailDesk())
    // Legacy requireJobCaller_ -> viewAsGuard_; the port's jobMailDesk calls the same
    // requireJobCaller guard (it is cron-routed, but the hand-run path refuses identically).
    expect(legacyRes.err).toBe('View as is read-only — exit to make changes.')
    expect(portRes.err).toBe(legacyRes.err)
  })

  it('jobMailDesk by a non-admin hand refuses identically', async () => {
    const f = fx({ userEmail: 'agent@dabdoob.com', gmailThreads: THREADS, tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [] } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('jobMailDesk', [], fixture)
    const portRes = await portCall(() => jobMailDesk())
    // requireJobCaller_ is ported: the port's jobMailDesk refuses a non-admin hand too.
    expect(legacyRes.err).toBe('Scheduled jobs can only be run by an admin.')
    expect(portRes.err).toBe(legacyRes.err)
  })

  it('no Gmail read adapter: the port fails closed where the fake Gmail simply returns threads', async () => {
    // An EMPTY thread list: deskInstall clears the adapter, so the port's mdThreads_
    // throws "Gmail is not configured" while the legacy Gmail stub returns [].
    const f = jobFx({ gmailThreads: [], tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [] } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncSla_', [], fixture)
    const portRes = await portCall(() => mdSyncSla_())
    expect(legacyRes.ok).toBe('0 response-tracked messages from 0 threads.')
    expect(portRes.err).toMatch(/Gmail is not configured/)
  })

  it('mailDeskRefresh: check-now runs the job then re-reads the page', async () => {
    const f = fx({ gmailThreads: THREADS, tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [] } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mailDeskRefresh', [], fixture)
    const portRes = await portCall(() => mailDeskRefresh())
    expectSame(portRes, legacyRes, 'mailDeskRefresh')
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla after refresh')
  })
})

// =====================================================================
// The Mail desk page
// =====================================================================

describe('mailDeskPage (MailDesk.js)', () => {
  const pageFx = (over: DeskFx = {}): DeskFx =>
    fx({
      props: { DQ_LAST_mail_desk: '2026-10-08T08:00:00.000Z' },
      tables: {
        mail_sla: [
          { message_id: 'm-old', thread_id: 't0', kind: 'chargeback', subject: 'Old chargeback', from_email: 'bank@x.com', received_at: ISO(NOW - 8 * 86400000), expected_tls: 'noha@dabdoob.com', status: 'open', replied_at: '', replied_by: '', minutes_to_reply: '', breached: true, by_expected: false, covering_missed: false, snippet: '', updated_at: '', due_at: ISO(NOW - 7 * 86400000), next_shift: false },
          { message_id: 'm-open', thread_id: 't9', kind: 'refund_status', subject: 'Refund Status Update ORD-9', from_email: 'noreply@myfatoorah.com', received_at: ISO(NOW - 3 * H), expected_tls: 'noha@dabdoob.com', status: 'open', replied_at: '', replied_by: '', minutes_to_reply: '', breached: false, by_expected: false, covering_missed: false, snippet: 'needs answer', updated_at: '', due_at: ISO(NOW + H), next_shift: false },
          { message_id: 'm-done', thread_id: 't8', kind: 'chargeback', subject: 'Chargeback #9', from_email: 'bank@x.com', received_at: ISO(NOW - 5 * H), expected_tls: 'noha@dabdoob.com', status: 'replied', replied_at: ISO(NOW - 4 * H), replied_by: 'noha@dabdoob.com', minutes_to_reply: 60, breached: false, by_expected: true, covering_missed: false, snippet: '', updated_at: '', due_at: ISO(NOW + 2 * H), next_shift: false },
        ],
        mail_approvals: [
          approvalRow(),
          approvalRow({ thread_id: 't6', status: 'approved', decided_by: 'k.elnaggar@dabdoob.com', decided_at: ISO(NOW - 2 * H), sent_status: 'dry_run', updated_at: ISO(NOW - 2 * H) }),
          approvalRow({ thread_id: 't-stuck', status: 'sending', client_token: 'tok-old', updated_at: ISO(NOW - 10 * 60000) }), // > 5 min: stuck
          approvalRow({ thread_id: 't-fresh-send', status: 'sending', client_token: 'tok-new', updated_at: ISO(NOW - 60000) }), // < 5 min: not stuck
          approvalRow({ thread_id: 't-ancient', status: 'replied', decided_at: ISO(NOW - 20 * 86400000), updated_at: ISO(NOW - 20 * 86400000) }), // outside the 14d cut -> filtered
        ],
      },
      ...over,
    })

  it('the full page payload matches for an admin approver', async () => {
    await deskSame('mailDeskPage', [], pageFx(), () => mailDeskPage())
  })
  it('a non-approver TL gets approvals: null', async () => {
    await deskSame('mailDeskPage', [], pageFx({ userEmail: 'noha@dabdoob.com' }), () => mailDeskPage())
  })
  it('an approver who is only on the list (not admin/tl roster role) still sees the page', async () => {
    // karim is roster-admin here; make a noha+approver variant for coverage of the approver gate.
    await deskSame('mailDeskPage', [], pageFx({ userEmail: 'k.elnaggar@dabdoob.com' }), () => mailDeskPage())
  })
  it('an agent is refused identically', async () => {
    await deskSame('mailDeskPage', [], pageFx({ userEmail: 'agent@dabdoob.com' }), () => mailDeskPage())
  })
  it('an unknown caller is refused identically', async () => {
    await deskSame('mailDeskPage', [], pageFx({ userEmail: 'outsider@dabdoob.com' }), () => mailDeskPage())
  })
  it('empty stores render identically', async () => {
    await deskSame('mailDeskPage', [], pageFx({ tables: { mail_sla: [], mail_approvals: [] } }), () => mailDeskPage())
  })
})

// =====================================================================
// mailApprovalDecide / mailApprovalReset (dry-run mode)
// =====================================================================

describe('mailApprovalDecide (MailDesk.js): claim -> send -> record', () => {
  const decideFx = (rows: Row[] = [approvalRow()], over: DeskFx = {}): DeskFx =>
    fx({ tables: { mail_approvals: rows, mail_approval_log: [] }, ...over })

  it('approve a pending mail: envelope + both stores match', async () => {
    const f = decideFx()
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mailApprovalDecide', ['t7', 'approved', 'Proceed with the write-off.', 'tok-1'], fixture)
    const portRes = await portCall(() => mailApprovalDecide('t7', 'approved', 'Proceed with the write-off.', 'tok-1'))
    expectSame(portRes, legacyRes, 'mailApprovalDecide approved')
    expectStoreSame('mail_approvals', 'mail_approvals', 'mail_approvals after decide')
    expectStoreSame('mail_approval_log', 'mail_approval_log', 'mail_approval_log after decide')
    const log = deskStore('mail_approval_log')[0]
    expect(log.action).toBe('decide')
    expect(log.to).toBe('decisions@vendor.com') // Reply-To wins
    expect(log.cc).toBe('team@vendor.com,finance@dabdoob.com')
  })
  it('reject + free-text reply envelopes match', async () => {
    await deskSame('mailApprovalDecide', ['t7', 'rejected', 'Not this month.', 'tok-2'], decideFx(), () => mailApprovalDecide('t7', 'rejected', 'Not this month.', 'tok-2'))
    await deskSame('mailApprovalDecide', ['t7', 'reply', 'Can you resend the invoice?', 'tok-3'], decideFx(), () => mailApprovalDecide('t7', 'reply', 'Can you resend the invoice?', 'tok-3'))
  })
  it('the same token again returns the first result (no double send)', async () => {
    const rows = [approvalRow({ status: 'approved', client_token: 'tok-1', decided_by: 'admin@dabdoob.com', decided_at: ISO(NOW - H), updated_at: ISO(NOW - H), sent_status: 'dry_run' })]
    await deskSame('mailApprovalDecide', ['t7', 'approved', 'different text', 'tok-1'], decideFx(rows), () => mailApprovalDecide('t7', 'approved', 'different text', 'tok-1'))
    // ...and a stuck 'sending' claim replays too.
    const sending = [approvalRow({ status: 'sending', client_token: 'tok-9', decided_by: 'admin@dabdoob.com', updated_at: ISO(NOW - 10 * 60000) })]
    await deskSame('mailApprovalDecide', ['t7', 'approved', 'x', 'tok-9'], decideFx(sending), () => mailApprovalDecide('t7', 'approved', 'x', 'tok-9'))
  })
  it('a different token on a decided mail is refused with the same message', async () => {
    const rows = [approvalRow({ status: 'approved', client_token: 'tok-1', decided_by: 'admin@dabdoob.com', decided_at: ISO(NOW - H), updated_at: ISO(NOW - H) })]
    await deskSame('mailApprovalDecide', ['t7', 'rejected', 'x', 'tok-2'], decideFx(rows), () => mailApprovalDecide('t7', 'rejected', 'x', 'tok-2'))
    const sending = [approvalRow({ status: 'sending', client_token: 'tok-1', decided_by: 'k.elnaggar@dabdoob.com', updated_at: ISO(NOW - 60000) })]
    await deskSame('mailApprovalDecide', ['t7', 'approved', 'x', 'tok-2'], decideFx(sending), () => mailApprovalDecide('t7', 'approved', 'x', 'tok-2'))
  })
  it('validation order and messages match', async () => {
    const cases: [string, string, string, string][] = [
      ['t7', 'bogus', '', 'tok-1'],
      ['t7', 'reply', 'x', 'tok-1'], // reply needs >= 2 chars
      ['t7', 'reply', '', 'tok-1'],
      ['t7', 'approved', '', ''], // missing token
      ['ghost', 'approved', '', 'tok-1'], // unknown thread
    ]
    for (const [t, d, txt, tok] of cases) {
      await deskSame('mailApprovalDecide', [t, d, txt, tok], decideFx(), () => mailApprovalDecide(t, d, txt, tok))
    }
  })
  it('a non-approver is refused identically', async () => {
    await deskSame('mailApprovalDecide', ['t7', 'approved', '', 'tok-1'], decideFx([approvalRow()], { userEmail: 'menna@dabdoob.com' }), () =>
      mailApprovalDecide('t7', 'approved', '', 'tok-1'),
    )
    await deskSame('mailApprovalDecide', ['t7', 'approved', '', 'tok-1'], decideFx([approvalRow()], { userEmail: 'agent@dabdoob.com' }), () =>
      mailApprovalDecide('t7', 'approved', '', 'tok-1'),
    )
  })
  it('view-as refuses a valid decide identically', async () => {
    const f = decideFx([approvalRow()], {
      tables: {
        mail_approvals: [approvalRow()],
        mail_approval_log: [],
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'agent@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
    await deskSame('mailApprovalDecide', ['t7', 'approved', 'ok', 'tok-1'], f, () => mailApprovalDecide('t7', 'approved', 'ok', 'tok-1'))
  })
})

describe('mailApprovalReset (MailDesk.js)', () => {
  const stuck = approvalRow({ status: 'sending', client_token: 'tok-x', decided_by: 'admin@dabdoob.com', updated_at: ISO(NOW - 10 * 60000) })
  const resetFx = (rows: Row[]): DeskFx => fx({ tables: { mail_approvals: rows, mail_approval_log: [] } })

  it('a stuck send goes back to pending and logs reset', async () => {
    const f = resetFx([stuck])
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mailApprovalReset', ['t7'], fixture)
    const portRes = await portCall(() => mailApprovalReset('t7'))
    expectSame(portRes, legacyRes, 'mailApprovalReset')
    expectStoreSame('mail_approvals', 'mail_approvals', 'mail_approvals after reset')
    expectStoreSame('mail_approval_log', 'mail_approval_log', 'mail_approval_log after reset')
    const log = deskStore('mail_approval_log')[0]
    expect(log.action).toBe('reset')
  })
  it('not-sending / fresh-sending / unknown all error identically', async () => {
    await deskSame('mailApprovalReset', ['t7'], resetFx([approvalRow({ status: 'pending' })]), () => mailApprovalReset('t7'))
    await deskSame('mailApprovalReset', ['t7'], resetFx([approvalRow({ status: 'sending', updated_at: ISO(NOW - 60000) })]), () => mailApprovalReset('t7'))
    await deskSame('mailApprovalReset', ['ghost'], resetFx([]), () => mailApprovalReset('ghost'))
  })
  it('a non-approver is refused identically', async () => {
    await deskSame('mailApprovalReset', ['t7'], resetFx([stuck]), () => mailApprovalReset('t7'), 'reset admin')
    const f = resetFx([stuck]); f.userEmail = 'menna@dabdoob.com'
    await deskSame('mailApprovalReset', ['t7'], f, () => mailApprovalReset('t7'), 'reset non-approver')
  })
})

// =====================================================================
// TL performance — pure rollup math
// =====================================================================

describe('tlpWeek_ / tlpOverall_ / tlpMean_ / tlpLabel_ / tlpCheckValue_ (TlPerformance.js)', () => {
  it('tlpWeek_: the Sunday that opens a CX week', async () => {
    for (const d of ['2026-10-08', '2026-10-04', '2026-10-06', '2026-10-10', '2026-01-01', '2026-02-28', '2024-02-29']) {
      await deskSame('tlpWeek_', [d], fx(), () => tlpWeek_(d))
    }
  })
  it('tlpOverall_: weighted mean of the parts that exist', async () => {
    const cases: [Record<string, number | null>, Record<string, number> | null][] = [
      [{ team: 80, responsibilities: 90 }, { team: 85, responsibilities: 15 }],
      [{ team: 80, responsibilities: null }, { team: 85, responsibilities: 15 }],
      [{ team: null, responsibilities: null }, { team: 85, responsibilities: 15 }],
      [{ team: 80.55, responsibilities: 90.44 }, { team: 85, responsibilities: 15 }],
      [{ team: 80, responsibilities: 90, extra: 1 }, { team: 85, responsibilities: 15 }], // unweighted part ignored
      [{ team: 80 }, {}], // no weights -> score null
      [{ team: 80, responsibilities: 90 }, null],
      [{ quality: 60, fcr: 70, productivity: 80, responsibilities: 90 }, { quality: 35, fcr: 15, productivity: 35, responsibilities: 15 }],
    ]
    for (const [parts, w] of cases) {
      await deskSame('tlpOverall_', [parts, w], fx(), () => tlpOverall_(parts, w))
    }
  })
  it('tlpMean_ vectors', async () => {
    for (const v of [[80, 90, 70], [80, '', null, 90], [], [null], ['x', 5], [0, 100], [33.333]]) {
      await deskSame('tlpMean_', [v], fx(), () => tlpMean_(v))
    }
  })
  it('tlpLabel_ vectors', async () => {
    const zones = { meets: 75, exceeds: 95 }
    for (const v of [96, 95, 94.9, 75, 74.9, 0, '', null, 'x', 100]) {
      await deskSame('tlpLabel_', [v, zones], fx(), () => tlpLabel_(v, zones))
    }
    await deskSame('tlpLabel_', [80, null], fx(), () => tlpLabel_(80, null))
    await deskSame('tlpLabel_', [80, {}], fx(), () => tlpLabel_(80, {}))
    await deskSame('tlpLabel_', [50, { meets: 40, exceeds: 60 }], fx(), () => tlpLabel_(50, { meets: 40, exceeds: 60 }))
  })
  it('tlpCheckValue_: 0-100 in steps of 5', async () => {
    for (const v of [0, 50, 100, '80', 5, 95]) {
      await deskSame('tlpCheckValue_', [v], fx(), () => tlpCheckValue_(v))
    }
    for (const v of [33.5, -5, 101, 'x', '', null, 7.5, 55.0001]) {
      await deskSame('tlpCheckValue_', [v], fx(), () => tlpCheckValue_(v))
    }
  })
})

describe('tlpByName_ / tlpKbMetrics_ (TlPerformance.js)', () => {
  const people = [
    { email: 'noha@dabdoob.com', name: 'Noha Hassan Foaad Qandil', active: true },
    { email: 'menna@dabdoob.com', name: 'Menna Mekawy', active: true },
    { email: 'esmail@dabdoob.com', name: 'Ahmed Essam Ismail Ali', active: true },
    { email: 'naguib@dabdoob.com', name: 'Ahmed Naguib', active: true },
    { email: 'ahmed2@dabdoob.com', name: 'Ahmed Nabil', active: true },
    { email: 'former@dabdoob.com', name: 'Noha Former', active: false }, // inactive never matches
  ]
  const cases: [string, string[]][] = [
    ['full name exact', ['Noha Hassan Foaad Qandil', 'Noha']],
    ['short name as a word', ['Menna']],
    ['word that hits two (fallback list can be empty)', ['Ahmed']],
    ['nobody', ['Zaid']],
    ['case and spacing', ['  menna  mekawy ']],
    ['inactive only', ['Noha Former']],
  ]
  for (const [label, names] of cases) {
    it(label, async () => {
      await deskSame('tlpByName_', [people, names], fx(), () => tlpByName_(people, names))
    })
  }
  it('tlpKbMetrics_: done / accurate / within-a-day / open', async () => {
    const rows = [
      { kb_id: 'k1', requested_at: ISO(NOW - 10 * 86400000), done_at: ISO(NOW - 9 * 86400000), accurate: 'yes' },
      { kb_id: 'k2', requested_at: ISO(NOW - 5 * 86400000), done_at: ISO(NOW - 6 * 86400000), accurate: 'no' }, // done before request edge
      { kb_id: 'k3', requested_at: ISO(NOW - 40 * 86400000), done_at: ISO(NOW - 39 * 86400000), accurate: 'yes' }, // older than the 30d cut
      { kb_id: 'k4', requested_at: ISO(NOW - 2 * 86400000), done_at: '', accurate: '' }, // still open
      { kb_id: 'k5', requested_at: ISO(NOW - 86400000), done_at: ISO(NOW - 86400000 + 2 * 3600000), accurate: 'maybe' }, // unmarked
      { kb_id: 'k6', requested_at: '', done_at: ISO(NOW - 3600000), accurate: 'yes' }, // done but no request -> out of the timing window
    ]
    const from = ISO(NOW - 30 * 86400000)
    await deskSame('tlpKbMetrics_', [rows, from], fx(), () => tlpKbMetrics_(rows, from))
    await deskSame('tlpKbMetrics_', [[], from], fx(), () => tlpKbMetrics_([], from))
  })
})

// =====================================================================
// tlpAreasFor_ + tlPerformancePage
// =====================================================================

describe('tlpAreasFor_ (TlPerformance.js)', () => {
  it('reads the configured ownership map identically', async () => {
    for (const email of ['noha@dabdoob.com', 'menna@dabdoob.com', 'esmail@dabdoob.com', 'naguib@dabdoob.com', 'nobody@dabdoob.com', 'NOHA@dabdoob.com']) {
      await deskSame('tlpAreasFor_', [email], fx(), () => tlpAreasFor_(email))
    }
  })
  it('defaults to [] with no ownership map', async () => {
    const f = fx({ settings: { tlp_tl_areas: {} } })
    await deskSame('tlpAreasFor_', ['noha@dabdoob.com'], f, () => tlpAreasFor_('noha@dabdoob.com'))
  })
})

describe('tlPerformancePage (TlPerformance.js)', () => {
  const teamRow = {
    tl_email: 'noha@dabdoob.com', month: '2026-10', quality: 88.5, fcr: 70, productivity: 91, agents: 6,
    updated_at: '2026-10-08T06:00:00.000Z', kpi_score: 90.2, kpi_prod: 95, kpi_qual: 88, kpi_fcr: 70.5, kpi_behavior: 100,
    kpi_agents: 6, ol_agents: 1, ineligible_agents: 0, red_zone: 1, action_plan: 2, probation_agents: 0, partial_agents: 1,
  }
  const perfFx = (over: DeskFx = {}): DeskFx =>
    fx({
      props: { DQ_LAST_tl_queue_metrics: '2026-10-08T07:00:00.000Z' },
      tables: {
        tlp_team: [teamRow],
        tlp_resp_ratings: [
          { rating_id: '2026-10-04|noha@dabdoob.com|Refunds', tl_email: 'noha@dabdoob.com', week: '2026-10-04', area: 'Refunds', rating: 80, note: 'Solid', rated_by: 'admin@dabdoob.com', rated_at: ISO(NOW - 86400000) },
          { rating_id: '2026-09-27|noha@dabdoob.com|Refunds', tl_email: 'noha@dabdoob.com', week: '2026-09-27', area: 'Refunds', rating: 90, note: '', rated_by: 'admin@dabdoob.com', rated_at: ISO(NOW - 8 * 86400000) },
          { rating_id: '2026-09-27|noha@dabdoob.com|Operational loss', tl_email: 'noha@dabdoob.com', week: '2026-09-27', area: 'Operational loss', rating: 'x', note: 'bad data', rated_by: 'admin@dabdoob.com', rated_at: ISO(NOW - 8 * 86400000) },
          { rating_id: '2026-10-04|menna@dabdoob.com|Returns', tl_email: 'menna@dabdoob.com', week: '2026-10-04', area: 'Returns', rating: 60, note: '', rated_by: 'admin@dabdoob.com', rated_at: ISO(NOW - 86400000) },
        ],
        tlp_area_metrics: [
          { key: 'noha|Refunds', tl_email: 'noha@dabdoob.com', area: 'Refunds', from: '2026-09-01', to: '2026-09-30', pct: 96.5, met: 27, total: 28, rule: 'sla', updated_at: ISO(NOW - 86400000) },
          { key: 'other|x', tl_email: 'other@dabdoob.com', area: 'Refunds', from: '2026-09-01', to: '2026-09-30', pct: 50, met: 1, total: 2, rule: 'sla', updated_at: ISO(NOW - 86400000) },
        ],
        tlp_queue_daily: [
          { date: '2026-10-08', tl_email: 'noha@dabdoob.com', windows: '08-12,13-16', queue_min: 420, calls_in: 40, calls_serviced: 34, calls_abandoned: 6, calls_other: 0, answer_rate: 85, text_touches: 12, text_tickets: 9, resp_count: 30, resp_avg_min: 4.5, resp_missing: 2, text_source: 'freshchat', computed_at: ISO(NOW - 3600000) },
          { date: '2026-10-07', tl_email: 'noha@dabdoob.com', windows: '08-16', queue_min: 480, calls_in: 50, calls_serviced: 45, calls_abandoned: 5, calls_other: 0, answer_rate: 90, text_touches: 10, text_tickets: 8, resp_count: 40, resp_avg_min: 6, resp_missing: 1, text_source: 'freshchat', computed_at: ISO(NOW - 86400000) },
          { date: '2026-09-30', tl_email: 'noha@dabdoob.com', windows: '', queue_min: 100, calls_in: 5, calls_serviced: 5, calls_abandoned: 0, calls_other: 0, answer_rate: '', text_touches: 1, text_tickets: 1, resp_count: 0, resp_avg_min: '', resp_missing: 0, text_source: '', computed_at: ISO(NOW - 8 * 86400000) }, // outside the 7-day window
          { date: '2026-10-08', tl_email: 'menna@dabdoob.com', windows: '14-22', queue_min: 300, calls_in: 20, calls_serviced: 18, calls_abandoned: 2, calls_other: 0, answer_rate: 90, text_touches: 5, text_tickets: 5, resp_count: 15, resp_avg_min: 8, resp_missing: 0, text_source: 'freshchat', computed_at: ISO(NOW - 3600000) },
        ],
        actions: [
          { action_id: 'act-1', owner_email: 'noha@dabdoob.com', title: 'Refunds SLA revamp', status: 'done', track_as_task: true, submitted_by: 'x', submitted_at: ISO(NOW - 20 * 86400000) },
          { action_id: 'act-2', owner_email: 'noha@dabdoob.com', title: 'Late project', status: 'open', track_as_task: true, submitted_by: 'x', submitted_at: ISO(NOW - 10 * 86400000) },
          { action_id: 'act-3', owner_email: 'noha@dabdoob.com', title: 'Dropped thing', status: 'dropped', track_as_task: true, submitted_by: 'x', submitted_at: ISO(NOW - 9 * 86400000) },
          { action_id: 'act-4', owner_email: 'menna@dabdoob.com', title: 'Not hers', status: 'open', track_as_task: true, submitted_by: 'x', submitted_at: ISO(NOW - 8 * 86400000) },
        ],
        action_task_details: [
          { action_id: 'act-1', expectation: '100% within SLA', deadline_at: ISO(NOW - 15 * 86400000), delivered_at: ISO(NOW - 10 * 86400000), outcome_rating: 90, outcome_note: 'Good', rated_by: 'admin@dabdoob.com', rated_at: ISO(NOW - 9 * 86400000) },
          { action_id: 'act-2', expectation: '', deadline_at: ISO(NOW - 5 * 86400000), delivered_at: '', outcome_rating: '', outcome_note: '', rated_by: '', rated_at: '' }, // overdue open
        ],
        mail_sla: [
          { message_id: 'sm1', thread_id: 'st1', kind: 'refund_status', subject: 'Refund Status Update', from_email: 'a@myfatoorah.com', received_at: ISO(NOW - 2 * 86400000), expected_tls: 'noha@dabdoob.com', status: 'open', replied_at: '', replied_by: '', minutes_to_reply: '', breached: true, by_expected: false, covering_missed: false, snippet: '', updated_at: '', due_at: ISO(NOW - 86400000), next_shift: false },
          { message_id: 'sm2', thread_id: 'st2', kind: 'chargeback', subject: 'Chargeback', from_email: 'b@x.com', received_at: ISO(NOW - 86400000), expected_tls: 'noha@dabdoob.com', status: 'replied', replied_at: ISO(NOW - 80000000), replied_by: 'menna@dabdoob.com', minutes_to_reply: 120, breached: false, by_expected: false, covering_missed: true, snippet: '', updated_at: '', due_at: ISO(NOW + 86400000), next_shift: false },
          { message_id: 'sm3', thread_id: 'st3', kind: 'refund_status', subject: 'Refund', from_email: 'a@myfatoorah.com', received_at: ISO(NOW - 86400000), expected_tls: 'menna@dabdoob.com', status: 'replied', replied_at: ISO(NOW - 70000000), replied_by: 'noha@dabdoob.com', minutes_to_reply: 30, breached: false, by_expected: false, covering_missed: true, snippet: '', updated_at: '', due_at: ISO(NOW + 86400000), next_shift: false },
        ],
        ...over.tables,
      },
      ...over,
    })

  /** Port area objects carry kb:null where legacy simply never sets the key — strip it when null on both sides. */
  const stripNullKb = (res: { ok?: unknown; err?: string }) => {
    const out = json(res) as { ok?: { areas?: { kb?: unknown }[] } }
    if (out.ok && Array.isArray(out.ok.areas)) out.ok.areas.forEach((a) => { if (a.kb === null) delete a.kb })
    return out
  }
  const pageSame = async (f: DeskFx, tl: string) => {
    const fixture = deskInstall(f)
    const legacyRes = deskCall('tlPerformancePage', [tl], fixture)
    const portRes = await portCall(() => tlPerformancePage(tl))
    expectSame(stripNullKb(portRes), stripNullKb(legacyRes), 'tlPerformancePage ' + tl)
    return { legacyRes, portRes }
  }

  it('the full page matches for an admin viewing a TL', async () => {
    await pageSame(perfFx(), 'noha@dabdoob.com')
  })
  it('a TL sees her own page', async () => {
    await pageSame(perfFx({ userEmail: 'noha@dabdoob.com' }), 'noha@dabdoob.com')
    await pageSame(perfFx({ userEmail: 'noha@dabdoob.com' }), '') // empty: defaults to self
  })
  it('a TL viewing another TL is refused identically', async () => {
    await pageSame(perfFx({ userEmail: 'menna@dabdoob.com' }), 'noha@dabdoob.com')
  })
  it('an agent / unknown is refused identically', async () => {
    await pageSame(perfFx({ userEmail: 'agent@dabdoob.com' }), 'noha@dabdoob.com')
    await pageSame(perfFx({ userEmail: 'outsider@dabdoob.com' }), 'noha@dabdoob.com')
  })
  it('admin with no tlEmail picks the first TL', async () => {
    await pageSame(perfFx(), '')
  })
  it('a KB-owning TL picks up the kb metrics block', async () => {
    const f = perfFx({
      userEmail: 'admin@dabdoob.com',
      tables: {
        tlp_kb: [
          { kb_id: 'k1', topic: 'Ajex returns', requested_at: ISO(NOW - 10 * 86400000), done_at: ISO(NOW - 9 * 86400000), accurate: 'yes', owner_email: 'menna@dabdoob.com', note: '', created_by: 'admin@dabdoob.com', created_at: '', updated_at: '' },
          { kb_id: 'k2', topic: 'Refund window', requested_at: ISO(NOW - 3 * 86400000), done_at: '', accurate: '', owner_email: '', note: '', created_by: 'admin@dabdoob.com', created_at: '', updated_at: '' },
        ],
      },
    })
    // menna owns 'Knowledge base' -> areas.some(KB) -> the kb block is read on both sides.
    await pageSame(f, 'menna@dabdoob.com')
  })
  it('an OTD-owning TL picks up the otd block', async () => {
    const f = perfFx({
      tables: {
        tlp_otd: [
          { key: '2026-10|0', month: '2026-10', warehouse: 0, value: 92, entered_by: 'admin@dabdoob.com', entered_at: ISO(NOW - 86400000) },
          { key: '2026-10|2', month: '2026-10', warehouse: 2, value: 77, entered_by: 'admin@dabdoob.com', entered_at: ISO(NOW - 86400000) },
          { key: '2026-09|0', month: '2026-09', warehouse: 0, value: 100, entered_by: 'admin@dabdoob.com', entered_at: ISO(NOW - 30 * 86400000) },
        ],
      },
    })
    await pageSame(f, 'esmail@dabdoob.com') // owns 'OTD'
  })
  it('empty stores render the same skeleton', async () => {
    await pageSame(perfFx({ tables: { tlp_team: [], tlp_resp_ratings: [], tlp_area_metrics: [], tlp_queue_daily: [], actions: [], action_task_details: [], mail_sla: [] } }), 'noha@dabdoob.com')
  })
})

// =====================================================================
// TL performance writes
// =====================================================================

describe('tlpRateArea (TlPerformance.js)', () => {
  it('rates and upserts the same row', async () => {
    const f = fx({ tables: { tlp_resp_ratings: [] } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 80, 'Solid week'], fixture)
    const portRes = await portCall(() => tlpRateArea('noha@dabdoob.com', 'Refunds', 80, 'Solid week'))
    expectSame(portRes, legacyRes, 'tlpRateArea')
    expectStoreSame('tlp_resp_ratings', 'tlp_resp_ratings', 'ratings after rate')
    const row = deskStore('tlp_resp_ratings')[0]
    expect(row.rating_id).toBe('2026-10-04|noha@dabdoob.com|Refunds') // current CX week
  })
  it('a second rating for the same week+area overwrites', async () => {
    const seeded = [{ rating_id: '2026-10-04|noha@dabdoob.com|Refunds', tl_email: 'noha@dabdoob.com', week: '2026-10-04', area: 'Refunds', rating: 60, note: 'old', rated_by: 'k.elnaggar@dabdoob.com', rated_at: ISO(NOW - 3600000) }]
    const f = fx({ tables: { tlp_resp_ratings: seeded } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 85, 'better'], fixture)
    const portRes = await portCall(() => tlpRateArea('noha@dabdoob.com', 'Refunds', 85, 'better'))
    expectSame(portRes, legacyRes, 'tlpRateArea overwrite')
    expectStoreSame('tlp_resp_ratings', 'tlp_resp_ratings', 'ratings after overwrite')
  })
  it('validation order and messages match', async () => {
    const f = fx({ tables: { tlp_resp_ratings: [] } })
    const cases: [string, string, unknown, string?][] = [
      ['noha@dabdoob.com', 'Refunds', 33.5, 'bad'], // not a step of 5
      ['noha@dabdoob.com', 'Refunds', 101, 'bad'],
      ['noha@dabdoob.com', 'Refunds', 50, 'short'], // below meets + note < 10
      ['noha@dabdoob.com', 'Nope', 80, 'ok long enough'],
      ['nobody@dabdoob.com', 'Refunds', 80, 'ok long enough'], // tl not on roster: tlpAreasFor_ empty
      ['noha@dabdoob.com', 'Refunds', 50, 'a note long enough for below'], // below WITH a note -> saves
    ]
    for (const [tl, area, v, note] of cases) {
      await deskSame('tlpRateArea', [tl, area, v, note], f, () => tlpRateArea(tl, area, v, note), 'rate ' + JSON.stringify([tl, area, v, note]))
    }
  })
  it('permission refusals match', async () => {
    const f = fx({ tables: { tlp_resp_ratings: [] } })
    const self = { ...f, userEmail: 'noha@dabdoob.com' }
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 80, 'x'], self, () => tlpRateArea('noha@dabdoob.com', 'Refunds', 80, 'x'), 'rate self')
    const otherTl = { ...f, userEmail: 'menna@dabdoob.com' }
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 80, 'x'], otherTl, () => tlpRateArea('noha@dabdoob.com', 'Refunds', 80, 'x'), 'rate other tl')
    const agent = { ...f, userEmail: 'agent@dabdoob.com' }
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 80, 'x'], agent, () => tlpRateArea('noha@dabdoob.com', 'Refunds', 80, 'x'), 'rate as agent')
    const karim = { ...f, userEmail: 'k.elnaggar@dabdoob.com' } // roster-admin manager
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 80, 'x'], karim, () => tlpRateArea('noha@dabdoob.com', 'Refunds', 80, 'x'), 'rate as manager')
  })
  it('view-as refuses a valid rating identically', async () => {
    const f = fx({
      tables: {
        tlp_resp_ratings: [],
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'noha@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 80, 'long enough note'], f, () => tlpRateArea('noha@dabdoob.com', 'Refunds', 80, 'long enough note'))
  })
})

describe('tlpRateProject (TlPerformance.js)', () => {
  const actions = [
    { action_id: 'act-1', owner_email: 'noha@dabdoob.com', title: 'Refunds SLA revamp', status: 'done', track_as_task: true, submitted_by: 'x', submitted_at: ISO(NOW - 20 * 86400000) },
    { action_id: 'act-open', owner_email: 'noha@dabdoob.com', title: 'Still running', status: 'open', track_as_task: true, submitted_by: 'x', submitted_at: ISO(NOW - 10 * 86400000) },
  ]
  const details = [
    { action_id: 'act-1', expectation: '100% within SLA', deadline_at: ISO(NOW - 15 * 86400000), delivered_at: ISO(NOW - 10 * 86400000), outcome_rating: '', outcome_note: '', rated_by: '', rated_at: '', submitted_by: 'x', submitted_at: ISO(NOW - 20 * 86400000), updated_by: 'pre@dabdoob.com', updated_at: '2020-01-01T00:00:00.000Z' },
    { action_id: 'act-open', expectation: '', deadline_at: ISO(NOW - 86400000), delivered_at: '', outcome_rating: '', outcome_note: '', rated_by: '', rated_at: '', updated_by: '', updated_at: '' },
  ]
  const rateFx = (over: DeskFx = {}): DeskFx =>
    fx({
      tables: { actions, action_task_details: details, action_updates: [] },
      // The appendRows_ Core-tab seam: an empty actions-history tab still carries its headers.
      headers: { action_updates: ['update_id', 'action_id', 'kind', 'note', 'submitted_by', 'submitted_at'] },
      ...over,
    })

  it('rates a delivered task: envelope + rows (with two documented diffs)', async () => {
    const f = rateFx()
    const fixture = deskInstall(f)
    const legacyRes = deskCall('tlpRateProject', ['act-1', 90, 'Clean delivery'], fixture)
    const portRes = await portCall(() => tlpRateProject('act-1', 90, 'Clean delivery'))
    expectSame(portRes, legacyRes, 'tlpRateProject')
    // Documented write diff on action_task_details:
    //  legacy writes rated_at through pwTxt_ (' prefix); the port stores the plain ISO.
    //  (updated_by/updated_at stamping was brought over with updateRow_ — identical now.)
    const legacyDetail = deskTable('action_task_details').find((r) => r.action_id === 'act-1')!
    const portDetail = (hubDb.tables.action_task_details || []).find((r) => r.action_id === 'act-1')!
    expect(String(legacyDetail.rated_at).replace(/^'/, '')).toBe(ISO(NOW))
    expect(legacyDetail.updated_by).toBe('admin@dabdoob.com')
    expect(String(legacyDetail.updated_at)).toBe(ISO(NOW))
    expect(portDetail.rated_at).toBe(ISO(NOW))
    expect(portDetail.updated_by).toBe('admin@dabdoob.com')
    expect(portDetail.updated_at).toBe(ISO(NOW))
    // The shared fields still match, ' normalized.
    const strip = (r: Row) => {
      const c = { ...(JSON.parse(JSON.stringify(r)) as Row) }
      delete c._row
      delete c.id
      delete c.updated_by
      delete c.updated_at
      c.rated_at = String(c.rated_at).replace(/^'/, '')
      return c
    }
    expect(strip(portDetail)).toEqual(strip(legacyDetail))
    // action_updates: same history row appended on both sides.
    expectTabSame('action_updates', 'action_updates', 'action_updates after rating')
    const upd = deskTable('action_updates')[0]
    expect(upd.kind).toBe('status')
    expect(String(upd.note)).toBe('Rated 90 (meets) against the expectation by Admin Person: Clean delivery')
  })
  it('validation and permission errors match', async () => {
    const cases: [string, unknown, string?, DeskFx?][] = [
      ['ghost', 90, 'x', undefined],
      ['act-open', 90, 'x', undefined], // not done yet
      ['act-1', 33.5, 'x', undefined],
      ['act-1', 50, 'short', undefined], // below + short note
      ['act-1', 80, 'x', { userEmail: 'menna@dabdoob.com' }], // a TL who is not the owner's manager
      ['act-1', 80, 'x', { userEmail: 'agent@dabdoob.com' }], // agent: requireRole fails
    ]
    for (const [id, v, note, over] of cases) {
      const f = rateFx(over || {})
      await deskSame('tlpRateProject', [id, v, note], f, () => tlpRateProject(id, v, note), 'rateProject ' + JSON.stringify([id, v, note]))
    }
  })
})

describe('kbTrackerPage / kbTrackerSave (TlPerformance.js)', () => {
  const kbRows = [
    { kb_id: 'KB_old1', topic: 'Ajex returns', requested_at: ISO(NOW - 10 * 86400000), done_at: ISO(NOW - 9 * 86400000), accurate: 'yes', owner_email: 'menna@dabdoob.com', note: 'done', created_by: 'admin@dabdoob.com', created_at: ISO(NOW - 10 * 86400000), updated_at: ISO(NOW - 9 * 86400000) },
    { kb_id: 'KB_old2', topic: 'Refund window', requested_at: ISO(NOW - 3 * 86400000), done_at: '', accurate: '', owner_email: '', note: '', created_by: 'admin@dabdoob.com', created_at: ISO(NOW - 3 * 86400000), updated_at: ISO(NOW - 3 * 86400000) },
    { kb_id: 'KB_ancient', topic: 'Ancient done', requested_at: ISO(NOW - 100 * 86400000), done_at: ISO(NOW - 95 * 86400000), accurate: 'no', owner_email: 'menna@dabdoob.com', note: '', created_by: 'x', created_at: '', updated_at: '' }, // > 90d and done -> filtered
  ]
  const kbFx = (over: DeskFx = {}): DeskFx => fx({ tables: { tlp_kb: kbRows.map((r) => ({ ...r })) }, ...over })

  it('the page payload matches (admin editor, KB owner, non-owner)', async () => {
    await deskSame('kbTrackerPage', [], kbFx(), () => kbTrackerPage(), 'kb page admin')
    await deskSame('kbTrackerPage', [], kbFx({ userEmail: 'menna@dabdoob.com' }), () => kbTrackerPage(), 'kb page owner')
    await deskSame('kbTrackerPage', [], kbFx({ userEmail: 'noha@dabdoob.com' }), () => kbTrackerPage(), 'kb page non-owner')
    await deskSame('kbTrackerPage', [], kbFx({ userEmail: 'agent@dabdoob.com' }), () => kbTrackerPage(), 'kb page agent')
  })
  it('adding a row writes the same record (done_at "" <-> null documented)', async () => {
    const f = kbFx()
    const fixture = deskInstall(f)
    const input = { topic: 'Refund SLA exceptions', requestedAt: '2026-10-06T10:00', doneAt: '2026-10-08T08:00', accurate: 'yes', ownerEmail: 'menna@dabdoob.com', note: 'first pass' }
    const legacyRes = deskCall('kbTrackerSave', [input], fixture)
    const portRes = await portCall(() => kbTrackerSave(input))
    expectSame(portRes, legacyRes, 'kbTrackerSave add')
    // The stored done_at: legacy '' vs port '' — but an EMPTY doneAt shows the seam:
    const legacyRow = deskStore('tlp_kb').find((r) => r.topic === 'Refund SLA exceptions')!
    const portRow = (hubDb.tables.tlp_kb || []).find((r) => r.topic === 'Refund SLA exceptions')!
    expect(legacyRow.kb_id).toBe(portRow.kb_id) // deterministic newId_ on both sides
    const strip = (r: Row) => {
      const c = { ...(JSON.parse(JSON.stringify(r)) as Row) }
      delete c._row
      delete c.id
      return c
    }
    expect(strip(portRow)).toEqual(strip(legacyRow))
  })
  it('an empty doneAt stores ""/null on the two sides (documented seam)', async () => {
    const f = kbFx()
    const fixture = deskInstall(f)
    const input = { topic: 'Open request', requestedAt: '2026-10-07T09:00', accurate: '', note: '' }
    const legacyRes = deskCall('kbTrackerSave', [input], fixture)
    const portRes = await portCall(() => kbTrackerSave(input))
    // The RETURN object is identical; only the stored cell differs.
    expectSame(portRes, legacyRes, 'kbTrackerSave open')
    const legacyRow = deskStore('tlp_kb').find((r) => r.topic === 'Open request')!
    const portRow = (hubDb.tables.tlp_kb || []).find((r) => r.topic === 'Open request')!
    expect(legacyRow.done_at).toBe('')
    expect(portRow.done_at).toBe(null)
    expectStoreSame('tlp_kb', 'tlp_kb', 'tlp_kb after open save (null->"")')
  })
  it('editing an existing row keeps kb_id and created_* fields', async () => {
    const f = kbFx()
    const fixture = deskInstall(f)
    const input = { id: 'KB_old2', topic: 'Refund window updated', requestedAt: '2026-10-05T09:00', doneAt: '2026-10-08T07:30', accurate: 'no', note: 'checked' }
    const legacyRes = deskCall('kbTrackerSave', [input], fixture)
    const portRes = await portCall(() => kbTrackerSave(input))
    expectSame(portRes, legacyRes, 'kbTrackerSave edit')
    expectStoreSame('tlp_kb', 'tlp_kb', 'tlp_kb after edit')
  })
  it('validation errors match', async () => {
    const cases: Record<string, unknown>[] = [
      { topic: 'ab', requestedAt: '2026-10-07T09:00' }, // topic < 3
      { topic: 'Good topic', requestedAt: '' },
      { topic: 'Good topic', requestedAt: '2026-10-07T09:00', doneAt: '2026-10-06T09:00' }, // done < requested
      { id: 'KB_ghost', topic: 'Good topic', requestedAt: '2026-10-07T09:00' }, // unknown id
      { topic: 'Good topic', requestedAt: 'not a date' },
      { topic: 'Good topic', requestedAt: '2026-10-07T09:00', accurate: 'sometimes' }, // normalized to ''
    ]
    for (const input of cases) {
      await deskSame('kbTrackerSave', [input], kbFx(), () => kbTrackerSave(input as never), 'kbSave ' + JSON.stringify(input))
    }
    const noha = kbFx({ userEmail: 'noha@dabdoob.com' })
    await deskSame('kbTrackerSave', [{ topic: 'Good topic', requestedAt: '2026-10-07T09:00' }], noha, () =>
      kbTrackerSave({ topic: 'Good topic', requestedAt: '2026-10-07T09:00' }), 'kbSave non-owner',
    )
    const agent = kbFx({ userEmail: 'agent@dabdoob.com' })
    await deskSame('kbTrackerSave', [{ topic: 'Good topic', requestedAt: '2026-10-07T09:00' }], agent, () =>
      kbTrackerSave({ topic: 'Good topic', requestedAt: '2026-10-07T09:00' }), 'kbSave agent',
    )
  })
})

describe('otdSave (TlPerformance.js): the pwTxt_ read asymmetry', () => {
  const otdFx = (over: DeskFx = {}): DeskFx => fx({ tables: { tlp_otd: [] }, ...over })

  it('legacy writes "\'2026-10" cells its own tlpOtd_ then cannot read — the port repaired the read', async () => {
    // A REAL legacy asymmetry: otdSave stores month as pwTxt_ ("'2026-10") and
    // tlpOtd_ matches String(x.month) === '2026-10' with no pwStr_ — so on GAS the
    // just-written values are invisible to the page. The port stores the plain
    // month AND strips a leading ' on read, so it sees both shapes.
    const f = otdFx()
    const fixture = deskInstall(f)
    const values = [90, 95, '', 80, 70, 100, 88]
    const legacyRes = deskCall('otdSave', ['2026-10', values], fixture)
    const portRes = await portCall(() => otdSave('2026-10', values))
    // Envelopes differ BY DESIGN here: legacy tlpOtd_ misses its own rows.
    expect(legacyRes.err).toBeUndefined()
    expect(portRes.err).toBeUndefined()
    const lmonths = (legacyRes.ok as { months: { values: (number | null)[] }[] }).months
    const pmonths = (portRes.ok as { months: { values: (number | null)[] }[] }).months
    const lcur = lmonths.find((m) => (m as { month?: string }).month === '2026-10')!
    const pcur = pmonths.find((m) => (m as { month?: string }).month === '2026-10')!
    expect(lcur.values.every((v) => v === null)).toBe(true) // legacy cannot read its own write
    expect(pcur.values).toEqual([90, 95, null, 80, 70, 100, 88])
    // The stored cells differ only by the ' marker and ''<->null on cleared values.
    const legacyRows = deskStore('tlp_otd').filter((r) => String(r.key).indexOf('2026-10|') === 0)
    const portRows = (hubDb.tables.tlp_otd || []).filter((r) => String(r.key).indexOf('2026-10|') === 0)
    expect(legacyRows.length).toBe(7)
    expect(portRows.length).toBe(7)
    legacyRows.forEach((r) => expect(String(r.month)).toBe("'2026-10"))
    portRows.forEach((r) => expect(String(r.month)).toBe('2026-10'))
    const cleared = portRows.find((r) => r.key === '2026-10|2')!
    const clearedL = legacyRows.find((r) => r.key === '2026-10|2')!
    expect(clearedL.value).toBe('')
    expect(cleared.value).toBe(null)
  })
  it('pre-existing plain rows read identically on both sides', async () => {
    const f = otdFx({
      tables: {
        tlp_otd: [
          { key: '2026-09|0', month: '2026-09', warehouse: 0, value: 92, entered_by: 'admin@dabdoob.com', entered_at: ISO(NOW - 30 * 86400000) },
          { key: '2026-09|1', month: "'2026-09", warehouse: 1, value: 70, entered_by: 'admin@dabdoob.com', entered_at: ISO(NOW - 30 * 86400000) }, // a legacy-written cell: port sees it, legacy misses it
          { key: '2026-10|0', month: '2026-10', warehouse: 0, value: 88, entered_by: 'admin@dabdoob.com', entered_at: ISO(NOW - 86400000) },
        ],
      },
    })
    const fixture = deskInstall(f)
    // tlpOtd_ is not exported on either side; the page's otd block exposes it.
    const legacyRes = deskCall('otdSave', ['2026-10', [50]], fixture)
    const portRes = await portCall(() => otdSave('2026-10', [50]))
    const months = (r: { ok?: unknown; err?: string }) =>
      ((((r as { ok?: { months?: { month: string; values: (number | null)[] }[] } }).ok || {}).months || [])).filter(
        (m) => m.month === '2026-09',
      )[0]
    expect(months(legacyRes).values).toEqual([92, null, null, null, null, null, null]) // legacy misses the '2026-09 cell
    expect(months(portRes).values).toEqual([92, 70, null, null, null, null, null]) // port reads both shapes
  })
  it('validation errors match', async () => {
    const cases: [string, unknown[], DeskFx?][] = [
      ['26-10', [90], undefined],
      ['2026-1', [90], undefined],
      ['2026-10', [90, 101], undefined],
      ['2026-10', [90, 'x'], undefined],
      ['2026-10', [90, -1], undefined],
      ['2026-10', [90], { userEmail: 'noha@dabdoob.com' }], // not the OTD owner
      ['2026-10', [90], { userEmail: 'agent@dabdoob.com' }], // requireRole fails
      ['2026-10', [], undefined], // empty list writes nothing
    ]
    for (const [m, v, over] of cases) {
      const f = otdFx(over || {})
      await deskSame('otdSave', [m, v], f, () => otdSave(m, v), 'otdSave ' + JSON.stringify([m, v, over && over.userEmail]))
    }
  })
})

describe('setupDesk (TlPerformance.js)', () => {
  it('seeds settings, fills tlp_tl_areas from roster names, adds the manager to admin_emails', async () => {
    // Raw fixture: NO config keys at all (deskInstall still injects ss_live_id),
    // so every TLP_SETTINGS/MD_SETTINGS default gets seeded.
    const f: DeskFx = {
      userEmail: 'admin@dabdoob.com', nowMs: NOW, scriptTz: 'Asia/Kuwait',
      settings: {}, tables: { roster: ROSTER.map((r) => ({ ...r })) },
    }
    const fixture = deskInstall(f)
    const legacyRes = deskCall('setupDesk', [], fixture)
    const portRes = await portCall(() => setupDesk())
    expectSame(portRes, legacyRes, 'setupDesk report')
    // Config values identical; updated_by identical too (legacy stamps the real actor
    // via actorEmail_, the port's setConfig now stamps the same user email).
    const legacyCfg = deskTable('Config')
    const portCfg = hubDb.tables.config || []
    const value = (rows: Row[]) => {
      const o: Row = {}
      rows.forEach((r) => { o[String(r.key)] = r.value })
      return o
    }
    const lv = value(legacyCfg), pv = value(portCfg)
    Object.keys(lv).forEach((k) => expect(pv[k]).toEqual(lv[k]))
    const seeded = legacyCfg.filter((r) => String(r.key).indexOf('tlp_') === 0 || String(r.key).indexOf('mail_') === 0)
    expect(seeded.length).toBeGreaterThan(5)
    expect(seeded.every((r) => r.updated_by === 'admin@dabdoob.com')).toBe(true)
    expect((portCfg.find((r) => r.key === 'tlp_weights') || {}).updated_by).toBe('admin@dabdoob.com')
    expect(JSON.parse(String(pv.tlp_tl_areas))).toEqual(JSON.parse(String(lv.tlp_tl_areas)))
    expect(pv.admin_emails).toContain('k.elnaggar@dabdoob.com')
  })
  it('is idempotent and refuses non-admins identically', async () => {
    const f = fx({ settings: { admin_emails: 'admin@dabdoob.com,k.elnaggar@dabdoob.com' } }) // keys already set -> 'left as it is.'
    await deskSame('setupDesk', [], f, () => setupDesk(), 'setupDesk idempotent')
    const agent = fx({ userEmail: 'agent@dabdoob.com' })
    await deskSame('setupDesk', [], agent, () => setupDesk(), 'setupDesk as agent')
  })
})

// =====================================================================
// KPI logs (KpiLogs.js)
// =====================================================================

describe('kpiLogSave (KpiLogs.js): validation + writes', () => {
  const logFx = (over: DeskFx = {}): DeskFx =>
    fx({
      tables: { kpi_behaviour_log: [], kpi_leave_log: [], tlp_ticket_exclusions: [] },
      ...over,
    })

  it('valid behaviour save: envelope + deterministic log_id + row parity', async () => {
    const f = logFx()
    const fixture = deskInstall(f)
    const legacyRes = deskCall('kpiLogSave', ['behaviour', { email: 'agent@dabdoob.com', date: '2026-10-07', note: 'Rude to a customer' }], fixture)
    const portRes = await portCall(() => kpiLogSave('behaviour', { email: 'agent@dabdoob.com', date: '2026-10-07', note: 'Rude to a customer' }))
    expectSame(portRes, legacyRes, 'kpiLogSave behaviour')
    expectStoreSame('kpi_behaviour_log', 'kpi_behaviour_log', 'behaviour log after save')
    const row = deskStore('kpi_behaviour_log')[0]
    expect(String(row.log_id)).toMatch(/^BH_[0-9a-z]+[0-9a-z]{4}$/) // deterministic under the pinned Math.random
    expect((hubDb.tables.kpi_behaviour_log || [])[0].log_id).toBe(row.log_id)
  })
  it('valid leave save: envelope + row parity', async () => {
    const f = logFx()
    const fixture = deskInstall(f)
    const input = { email: 'agent@dabdoob.com', from: '2026-10-05', to: '2026-10-06', type: 'Emergency', note: 'hospital' }
    const legacyRes = deskCall('kpiLogSave', ['leave', input], fixture)
    const portRes = await portCall(() => kpiLogSave('leave', input))
    expectSame(portRes, legacyRes, 'kpiLogSave leave')
    expectStoreSame('kpi_leave_log', 'kpi_leave_log', 'leave log after save')
    expect(deskStore('kpi_leave_log')[0].log_id).toMatch(/^LV_/)
  })
  it('leave with no "to" defaults to the from date on both sides', async () => {
    const input = { email: 'agent@dabdoob.com', from: '2026-10-05', type: 'Sick', note: '' }
    await deskSame('kpiLogSave', ['leave', input], logFx(), () => kpiLogSave('leave', input))
  })
  it('valid exclusion save: rows parity modulo removed_at ""<->null', async () => {
    const f = logFx()
    const fixture = deskInstall(f)
    const input = { area: 'Returns', ticketIds: ' 1001, #1002;1003  1004 ', reason: 'Ajex handling' }
    const legacyRes = deskCall('kpiLogSave', ['exclusion', input], fixture)
    const portRes = await portCall(() => kpiLogSave('exclusion', input))
    expectSame(portRes, legacyRes, 'kpiLogSave exclusion')
    // removed_at: legacy stores '' in the row object; the port writes null (the documented seam).
    const legacyRows = deskStore('tlp_ticket_exclusions').filter((r) => r.logged_by === 'admin@dabdoob.com')
    const portRows = (hubDb.tables.tlp_ticket_exclusions || []).filter((r) => r.logged_by === 'admin@dabdoob.com')
    expect(legacyRows.length).toBe(4)
    expect(portRows.length).toBe(4)
    expect(legacyRows.every((r) => r.removed_at === '')).toBe(true)
    expect(portRows.every((r) => r.removed_at === null)).toBe(true)
    expectStoreSame('tlp_ticket_exclusions', 'tlp_ticket_exclusions', 'exclusions after save (null->"")')
    expect(legacyRows.map((r) => r.key).sort()).toEqual(['Returns|1001', 'Returns|1002', 'Returns|1003', 'Returns|1004'])
  })
  it('behaviour validation errors match', async () => {
    const f = logFx()
    const cases: [string, Record<string, unknown>][] = [
      ['bogus', {}], // Unknown log.
      ['behaviour', { date: '2026-10-07', note: 'long enough note' }], // no email
      ['behaviour', { email: 'nobody@dabdoob.com', date: '2026-10-07', note: 'long enough note' }], // not on roster
      ['behaviour', { email: 'noha@dabdoob.com', date: '2026-10-07', note: 'long enough note' }], // a TL, not an agent
      ['behaviour', { email: 'agent@dabdoob.com', date: '07/10/2026', note: 'long enough note' }], // bad date
      ['behaviour', { email: 'agent@dabdoob.com', date: '2026-10-07', note: 'abc' }], // note < 5
      ['behaviour', { email: 'agent@dabdoob.com', date: '2026-10-07', note: '' }],
      ['behaviour', { email: 'AGENT@dabdoob.com', date: '2026-10-07', note: 'upper ok — normalized' }], // upper-case email normalises
    ]
    for (const [kind, input] of cases) {
      await deskSame('kpiLogSave', [kind, input], f, () => kpiLogSave(kind, input), 'save ' + JSON.stringify([kind, input]))
    }
  })
  it('leave validation errors match', async () => {
    const f = logFx()
    const cases: Record<string, unknown>[] = [
      { email: 'agent@dabdoob.com', from: 'bad', to: '2026-10-06', type: 'Sick' },
      { email: 'agent@dabdoob.com', from: '2026-10-06', to: 'bad', type: 'Sick' },
      { email: 'agent@dabdoob.com', from: '2026-10-07', to: '2026-10-06', type: 'Sick' }, // to < from
      { email: 'agent@dabdoob.com', from: '2026-10-06', to: '2026-10-06', type: 'Holiday' }, // not a leave type
      { email: 'agent@dabdoob.com', from: '2026-10-06', to: '2026-10-06', type: '' },
      { email: 'agent@dabdoob.com', from: '2026-10-06', to: '2026-10-06', type: 'sick' }, // case-sensitive type
      { email: 'noha@dabdoob.com', from: '2026-10-06', type: 'Sick' }, // not an agent
      { email: 'agent@dabdoob.com', from: '2026-10-06', type: 'Absent without notice' },
      { email: 'agent@dabdoob.com', from: '2026-10-06', type: 'Other' },
    ]
    for (const input of cases) {
      await deskSame('kpiLogSave', ['leave', input], f, () => kpiLogSave('leave', input), 'leave ' + JSON.stringify(input))
    }
  })
  it('exclusion validation errors match', async () => {
    const cases: [Record<string, unknown>, DeskFx?][] = [
      [{ area: 'Nowhere', ticketIds: '1001', reason: 'good reason' }, undefined],
      [{ area: '', ticketIds: '1001', reason: 'good reason' }, undefined],
      [{ area: 'Refunds', ticketIds: '1001', reason: 'good reason' }, { userEmail: 'menna@dabdoob.com' }], // not her area
      [{ area: 'Returns', ticketIds: '', reason: 'good reason' }, undefined],
      [{ area: 'Returns', ticketIds: 'abc', reason: 'good reason' }, undefined],
      [{ area: 'Returns', ticketIds: '1001 x', reason: 'good reason' }, undefined],
      [{ area: 'Returns', ticketIds: '1234567890123', reason: 'good reason' }], // 13 digits > 12
      [{ area: 'Returns', ticketIds: '1001', reason: 'ab' }, undefined],
      [{ area: 'Returns', ticketIds: '1001', reason: '' }, undefined],
      [{ area: 'Refunds', ticketIds: '1001', reason: 'good reason' }, { userEmail: 'noha@dabdoob.com' }], // her area -> saves
      [{ area: 'Returns', ticketIds: '1001', reason: 'good reason' }, { userEmail: 'agent@dabdoob.com' }], // requireRole fails
    ]
    for (const [input, over] of cases) {
      const f = logFx(over || {})
      await deskSame('kpiLogSave', ['exclusion', input], f, () => kpiLogSave('exclusion', input), 'excl ' + JSON.stringify([input, over && over.userEmail]))
    }
  })
  it('view-as refuses a valid save identically', async () => {
    const f = logFx({
      tables: {
        kpi_behaviour_log: [], kpi_leave_log: [], tlp_ticket_exclusions: [],
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'agent@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
    await deskSame('kpiLogSave', ['behaviour', { email: 'agent@dabdoob.com', date: '2026-10-07', note: 'long enough' }], f, () =>
      kpiLogSave('behaviour', { email: 'agent@dabdoob.com', date: '2026-10-07', note: 'long enough' }),
    )
  })
})

describe('kpiLogRemove (KpiLogs.js)', () => {
  const seededFx = (over: DeskFx = {}): DeskFx =>
    fx({
      tables: {
        kpi_behaviour_log: [
          { log_id: 'BH_keep', email: 'agent@dabdoob.com', date: '2026-10-01', note: 'Rude', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 7 * 86400000), removed_by: '', removed_at: '' },
          { log_id: 'BH_gone', email: 'agent@dabdoob.com', date: '2026-10-02', note: 'Old', logged_by: 'noha@dabdoob.com', logged_at: ISO(NOW - 6 * 86400000), removed_by: 'admin@dabdoob.com', removed_at: ISO(NOW - 86400000) },
          { log_id: 'BH_menna', email: 'agent2@dabdoob.com', date: '2026-10-03', note: 'Hers', logged_by: 'menna@dabdoob.com', logged_at: ISO(NOW - 5 * 86400000), removed_by: '', removed_at: '' },
        ],
        kpi_leave_log: [],
        tlp_ticket_exclusions: [],
      },
      ...over,
    })

  it('removing a row stamps removed_by/at identically', async () => {
    const f = seededFx()
    const fixture = deskInstall(f)
    const legacyRes = deskCall('kpiLogRemove', ['behaviour', 'BH_keep'], fixture)
    const portRes = await portCall(() => kpiLogRemove('behaviour', 'BH_keep'))
    expectSame(portRes, legacyRes, 'kpiLogRemove')
    expectStoreSame('kpi_behaviour_log', 'kpi_behaviour_log', 'behaviour log after remove')
    const row = deskStore('kpi_behaviour_log').find((r) => r.log_id === 'BH_keep')!
    expect(row.removed_by).toBe('admin@dabdoob.com')
    expect(row.removed_at).toBe(ISO(NOW))
  })
  it('the logger can remove their own; another TL cannot', async () => {
    const menna = seededFx({ userEmail: 'menna@dabdoob.com' })
    await deskSame('kpiLogRemove', ['behaviour', 'BH_menna'], menna, () => kpiLogRemove('behaviour', 'BH_menna'), 'own entry')
    const noha = seededFx({ userEmail: 'noha@dabdoob.com' })
    await deskSame('kpiLogRemove', ['behaviour', 'BH_menna'], noha, () => kpiLogRemove('behaviour', 'BH_menna'), 'not own entry')
  })
  it('missing / already-removed / wrong-kind errors match', async () => {
    const cases: [string, string][] = [
      ['behaviour', 'BH_ghost'],
      ['behaviour', 'BH_gone'], // already removed
      ['leave', 'BH_keep'], // the id exists in a different list
      ['bogus', 'BH_keep'],
    ]
    for (const [kind, id] of cases) {
      await deskSame('kpiLogRemove', [kind, id], seededFx(), () => kpiLogRemove(kind, id), 'remove ' + kind + ' ' + id)
    }
  })
})

describe('kpiLogsPage (KpiLogs.js)', () => {
  const pageFx = (over: DeskFx = {}): DeskFx =>
    fx({
      tables: {
        kpi_behaviour_log: [
          { log_id: 'BH_1', email: 'agent@dabdoob.com', date: '2026-10-01', note: 'Rude to a customer', logged_by: 'noha@dabdoob.com', logged_at: ISO(NOW - 7 * 86400000), removed_by: '', removed_at: '' },
          { log_id: 'BH_2', email: 'agent2@dabdoob.com', date: '2026-09-20', note: 'Second case', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 18 * 86400000), removed_by: '', removed_at: '' },
          { log_id: 'BH_3', email: 'agent@dabdoob.com', date: '2026-01-01', note: 'Too old', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 200 * 86400000), removed_by: '', removed_at: '' }, // > 180d
          { log_id: 'BH_4', email: 'agent@dabdoob.com', date: '2026-10-05', note: 'Removed one', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 3 * 86400000), removed_by: 'noha@dabdoob.com', removed_at: ISO(NOW - 86400000) },
        ],
        kpi_leave_log: [
          { log_id: 'LV_1', email: 'agent@dabdoob.com', from_date: '2026-09-20', to_date: '2026-09-21', type: 'Sick', note: '', logged_by: 'noha@dabdoob.com', logged_at: ISO(NOW - 18 * 86400000), removed_by: '', removed_at: '' },
          { log_id: 'LV_2', email: 'agent2@dabdoob.com', from_date: '2026-10-04', to_date: '', type: 'Emergency', note: '', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 4 * 86400000), removed_by: '', removed_at: '' },
        ],
        tlp_ticket_exclusions: [
          { key: 'Returns|1001', area: 'Returns', ticket_id: '1001', reason: 'Ajex', logged_by: 'noha@dabdoob.com', logged_at: ISO(NOW - 86400000), removed_by: '', removed_at: '' },
          { key: 'Refunds|2002', area: 'Refunds', ticket_id: '2002', reason: 'Outside KSA', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 2 * 86400000), removed_by: '', removed_at: '' },
          { key: 'Returns|9999', area: 'Returns', ticket_id: '9999', reason: 'Removed', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 86400000), removed_by: 'admin@dabdoob.com', removed_at: ISO(NOW - 3600000) },
        ],
      },
      ...over,
    })

  it('the full page matches for an admin', async () => {
    await deskSame('kpiLogsPage', [], pageFx(), () => kpiLogsPage())
  })
  it('a TL sees the same page shape (canExclude limited to their areas)', async () => {
    await deskSame('kpiLogsPage', [], pageFx({ userEmail: 'menna@dabdoob.com' }), () => kpiLogsPage(), 'kpi page menna')
    await deskSame('kpiLogsPage', [], pageFx({ userEmail: 'noha@dabdoob.com' }), () => kpiLogsPage(), 'kpi page noha')
  })
  it('an agent / unknown is refused identically', async () => {
    await deskSame('kpiLogsPage', [], pageFx({ userEmail: 'agent@dabdoob.com' }), () => kpiLogsPage(), 'kpi page agent')
    await deskSame('kpiLogsPage', [], pageFx({ userEmail: 'outsider@dabdoob.com' }), () => kpiLogsPage(), 'kpi page unknown')
  })
  it('klAreas_ falls back to [Returns] with no tlp_area_sources', async () => {
    const f = pageFx({ settings: { tlp_area_sources: {} } })
    await deskSame('kpiLogsPage', [], f, () => kpiLogsPage(), 'kpi page default areas')
  })
  it('empty logs render identically', async () => {
    await deskSame('kpiLogsPage', [], pageFx({ tables: { kpi_behaviour_log: [], kpi_leave_log: [], tlp_ticket_exclusions: [] } }), () => kpiLogsPage())
  })
})

// =====================================================================
// Wave-2 extension: residual vectors from specs/megaplan/audits/desk.md §6
// =====================================================================

describe('mdThreads_ (wave-2 extension): grouping, cap, headers, failure', () => {
  it('multi-message threads keep fixture order; rfcId/replyTo/cc extracted', async () => {
    const { port } = await deskSame('mdThreads_', ['any query'], fx({ gmailThreads: THREADS }), () => mdThreads_('any query'))
    const groups = port.ok as Row[][]
    expect(groups.length).toBe(7)
    const t7 = groups.find((g) => g[0].threadId === 't7')!
    expect(t7[0].replyTo).toBe('decisions@vendor.com')
    expect(t7[0].rfcId).toBe('<rfc-t7m1@mail>')
    expect(t7[0].cc).toBe('team@vendor.com, finance@dabdoob.com')
    const t1 = groups.find((g) => g[0].threadId === 't1')!
    expect(t1.map((m) => m.id)).toEqual(['t1m1', 't1m2', 't1m3'])
  })
  it('the 50-thread cap: 51 threads yield 50 groups on both sides', async () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      id: 'cap' + i,
      messages: [gmsg('cap' + i, 'cap' + i + 'm1', NOW - i * 60000, 'alerts@myfatoorah.com', 'Refund Status Update ORD-' + i)],
    }))
    const { port, legacy } = await deskSame('mdThreads_', ['q'], fx({ gmailThreads: many }), () => mdThreads_('q'))
    expect((port.ok as Row[][]).length).toBe(50)
    expect((port.ok as Row[][]).map((g) => g[0].threadId)).toEqual((legacy.ok as Row[][]).map((g) => g[0].threadId))
  })
  it('a get failure propagates the same message on both sides', async () => {
    // thread id == message id 'boom' so the one marker hits Threads.get AND getMessage.
    const boom = [{ id: 'boom', messages: [gmsg('boom', 'boom', NOW - H, 'a@b.com', 'x')] }]
    await deskSame('mdThreads_', ['q'], fx({ gmailThreads: boom, gmailThrowGet: 'boom' }), () => mdThreads_('q'), 'mdThreads_ get failure')
    await deskSame(
      'mdSyncSla_',
      [],
      jobFx({ gmailThreads: boom, gmailThrowGet: 'boom', tables: { tlp_shifts: SHIFTS, mail_sla: [], popups: [], mail_approval_log: [] } }),
      () => mdSyncSla_(),
      'mdSyncSla_ get failure',
    )
  })
})

describe('mdSyncSla_ popup edges (wave-2 extension)', () => {
  const slaFx = (threads: typeof THREADS, tables: Record<string, Row[]> = {}, over: DeskFx = {}): DeskFx =>
    jobFx({ gmailThreads: threads, tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [], ...tables }, ...over })

  it('a mail first seen more than 6h old opens without a popup', async () => {
    const old = [{ id: 'told', messages: [gmsg('told', 'toldm1', NOW - 7 * H, 'alerts@myfatoorah.com', 'Refund Status Update ORD-old')] }]
    const f = slaFx(old)
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncSla_', [], fixture)
    const portRes = await portCall(() => mdSyncSla_())
    expectSame(portRes, legacyRes, 'mdSyncSla_ >6h')
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla >6h')
    expectTabSame('popups', 'Popups', 'popups >6h')
    const pops = normRows(hubDb.tables.popups || []).rows
    expect(pops.length).toBe(0) // the <6h gate suppresses the popup on both sides
    const row = (hubDb.tables.mail_sla || [])[0]
    expect(row.status).toBe('open')
  })

  it('a fresh open mail whose row already existed raises no popup', async () => {
    const t8 = [{ id: 't8', messages: [gmsg('t8', 't8m1', NOW - 30 * 60000, 'alerts@myfatoorah.com', 'Refund Status Update ORD-8')] }]
    const existing = [
      { message_id: 't8m1', thread_id: 't8', kind: 'refund_status', subject: 'Refund Status Update ORD-8', from_email: 'alerts@myfatoorah.com',
        received_at: ISO(NOW - 40 * 60000), expected_tls: 'noha@dabdoob.com', status: 'open', replied_at: '', replied_by: '',
        minutes_to_reply: '', breached: false, by_expected: false, covering_missed: false, snippet: 'seen before',
        updated_at: ISO(NOW - 35 * 60000), due_at: ISO(NOW + H), next_shift: false },
    ]
    const f = slaFx(t8, { mail_sla: existing })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncSla_', [], fixture)
    const portRes = await portCall(() => mdSyncSla_())
    expectSame(portRes, legacyRes, 'mdSyncSla_ existing row')
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla existing')
    expectTabSame('popups', 'Popups', 'popups existing')
    expect(normRows(hubDb.tables.popups || []).rows.length).toBe(0) // `was` exists -> no popup
    expect((hubDb.tables.mail_sla || [])[0].status).toBe('open')
  })

  it('a transition to replied resolves the open popup', async () => {
    const t9 = [
      {
        id: 't9',
        messages: [
          gmsg('t9', 't9m1', NOW - 3 * H, 'alerts@myfatoorah.com', 'Refund Status Update ORD-9'),
          gmsg('t9', 't9m2', NOW - H, 'Noha <noha@dabdoob.com>', 'Re: Refund Status Update ORD-9'),
        ],
      },
    ]
    const seeded = [
      { message_id: 't9m1', thread_id: 't9', kind: 'refund_status', subject: 'Refund Status Update ORD-9', from_email: 'alerts@myfatoorah.com',
        received_at: ISO(NOW - 3 * H), expected_tls: 'noha@dabdoob.com', status: 'open', replied_at: '', replied_by: '',
        minutes_to_reply: '', breached: false, by_expected: false, covering_missed: false, snippet: '',
        updated_at: ISO(NOW - 2 * H), due_at: ISO(NOW + 4 * H), next_shift: false },
    ]
    const popup = [
      { popup_id: 'pop-9', recipient: 'noha@dabdoob.com', kind: 'mail_sla_due', title: 'MyFatoorah refund update: reply needed',
        body: 'needs a reply', link: '#/mail-desk', ref: 't9m1', created_at: ISO(NOW - 3 * H), resolved_at: '',
        submitted_by: 'system:mail_desk', submitted_at: ISO(NOW - 3 * H) },
    ]
    const f = slaFx(t9, { mail_sla: seeded, popups: popup })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncSla_', [], fixture)
    const portRes = await portCall(() => mdSyncSla_())
    expectSame(portRes, legacyRes, 'mdSyncSla_ replied resolves')
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla replied')
    expectTabSame('popups', 'Popups', 'popups resolved')
    const row = (hubDb.tables.mail_sla || [])[0]
    expect(row.status).toBe('replied')
    expect(row.replied_by).toBe('noha@dabdoob.com')
    const pop = (hubDb.tables.popups || [])[0]
    expect(pop.resolved_at).toBe(ISO(NOW))
  })
})

describe('mdOurs_ precedence (wave-2 extension)', () => {
  const oursFx = (threads: typeof THREADS, over: DeskFx = {}): DeskFx =>
    jobFx({ gmailThreads: threads, tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [] }, ...over })

  it('a reply by an admin_emails address counts as ours', async () => {
    const t = [{ id: 'ta', messages: [
      gmsg('ta', 'tam1', NOW - 3 * H, 'alerts@myfatoorah.com', 'Refund Status Update ORD-A'),
      gmsg('ta', 'tam2', NOW - H, 'Admin <admin@dabdoob.com>', 'Re: Refund Status Update ORD-A'),
    ]}]
    await deskSame('mdSyncSla_', [], oursFx(t), () => mdSyncSla_(), 'ours via admins')
    const row = (hubDb.tables.mail_sla || [])[0]
    expect(row.status).toBe('replied')
    expect(row.replied_by).toBe('admin@dabdoob.com')
  })

  it('the effective-user "me" counts as ours in legacy only (pinned D-GOOGLE divergence)', async () => {
    // mohamed.nabil@ is neither roster, admin_emails nor mail_sla_our_senders — but it IS
    // Session.getEffectiveUser() here, and legacy mdOurs_ counts that mailbox as ours.
    // The port has no mailbox identity (the Gmail send adapter owns it — D-GOOGLE), so the
    // same reply stays 'open' there. Pinned so the seam difference is explicit.
    const t = [{ id: 'tm', messages: [
      gmsg('tm', 'tmm1', NOW - 3 * H, 'alerts@myfatoorah.com', 'Refund Status Update ORD-M'),
      gmsg('tm', 'tmm2', NOW - H, 'Mohamed <mohamed.nabil@dabdoob.com>', 'Re: Refund Status Update ORD-M'),
    ]}]
    const f = oursFx(t, { effectiveUserEmail: 'mohamed.nabil@dabdoob.com' })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mdSyncSla_', [], fixture)
    const portRes = await portCall(() => mdSyncSla_())
    expect(legacyRes.ok).toBe('1 response-tracked messages from 1 threads.')
    expect(portRes.ok).toBe(legacyRes.ok) // note text still matches
    const legacyRow = deskStore('mail_sla')[0]
    const portRow = (hubDb.tables.mail_sla || [])[0]
    expect(legacyRow.status).toBe('replied')
    expect(legacyRow.replied_by).toBe('mohamed.nabil@dabdoob.com')
    expect(portRow.status).toBe('open')
    expect(String(portRow.replied_by || '')).toBe('')
  })
})

describe('jobMailDesk half-failure (wave-2 extension)', () => {
  const halfFx = (marker: string): DeskFx =>
    jobFx({ gmailThreads: THREADS, gmailThrowList: marker, tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [] } })

  it('a failed SLA half leaves the approvals half working -> warn heartbeat + joined note', async () => {
    const f = halfFx('chargeback') // the sla query contains it; the approval query does not
    const fixture = deskInstall(f)
    const legacyRes = deskCall('jobMailDesk', [], fixture)
    const portRes = await portCall(() => jobMailDesk())
    expectSame(portRes, legacyRes, 'jobMailDesk sla-fail')
    expect(legacyRes.ok).toEqual({ note: 'Response tracking failed: Gmail list failed (simulated) 2 approval threads.' })
    expectStoreSame('mail_approvals', 'mail_approvals', 'approvals still synced')
    // warn heartbeat: the later implicit ok beat must not downgrade it; the note is the joined line.
    const legacyHealth = deskTable('Health').filter((r) => r.job === 'mail_desk')
    expect(legacyHealth.length).toBe(1)
    expect(legacyHealth[0].last_status).toBe('warn')
    const portHealth = (hubDb.tables.health || []).filter((r) => r.job === 'mail_desk')
    expect(portHealth.length).toBe(1)
    expect(portHealth[0].last_status).toBe('warn')
    expect(portHealth[0].last_note).toBe(legacyHealth[0].last_note)
    expect(deskProps().DQ_LAST_mail_desk).toBe(ISO(NOW))
  })

  it('a failed approvals half leaves the SLA half working -> warn heartbeat + joined note', async () => {
    const f = halfFx('refund approval') // only the approvals query carries it
    const fixture = deskInstall(f)
    const legacyRes = deskCall('jobMailDesk', [], fixture)
    const portRes = await portCall(() => jobMailDesk())
    expectSame(portRes, legacyRes, 'jobMailDesk approvals-fail')
    expect(legacyRes.ok).toEqual({ note: '6 response-tracked messages from 7 threads. Approvals failed: Gmail list failed (simulated)' })
    expectStoreSame('mail_sla', 'mail_sla', 'sla still synced')
    const portHealth = (hubDb.tables.health || []).filter((r) => r.job === 'mail_desk')
    expect(portHealth[0].last_status).toBe('warn')
    expect(deskTable('Health').filter((r) => r.job === 'mail_desk')[0].last_status).toBe('warn')
  })
})

describe('mailDeskRefresh (wave-2 extension)', () => {
  const refreshFx = (over: DeskFx = {}): DeskFx =>
    fx({ gmailThreads: THREADS, tables: { tlp_shifts: SHIFTS, mail_sla: [], mail_approvals: [], popups: [], mail_approval_log: [] }, ...over })

  it('a non-approver TL is refused with the exact message', async () => {
    await deskSame('mailDeskRefresh', [], refreshFx({ userEmail: 'menna@dabdoob.com' }), () => mailDeskRefresh(), 'refresh non-approver')
  })
  it('a non-admin approver passes the refresh gate but requireJobCaller refuses the hand-run', async () => {
    const f = refreshFx({ userEmail: 'noha@dabdoob.com', settings: { mail_approver_emails: ['admin@dabdoob.com', 'k.elnaggar@dabdoob.com', 'noha@dabdoob.com'] } })
    await deskSame('mailDeskRefresh', [], f, () => mailDeskRefresh(), 'refresh approver non-admin')
  })
  it('a roster admin outside admin_emails cannot hand-run the job (requireJobCaller_ gate)', async () => {
    // k.elnaggar passes the refresh gate (roster admin + approver) but
    // requireJobCaller_ checks admin_emails only — refused identically.
    await deskSame('mailDeskRefresh', [], refreshFx({ userEmail: 'k.elnaggar@dabdoob.com' }), () => mailDeskRefresh(), 'refresh roster-admin non-admin_emails')
  })
  it('an admin_emails caller runs the job then re-reads the page', async () => {
    const f = refreshFx() // admin@dabdoob.com: in admin_emails AND mail_approver_emails
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mailDeskRefresh', [], fixture)
    const portRes = await portCall(() => mailDeskRefresh())
    expectSame(portRes, legacyRes, 'mailDeskRefresh admin approver')
    expectStoreSame('mail_sla', 'mail_sla', 'mail_sla after admin refresh')
    expectStoreSame('mail_approvals', 'mail_approvals', 'mail_approvals after admin refresh')
  })
})

describe('installDeskTriggers (wave-2 extension)', () => {
  it('admin: the cadence note differs on purpose (D-SCHED pg_cron vs 10-min trigger)', async () => {
    const f = fx()
    const fixture = deskInstall(f)
    const legacyRes = deskCall('installDeskTriggers', [], fixture)
    const portRes = await portCall(() => installDeskTriggers())
    expect(legacyRes.ok).toBe('Installed: jobMailDesk every 10 minutes.')
    // The port cannot install a GAS trigger; the pg_cron schedule note documents the cadence (WP-15).
    expect(portRes.ok).toBe('Installed: jobMailDesk every 15 minutes (pg_cron per D-SCHED; not installable from the app).')
  })
  it('a non-admin is refused identically', async () => {
    await deskSame('installDeskTriggers', [], fx({ userEmail: 'noha@dabdoob.com' }), () => installDeskTriggers(), 'install non-admin')
    await deskSame('installDeskTriggers', [], fx({ userEmail: 'agent@dabdoob.com' }), () => installDeskTriggers(), 'install agent')
  })
  it('view-as refuses identically (newTrigger_ guard == assertWritable)', async () => {
    const f = fx({
      tables: {
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'k.elnaggar@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
    await deskSame('installDeskTriggers', [], f, () => installDeskTriggers(), 'install view-as')
  })
})

describe('mailDeskPage dryRun + approvals ordering (wave-2 extension)', () => {
  const pageFx = (over: DeskFx = {}): DeskFx =>
    fx({
      props: { DQ_LAST_mail_desk: '2026-10-08T08:00:00.000Z' },
      tables: {
        mail_sla: [],
        mail_approvals: [
          approvalRow(),
          approvalRow({ thread_id: 't6', status: 'approved', decided_by: 'k.elnaggar@dabdoob.com', decided_at: ISO(NOW - 2 * H), sent_status: 'dry_run', updated_at: ISO(NOW - 2 * H) }),
          approvalRow({ thread_id: 't-stuck', status: 'sending', client_token: 'tok-old', updated_at: ISO(NOW - 10 * 60000) }),
        ],
      },
      ...over,
    })

  it("dryRun is false for the string 'false', boolean false, and true when unset", async () => {
    const f1 = pageFx({ settings: { mail_approval_dry_run: 'false' } })
    const { port: p1 } = await deskSame('mailDeskPage', [], f1, () => mailDeskPage(), 'dryRun string false')
    expect((p1.ok as Row).dryRun).toBe(false)
    const f2 = pageFx({ settings: { mail_approval_dry_run: false } })
    const { port: p2 } = await deskSame('mailDeskPage', [], f2, () => mailDeskPage(), 'dryRun boolean false')
    expect((p2.ok as Row).dryRun).toBe(false)
    const f3 = pageFx({ settings: { mail_approval_dry_run: undefined } })
    delete (f3.settings as Record<string, unknown>).mail_approval_dry_run
    const { port: p3 } = await deskSame('mailDeskPage', [], f3, () => mailDeskPage(), 'dryRun default true')
    expect((p3.ok as Row).dryRun).toBe(true)
  })
  it('approvals sort pending-first then receivedAt desc', async () => {
    const { port, legacy } = await deskSame('mailDeskPage', [], pageFx(), () => mailDeskPage(), 'approvals ordering')
    const order = (r: { ok?: unknown }) => ((r.ok as Row).approvals as Row[]).map((a) => a.threadId + ':' + a.status)
    expect(order(port)).toEqual(order(legacy))
    expect((order(port) as string[])[0]).toBe('t7:pending') // pending outranks sending/decided
  })
})

describe('mailApprovalReset 5-minute boundary (wave-2 extension)', () => {
  it('updated_at exactly now-5min still refuses (<=); now-5min-1ms resets', async () => {
    const edge = approvalRow({ status: 'sending', client_token: 'tok-x', decided_by: 'admin@dabdoob.com', updated_at: ISO(NOW - 5 * 60000) })
    await deskSame('mailApprovalReset', ['t7'], fx({ tables: { mail_approvals: [edge], mail_approval_log: [] } }), () => mailApprovalReset('t7'), 'reset exact boundary')
    const past = approvalRow({ status: 'sending', client_token: 'tok-x', decided_by: 'admin@dabdoob.com', updated_at: ISO(NOW - 5 * 60000 - 1) })
    const f = fx({ tables: { mail_approvals: [past], mail_approval_log: [] } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mailApprovalReset', ['t7'], fixture)
    const portRes = await portCall(() => mailApprovalReset('t7'))
    expectSame(portRes, legacyRes, 'reset past boundary')
    expect((legacyRes.ok as Row).status).toBe('pending')
    expectStoreSame('mail_approvals', 'mail_approvals', 'approvals after boundary reset')
  })
})

describe('mailApprovalDecide real-send path (wave-2 extension)', () => {
  const decideFx = (rows: Row[] = [approvalRow()], over: DeskFx = {}): DeskFx =>
    fx({ tables: { mail_approvals: rows, mail_approval_log: [] }, ...over })
  const sendFailStub = () =>
    deskOracle().eval(`Gmail.Users.Messages.send = function () { throw new Error('Gmail send is not configured (GMAIL_SEND_ENABLED + GMAIL_API_URL/GMAIL_API_KEY).'); };`)
  const sendOkStub = () =>
    deskOracle().eval(`Gmail.Users.Messages.send = function (res, u) { (__FIXTURES__.gmailSent = __FIXTURES__.gmailSent || []).push(res); return { id: 'sent-1' }; };`)
  const gmailSent = () => JSON.parse(deskOracle().eval('JSON.stringify(__FIXTURES__.gmailSent || [])')) as { raw: string; threadId: string }[]

  it('unconfigured send: send_failed + pending restore + failed mail_log row (both sides)', async () => {
    sendFailStub() // legacy's Gmail.Users.Messages.send throws what the port's closed adapter would say
    vi.stubEnv('GMAIL_SEND_ENABLED', '')
    vi.stubEnv('GMAIL_API_URL', '')
    vi.stubEnv('GMAIL_API_KEY', '')
    try {
      const f = decideFx([approvalRow()], { settings: { mail_approval_dry_run: false } })
      const fixture = deskInstall(f)
      const legacyRes = deskCall('mailApprovalDecide', ['t7', 'approved', 'ok', 'tok-1'], fixture)
      const portRes = await portCall(() => mailApprovalDecide('t7', 'approved', 'ok', 'tok-1'))
      expectSame(portRes, legacyRes, 'unconfigured send')
      expect(portRes.err).toBe('The reply was not sent (Gmail send is not configured (GMAIL_SEND_ENABLED + GMAIL_API_URL/GMAIL_API_KEY).). The mail is still pending.')
      // The claim rolls back to pending identically.
      expectStoreSame('mail_approvals', 'mail_approvals', 'approvals after send_failed')
      const restored = (hubDb.tables.mail_approvals || [])[0]
      expect(restored.status).toBe('pending')
      expect(restored.client_token).toBe('')
      // mail_approval_log gets the send_failed row with the same error text.
      expectStoreSame('mail_approval_log', 'mail_approval_log', 'log after send_failed')
      const log = (hubDb.tables.mail_approval_log || [])[0]
      expect(log.action).toBe('send_failed')
      expect(log.sent_status).toBe('failed')
      // MailLog records the failed attempt on both sides (sendGmailReply_ always logs;
      // the port logs the same 'failed' row in its closed-adapter branch).
      expectTabSame('mail_log', 'MailLog', 'mail_log after send_failed')
      const ml = (hubDb.tables.mail_log || [])[0]
      expect(ml.status).toBe('failed')
      expect(ml.error).toBe(log.error)
    } finally {
      vi.unstubAllEnvs()
      sendOkStub() // restore the recording stub for later tests
    }
  })

  it('configured send: sent + sent_message_id + MailLog + identical RFC 2822 bytes', async () => {
    sendOkStub()
    const f = decideFx([approvalRow()], { settings: { mail_approval_dry_run: false } })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mailApprovalDecide', ['t7', 'approved', 'Proceed.', 'tok-1'], fixture)
    const sentBodies: { raw?: string; threadId?: string }[] = []
    vi.stubEnv('GMAIL_SEND_ENABLED', 'true')
    vi.stubEnv('GMAIL_API_URL', 'https://gmail.test/send')
    vi.stubEnv('GMAIL_API_KEY', 'key-1')
    vi.stubGlobal('fetch', async (_url: unknown, opts: { body?: unknown }) => {
      sentBodies.push(JSON.parse(String((opts as { body?: string }).body)))
      return { ok: true, json: async () => ({ id: 'sent-1' }) }
    })
    try {
      const portRes = await portCall(() => mailApprovalDecide('t7', 'approved', 'Proceed.', 'tok-1'))
      expectSame(portRes, legacyRes, 'mailApprovalDecide real send')
      const final = (legacyRes.ok as Row)
      expect(final.status).toBe('approved')
      expect(final.sentStatus).toBe('sent')
      expectStoreSame('mail_approvals', 'mail_approvals', 'approvals after send')
      expectStoreSame('mail_approval_log', 'mail_approval_log', 'log after send')
      expectTabSame('mail_log', 'MailLog', 'mail_log after send')
      const approval = (hubDb.tables.mail_approvals || [])[0]
      expect(approval.sent_message_id).toBe('sent-1')
      const mlog = (hubDb.tables.mail_log || [])[0]
      expect(mlog.status).toBe('sent')
      // The wire payload differs in shape (GAS wants base64url raw, the adapter POSTs raw
      // text) but the RFC 2822 bytes are the same mdReplyMime_ output.
      const legacySent = gmailSent()
      expect(legacySent.length).toBe(1)
      expect(legacySent[0].threadId).toBe('t7')
      expect(sentBodies.length).toBe(1)
      expect(sentBodies[0].threadId).toBe('t7')
      const legacyMime = Buffer.from(String(legacySent[0].raw).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
      expect(normLegacyBrand(legacyMime)).toBe(sentBodies[0].raw)
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })

  it('the effective-user "me" is stripped from Cc in legacy only (pinned D-GOOGLE divergence)', async () => {
    sendOkStub()
    // finance@dabdoob.com sits in t7's Cc. Legacy me = Session.getEffectiveUser() strips it;
    // the port has no mailbox identity (me = ''), so its reply Cc keeps it.
    const f = decideFx([approvalRow()], { settings: { mail_approval_dry_run: false }, effectiveUserEmail: 'finance@dabdoob.com' })
    const fixture = deskInstall(f)
    const legacyRes = deskCall('mailApprovalDecide', ['t7', 'approved', 'ok', 'tok-1'], fixture)
    vi.stubEnv('GMAIL_SEND_ENABLED', 'true')
    vi.stubEnv('GMAIL_API_URL', 'https://gmail.test/send')
    vi.stubEnv('GMAIL_API_KEY', 'key-1')
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ id: 'sent-1' }) }))
    try {
      const portRes = await portCall(() => mailApprovalDecide('t7', 'approved', 'ok', 'tok-1'))
      const legacyLog = deskStore('mail_approval_log')[0]
      const portLog = (hubDb.tables.mail_approval_log || [])[0]
      expect(legacyLog.cc).toBe('team@vendor.com')
      expect(portLog.cc).toBe('team@vendor.com,finance@dabdoob.com')
      const legacyMl = deskTable('MailLog')[0]
      const portMl = (hubDb.tables.mail_log || [])[0]
      expect(legacyMl.cc).toBe('team@vendor.com')
      expect(portMl.cc).toBe('team@vendor.com,finance@dabdoob.com')
      // Everything else in the envelope still matches.
      expect((legacyRes.ok as Row).status).toBe('approved')
      expect((portRes.ok as Row).status).toBe('approved')
    } finally {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })

  it('view-as + invalid decision: legacy validates before its guarded write; so does the port', async () => {
    // Ordering pin: mailApprovalDecide checks decision/text/token before the claim's
    // guarded dqUpsertIn_ — the port's assertWritable sits at the same spot.
    const f = decideFx([approvalRow()], {
      tables: {
        mail_approvals: [approvalRow()],
        mail_approval_log: [],
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'k.elnaggar@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
    await deskSame('mailApprovalDecide', ['t7', 'bogus', '', 'tok-1'], f, () => mailApprovalDecide('t7', 'bogus', '', 'tok-1'), 'view-as + invalid decision')
    await deskSame('mailApprovalDecide', ['t7', 'approved', 'ok', 'tok-1'], f, () => mailApprovalDecide('t7', 'approved', 'ok', 'tok-1'), 'view-as + valid decide')
  })
})

describe('tlPerformancePage partial failure (wave-2 extension)', () => {
  it('a failed tlp_team read lands in notes; the section is null; the rest renders', async () => {
    // tlp_team exists but its data read dies mid-scan (failTabs) on the legacy side —
    // the same failure the port sees when the Postgres relation is missing (hubDb.missing).
    // The thrown text is hub-fakes' own relation message, so the note strings match exactly.
    const f = fx({
      failTabs: ['tlp_team'],
      tables: {
        tlp_team: [{ tl_email: 'noha@dabdoob.com', quality: 90, fcr: 70, productivity: 80, agents: 3, month: '2026-10', updated_at: ISO(NOW - 86400000), kpi_score: 85, kpi_prod: 80, kpi_qual: 90, kpi_fcr: 70, kpi_behavior: 100, kpi_agents: 3, ol_agents: 0, ineligible_agents: 0, red_zone: 0, action_plan: 0, probation_agents: 0, partial_agents: 0 }],
        tlp_resp_ratings: [],
        tlp_area_metrics: [],
        tlp_queue_daily: [],
        tlp_kb: [],
        tlp_otd: [],
        mail_sla: [],
        actions: [],
        action_task_details: [],
      },
    })
    const fixture = deskInstall(f)
    hubDb.missing.add('tlp_team') // the same failure, port-side
    const legacyRes = deskCall('tlPerformancePage', ['noha@dabdoob.com'], fixture)
    const portRes = await portCall(() => tlPerformancePage('noha@dabdoob.com'))
    // notes/kb normalization as in the earlier page tests: legacy materializes a kb key
    // only when a Knowledge base area exists (none here), the port emits kb: null there too.
    expectSame(portRes, legacyRes, 'tlPerformancePage partial failure')
    const page = legacyRes.ok as Row
    expect(page.team).toBeNull()
    expect((page.notes as string[]).some((n) => n.indexOf('Team scores could not be read: relation "public.tlp_team" does not exist') !== -1)).toBe(true)
    expect((page.areas as Row[]).length).toBeGreaterThan(0) // remaining sections still render
  })
})

describe('tlpRateArea ordering under view-as (wave-2 extension)', () => {
  const rateFx = (): DeskFx =>
    fx({
      tables: {
        tlp_resp_ratings: [],
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'k.elnaggar@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
  it("unknown area beats the read-only refusal — validation precedes the guarded write", async () => {
    // Legacy checks areas before dqUpsertIn_'s viewAsGuard_; the port's assertWritable
    // sits at the same spot now, so the message matches instead of VIEW_AS_READONLY.
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Nope', 80, 'long enough note'], rateFx(), () =>
      tlpRateArea('noha@dabdoob.com', 'Nope', 80, 'long enough note'),
    )
  })
  it('below-threshold note requirement precedes the guarded write too', async () => {
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 50, 'short'], rateFx(), () =>
      tlpRateArea('noha@dabdoob.com', 'Refunds', 50, 'short'),
    )
  })
  it('a fully valid rating still refuses at the write boundary', async () => {
    await deskSame('tlpRateArea', ['noha@dabdoob.com', 'Refunds', 80, 'long enough note'], rateFx(), () =>
      tlpRateArea('noha@dabdoob.com', 'Refunds', 80, 'long enough note'),
    )
  })
})

describe('kpiLogRemove claim ordering (wave-2 extension)', () => {
  const seededFx = (over: DeskFx = {}): DeskFx =>
    fx({
      tables: {
        kpi_behaviour_log: [
          { log_id: 'BH_keep', email: 'agent@dabdoob.com', date: '2026-10-01', note: 'Rude', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 7 * 86400000), removed_by: '', removed_at: '' },
        ],
        kpi_leave_log: [],
        tlp_ticket_exclusions: [],
      },
      ...over,
    })

  it('a second remove after the first succeeds is refused identically', async () => {
    const f = seededFx()
    const fixture = deskInstall(f)
    const legacy1 = deskCall('kpiLogRemove', ['behaviour', 'BH_keep'], fixture)
    const port1 = await portCall(() => kpiLogRemove('behaviour', 'BH_keep'))
    expectSame(port1, legacy1, 'first remove')
    // __reset__ re-seeds __FIXTURES__ from the host fixture on every call — feed
    // the oracle the store cells it stamped in call #1 so the second remove sees
    // the removed row (the port reads its own updated hubDb either way).
    fixture.spreadsheets = fixture.spreadsheets || {}
    fixture.spreadsheets['live-store'] = { ...(fixture.spreadsheets['live-store'] || {}), kpi_behaviour_log: deskSheetCells('live-store', 'kpi_behaviour_log') }
    const legacy2 = deskCall('kpiLogRemove', ['behaviour', 'BH_keep'], fixture)
    const port2 = await portCall(() => kpiLogRemove('behaviour', 'BH_keep'))
    expectSame(port2, legacy2, 'second remove')
    expect(legacy2.err).toBe('That entry is no longer there.')
    // The port's update is now conditional (removed_at still null): a row another caller
    // removed between the read and the update yields the same refusal — the withLock_
    // serialization the sheet version gets for free.
    expectStoreSame('kpi_behaviour_log', 'kpi_behaviour_log', 'behaviour log after double remove')
  })

  it('view-as: row checks precede the guarded update on both sides', async () => {
    // An already-removed row reports 'no longer there' (the read+check runs
    // before the guarded write on both sides — same ordering as the legacy
    // withLock_ body); a live row reaches the guard and refuses identically.
    const f = seededFx({
      tables: {
        kpi_behaviour_log: [
          { log_id: 'BH_keep', email: 'agent@dabdoob.com', date: '2026-10-01', note: 'Rude', logged_by: 'admin@dabdoob.com', logged_at: ISO(NOW - 7 * 86400000), removed_by: '', removed_at: '' },
          { log_id: 'BH_gone', email: 'agent@dabdoob.com', date: '2026-10-02', note: 'Old', logged_by: 'noha@dabdoob.com', logged_at: ISO(NOW - 6 * 86400000), removed_by: 'admin@dabdoob.com', removed_at: ISO(NOW - 86400000) },
        ],
        view_as: [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'k.elnaggar@dabdoob.com', app: 'desk', submitted_by: 'admin@dabdoob.com', submitted_at: ISO(NOW - H) }],
      },
    })
    await deskSame('kpiLogRemove', ['behaviour', 'BH_gone'], f, () => kpiLogRemove('behaviour', 'BH_gone'), 'view-as + removed row')
    await deskSame('kpiLogRemove', ['behaviour', 'BH_keep'], f, () => kpiLogRemove('behaviour', 'BH_keep'), 'view-as + live row')
  })
})
