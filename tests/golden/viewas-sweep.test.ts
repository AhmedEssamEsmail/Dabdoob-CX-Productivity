/**
 * WP-42 View-as write-refusal sweep — port-side proof for the matrix in
 * specs/megaplan/audits/viewas-sweep.md.
 *
 * The owner (assistant_owner_email) is admin@dabdoob.com. A `view_as` start row
 * puts him behind the target's identity; while it is on, every write must
 * refuse with VIEW_AS_READONLY — no matter the target's role. This file pins:
 *   1. lib-level refusals across every feature surface (data-layer guards);
 *   2. route-level refusals (route guard, lib guard, and requireJobCaller paths
 *      — including the WP-42 fixes on job-tl-queue?dates, job-qa-engine,
 *      integrations/{freshchat,maqsam} and admin/migrate);
 *   3. mechanism invariants: a non-owner can never be "viewing as admin"
 *      (startViewAs refuses + a forged view_as row is inert), and
 *   4. the by-design exemptions: the view-as mechanism itself, cache-only
 *      alert-seen writes, and sessionless cron calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

// api/admin/migrate builds a service-role Supabase client at module scope —
// same kind of dummy value vitest.config sets for the anon keys.
vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
})

import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'
import {
  assertWritable,
  viewAsBlocking,
  viewAsState,
  startViewAs,
  stopViewAs,
  viewAsResetCaches,
  VIEW_AS_READONLY,
} from '@/features/shared/platform/viewas'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { addOption } from '@/features/shared/platform/options'
import { holidayUpsert, holidayDelete } from '@/features/shared/platform/holidays'
import { oneOnOneAlertsSeen } from '@/features/shared/platform/notify'
import { setAdminConfig, saveConfigSetting, setAppUrl } from '@/features/cx-hub/lib/admin'
import { syncRosterNow, setPersonOverrides } from '@/features/cx-hub/lib/roster'
import { actionsSetStatus } from '@/features/cx-people/lib/actions'
import { coachingSignal } from '@/features/cx-people/lib/coaching'
import { tasksCreate } from '@/features/cx-people/lib/tasks'
import { oneOnOnesSchedule } from '@/features/cx-people/lib/one-on-ones'
import { meetingsCreateSeries } from '@/features/cx-people/lib/meetings'
import { notesSave } from '@/features/cx-people/lib/notes'
import { refreshScorecard } from '@/features/cx-people/lib/scorecard-server'
import { submitCheckin, refreshQueueNow, agingFlagTicket, agingResolveFlag } from '@/features/cx-queue/lib/pages'
import { schedulerSave } from '@/features/cx-queue/lib/scheduler'
import { runPriorHeatmapRegression } from '@/features/cx-queue/lib/heatmap'
import { kbTrackerSave, setupDesk, installDeskTriggers } from '@/features/cx-desk/lib/tlperformance'
import { mailApprovalDecide } from '@/features/cx-desk/lib/maildesk'
import { kpiLogAppend, kpiLogRemove, olCaseUpsert } from '@/features/cx-people/lib/kpi/server'
import { setQaAuditorGrant, importQaQueueNow, backfillQaSampleBasis } from '@/features/cx-quality/lib/server'
import { createTracker } from '@/features/cx-operations/lib/trackers'

// Routes under test — the real handler wiring, not a reimplementation.
import { POST as configPOST } from '@/app/api/config/route'
import { POST as rosterPOST, PUT as rosterPUT } from '@/app/api/roster/route'
import { POST as qaAuditsPOST } from '@/app/api/quality/audits/route'
import { POST as tphDaysPOST } from '@/app/api/tph/days/route'
import { POST as mailDeskPOST } from '@/app/api/mail-desk/route'
import { POST as myDayPOST } from '@/app/api/hub/my-day/route'
import { POST as optionsPOST } from '@/app/api/options/[listKey]/route'
import { POST as qaDispatchPOST } from '@/app/api/qa/[action]/route'
import { GET as tlQueueCronGET } from '@/app/api/cron/job-tl-queue/route'
import { GET as qaEngineCronGET } from '@/app/api/cron/job-qa-engine/route'
import { POST as freshchatPOST } from '@/app/api/integrations/freshchat/route'
import { POST as maqsamPOST } from '@/app/api/integrations/maqsam/route'
import { POST as migratePOST } from '@/app/api/admin/migrate/route'
import { POST as backfillPOST } from '@/app/api/admin/backfill/route'
import { POST as mirrorsPOST } from '@/app/api/admin/mirrors/route'
import { POST as queueRefreshPOST } from '@/app/api/queue/refresh/route'
import { POST as hubAdminPOST } from '@/app/api/hub/admin/route'
import { POST as deskSetupPOST } from '@/app/api/desk/setup/route'
import { POST as kpiLeavePOST, DELETE as kpiLeaveDELETE } from '@/app/api/kpi/leave/route'
import { POST as holidaysPOST, DELETE as holidaysDELETE } from '@/app/api/holidays/route'
import { POST as viewAsPOST, DELETE as viewAsDELETE } from '@/app/api/view-as/route'

const NOW = Date.parse('2026-10-08T09:00:00Z')
const ISO = (ms: number) => new Date(ms).toISOString()
const ROLE_DENIED = 'You do not have access to this.'

const ROSTER = [
  { email: 'admin@dabdoob.com', name: 'Admin Person', role: 'admin', tl_email: '', position: 'manager', active: true },
  { email: 'boss@dabdoob.com', name: 'Boss Admin', role: 'admin', tl_email: '', position: 'manager', active: true },
  { email: 'tl@dabdoob.com', name: 'Tessa Lead', role: 'tl', tl_email: '', position: 'team lead', active: true },
  { email: 'agent@dabdoob.com', name: 'Andy Agent', role: 'agent', tl_email: 'tl@dabdoob.com', position: 'agent', active: true },
]
const SETTINGS = {
  allowed_domain: 'dabdoob.com',
  admin_emails: 'admin@dabdoob.com,boss@dabdoob.com',
  assistant_owner_email: 'admin@dabdoob.com',
  mail_approver_emails: ['admin@dabdoob.com', 'agent@dabdoob.com'],
}

function configRowsOf(settings: Record<string, unknown>): Record<string, unknown>[] {
  return Object.keys(settings).map((k) => ({
    key: k,
    value: typeof settings[k] === 'string' ? settings[k] : JSON.stringify(settings[k]),
    description: '',
    updated_by: 'test',
    updated_at: ISO(NOW),
  }))
}

function vaRow(owner: string, action: 'start' | 'stop', target: string) {
  return { owner_email: owner, action, target_email: target, app: 'test', submitted_by: owner, submitted_at: ISO(NOW - 3600000) }
}

interface Fx {
  userEmail?: string
  /** Owner's view-as target; '' or omitted = viewing nothing. */
  target?: string
  tables?: Record<string, Record<string, unknown>[]>
  settings?: Record<string, unknown>
  vaRows?: Record<string, unknown>[]
}

