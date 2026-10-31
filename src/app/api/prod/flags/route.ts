import { createAuthClient, requireRole } from '@/lib/auth'
import {
  PROD_DEFAULTS,
  addDays,
  flagView,
  ruleView,
  settingList,
  statusChoices,
  todayKey,
  type ProdFlagRow,
} from '@/lib/prod-validation'
import { NextResponse } from 'next/server'

const CONFIG_KEYS = [
  'prod_flag_cases_x',
  'prod_flag_window_min',
  'prod_flag_min_interval_min',
  'prod_review_days',
  'prod_flag_statuses',
  'prod_offline_statuses',
  'prod_channel_status',
  'prod_replacement_statuses',
  'prod_reason_statuses',
  'freshdesk_domain',
]

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to authorize request'
  return NextResponse.json(
    { error: message },
    { status: message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500 }
  )
}

/**
 * getProdReviewPage port: pending flags of the caller's scope, the last 30 days of decisions,
 * the replacement/reason status lists, the detection rule and the Freshdesk ticket base URL.
 */
export async function GET() {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['admin', 'tl'])
  } catch (error) {
    return authError(error)
  }

  const supabase = await createAuthClient()
  const today = todayKey()
  const decidedFrom = addDays(today, -30)
  const seenFrom = addDays(today, -14)
  const email = String(user.email || '').toLowerCase()

  const [rosterRes, configRes] = await Promise.all([
    supabase.from('roster').select('email, name, tl_email'),
    supabase.from('config').select('key, value').in('key', CONFIG_KEYS),
  ])

  if (rosterRes.error) return NextResponse.json({ error: rosterRes.error.message }, { status: 500 })

  const nameOf = (e: string) =>
    rosterRes.data?.find((r) => String(r.email).toLowerCase() === e.toLowerCase())?.name || ''
  const teamEmails = (rosterRes.data || [])
    .filter((r) => String(r.tl_email || '').toLowerCase() === email)
    .map((r) => String(r.email).toLowerCase())

  let flagsQuery = supabase.from('prod_flags').select('*').neq('decision', 'void')
  if (user.role === 'tl') {
    // Legacy scopes by current roster mapping (managerOf); tl_email on the flag is a fallback
    // for agents whose roster line changed since detection.
    const scope = [`tl_email.eq.${email}`]
    if (teamEmails.length) scope.push(`agent_email.in.(${teamEmails.join(',')})`)
    flagsQuery = flagsQuery.or(scope.join(','))
  }

  const { data: flagRows, error: flagsError } = await flagsQuery
  if (flagsError) return NextResponse.json({ error: flagsError.message }, { status: 500 })

  const rows = (flagRows || []) as ProdFlagRow[]
  const view = (f: ProdFlagRow) => flagView(f, nameOf)

  const pending = rows
    .filter((f) => f.decision === 'pending')
    .sort(
      (a, b) =>
        String(a.due_date || '').localeCompare(String(b.due_date || '')) ||
        String(a.interval_start).localeCompare(String(b.interval_start))
    )
    .map(view)

  const decided = rows
    .filter((f) => f.decision !== 'pending' && String(f.date) >= decidedFrom)
    .sort((a, b) => String(b.decided_at || '').localeCompare(String(a.decided_at || '')))
    .slice(0, 150)
    .map(view)

  const cfg: Record<string, string> = {}
  ;(configRes.data || []).forEach((row) => {
    cfg[row.key] = row.value
  })

  // Statuses seen in the interval store over the last 14 days (prodSeenStatuses_).
  const { data: seenRows } = await supabase
    .from('prod_intervals')
    .select('status')
    .gte('date', seenFrom)
    .limit(10000)

  const seenCounts = new Map<string, number>()
  ;(seenRows || []).forEach((r) => {
    const s = String((r as { status?: string }).status || '')
    if (s) seenCounts.set(s, (seenCounts.get(s) || 0) + 1)
  })
  const seenStatuses = [...seenCounts.keys()].sort()

  const flagStatuses = settingList(cfg.prod_flag_statuses, PROD_DEFAULTS.prod_flag_statuses)
  const offlineStatuses = settingList(cfg.prod_offline_statuses, PROD_DEFAULTS.prod_offline_statuses)
  const replacement = settingList(cfg.prod_replacement_statuses, PROD_DEFAULTS.prod_replacement_statuses)

  const isAdmin = user.role === 'admin'

  return NextResponse.json({
    today,
    pending,
    decided,
    disputes: [],
    statuses: statusChoices(replacement, flagStatuses, offlineStatuses, seenStatuses),
    reasonStatuses: settingList(cfg.prod_reason_statuses, PROD_DEFAULTS.prod_reason_statuses),
    rule: ruleView(cfg),
    ticketUrl: `https://${cfg.freshdesk_domain || PROD_DEFAULTS.freshdesk_domain}/a/tickets/`,
    isAdmin,
    ready: true,
    source: isAdmin
      ? {
          statusesSeen: seenStatuses.map((status) => ({ status, rows: seenCounts.get(status) || 0 })),
        }
      : null,
  })
}
