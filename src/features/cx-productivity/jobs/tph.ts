/**
 * ProdTph.js job ports: the hourly queue capture and the past-days rebuild,
 * run against a JobEnv. The ported pure fns in src/lib/tph/index.ts do the
 * work (tphCaptureCases_, tphBuildPastDays_); this file wires the prefetches
 * their io seams need and keeps the legacy job wrap (dqStep_ + hbFlush_).
 */

import { dqAddDays_, dqSetting_, prodFileFor_ } from '@/features/shared/lib/adapters'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { tphBuildPastDays_, tphCaptureCases_ } from '@/features/cx-productivity/lib/tph'
import type { JobEnv, Row } from '@/features/shared/jobs/env'
import { dqStep_ } from '@/features/shared/jobs/steps'
import { DAILY_REPORT_TABS, FD_ACTIVITY_TABS, PROD_MONTH_TABS } from '@/features/shared/jobs/sheets'

/**
 * jobTphHourly verbatim: folds the fresh queue numbers into today's 'auto'
 * prod_tph_cases row. First capture of an hour records stock + starting
 * created; later ones update the latest created count.
 */
export async function jobTphHourly(env: JobEnv): Promise<Row | null> {
  try {
    return await dqStep_(env, 'prod_tph_cases', async () => {
      await env.prefetchTables(['agg_queue_now'])
      return tphCaptureCases_(env as never)
    })
  } finally {
    await env.hbFlush()
  }
}

/**
 * jobTphPastDays verbatim: rebuilds stale or missing touches, rebuilt cases
 * and calls for yesterday plus the TPH_PAST_DAYS-1 days before it, until the
 * time guard trips (270 s, stale = 6 h). Steps run through the env's
 * TphStepIo seams; each step's failure is logged and the day runner moves on.
 */
export async function jobTphPastDays(env: JobEnv): Promise<Row | null> {
  try {
    return await dqStep_(env, 'prod_tph_auto', async () => {
      await env.prefetchTables(['tickets', 'agg_inflow_hourly'])
      // 'calls' reads the month workbooks' Maqsam Calls; 'cases' reads the
      // daily-report Freshchat tab and the Activities tail; 'touches' reads
      // the Activities rows. Prefetch every source the sync builders open.
      const today = prodToday_(env.cfg, env.today)
      const months = [1, 2, 3]
        .map((i) => dqAddDays_(today, -i).slice(0, 7))
        .filter((m, i, a) => a.indexOf(m) === i)
      await Promise.all([
        env.prefetchWorkbook(String(dqSetting_(env.cfg, 'daily_report_ss_id')), DAILY_REPORT_TABS),
        env.prefetchWorkbook(String(dqSetting_(env.cfg, 'fd_activity_ss_id')), FD_ACTIVITY_TABS),
        ...months.map((m) => env.prefetchWorkbook(prodFileFor_(m, env.cfg), PROD_MONTH_TABS)),
      ])
      await env.activityRows() // fills the memo activityTail() filters
      await env.ensureHeadcount()
      return tphBuildPastDays_(env as never)
    })
  } finally {
    await env.hbFlush()
  }
}
