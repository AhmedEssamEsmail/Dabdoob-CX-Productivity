import { NextResponse } from 'next/server'
import { mailDeskPage, mailDeskRefresh, mailApprovalDecide, mailApprovalReset } from '@/features/cx-desk/lib/maildesk'
import { apiError } from '@/features/shared/lib/api-error'
import { assertWritable } from '@/features/shared/platform/viewas'

/**
 * mailDeskPage (GET) — stored mail_sla rows + approvals for approvers.
 * POST actions: { action: 'refresh' } | { action: 'decide', threadId, decision, text, clientToken }
 *               | { action: 'reset', threadId }
 */
export async function GET() {
  try {
    return NextResponse.json(await mailDeskPage())
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    await assertWritable()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || '')
    if (action === 'refresh') return NextResponse.json(await mailDeskRefresh())
    if (action === 'decide') {
      return NextResponse.json(
        await mailApprovalDecide(String(body.threadId || ''), String(body.decision || ''), String(body.text || ''), String(body.clientToken || '')),
      )
    }
    if (action === 'reset') return NextResponse.json(await mailApprovalReset(String(body.threadId || '')))
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (e) {
    return apiError(e)
  }
}
