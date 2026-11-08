/**
 * Shared Desk job helpers. dqMarkRun_ (Stores.js): the DQ_LAST_<job> script
 * property -> the `dq_last_<job>` config key dqLastRun_ reads back (and the
 * hbEvidence_ health reader checks the same way, case-insensitive).
 */

import 'server-only'

import { setConfig } from '@/features/shared/platform/settings'

/** dqMarkRun_: stamp the job's last-run time. */
export async function dqMarkRun_(job: string): Promise<void> {
  try {
    await setConfig('dq_last_' + job, new Date().toISOString(), 'Last run of the ' + job + ' job (dqMarkRun_).', 'system:' + job)
  } catch {
    /* a run stamp never breaks the job */
  }
}
