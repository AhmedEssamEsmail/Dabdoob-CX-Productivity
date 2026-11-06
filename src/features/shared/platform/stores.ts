/**
 * Stores.js seams on Postgres — the pieces of original_deprecated/Stores.js the
 * ported API fragments need:
 *
 *   readStore / dqCachedLive   dqReadObjects_(.., { missingOk: true }) / dqCachedLive_:
 *                              a whole table as objects, [] when the store is not there.
 *                              The GAS version cached Live aggregates in the script cache
 *                              versioned by cache_stamps; Postgres reads are direct, so the
 *                              cache layer is dropped (same data, no staleness window).
 *   dqReadTail                 dqReadTail_: the last n rows of an append-ordered table.
 *   dqLastRun                  dqLastRun_: Script Property DQ_LAST_<job> -> the config
 *                              dq_last_* keys (the same stand-in hbEvidence_ reads), then
 *                              the shared health row's last_ok_at (dqLastOkElsewhere_).
 */

import { db, readRows, cacheGet, cachePut } from './repo'
import { configAll } from './settings'

export interface StoreRead {
  rows: Record<string, unknown>[]
  /** false when the table could not be read at all (missing store — do not invent data). */
  exists: boolean
}

/** Whole-table read; exists=false when the store is absent (dqReadObjects_ missingOk). */
export async function readStore(name: string): Promise<StoreRead> {
  try {
    const { data, error } = await db().from(name).select('*')
    if (error) return { rows: [], exists: false }
    return { rows: (data || []) as Record<string, unknown>[], exists: true }
  } catch {
    return { rows: [], exists: false }
  }
}

/** dqCachedLive_: a Live aggregate table as objects; [] when the store is absent. */
export async function dqCachedLive(name: string): Promise<Record<string, unknown>[]> {
  return (await readStore(name)).rows
}

/** dqReadTail_: the last n rows of an append-ordered table, oldest first (as appended). */
export async function dqReadTail(name: string, n: number): Promise<Record<string, unknown>[]> {
  try {
    const { data, error } = await db()
      .from(name)
      .select('*')
      .order('id', { ascending: false })
      .limit(n)
    if (error) return []
    return ((data || []) as Record<string, unknown>[]).reverse()
  } catch {
    return []
  }
}

const DQ_LAST_OK_CACHE_KEY = 'dq_last_ok'
const DQ_LAST_OK_CACHE_S = 60

/**
 * dqLastOkElsewhere_: last ok run of a job another project runs — the shared
 * health row's last_ok_at, cached 60 s.
 */
export async function dqLastOkElsewhere(job: string): Promise<string> {
  let map: Record<string, string> | null = null
  const hit = cacheGet(DQ_LAST_OK_CACHE_KEY)
  if (hit) {
    try {
      map = JSON.parse(hit) as Record<string, string>
    } catch {
      map = null
    }
  }
  if (!map) {
    map = {}
    try {
      ;(await readRows('health')).forEach((r) => {
        const d = r.last_ok_at instanceof Date ? r.last_ok_at : new Date(String(r.last_ok_at || ''))
        if (d && !isNaN(d.getTime())) (map as Record<string, string>)[String(r.job)] = d.toISOString()
      })
    } catch {
      /* no health table: no date */
    }
    try {
      cachePut(DQ_LAST_OK_CACHE_KEY, JSON.stringify(map), DQ_LAST_OK_CACHE_S)
    } catch {
      /* too big or unavailable */
    }
  }
  return map[job] || ''
}

/**
 * dqLastRun_(job): the DQ_LAST_<job> script property -> the config dq_last_* key
 * standing in for it (hbEvidence_ reads them the same way, case-insensitive);
 * else the shared health row's last_ok_at. '' when nothing is recorded.
 */
export async function dqLastRun(job: string): Promise<string> {
  try {
    const all = await configAll()
    const want = 'DQ_LAST_' + job.toUpperCase()
    const keys = Object.keys(all)
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].toUpperCase() !== want) continue
      const v = all[keys[i]]
      const s = v instanceof Date ? v.toISOString() : String(v || '')
      if (s) return s
    }
  } catch {
    /* no config */
  }
  /* Queue-side dqMarkRun_ stamps 'dq_last_run_<job>' in the script-cache
     stand-in instead of config; read it before the health fallback. */
  const stamped = cacheGet('dq_last_run_' + job)
  if (stamped) return stamped
  return dqLastOkElsewhere(job)
}