function install(fx: Fx = {}) {
  hubDbReset()
  cacheClear()
  viewAsResetCaches()
  hubSetUser(fx.userEmail === undefined ? 'admin@dabdoob.com' : fx.userEmail)
  const view_as =
    fx.vaRows !== undefined ? fx.vaRows : fx.target ? [vaRow('admin@dabdoob.com', 'start', fx.target)] : []
  hubSetTables({
    roster: ROSTER.map((r) => ({ ...r })),
    view_as,
    config: configRowsOf({ ...SETTINGS, ...(fx.settings || {}) }),
    ...(fx.tables || {}),
  })
}

async function refuses(fn: () => Promise<unknown> | unknown, msg = VIEW_AS_READONLY) {
  try {
    await fn()
  } catch (e) {
    expect((e as Error).message).toBe(msg)
    return
  }
  throw new Error('expected refusal: ' + msg)
}

function postReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body || {}),
  })
}

/** Same, typed NextRequest — the dispatchers' signatures require it. */
function postNext(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body || {}),
  })
}

async function statusOf(res: Response): Promise<{ status: number; error: string }> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, error: String(body.error || '') }
}

beforeEach(() => install())
afterEach(() => {
  vi.unstubAllEnvs()
  viewAsResetCaches()
})

// ---------------------------------------------------------------- mechanism
describe('view-as mechanism invariants (WP-42)', () => {
  it('owner signed in, nothing started: writes proceed', async () => {
    install()
    expect(await viewAsBlocking()).toBe(false)
    await assertWritable()
  })

  it('sessionless (cron) caller: view-as can never attach', async () => {
    install({ userEmail: '' })
    expect((await viewAsState()).target).toBe('')
    await assertWritable()
    await requireJobCaller() // early return — no session means no role check either
  })

  it('a non-owner cannot start view-as', async () => {
    install({ userEmail: 'agent@dabdoob.com' })
    await refuses(() => startViewAs('admin@dabdoob.com'), 'View as is only available to the CX owner.')
    await refuses(() => startViewAs('boss@dabdoob.com'), 'View as is only available to the CX owner.')
  })

  it('a forged view_as row owned by a non-owner is inert — "agent viewing as admin" cannot exist', async () => {
    // Even if a row somehow lands in the table, viewAsState only trusts rows of
    // the REAL signed-in owner — and agent@ is never the owner.
    install({ userEmail: 'agent@dabdoob.com', vaRows: [vaRow('agent@dabdoob.com', 'start', 'admin@dabdoob.com')] })
    const st = await viewAsState(true)
    expect(st.owner).toBe(false)
    expect(st.target).toBe('')
    expect(await viewAsBlocking()).toBe(false)
    await assertWritable() // passes — and the agent is still only an agent:
    await refuses(() => setAdminConfig('checkin_slots', '[]'), ROLE_DENIED + ' Ask the CX admin to add you to the roster.')
  })

  it('an agent cannot ride the owner’s rows either', async () => {
    install({ userEmail: 'agent@dabdoob.com', vaRows: [vaRow('admin@dabdoob.com', 'start', 'agent@dabdoob.com')] })
    expect(await viewAsBlocking()).toBe(false) // rows are keyed by real owner, not by target
  })

  it('start/stop are the only writes allowed while it is on', async () => {
    install({ target: 'agent@dabdoob.com' })
    expect(await startViewAs('tl@dabdoob.com')).toEqual({ target: 'tl@dabdoob.com' }) // switch = a write, allowed
    expect(await stopViewAs()).toEqual({ target: '' })
    expect(await viewAsBlocking()).toBe(false)
  })
})

