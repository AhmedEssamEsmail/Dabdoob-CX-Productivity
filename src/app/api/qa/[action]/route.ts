import { NextRequest, NextResponse } from 'next/server'
import * as qa from '@/features/cx-quality/lib/server'
import { apiError } from '@/features/shared/lib/api-error'

/**
 * /api/qa/<action> — the google.script.run seam. Legacy clients called
 * `google.script.run[fn](arg1, arg2, …)` positionally; the port's client POSTs
 * `{ args: [arg1, arg2, …] }` and the dispatcher spreads them into the same
 * positional server signatures. GET maps ?args=<json-array> or ?arg0=..&arg1=..
 */
const HANDLERS: Record<string, (a: unknown[]) => Promise<unknown>> = {
  getQaAccess: () => qa.getQaAccess(),
  setQaAuditorGrant: (a) => qa.setQaAuditorGrant(String(a[0] ?? ''), a[1]),
  getQaQueuePage: (a) => qa.getQaQueuePage(String(a[0] ?? '')),
  startQaAudit: (a) => qa.startQaAudit(String(a[0] ?? '')),
  submitQaAudit: (a) => qa.submitQaAudit((a[0] || {}) as never),
  importQaQueueNow: () => qa.importQaQueueNow(),
  resendQaAuditEmail: (a) => qa.resendQaAuditEmail(String(a[0] ?? ''), a[1]),
  passQaQueueItem: (a) => qa.passQaQueueItem(String(a[0] ?? ''), String(a[1] ?? '')),
  requestQaAudit: (a) => qa.requestQaAudit((a[0] || {}) as never),
  createQaOffQueueAudit: (a) => qa.createQaOffQueueAudit((a[0] || {}) as never),
  waiveQaAuditRequest: (a) => qa.waiveQaAuditRequest(String(a[0] ?? ''), String(a[1] ?? '')),
  createQaNonTicketAudit: (a) => qa.createQaNonTicketAudit((a[0] || {}) as never),
  getQaMyAuditsPage: () => qa.getQaMyAuditsPage(),
  confirmQaCtl: (a) => qa.confirmQaCtl(String(a[0] ?? ''), a[1], String(a[2] ?? '')),
  getQaCtlPage: () => qa.getQaCtlPage(),
  submitQaCtl: (a) => qa.submitQaCtl((a[0] || {}) as never),
  getQaDisputesPage: () => qa.getQaDisputesPage(),
  decideQaDispute: (a) => qa.decideQaDispute((a[0] || {}) as never),
  getQaCalibrationPage: () => qa.getQaCalibrationPage(),
  createQaCalibration: (a) => qa.createQaCalibration((a[0] || {}) as never),
  submitQaCalibrationAudit: (a) => qa.submitQaCalibrationAudit((a[0] || {}) as never),
  getQaKbGapsPage: () => qa.getQaKbGapsPage(),
  addQaKbGap: (a) => qa.addQaKbGap((a[0] || {}) as never),
  markQaKbGapAdded: (a) => qa.markQaKbGapAdded(String(a[0] ?? '')),
  getQaMyAuditorKpis: (a) => qa.getQaMyAuditorKpis(String(a[0] ?? '')),
  getQaScoresPage: (a) => qa.getQaScoresPage(String(a[0] ?? ''), String(a[1] ?? ''), String(a[2] ?? '')),
  getQaAnalyticsPage: (a) => qa.getQaAnalyticsPage(String(a[0] ?? ''), String(a[1] ?? ''), String(a[2] ?? '')),
  getQaAnalyticsAudits: (a) => qa.getQaAnalyticsAudits(String(a[0] ?? ''), String(a[1] ?? ''), String(a[2] ?? ''), String(a[3] ?? ''), String(a[4] ?? '')),
  getQaCoveragePage: () => qa.getQaCoveragePage(),
  getQaFormsPage: () => qa.getQaFormsPage(),
  saveQaForm: (a) => qa.saveQaForm((a[0] || {}) as never),
  getQaSamplingPage: () => qa.getQaSamplingPage(),
  saveQaSampling: (a) => qa.saveQaSampling((a[0] || {}) as never),
  backfillQaSampleBasis: () => qa.backfillQaSampleBasis(),
  backfillQaInteractionDates: () => qa.backfillQaInteractionDates(),
  qaImportHistory: (a) => qa.qaImportHistory((a[0] || {}) as never),
  qaReconcileQueueLog: () => qa.qaReconcileQueueLog(),
  qaCtlReminders: () => qa.qaCtlReminders(),
  qaEnsureCtlPopups: () => qa.qaEnsureCtlPopups(),
}

async function run(action: string, args: unknown[]) {
  const fn = HANDLERS[action]
  if (!fn) return NextResponse.json({ error: 'Unknown QA action "' + action + '".' }, { status: 404 })
  try {
    return NextResponse.json(await fn(args))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  let args: unknown[] = []
  try {
    const body = (await req.json()) as { args?: unknown[] } | unknown[]
    args = Array.isArray(body) ? body : Array.isArray(body?.args) ? body.args : []
  } catch {
    args = []
  }
  return run(action, args)
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  let args: unknown[] = []
  const raw = req.nextUrl.searchParams.get('args')
  if (raw) {
    try {
      const p = JSON.parse(raw)
      args = Array.isArray(p) ? p : [p]
    } catch {
      args = [raw]
    }
  } else {
    const indexed: Record<number, unknown> = {}
    let max = -1
    req.nextUrl.searchParams.forEach((v, k) => {
      const m = /^arg(\d+)$/.exec(k)
      if (m) {
        const i = Number(m[1])
        indexed[i] = v
        if (i > max) max = i
      }
    })
    for (let i = 0; i <= max; i++) args.push(indexed[i])
  }
  return run(action, args)
}
