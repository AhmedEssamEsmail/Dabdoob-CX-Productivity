'use client'

import { useCallback, useEffect, useState } from 'react'
import { Chip } from '@/components/shell/ui'
import { daysUntil, type FlagView } from '@/lib/prod-validation'

/**
 * The productivity pages' shared machinery, mirroring the bundle's module scope:
 * Ta/Aa (ue/re/fe/G/Ea/T formatters), zt/be decision chips, kt (FlagStrip),
 * Mt (CasesLine), Se (useSe) and the ce-style JSON fetch.
 */

/* --- Ta/Aa — Kuwait formatters ---------------------------------------- */

export const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
export const ue = (t: string) => (t ? timeFmt.format(new Date(t)) : '')
export const re = (t: string) => (t ? dayFmt.format(new Date(t)) : '')
export const fe = (f: { intervalStart: string; intervalEnd: string }) =>
  `${ue(f.intervalStart)}–${ue(f.intervalEnd)}`
export const G = (t: number) => `${Math.round(t)} min`
export const T = (t: number | null | undefined, n = '') => (t == null ? '–' : `${t}${n}`)
export const Ea = (due: string, today: string) => daysUntil(due, today)

/* --- zt/be — decision chip -------------------------------------------- */

export const DECISIONS: Record<string, [string, string]> = {
  pending: ['Waiting for review', 'warn'],
  accepted: ['Accepted', 'ok'],
  reverted: ['Reverted to raw', 'neutral'],
  auto: ['Auto-accepted (not reviewed)', 'bad'],
  void: ['No longer applies', 'neutral'],
  open: ['Dispute open', 'warn'],
  upheld: ['Dispute upheld', 'ok'],
  rejected: ['Dispute not upheld', 'neutral'],
}

export function DecisionChip({ d }: { d: string }) {
  return <Chip status={DECISIONS[d]?.[1] ?? 'neutral'}>{DECISIONS[d]?.[0] ?? d}</Chip>
}

export const CHANNEL_LABELS: Record<string, string> = {
  chat: 'chat',
  ticket: 'ticket',
  wa: 'waiting address',
}

/* --- fetchJson — the ce.google-run seam -------------------------------- */

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed')
  return data
}

/** Se — data fetch with error + reload. */
export function useSe<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    queueMicrotask(() => live && setError(''))
    fn().then(
      (d) => live && setData(d),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload, setData }
}

/* --- kt — the three-lane strip ----------------------------------------- */

export function FlagStrip({ f }: { f: FlagView }) {
  const n = Date.parse(f.intervalStart)
  const a = Date.parse(f.intervalEnd)
  const s = Math.max(a - n, 1)
  const l = (i: string) => Math.min(100, Math.max(0, ((Date.parse(i) - n) / s) * 100))
  const r = f.decision === 'pending' ? '' : f.validatedStatus || f.suggestedStatus
  const lane = (label: string, status: string, kind: string) => (
    <div className="pv-lane" data-kind={kind}>
      <span className="pv-lane__label">{label}</span>
      <div className="pv-lane__bar" aria-hidden="true">
        {kind !== 'raw'
          ? f.spans.map(([from, to]) => (
              <span
                key={from}
                className="pv-lane__span"
                style={{
                  insetInlineStart: `${l(from)}%`,
                  inlineSize: `${Math.max(l(to) - l(from), 0.8)}%`,
                }}
              />
            ))
          : null}
      </div>
      <span className="pv-lane__status">{status}</span>
    </div>
  )
  return (
    <figure className="pv-strip">
      {lane('Logged', f.rawStatus, 'raw')}
      {lane('Suggested', f.suggestedStatus, 'suggested')}
      {lane('Reviewed', r || 'not yet', r ? (r === f.rawStatus ? 'reverted' : 'reviewed') : 'pending')}
      <figcaption className="pv-strip__axis">
        <span>{ue(f.intervalStart)}</span>
        <span>
          {G(f.flaggedMin)} flagged of {G(f.intervalMin)} {f.rawStatus}
        </span>
        <span>{ue(f.intervalEnd)}</span>
      </figcaption>
    </figure>
  )
}

/* --- Mt — the cases line ------------------------------------------------ */

export function CasesLine({ f, ticketUrl }: { f: FlagView; ticketUrl: string }) {
  return (
    <p className="pv-cases">
      <strong>
        {f.distinctCases} distinct {f.distinctCases === 1 ? 'case' : 'cases'}
      </strong>
      <span className="cx-muted"> ({f.caseCount} events) in the flagged time: </span>
      {f.cases.map((c, i) => (
        <span key={c.id}>
          {i ? ', ' : ''}
          <a href={ticketUrl + c.id} target="_blank" rel="noopener noreferrer">
            #{c.id}
          </a>
          <span className="cx-faint"> {CHANNEL_LABELS[c.channel] ?? c.channel}</span>
        </span>
      ))}
    </p>
  )
}