// ------------------------------------------------------- lib-level refusals
describe('data-layer refusals — owner viewing as TL', () => {
  beforeEach(() => install({ target: 'tl@dabdoob.com' }))

  it.each([
    ['addOption', () => addOption('x.list', 'v', 'admin@dabdoob.com')],
    ['holidayUpsert', () => holidayUpsert({ country: 'Kuwait', date: '2026-12-25', name: 'X' }, 'admin@dabdoob.com')],
    ['holidayDelete', () => holidayDelete('h1', 'admin@dabdoob.com')],
    ['tasksCreate', () => tasksCreate({ title: 't', ownerEmail: 'tl@dabdoob.com' })],
    ['oneOnOnesSchedule', () => oneOnOnesSchedule('agent@dabdoob.com', '2026-10-09T09:00:00Z', 30)],
    ['meetingsCreateSeries', () => meetingsCreateSeries({ agentEmail: 'agent@dabdoob.com' })],
    ['coachingSignal', () => coachingSignal({ email: 'agent@dabdoob.com' })], // TLs are signalers — guard is next
    ['refreshScorecard', () => refreshScorecard(['2026-10'])],
    ['submitCheckin', () => submitCheckin({ slot: 'am' })],
    ['refreshQueueNow', () => refreshQueueNow()],
    ['agingFlagTicket', () => agingFlagTicket('T1', 'help')],
    ['agingResolveFlag', () => agingResolveFlag('f1', 'done')],
    ['kpiLogAppend', () => kpiLogAppend('kpi_leave_log', 'kll', { email: 'agent@dabdoob.com' }, 'admin@dabdoob.com')],
    ['kpiLogRemove', () => kpiLogRemove('kpi_leave_log', 'kll-1', 'admin@dabdoob.com')],
    ['olCaseUpsert', () => olCaseUpsert({ agentEmail: 'agent@dabdoob.com' })],
    ['notesSave', () => notesSave({ text: 'x' })], // owner-only via realEmail — still refused
    ['requireJobCaller (cron hand-run)', () => requireJobCaller()],
  ])('%s refuses', async (_n, fn) => {
    await refuses(fn)
  })
})

