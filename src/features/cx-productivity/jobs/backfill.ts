/**
 * Admin backfill runner — recompute TPH + productivity layers + flags for a
 * historical range (2026-07-01 onward). Chunked inside a time budget; the
 * caller loops on the returned `next` cursor until it is null.
 *
 * Ordering per spec 03: mirrors once (full sync of the range's months), then
 * per date: tph touches -> calls -> cases_tickets -> cases_chats -> layers ->
 * flags. A step failure is recorded in `failed` and the run moves on; a
 * touches failure skips the remaining TPH steps for that date.
 *
 * Honesty rules: months without a productivity_files entry are reported in
 * `skipped` with a hint (the fallback workbook is the wrong month); dates
 * without prod_intervals rows skip flags; grid slots (prod_tph_days) are
 * never fabricated — migration 04 or TL logging owns them.
 */

import 'server-only'

import { dqAddDays_, dqSetting_ } from '@/features/shared/lib/adapters'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { tphRunStep_, type TphStep } from '@/features/cx-productivity/lib/tph'
import { described } from '@/features/shared/lib/errors'
import { buildJobEnv, type JobEnv } from '@/features/shared/jobs/env'
import { prodComputeStep_, prodFlagsStep_ } from './productivity'
import { syncAllMirrors } from '@/features/shared/jobs/mirrors'
import { tphGridFromIntervals_, type IntervalRow } from '@/features/cx-productivity/lib/tph/grid-slots'
import { prodNowIso_ } from '@/features/cx-productivity/lib/prod/engine'
import { DAILY_REPORT_TABS } from '@/features/shared/jobs/sheets'

export type BackfillKind = 'mirrors' | 'grid' | 'tph' | 'layers' | 'flags'
export const BACKFILL_KINDS: BackfillKind[] = ['mirrors', 'grid', 'tph', 'layers', 'flags']
const TPH_STEPS: TphStep[] = ['touches', 'calls', 'cases_tickets', 'cases_chats']
const DEFAULT_BUDGET_MS = 240000

export interface BackfillCursor {
  date: string
}

export interface BackfillOpts {
  from: string
  to: string
  kinds?: BackfillKind[]
  cursor?: BackfillCursor | null
  force?: boolean
  budgetMs?: number
  env?: JobEnv
  now?: number | Date
}

export interface BackfillResult {
  done: { date: string; kind: string; rows: number | string }[]
  failed: { date: string; kind: string; step?: string; error: string; hint?: string }[]
  skipped: { date: string; kind?: string; reason: string }[]
  next: BackfillCursor | null
  mirrors?: Record<string, unknown>
  ms: number
}

function monthCount(from: string, to: string): number {
  let n = 0
  let m = from.slice(0, 7)
  while (m <= to.slice(0, 7) && n < 120) {
    n++
    const [y, mm] = m.split('-').map(Number)
    m = new Date(Date.UTC(y, mm, 1)).toISOString().slice(0, 7)
  }
  return n
}

