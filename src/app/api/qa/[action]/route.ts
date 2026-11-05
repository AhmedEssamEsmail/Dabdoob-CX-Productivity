import { NextRequest, NextResponse } from 'next/server'
import * as qa from '@/features/cx-quality/lib/server'
import { apiError } from '@/features/shared/lib/api-error'

/**
 * /api/qa/<action> — the google.script.run seam. POST body = the call's args
 * object; GET maps query params the same way. Each action name is the legacy
 * function name (getQaQueuePage, submitQaAudit, …) so page code ports 1:1.
 */
const HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  getQaAccess: (a) => qa.getQaAccess(String(a.viewAs || '') || undefined),
  setQaAuditorGrant: (a) => qa.setQaAuditorGrant(a as never),
  getQaQueuePage: (a) => qa.getQaQueuePage(a as never),
  startQaAudit: (a) => qa.startQaAudit(a as never),
  submitQaAudit: (a) => qa.submitQaAudit(a as never),
  resendQaAuditEmail: (a) => qa.resendQaAuditEmail(a as never),
  passQaQueueItem: (a) => qa.passQaQueueItem(a as never),
  requestQaAudit: (a) => qa.requestQaAudit(a as never),
  createQaOffQueueAudit: (a) => qa.createQaOffQueueAudit(a as never),
  waiveQaAuditRequest: (a) => qa.waiveQaAuditRequest(a as never),
  createQaNonTicketAudit: (a) => qa.createQaNonTicketAudit(a as never),
  getQaMyAuditsPage: (a) => qa.getQaMyAuditsPage(a as never),
  confirmQaCtl: (a) => qa.confirmQaCtl(a as never),
  getQaCtlPage: (a) => qa.getQaCtlPage(a as never),
  submitQaCtl: (a) => qa.submitQaCtl(a as never),
  getQaDisputesPage: (a) => qa.getQaDisputesPage(a as never),
  decideQaDispute: (a) => qa.decideQaDispute(a as never),
  getQaCalibrationPage: (a) => qa.getQaCalibrationPage(a as never),
  createQaCalibration: (a) => qa.createQaCalibration(a as never),
  submitQaCalibrationAudit: (a) => qa.submitQaCalibrationAudit(a as never),
  getQaKbGapsPage: (a) => qa.getQaKbGapsPage(a as never),
  addQaKbGap: (a) => qa.addQaKbGap(a as never),
  markQaKbGapAdded: (a) => qa.markQaKbGapAdded(a as never),
  getQaMyAuditorKpis: (a) => qa.getQaMyAuditorKpis(a as never),
  getQaScoresPage: (a) => qa.getQaScoresPage(a as never),
  getQaAnalyticsPage: (a) => qa.getQaAnalyticsPage(a as never),
  getQaAnalyticsAudits: (a) => qa.getQaAnalyticsAudits(a as never),
  getQaCoveragePage: () => qa.getQaCoveragePage(),
  getQaFormsPage: () => qa.getQaFormsPage(),
  saveQaForm: (a) => qa.saveQaForm(a as never),
  getQaSamplingPage: () => qa.getQaSamplingPage(),
  saveQaSampling: (a) => qa.saveQaSampling(a as never),
  backfillQaSampleBasis: () => qa.backfillQaSampleBasis(),
  backfillQaInteractionDates: () => qa.backfillQaInteractionDates(),
  qaImportHistory: () => qa.qaImportHistory(),
  qaReconcileQueueLog: () => qa.qaReconcileQueueLog(),
  qaCtlReminders: () => qa.qaCtlReminders(),
  qaEnsureCtlPopups: () => qa.qaEnsureCtlPopups(),
}

async function run(action: string, args: Record<string, unknown>) {
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
  let args: Record<string, unknown> = {}
  try {
    args = (await req.json()) as Record<string, unknown>
  } catch {
    args = {}
  }
  return run(action, args)
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params
  const args: Record<string, unknown> = {}
  req.nextUrl.searchParams.forEach((v, k) => {
    args[k] = v
  })
  return run(action, args)
}