describe('data-layer refusals — owner viewing as an agent', () => {
  beforeEach(() => install({ target: 'agent@dabdoob.com' }))

  it.each([
    ['actionsSetStatus', () => actionsSetStatus('a1', 'done')],
    ['agingFlagTicket', () => agingFlagTicket('T1', 'help')],
    ['addOption', () => addOption('x.list', 'v', 'admin@dabdoob.com')],
  ])('%s refuses', async (_n, fn) => {
    await refuses(fn)
  })

  it('mailApprovalDecide refuses at the physical write even after passing approver+pending checks', async () => {
    install({
      target: 'agent@dabdoob.com',
      tables: { mail_approvals: [{ thread_id: 't1', status: 'pending', client_token: '', decided_by: '' }] },
    })
    await refuses(() => mailApprovalDecide('t1', 'approved', '', 'tok'))
  })

  it('admin-only writes are refused too — role denial fires first (agent ≠ admin)', async () => {
    await refuses(() => setAdminConfig('checkin_slots', '[]'), ROLE_DENIED + ' Ask the CX admin to add you to the roster.')
    await refuses(() => schedulerSave({}), ROLE_DENIED + ' Ask the CX admin to add you to the roster.')
  })
})

describe('data-layer refusals — owner viewing as ANOTHER ADMIN (role gates pass; only view-as stops it)', () => {
  beforeEach(() => install({ target: 'boss@dabdoob.com' }))

  it.each([
    ['setAdminConfig', () => setAdminConfig('checkin_slots', '[]')],
    ['saveConfigSetting', () => saveConfigSetting('checkin_slots', '[]')],
    ['setAppUrl', () => setAppUrl('hub', 'https://script.google.com/macros/s/ABC123_xyz-/exec')],
    ['syncRosterNow', () => syncRosterNow()],
    ['setPersonOverrides', () => setPersonOverrides('agent@dabdoob.com', {})],
    ['schedulerSave', () => schedulerSave({})],
    ['runPriorHeatmapRegression', () => runPriorHeatmapRegression()],
    ['setupDesk', () => setupDesk()],
    ['installDeskTriggers', () => installDeskTriggers()],
    ['setQaAuditorGrant', () => setQaAuditorGrant('agent@dabdoob.com', true)],
    ['kbTrackerSave', () => kbTrackerSave({ topic: 'x' })], // admins are KB editors — guard is next
    ['importQaQueueNow', () => importQaQueueNow()],
    ['backfillQaSampleBasis', () => backfillQaSampleBasis()],
    ['createTracker', () => createTracker({ name: 'Refund QA', fields: [{ label: 'Ticket', type: 'text', required: true }] })],
    ['requireJobCaller', () => requireJobCaller()],
  ])('%s refuses', async (_n, fn) => {
    await refuses(fn)
  })
})

