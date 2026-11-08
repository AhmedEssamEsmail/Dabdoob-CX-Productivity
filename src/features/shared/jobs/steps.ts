/**
 * dqStep_ verbatim port: run one job step, stamp health ok/error and log the
 * failure. A step that throws returns null — the caller chain keeps going,
 * exactly like the legacy trigger.
 */

import 'server-only'

import type { JobEnv } from './env'

export async function dqStep_<T>(env: JobEnv, job: string, fn: () => T | Promise<T>): Promise<T | null> {
  try {
    const r = await fn()
    await env.flushWrites()
    const skipped =
      r && typeof r === 'object' && !Array.isArray(r) ? (r as Record<string, unknown>).skipped : undefined
    env.hbBeat(job, 'ok', skipped ? 'Skipped: ' + skipped : '')
    return r
  } catch (e) {
    const msg = (e as Error)?.message || String(e)
    console.log(job + ' failed: ' + msg)
    env.logRun(job, Date.now(), 'error', { error: msg })
    await env.flushWrites().catch(() => {}) // keep whatever was already written, like the sheet did
    env.hbBeat(job, 'error', msg)
    return null
  }
}
