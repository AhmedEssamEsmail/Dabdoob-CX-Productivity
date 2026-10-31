import { supabase } from '@/lib/supabase'
import { effectiveStatus, parseJson, type ProdFlagRow } from '@/lib/prod-validation'
import { NextResponse } from 'next/server'

/**
 * prodComputeDates_ effective pass, ported to the migrated schema. prod_daily_layers holds the
 * V1 engine's 26 columns; the raw layer comes from the migration/full pipeline. This job
 * rebuilds the effective layer per date: every non-void flag's flagged minutes are moved out
 * of the raw status and into its effective status (validated once reviewed, suggested while
 * pending — prodEffectiveStatus_ / prodAdjustAux_).
 *
 * Status -> engine bucket mapping (computeProductivityForDate_):
 *   texting avail = Available + Inbound Calls + Chats + exceptions - inbound calls
 *   WA avail      = min(Waiting Address, 480, waAchieved*4)
 *   idle          = min(IDLE, 480)
 * Minutes moved to a status outside the engine's list (e.g. Busy) leave the raw bucket and
 * land nowhere — they do not count in Productivity %.
 */
const TEXTING_STATUSES = new Set(['Available', 'Inbound Calls', 'Chats'])

type LayerRow = Record<string, number | string | null> & {
  layer: string
  email: string
  date: string
  agent_name: string | null
}

type FlagMove = { agent_email: string; from: string; to: string; minutes: number }

const round = (n: number) => Math.round(n * 10000) / 10000
const num = (v: unknown) => Number(v) || 0

function scaleTarget(target: number, availFrom: number, availTo: number): number {
  return availFrom > 0 ? (target * availTo) / availFrom : target
}

/** Rebuilds one agent's effective layer row from the stored raw row + that day's flag moves. */
function effectiveLayerRow(raw: LayerRow, moves: FlagMove[]): LayerRow {
  let idleOut = 0
  let idleIn = 0
  let textingDelta = 0
  let waDelta = 0
  const balance: Record<string, number> = {
    IDLE: num(raw.idle_min),
    Texting: num(raw.texting_avail_min),
    'Waiting Address': num(raw.wa_avail_min),
  }
  const bucketOf = (status: string): 'IDLE' | 'Texting' | 'Waiting Address' | null =>
    status === 'IDLE' ? 'IDLE' : TEXTING_STATUSES.has(status) ? 'Texting' : status === 'Waiting Address' ? 'Waiting Address' : null

  moves.forEach((m) => {
    const from = bucketOf(m.from)
    if (!from) return
    // prodAdjustAux_: never move more than the bucket still holds.
    const moved = Math.max(0, Math.min(m.minutes, balance[from]))
    if (moved <= 0) return
    balance[from] -= moved
    const to = bucketOf(m.to)
    if (from === 'IDLE') idleOut += moved
    else if (from === 'Texting') textingDelta -= moved
    else waDelta -= moved
    if (to === 'IDLE') idleIn += moved
    else if (to === 'Texting') textingDelta += moved
    else if (to === 'Waiting Address') waDelta += moved
    if (to) balance[to] += moved
  })

  const effIdle = Math.max(0, num(raw.idle_min) - idleOut + idleIn)
  const textingAvail = Math.min(Math.max(0, num(raw.texting_avail_min) + textingDelta), 480 - effIdle)
  const waAvail = Math.min(Math.max(0, num(raw.wa_avail_min) + waDelta), 480, num(raw.wa_achieved) * 4)

  const textingTarget = scaleTarget(num(raw.texting_target), num(raw.texting_avail_min), textingAvail)
  const waTarget = scaleTarget(num(raw.wa_target), num(raw.wa_avail_min), waAvail)
  const textingAchieved = num(raw.texting_achieved)
  const waAchieved = num(raw.wa_achieved)

  const aux = num(raw.inbound_avail_min) + textingAvail + waAvail
  const resolution = num(raw.productive_min_resolution)

  return {
    ...raw,
    layer: 'effective',
    texting_avail_min: round(textingAvail),
    texting_target: round(textingTarget),
    texting_prod_pct: textingTarget > 0 ? round(textingAchieved / textingTarget) : null,
    texting_gap: textingTarget > 0 ? round(textingAchieved - textingTarget) : null,
    wa_avail_min: round(waAvail),
    wa_target: round(waTarget),
    wa_prod_pct: waTarget > 0 ? round(waAchieved / waTarget) : null,
    wa_gap: waTarget > 0 ? round(waAchieved - waTarget) : null,
    overall_prod_pct: aux > 0 ? round(resolution / aux) : null,
    productive_min_aux: round(aux),
    idle_min: round(effIdle),
    computed_at: new Date().toISOString(),
  }
}

/**
 * Recomputes the effective layer for yesterday plus every date queued in
 * config.prod_dirty_dates (prodMarkDirty_: a TL decision recomputes the flag's date), then
 * clears the queue. The raw layer is left untouched — it is rebuilt by the data pipeline.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: dirtyRow } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'prod_dirty_dates')
      .maybeSingle()
    const dirtyDates = parseJson<string[]>(dirtyRow?.value, [])
    const dates = [...new Set([yesterdayStr, ...dirtyDates])]

    let datesProcessed = 0
    let layersWritten = 0

    for (const date of dates) {
      const [rawRes, flagsRes] = await Promise.all([
        supabase.from('prod_daily_layers').select('*').eq('date', date).eq('layer', 'raw'),
        supabase
          .from('prod_flags')
          .select('agent_email, raw_status, suggested_status, validated_status, decision, flagged_min')
          .eq('date', date)
          .neq('decision', 'void'),
      ])
      if (rawRes.error) return NextResponse.json({ error: rawRes.error.message }, { status: 500 })
      if (flagsRes.error) return NextResponse.json({ error: flagsRes.error.message }, { status: 500 })
      if (!rawRes.data || rawRes.data.length === 0) continue

      const movesByAgent = new Map<string, FlagMove[]>()
      ;((flagsRes.data || []) as Pick<
        ProdFlagRow,
        'agent_email' | 'raw_status' | 'suggested_status' | 'validated_status' | 'decision' | 'flagged_min'
      >[]).forEach((flag) => {
        const eff = effectiveStatus(flag)
        if (!eff || eff === flag.raw_status) return
        const list = movesByAgent.get(flag.agent_email) || []
        list.push({
          agent_email: flag.agent_email,
          from: flag.raw_status,
          to: eff,
          minutes: Number(flag.flagged_min) || 0,
        })
        movesByAgent.set(flag.agent_email, list)
      })

      const effectiveRows = (rawRes.data as LayerRow[]).map((raw) =>
        effectiveLayerRow(raw, movesByAgent.get(raw.email) || [])
      )

      const { error: deleteError } = await supabase
        .from('prod_daily_layers')
        .delete()
        .eq('date', date)
        .eq('layer', 'effective')
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

      const { error: insertError } = await supabase
        .from('prod_daily_layers')
        .insert(
          effectiveRows.map((row) => {
            const copy = { ...row }
            delete copy.id
            return copy
          })
        )
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

      datesProcessed++
      layersWritten += effectiveRows.length
    }

    if (dirtyDates.length) {
      await supabase
        .from('config')
        .upsert({ key: 'prod_dirty_dates', value: '[]', updated_at: new Date().toISOString() })
    }

    return NextResponse.json({
      message: 'Effective productivity layers recomputed',
      dates_processed: datesProcessed,
      dirty_dates_cleared: dirtyDates.length,
      layers_written: layersWritten,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Daily layers failed' },
      { status: 500 }
    )
  }
}