// ----------------------------------------------------- route-level refusals
describe('route-level refusals — the wired handlers themselves', () => {
  const optionsCtx = { params: Promise.resolve({ listKey: 'x.list' }) }
  const qaCtx = (action: string) => ({ params: Promise.resolve({ action }) })

  it('POST /api/config (route viewAsGuard)', async () => {
    install({ target: 'boss@dabdoob.com' })
    const r = await statusOf(await configPOST(postReq({ key: 'k', value: 'v' })))
    expect(r).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST + PUT /api/roster (route viewAsGuard)', async () => {
    install({ target: 'boss@dabdoob.com' })
    expect(await statusOf(await rosterPOST(postReq({ email: 'x@dabdoob.com' })))).toEqual({ status: 403, error: VIEW_AS_READONLY })
    expect(await statusOf(await rosterPUT(postReq({ email: 'x@dabdoob.com' })))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/quality/audits (route viewAsGuard)', async () => {
    install({ target: 'tl@dabdoob.com' })
    expect(await statusOf(await qaAuditsPOST(postReq({})))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/tph/days (route viewAsGuard)', async () => {
    install({ target: 'tl@dabdoob.com' })
    expect(await statusOf(await tphDaysPOST(postReq({})))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/mail-desk (route assertWritable)', async () => {
    install({ target: 'agent@dabdoob.com' })
    expect(await statusOf(await mailDeskPOST(postReq({ action: 'refresh' })))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/hub/my-day write action (route assertWritable)', async () => {
    install({ target: 'tl@dabdoob.com' })
    expect(await statusOf(await myDayPOST(postReq({ action: 'setSettings', patch: {} })))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/options/[listKey] (lib addOption)', async () => {
    install({ target: 'tl@dabdoob.com' })
    expect(await statusOf(await optionsPOST(postReq({ value: 'v' }), optionsCtx))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/qa/setQaAuditorGrant — the public dispatcher is refused too', async () => {
    install({ target: 'boss@dabdoob.com' })
    expect(await statusOf(await qaDispatchPOST(postNext({ args: ['agent@dabdoob.com', true] }), qaCtx('setQaAuditorGrant')))).toEqual({
      status: 403,
      error: VIEW_AS_READONLY,
    })
  })
  it('POST /api/queue/refresh (lib refreshQueueNow)', async () => {
    install({ target: 'tl@dabdoob.com' })
    expect(await statusOf(await queueRefreshPOST())).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/hub/admin action=setConfig (lib setAdminConfig)', async () => {
    install({ target: 'boss@dabdoob.com' })
    expect(await statusOf(await hubAdminPOST(postReq({ action: 'setConfig', key: 'checkin_slots', value: '[]' })))).toEqual({
      status: 403,
      error: VIEW_AS_READONLY,
    })
  })
  it('POST /api/desk/setup + ?triggers=1 (lib guards)', async () => {
    install({ target: 'boss@dabdoob.com' })
    expect(await statusOf(await deskSetupPOST(new Request('http://localhost/x', { method: 'POST' })))).toEqual({ status: 403, error: VIEW_AS_READONLY })
    expect(await statusOf(await deskSetupPOST(new Request('http://localhost/x?triggers=1', { method: 'POST' })))).toEqual({
      status: 403,
      error: VIEW_AS_READONLY,
    })
  })
  it('POST + DELETE /api/kpi/leave (lib guards)', async () => {
    install({ target: 'tl@dabdoob.com' })
    expect(
      await statusOf(await kpiLeavePOST(postReq({ email: 'agent@dabdoob.com', from_date: '2026-10-01', type: 'Sick' }))),
    ).toEqual({ status: 403, error: VIEW_AS_READONLY })
    expect(await statusOf(await kpiLeaveDELETE(new Request('http://localhost/x?log_id=k1', { method: 'DELETE' })))).toEqual({
      status: 403,
      error: VIEW_AS_READONLY,
    })
  })
  it('POST + DELETE /api/holidays (lib guards)', async () => {
    install({ target: 'boss@dabdoob.com' })
    expect(await statusOf(await holidaysPOST(postReq({ country: 'Kuwait', date: '2026-12-25', name: 'x' })))).toEqual({
      status: 403,
      error: VIEW_AS_READONLY,
    })
    expect(await statusOf(await holidaysDELETE(new Request('http://localhost/x?id=h1', { method: 'DELETE' })))).toEqual({
      status: 403,
      error: VIEW_AS_READONLY,
    })
  })
  it('POST /api/admin/backfill + /api/admin/mirrors (key-or-admin + route assertWritable)', async () => {
    install({ target: 'boss@dabdoob.com' })
    expect(await statusOf(await backfillPOST(postReq({})))).toEqual({ status: 403, error: VIEW_AS_READONLY })
    expect(await statusOf(await mirrorsPOST(postReq({})))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
})

// ------------------------------------------------- WP-42 fixes (were GAPs)
describe('WP-42 fixes — previously ungated write paths now refuse', () => {
  it('GET /api/cron/job-tl-queue?dates=… rebuild refused under view-as', async () => {
    install({ target: 'agent@dabdoob.com' })
    const res = await tlQueueCronGET(new NextRequest('http://localhost/api/cron/job-tl-queue?dates=2026-10-01'))
    expect(await statusOf(res)).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('GET /api/cron/job-tl-queue (no dates) refused under view-as', async () => {
    install({ target: 'agent@dabdoob.com' })
    const res = await tlQueueCronGET(new NextRequest('http://localhost/api/cron/job-tl-queue'))
    expect(await statusOf(res)).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('GET /api/cron/job-qa-engine refused under view-as', async () => {
    install({ target: 'agent@dabdoob.com' })
    const res = await qaEngineCronGET(new NextRequest('http://localhost/api/cron/job-qa-engine'))
    expect(await statusOf(res)).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/integrations/freshchat + maqsam refused under view-as (Bearer only is not enough for a sessioned caller)', async () => {
    install({ target: 'agent@dabdoob.com' })
    const h = { authorization: 'Bearer undefined' } // CRON_SECRET unset in tests
    expect(await statusOf(await freshchatPOST(postReq({}, h)))).toEqual({ status: 403, error: VIEW_AS_READONLY })
    expect(await statusOf(await maqsamPOST(postReq({}, h)))).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
  it('POST /api/admin/migrate refused under view-as even with the migration key', async () => {
    vi.stubEnv('MIGRATION_SECRET_KEY', 'mk')
    install({ target: 'agent@dabdoob.com' })
    const res = await migratePOST(postReq({ module: 'x' }, { 'x-migration-key': 'mk' }))
    expect(await statusOf(res)).toEqual({ status: 403, error: VIEW_AS_READONLY })
  })
})

// ------------------------------------------------- by-design non-refusals
describe('by-design exemptions (parity)', () => {
  it('oneOnOneAlertsSeen is a cache-only write — allowed while viewing', async () => {
    install({ target: 'tl@dabdoob.com' })
    await expect(oneOnOneAlertsSeen(['k1', 'k2'])).resolves.toEqual({ ok: true })
  })
  it('DELETE /api/view-as (exit) works while viewing', async () => {
    install({ target: 'agent@dabdoob.com' })
    const res = await viewAsDELETE()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ target: '' })
    expect(hubDb.tables.view_as.some((r) => r.action === 'stop')).toBe(true)
  })
  it('POST /api/view-as (switch target) works while viewing', async () => {
    install({ target: 'agent@dabdoob.com' })
    const res = await viewAsPOST(postReq({ email: 'tl@dabdoob.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ target: 'tl@dabdoob.com' })
  })
})
