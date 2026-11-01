import { createAuthClient, requireRole } from '@/lib/auth'
import { flagInScope } from '@/lib/prod-access'
import { viewAsGuard } from '@/lib/platform/viewas'
import { apiError, dbErr } from '@/lib/api-error'
import {
  PROD_DEFAULTS,
  PROD_DIRTY_MAX,
  addDays,
  checkDecision,
  parseJson,
  settingList,
  statusChoices,
  todayKey,
  type ProdFlagRow,
} from '@/lib/prod-validation'
import { NextResponse, type NextRequest } from 'next/server'

const CONFIG_KEYS = [
  'prod_flag_statuses',
  'prod_offline_statuses',
  'prod_replacement_statuses',
  'prod_reason_statuses',
]

function statusFor(error: Error): number {
  if (error.message.startsWith('This flag was already decided')) return 409
  return 400
}

/**
 * decideProdFlag port: a TL (or admin) decides one opened flag — accept as a replacement
 * status, or revert to the raw status with a reason. Writes the decision, the audit log row
 * (prod_flag_log) and records the date so the nightly layers job recomputes productivity.
 */
export async function POST(req: NextRequest, ctx: RouteContext<'/api/prod/flags/[flagId]/decide'>) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
  } catch (error) {
    return apiError(error)
  }

  const { flagId } = await ctx.params
  const input = (await req.json().catch(() => ({}))) as {
    action?: string
    status?: string
    reason?: string
    openedAt?: string
  }

  const opened = Date.parse(String(input.openedAt || ''))
  if (!Number.isFinite(opened)) {
    return NextResponse.json({ error: 'Open the flag before deciding it.' }, { status: 400 })
  }

  const supabase = await createAuthClient()

  const { data, error } = await supabase
    .from('prod_flags')
    .select('*')
    .eq('flag_id', flagId)
    .maybeSingle()

  if (error) return dbErr('prod_flags', error)

  const flag = data as ProdFlagRow | null
  if (!flag || !(await flagInScope(supabase, user, flag))) {
    return NextResponse.json({ error: 'That flag does not exist or is not in your team.' }, { status: 404 })
  }

  const { data: configRows } = await supabase
    .from('config')
    .select('key, value')
    .in('key', CONFIG_KEYS)
  const cfg: Record<string, string> = {}
  ;(configRows || []).forEach((row) => {
    cfg[row.key] = row.value
  })

  // prodStatusChoices_: the configured replacement list plus working statuses seen in the data.
  const { data: seenRows } = await supabase
    .from('prod_intervals')
    .select('status')
    .gte('date', addDays(todayKey(), -14))
    .limit(10000)
  const seenStatuses = [...new Set((seenRows || []).map((r) => String((r as { status?: string }).status || '')))]
    .filter(Boolean)
    .sort()

  const statuses = statusChoices(
    settingList(cfg.prod_replacement_statuses, PROD_DEFAULTS.prod_replacement_statuses),
    settingList(cfg.prod_flag_statuses, PROD_DEFAULTS.prod_flag_statuses),
    settingList(cfg.prod_offline_statuses, PROD_DEFAULTS.prod_offline_statuses),
    seenStatuses
  )

  let patch: ReturnType<typeof checkDecision>
  try {
    patch = checkDecision(flag, input, {
      statuses,
      reasonStatuses: settingList(cfg.prod_reason_statuses, PROD_DEFAULTS.prod_reason_statuses),
    })
  } catch (cause) {
    const err = cause instanceof Error ? cause : new Error('Could not record the decision.')
    return NextResponse.json({ error: err.message }, { status: statusFor(err) })
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('prod_flags')
    .update({
      ...patch,
      decided_by: user.email,
      decided_at: now,
      review_open_ms: Math.round(Math.max(0, Date.now() - opened)),
      updated_at: now,
    })
    .eq('flag_id', flagId)
    .eq('decision', 'pending')
    .select('flag_id')

  if (updateError) return dbErr('prod_flags', updateError)
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'This flag was already decided.' }, { status: 409 })
  }

  const { error: logError } = await supabase.from('prod_flag_log').insert({
    log_id: `pfl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    flag_id: flag.flag_id,
    action: patch.decision,
    from_status: flag.raw_status,
    to_status: patch.validated_status,
    by: user.email,
    at: now,
    reason: patch.reason,
  })
  if (logError) return dbErr('prod_flag_log', logError)

  // prodMarkDirty_: the flag's date is queued so the nightly layers job recomputes the
  // effective productivity layer — same "productivity updates overnight" contract.
  const { data: dirtyRow } = await supabase
    .from('config')
    .select('value')
    .eq('key', 'prod_dirty_dates')
    .maybeSingle()
  const dirty = new Set(parseJson<string[]>(dirtyRow?.value, []))
  dirty.add(flag.date)
  await supabase.from('config').upsert({
    key: 'prod_dirty_dates',
    value: JSON.stringify([...dirty].slice(-PROD_DIRTY_MAX)),
    updated_at: now,
  })

  return NextResponse.json({
    flagId: String(flag.flag_id),
    decision: patch.decision,
    validatedStatus: patch.validated_status,
  })
}