/** productivity_files as a month->id map (fallback id intentionally excluded). */
function prodFiles(cfg: JobEnv['cfg']): Record<string, unknown> {
  const v = cfg['productivity_files']
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** True when the date's stored outputs already cover `kind`. */
function kindDone(env: JobEnv, d: string, kind: BackfillKind): boolean {
  if (kind === 'grid') return false // grid skips per agent, not per date
  if (kind === 'tph')
    return (
      env.prodRows('prod_tph_touches').some((r) => r.date === d) &&
      env.prodRows('prod_tph_calls').some((r) => r.date === d) &&
      env.prodRows('prod_tph_cases').some((r) => r.date === d && r.source === 'rebuilt')
    )
  if (kind === 'layers') return env.prodRows('prod_daily_layers').some((r) => r.date === d)
  if (kind === 'flags') return env.prodRows('prod_flags').some((r) => r.date === d)
  return false
}

export async function runBackfill(opts: BackfillOpts): Promise<BackfillResult> {
  const t0 = Date.now()
  const budget = opts.budgetMs ?? DEFAULT_BUDGET_MS
  const from = String(opts.from)
  const to = String(opts.to)
  if (!/^\d{4}-\d\d-\d\d$/.test(from) || !/^\d{4}-\d\d-\d\d$/.test(to) || from > to)
    throw new Error('from/to are yyyy-MM-dd with from <= to.')
  const kinds = (opts.kinds?.length ? opts.kinds : BACKFILL_KINDS).filter((k) => k !== 'mirrors')
  const wantMirrors = !opts.kinds?.length || opts.kinds.includes('mirrors')

  const env =
    opts.env ??
    (await buildJobEnv({
      // backfill needs intervals/flags/days back to `from`, not the -45d window
      tables: [
        'prod_tph_touches',
        'prod_tph_calls',
        'prod_tph_cases',
        'prod_tph_days',
        'prod_daily_layers',
        'prod_flags',
        'prod_intervals',
      ],
      intervalSince: from,
      now: opts.now,
    }))
  const startDate = opts.cursor?.date && opts.cursor.date > from ? opts.cursor.date : from

  const result: BackfillResult = { done: [], failed: [], skipped: [], next: null, ms: 0 }
  const over = () => Date.now() - t0 > budget

  /* mirrors: once, before anything else (July range - the touch-history window). */
  if (wantMirrors && !opts.cursor) {
    try {
      result.mirrors = await syncAllMirrors(env.cfg, {
        full: true,
        monthsBack: monthCount(from, to) + 1,
        now: opts.now,
      })
      Object.values(result.mirrors).forEach((r) => {
        const e = (r as { error?: string; table?: string }).error
        if (e)
          result.failed.push({
            date: from,
            kind: 'mirrors',
            step: (r as { table?: string }).table,
            error: e,
            hint: 'The interactive TPH path reads this mirror; the backfill compute path reads the sheets directly, so the run continues.',
          })
      })
    } catch (e) {
      const d = described(e)
      result.failed.push({ date: from, kind: 'mirrors', error: d.message, hint: d.hint })
    }
  }

  const dirty: string[] = []

  /* TPH prefetches, once per invocation — the same seams prodTphCasesRebuiltStep_
   * and the touches/calls builders expect: activity memo, tickets+inflow tables,
   * the daily-report workbook. Failure is reported on every date, not hidden. */
  let tphReady: string | null = null
  if (kinds.includes('tph')) {
    try {
      await env.activityRows()
      await env.ensureHeadcount() // nameToEmail — without it every touch/call/case row drops
      await env.prefetchTables(['tickets', 'agg_inflow_hourly'])
      await env.prefetchWorkbook(String(dqSetting_(env.cfg, 'daily_report_ss_id')), DAILY_REPORT_TABS)
      tphReady = 'ok'
    } catch (e) {
      const de = described(e)
      tphReady = de.message + (de.hint ? ' — ' + de.hint : '')
    }
  }

  let d = startDate
  for (; d <= to; d = dqAddDays_(d, 1)) {
    if (over()) break

    /* ---- grid: derive prod_tph_days slots from prod_intervals (DB only) --- */
    if (kinds.includes('grid')) {
      const intervals = env
        .prodRows('prod_intervals')
        .filter((r) => r.date === d) as unknown as IntervalRow[]
      if (!intervals.length) {
        result.skipped.push({ date: d, kind: 'grid', reason: 'no prod_intervals rows — snapshot or migrate first; grid stays empty' })
      } else {
        const derived = tphGridFromIntervals_(intervals, env.cfg)
        const existing = env.prodRows('prod_tph_days').filter((r) => r.date === d)
        const have = new Set(existing.map((r) => String(r.agent_email).toLowerCase()))
        const now = prodNowIso_()
        const rows = Object.values(derived)
          .filter((dd) => dd.date === d && (!have.has(dd.agent_email.toLowerCase()) || opts.force))
          .map((dd) => ({
            date: dd.date,
            agent_email: dd.agent_email,
            slots_json: JSON.stringify(dd.slots),
            sources_json: JSON.stringify(Object.fromEntries(Object.keys(dd.slots).map((s) => [s, 'intervals']))),
            by: 'backfill',
            at: now,
          }))
        try {
          if (rows.length) env.upsert('prod_tph_days', ['date', 'agent_email'], rows, null)
          const kept = opts.force ? 0 : Object.keys(derived).length - rows.length
          result.done.push({
            date: d,
            kind: 'grid',
            rows: `${rows.length} agents written${kept ? `, ${kept} kept (TL-logged)` : ''}`,
          })
        } catch (e) {
          const de = described(e)
          result.failed.push({ date: d, kind: 'grid', error: de.message, hint: de.hint })
        }
      }
    }

    /* ---- tph: touches -> calls -> cases_tickets -> cases_chats ---------- */
    if (kinds.includes('tph')) {
      if (tphReady !== 'ok') {
        result.failed.push({ date: d, kind: 'tph', error: tphReady || 'prefetch failed' })
      } else if (!opts.force && kindDone(env, d, 'tph')) {
        result.skipped.push({ date: d, kind: 'tph', reason: 'already computed — pass force to redo' })
      } else {
        try {
          await env.prefetchMonthBooks([d]) // 'Maqsam Calls' for the calls step
        } catch (e) {
          const de = described(e)
          result.failed.push({ date: d, kind: 'tph', step: 'calls', error: de.message, hint: de.hint })
        }
        let tphBroken = false
        for (const step of TPH_STEPS) {
          if (over()) break
          if (tphBroken) {
            result.skipped.push({ date: d, kind: 'tph', reason: `skipped after the touches failure` })
            break
          }
          try {
            const out = tphRunStep_(d, step, 'backfill', env as never)
            const rows =
              typeof out.touchCells === 'number' ? out.touchCells : typeof out.casesRebuilt === 'number' ? out.casesRebuilt : 1
            result.done.push({ date: d, kind: `tph.${step}`, rows })
          } catch (e) {
            const de = described(e)
            result.failed.push({ date: d, kind: 'tph', step, error: de.message, hint: de.hint })
            if (step === 'touches') tphBroken = true
          }
        }
      }
    }

    /* ---- layers: month workbook must exist for this month --------------- */
    if (kinds.includes('layers')) {
      if (!opts.force && kindDone(env, d, 'layers')) {
        result.skipped.push({ date: d, kind: 'layers', reason: 'already computed — pass force to redo' })
      } else if (!prodFiles(env.cfg)[d.slice(0, 7)]) {
        result.skipped.push({
          date: d,
          kind: 'layers',
          reason: `no productivity_files entry for ${d.slice(0, 7)} — set it under Admin > Config (the fallback workbook is the wrong month)`,
        })
      } else {
        try {
          const n = await prodComputeStep_(env, [d])
          result.done.push({ date: d, kind: 'layers', rows: n })
          if (!dirty.includes(d)) dirty.push(d)
        } catch (e) {
          const de = described(e)
          result.failed.push({ date: d, kind: 'layers', error: de.message, hint: de.hint })
        }
      }
    }

    /* ---- flags: needs prod_intervals rows for the date ------------------- */
    if (kinds.includes('flags')) {
      if (!opts.force && kindDone(env, d, 'flags')) {
        result.skipped.push({ date: d, kind: 'flags', reason: 'flags already exist — pass force to redo' })
      } else if (!env.prodRows('prod_intervals').some((r) => r.date === d)) {
        result.skipped.push({ date: d, kind: 'flags', reason: 'no prod_intervals rows for this date — migrate (04) or snapshot first' })
      } else {
        try {
          const r = await prodFlagsStep_(env, [d])
          result.done.push({ date: d, kind: 'flags', rows: r.added ?? 0 })
          // redetectProductivityFlags verbatim: re-detected dates are marked dirty so the
          // next layers run recomputes their effective productivity (changed flags change
          // effective statuses even when the intervals are untouched).
          if (!dirty.includes(d)) dirty.push(d)
        } catch (e) {
          const de = described(e)
          result.failed.push({ date: d, kind: 'flags', error: de.message, hint: de.hint })
        }
      }
    }
  }

  if (d <= to) result.next = { date: d }

  /* mark recomputed dates dirty so the next daily run refreshes them */
  if (dirty.length) env.markDirty(dirty)
  await env.flushWrites()
  try {
    env.logRun('backfill', t0, 'ok', {
      rowsOut: result.done.length,
      note: `${startDate}..${d <= to ? dqAddDays_(d, -1) : to}: ${result.done.length} done, ${result.failed.length} failed, ${result.skipped.length} skipped${result.next ? ' (resumable)' : ''}`,
    })
  } catch {
    /* logging must not break the run */
  }
  result.ms = Date.now() - t0
  return result
}

/** Default backfill range per spec 03: 2026-07-01 -> yesterday (business tz). */
export function backfillDefaults(cfg: Parameters<typeof prodToday_>[0]): { from: string; to: string } {
  return { from: '2026-07-01', to: dqAddDays_(prodToday_(cfg), -1) }
}
