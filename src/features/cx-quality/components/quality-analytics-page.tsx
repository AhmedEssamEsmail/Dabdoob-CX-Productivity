'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality analytics page
 * (quality-analytics.closure.js — symbols: gl page; sections Ys health,
 * Gs attention, cl agents, sl columns, zs questions, Js by-channel, rl
 * non-ticket, details.qa-more(Xs coaching, el team leads, ll spread, Zs
 * outside), ol extras (+pl coverage, +ml totals, +_n columns); ea drill
 * drawer; ta basis seg; Count te machinery (is/rn/on/cs/Nt); constants
 * Ke/xt/ye/Me/Ge/Et/Pe/bn/Ks/Ot/yn/vn; helpers tl/nl/al/dl/he/ul/Rt/hl).
 */
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Chip,
  P,
  QaPage,
  QaSection,
  ScoreChip,
  qaBasisNote,
  qaBand,
  qaPct,
  useSe,
} from './qa-shared'
import {
  LoadError,
  useTip,
} from '@/features/shared/components/shell/ui'
import { prefersReducedMotion } from '@/features/shared/shell/i18n'
import { Button, Seg, Select } from '@/features/shared/components/ui'

/* --- constants (Ke/xt/ye/Me/Ge/Et/Pe/bn/Ks/Ot/yn/vn) -------------------- */
const CONF: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
const CONF_T: Record<string, string> = {
  high: 'ok',
  medium: 'warn',
  low: 'neutral',
}
/** ye — the ± range or "range unknown". */
const qaMargin = (t: number | null): string =>
  t === null ? 'range unknown' : `±${t}`
const TREND_G: Record<string, string> = { up: '↑', down: '↓', '': '' }
/** Ge — "pct% (lo–hi)" or dash. */
const qaPctl = (t: any): string =>
  t ? `${t.pct}% (${t.lo}–${t.hi})` : '–'
/** Et — band only when the row has a verdict. */
const qaVerdictStatus = (t: any): string =>
  t.verdict ? qaBand(t.avg, false) : 'neutral'
const WHY_V = ['agent', 'process', 'product', 'kb']
const REASON_L: Record<string, string> = {
  agent: 'Agent',
  process: 'Process',
  product: 'Product',
  kb: 'KB',
  untagged: 'Untagged',
}
/** Ks — "Agent 50%, KB 30% (2 untagged)" reason-share line. */
const qaReasons = (t: any): string => {
  const n = WHY_V.reduce((s, i) => s + t[i], 0)
  return (
    (WHY_V.filter((s) => t[s])
      .map((s) => `${REASON_L[s]} ${Math.round((t[s] / n) * 100)}%`)
      .join(', ') || '–') +
    (t.untagged ? ` (${t.untagged} untagged)` : '')
  )
}
const BASIS_L: Record<string, string> = {
  random: 'Random',
  targeted: 'Targeted',
  request: 'Requested',
  'off-queue': 'Off-queue',
  'non-ticket': 'Non-ticket',
  historical: 'History',
  unknown: 'Unknown basis',
}
const ATTN: Record<string, [string, string]> = {
  critical: ['Critical fail', 'bad'],
  repeat: ['Repeat after CTL', 'bad'],
  below: ['Below the team', 'warn'],
  falling: ['Falling', 'warn'],
  under: ['Under-audited', 'neutral'],
}
/** vn — period label. */
const qaPeriodLabel = (t: any, n = t.period): string =>
  t.grain === 'week' ? `Week of ${n}` : n

/** me — a button styled as the legacy qa-link. */
function QaLinkBtn({
  label,
  onClick,
}: {
  label: ReactNode
  onClick: () => void
}) {
  return (
    <Button type="button" className="qa-link" onClick={onClick}>
      {label}
    </Button>
  )
}

/* --- small helpers ------------------------------------------------------ */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const qaDowName = (t: string): string =>
  DAYS[new Date(t + 'T00:00:00Z').getUTCDay()]
const qaCountBand = (t: number, n: number): string =>
  t <= 0 ? 'bad' : t < n ? 'warn' : 'ok'
/** tl — period cell label (week drops the year-month prefix). */
const qaPeriodShort = (t: any, n: string): string =>
  t.grain === 'week' ? n.slice(5) : n
/** nl — "+1.4 points on the period before" (verbatim). */
const qaVsText = (t: number | null, n: number | null): string => {
  if (t === null || n == null) return ''
  const a = Math.round((t - n) * 10) / 10
  return a === 0
    ? 'same as the period before'
    : `${a > 0 ? '+' : ''}${a} points on the period before`
}
/** al — "Nov 25" month short. */
const qaMonthShort = (t: string): string =>
  new Date(t + '-01T00:00:00Z').toLocaleString('en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
const qaPerDay = (t: any, n: string): number =>
  n === 'queued' ? t.offerPerDay : t.perDay

/* --- Count — the animated number machinery (te + is + rn + on) ---------- */
const CS = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/
const CN = 900
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function Nt(): boolean {
  return (
    prefersReducedMotion() ||
    document.documentElement.hasAttribute('data-reduce-motion')
  )
}

/** is — scroll-into-view then ease a 0→1 progress over CN ms (verbatim). */
function useCountAnim(t: number | null) {
  const n = useRef<HTMLElement | null>(null)
  const a = useRef(false)
  const [s, i] = useState(1)

  useEffect(() => {
    if (a.current || t === null || t === 0 || Nt() || document.hidden) return
    a.current = true
    i(0)
    let c = 0,
      l = 0
    const p = () => {
      const u = performance.now()
      const d = (o: number) => {
        const h = Math.min(1, (o - u) / CN)
        i(h)
        if (h < 1) c = requestAnimationFrame(d)
      }
      c = requestAnimationFrame(d)
      l = window.setTimeout(() => {
        cancelAnimationFrame(c)
        i(1)
      }, CN + 100)
    }
    const m = n.current
    const r =
      m && typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((u) => {
            if (u.some((d) => d.isIntersecting)) {
              r?.disconnect()
              p()
            }
          })
        : null
    if (r && m) r.observe(m)
    else p()
    return () => {
      r?.disconnect()
      cancelAnimationFrame(c)
      clearTimeout(l)
      i(1)
    }
  }, [t])
  return { ref: n, k: s, ease: 1 - (1 - s) ** 3 }
}

/** rn — Arabic digit/punctuation localization (verbatim). */
function rn(t: string): string {
  return document.documentElement.lang !== 'ar'
    ? t
    : t
        .replace(/(\d)([.,])(?=\d)/g, (n, a, s) => a + (s === '.' ? '٫' : '٬'))
        .replace(/\d/g, (n) => AR_DIGITS[+n])
}

/** on — the live/sr-only pair. */
function CountPair({
  live: t,
  final: n,
  spanRef: a,
}: {
  live: string
  final: string
  spanRef: any
}) {
  return (
    <>
      <span ref={a} aria-hidden="true">
        {rn(t)}
      </span>
      <span className="sr-only">{rn(n)}</span>
    </>
  )
}

/** te — Count: eases a numeric string up, localizes, keeps sr-only final. */
function Count({ v: t }: { v: number | string | null }) {
  const n = t == null ? '' : String(t)
  const a = CS.exec(n)
  const s = a
    ? Number(a[2] + a[3].replace(/,/g, '') + (a[4] ?? ''))
    : null
  const { ref: i, k: c, ease: l } = useCountAnim(s)
  if (!a || s === null || c >= 1)
    return <CountPair live={n} final={n} spanRef={i} />
  const p = a[4] ? a[4].length - 1 : 0
  const m = (s * l).toLocaleString('en-US', {
    minimumFractionDigits: p,
    maximumFractionDigits: p,
    useGrouping: a[3].includes(','),
  })
  return <CountPair live={a[1] + m + a[5]} final={n} spanRef={i} />
}

/* --- il — the agent sparkline ------------------------------------------- */
function SparkChart({
  d: t,
  h: n,
  name: a,
}: {
  d: any
  h: any[] | undefined
  name: string
}) {
  const s = (n ?? [])
    .map((d: any, o: number) => (d.avg == null ? null : { i: o, v: d.avg }))
    .filter((d: any) => d !== null) as { i: number; v: number }[]
  if (s.length < 2) return <span className="cx-faint">–</span>
  const i = 84,
    c = 24,
    l = Math.min(60, ...s.map((d) => d.v)),
    p = (d: number) => 3 + (d * (i - 6)) / Math.max(1, (n ?? []).length - 1),
    m = (d: number) => 3 + ((100 - d) * (c - 6)) / (100 - l),
    r = s[s.length - 1],
    u = `${a} by ${t.grain}: ${(n ?? [])
      .map(
        (d: any, o: number) =>
          `${qaPeriodShort(t, t.history[o]?.period ?? '')} ${
            d.avg == null ? 'none' : `${d.avg}% (${d.audits})`
          }`
      )
      .join(', ')}`
  return (
    <svg
      className="qa-spark"
      viewBox={`0 0 ${i} ${c}`}
      role="img"
      aria-label={u}
    >
      <title>{u}</title>
      <polyline
        points={s.map((d) => `${p(d.i)},${m(d.v)}`).join(' ')}
        fill="none"
      />
      <circle cx={p(r.i)} cy={m(r.v)} r={2.5} />
    </svg>
  )
}

/* --- Ys — the health/bases head ------------------------------------------ */
function HealthHead({ d: t }: { d: any }) {
  const n = t.health
  const a = t.bases.filter((s: any) => s.basis !== 'random')
  return (
    <section className="card" aria-labelledby="qa-health-h">
      <div className="card-head">
        <div>
          <div className="card-title" id="qa-health-h">
            Team health
          </div>
          <div className="card-hint">{qaPeriodLabel(t)}</div>
        </div>
      </div>
      <div className="card-pad">
      <dl className="dq-totals qa-health">
        <div
          className="dq-totals__item"
          data-status={
            n.score !== null && n.badge !== 'low' ? qaBand(n.score, false) : undefined
          }
        >
          <dt>Team score</dt>
          <dd className="cx-num">
            <Count v={qaPct(n.score)} />{' '}
            <span className="qa-range">
              {n.score === null ? '' : qaMargin(n.margin)}
            </span>
            {n.trend ? (
              <span
                className="qa-range"
                title={`${n.trend === 'up' ? 'Up' : 'Down'} from ${n.prevScore}%, beyond both ranges`}
              >
                {' '}
                {TREND_G[n.trend]}
              </span>
            ) : null}
          </dd>
          <span className="cx-faint qa-sub">
            {n.score === null
              ? 'No agent has 10 random audits yet'
              : `${n.agents} agents, each counted once; ${CONF[n.badge].toLowerCase()} confidence`}
          </span>
        </div>
        <div className="dq-totals__item">
          <dt>Without critical fails</dt>
          <dd className="cx-num">
            <Count v={qaPct(n.scoreNoCritical)} />
          </dd>
        </div>
        <div
          className="dq-totals__item"
          data-status={n.critical ? 'bad' : undefined}
        >
          <dt>Critical fails</dt>
          <dd className="cx-num">
            <Count v={n.critical} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.criticalRate ? `${qaPctl(n.criticalRate)} of ${t.audits}` : 'no random audits'}
          </span>
        </div>
        <div className="dq-totals__item">
          <dt>Agents with a verdict</dt>
          <dd className="cx-num">
            <Count v={n.agentsVerdict} /> of <Count v={n.agentsAudited} />
          </dd>
          <span className="cx-faint qa-sub">16 or more audits</span>
        </div>
        <div className="dq-totals__item">
          <dt>Weighted to the ticket mix</dt>
          <dd className="cx-num">
            <Count v={n.weighted ? `${n.weighted.mean}%` : '–'} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.weighted
              ? `audited reasons hold ${n.weighted.coverage}% of tickets`
              : 'no ticket volumes recorded yet'}
          </span>
        </div>
        <div className="dq-totals__item">
          <dt>Audited against quota</dt>
          <dd className="cx-num">
            <Count v={qaPct(n.quotaPct)} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.quotaDone} of {n.quotaExpected} so far
          </span>
        </div>
        <div
          className="dq-totals__item"
          data-status={n.notFinal ? 'warn' : undefined}
        >
          <dt>Pending disputes</dt>
          <dd className="cx-num">
            <Count v={n.pendingDisputes} />
          </dd>
          <span className="cx-faint qa-sub">
            {n.notFinal ? 'Not final: these return when decided' : 'Final'}
          </span>
        </div>
      </dl>
      {a.length || t.blankScores ? (
        <p className="cx-muted qa-bases">
          Not in the score:{' '}
          {a.map((s: any) => `${BASIS_L[s.basis]} ${s.audits} (average ${qaPct(s.avg)})`).join(', ')}
          {t.blankScores
            ? `${a.length ? '; ' : ''}${t.blankScores} with no score`
            : ''}
          .
          {a.some((s: any) => s.basis === 'unknown')
            ? ' Unknown basis: audits from before the basis was recorded, until the one-off backfill runs.'
            : ''}
        </p>
      ) : null}
      </div>
    </section>
  )
}

/* --- Gs — who needs a look ------------------------------------------------ */
function Attention({
  d: t,
  open: n,
}: {
  d: any
  open: (pick: any) => void
}) {
  const [a, s] = useState(false)
  const i = a ? t.attention : t.attention.slice(0, 10)
  return (
    <QaSection
      id="qa-att-h"
      title="Who needs a look"
      hint="One row per agent, with every rule that fired: a critical fail, a repeat after a CTL, a score whose whole range sits under the middle agent, two falling periods, or fewer audits than the quota so far."
    >
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Why</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {i.length ? (
              i.map((c: any) => (
                <tr key={c.email}>
                  <td>
                    <QaLinkBtn
                      label={c.name}
                      onClick={() =>
                        n({ agent: c.email, agentName: c.name })
                      }
                    />
                    <span className="cx-faint qa-sub">{c.tlName}</span>
                  </td>
                  <td>
                    <ul className="qa-whylist">
                      {c.reasons.map((l: any, p: number) => (
                        <li key={p}>
                          <Chip status={ATTN[l.rule][1]}>{ATTN[l.rule][0]}</Chip>{' '}
                          <span className="cx-muted">{l.text}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="cx-num">
                    {c.avg === null ? '–' : `${c.avg}%`}
                    <span className="cx-faint qa-sub">{c.audits} random</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>
                  Nobody this period: no critical fail, repeat after coaching,
                  low verdict, fall or audit gap.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {t.attention.length > 10 ? (
        <Button
          variant="quiet"
          onClick={() => s(!a)}
        >
          {a ? 'Show the first 10' : `Show all ${t.attention.length}`}
        </Button>
      ) : null}
    </QaSection>
  )
}

/* --- Js — by channel and contact reason ---------------------------------- */
function ByChannel({ d: t }: { d: any }) {
  const n = (a: any) => (
    <>
      <Chip status={qaVerdictStatus(a)}>{qaPct(a.avg)}</Chip>{' '}
      <span className="qa-range cx-num">
        {a.other ? 'not ranked' : qaMargin(a.margin)}
      </span>
      {a.trend ? (
        <span
          className="qa-range"
          title={`${a.trend === 'up' ? 'Up' : 'Down'} from ${a.prevAvg}%, beyond both ranges`}
        >
          {' '}
          {TREND_G[a.trend]}
        </span>
      ) : null}
    </>
  )
  return (
    <QaSection
      id="qa-seg-h"
      title="By channel and contact reason"
      hint="Each agent counts once in a channel's score (the plain audit average is beside it). Weighted: re-weighted to how many tickets each contact reason had, undoing the queue's prioritisation."
    >
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Score</th>
              <th scope="col">Weighted</th>
              <th scope="col">Audits</th>
              <th scope="col">Confidence</th>
              <th scope="col">Critical</th>
            </tr>
          </thead>
          <tbody>
            {t.byChannel.length ? (
              t.byChannel.map((a: any) => (
                <tr className={a.badge === 'low' ? 'qa-low' : undefined} key={a.key}>
                  <td>{a.label}</td>
                  <td>
                    {n(a)}
                    <span className="cx-faint qa-sub">
                      audit average {qaPct(a.auditAvg)}
                    </span>
                  </td>
                  <td className="cx-num">
                    {a.weighted ? `${a.weighted.mean}%` : '–'}
                  </td>
                  <td className="cx-num">
                    {a.audits}
                    <span className="cx-faint qa-sub">{a.agents} agents</span>
                  </td>
                  <td>
                    <Chip status={CONF_T[a.badge]}>{CONF[a.badge]}</Chip>
                  </td>
                  <td className="cx-num">{a.fatal || ''}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>No random audits in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Contact reason</th>
              <th scope="col">Channel</th>
              <th scope="col">Score</th>
              <th scope="col">Audits</th>
              <th scope="col">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {t.byContactType.length ? (
              t.byContactType.map((a: any) => (
                <tr className={a.badge === 'low' ? 'qa-low' : undefined} key={a.key}>
                  <td>
                    {a.label}
                    {a.other ? (
                      <span className="cx-faint qa-sub">{a.reasons} reasons</span>
                    ) : null}
                  </td>
                  <td>{a.channel}</td>
                  <td>{n(a)}</td>
                  <td className="cx-num">{a.audits}</td>
                  <td>
                    <Chip status={CONF_T[a.badge]}>{CONF[a.badge]}</Chip>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No random audits in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </QaSection>
  )
}

/* --- cl — the agents table ------------------------------------------------ */
function Agents({ d: t, open: n }: { d: any; open: (pick: any) => void }) {
  const a = t.grain === 'month'
  return (
    <QaSection
      id="qa-ag-h"
      title="Agents"
      hint="Random audits only. Agents with 16 or more audits first, lowest score first; under 16 the score is not coloured. Channels are shown apart."
    >
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Score</th>
              <th scope="col">Trend</th>
              <th scope="col">Confidence</th>
              <th scope="col">Critical</th>
              <th scope="col">Channels</th>
              <th scope="col">Fails: agent / other</th>
              {a ? (
                <>
                  <th scope="col">Full marks</th>
                  <th scope="col">Critical rate</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {t.byAgent.length ? (
              t.byAgent.map((s: any) => (
                <tr className={s.badge === 'low' ? 'qa-low' : undefined} key={s.key}>
                  <td>
                    <QaLinkBtn
                      label={s.label}
                      onClick={() => n({ agent: s.key, agentName: s.label })}
                    />
                    <span className="cx-faint qa-sub">{s.tlName}</span>
                  </td>
                  <td>
                    <Chip status={qaVerdictStatus(s)}>{qaPct(s.avg)}</Chip>{' '}
                    <span className="qa-range cx-num">{qaMargin(s.margin)}</span>
                    {s.trend ? (
                      <span
                        className="qa-range"
                        title={`${s.trend === 'up' ? 'Up' : 'Down'} from ${s.prevAvg}%, beyond both ranges`}
                      >
                        {' '}
                        {TREND_G[s.trend]}
                      </span>
                    ) : null}
                    <span className="cx-faint qa-sub">{s.audits} audits</span>
                  </td>
                  <td>
                    <SparkChart d={t} h={s.history} name={s.label} />
                  </td>
                  <td>
                    <Chip status={CONF_T[s.badge]}>{CONF[s.badge]}</Chip>
                  </td>
                  <td className="cx-num">{s.fatal || ''}</td>
                  <td>
                    {s.channels.map((i: any) => (
                      <span className="qa-sub" key={i.channel}>
                        {i.channel} {qaPct(i.avg)} ({i.audits})
                      </span>
                    ))}
                  </td>
                  <td className="cx-num">
                    {s.reasons.agent} / {s.reasons.other}
                    {s.reasons.untagged ? (
                      <span className="cx-faint qa-sub">
                        {s.reasons.untagged} untagged
                      </span>
                    ) : null}
                  </td>
                  {a ? (
                    <>
                      <td className="cx-num">{qaPctl(s.fullMarks)}</td>
                      <td className="cx-num">{qaPctl(s.fatalRate)}</td>
                    </>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={a ? 9 : 7}>No random audits in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </QaSection>
  )
}

/* --- zs — where points are lost ------------------------------------------- */
function Questions({ d: t, open: n }: { d: any; open: (pick: any) => void }) {
  const [a, s] = useState(false)
  const i = a ? t.questions : t.questions.slice(0, 15)
  return (
    <QaSection
      id="qa-q-h"
      title="Where points are lost"
      hint={`Points each question costs per 100 audits of its form. Questions asked fewer than 10 times are listed after the rest. Reasons are shares of tagged fails: ${t.reasonCoveragePct === null ? 'none' : `${t.reasonCoveragePct}%`} of fails are tagged.`}
    >
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Points lost per 100 audits</th>
              <th scope="col">Failed</th>
              <th scope="col">N/A</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {i.length ? (
              i.map((c: any) => (
                <tr className={c.gated ? 'qa-low' : undefined} key={c.key}>
                  <td>
                    <QaLinkBtn
                      label={c.text}
                      onClick={() =>
                        n({ question: c.key, questionText: c.text })
                      }
                    />
                    <span className="cx-faint qa-sub">
                      {c.channel}, {c.section}
                      {c.fatal ? ', critical' : ''}
                      {c.gated ? ', too few to rank' : ''}
                    </span>
                  </td>
                  <td className="cx-num">{c.lossPer100}</td>
                  <td className="cx-num">
                    {c.failed} of {c.asked}
                    <span className="cx-faint qa-sub">
                      {qaPct(c.failPct)}, {c.agentsFailed}{' '}
                      {c.agentsFailed === 1 ? 'agent' : 'agents'}
                    </span>
                  </td>
                  <td className="cx-num">{qaPct(c.naPct)}</td>
                  <td>{qaReasons(c.reasons)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No failed questions in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {t.questions.length > 15 ? (
        <Button
          variant="quiet"
          onClick={() => s(!a)}
        >
          {a ? 'Show the top 15' : `Show all ${t.questions.length}`}
        </Button>
      ) : null}
      {t.rescoredSkipped ? (
        <p className="cx-faint">
          {t.rescoredSkipped} re-scored{' '}
          {t.rescoredSkipped === 1 ? 'audit is' : 'audits are'} left out here:
          a re-score keeps the old answers.
        </p>
      ) : null}
    </QaSection>
  )
}

/* --- _n — a columns chart -------------------------------------------------- */
function ColsChart({
  title: t,
  grain: n,
  cols: a,
  cells: s,
}: {
  title: string
  grain: string
  cols: any
  cells: any[]
}) {
  const { ref: i, tipFor: c, tipEl: l } = useTip<HTMLElement>()
  const p = 560,
    m = 210,
    r = 32,
    u = 8,
    d = 20,
    o = 40,
    h = a.periods.length,
    b = (p - r - u) / h,
    x = Math.min(44, b * 0.6),
    f = (_: number) =>
      d + ((100 - Math.max(0, Math.min(100, _))) * (m - d - o)) / 100,
    g = (_: string) => (n === 'week' ? _.slice(5) : qaMonthShort(_)),
    y = s.some((_) => _?.avg != null && _.audits > 0)

  return (
    <figure className="qa-trend qa-cols cc-chart" ref={i as any}>
      <figcaption className="qa-cols__title">{t}</figcaption>
      {l}
      <div className="qa-trend__scroll">
        <svg viewBox={`0 0 ${p} ${m}`} role="group" aria-label={t}>
          {[0, 50, 100].map((_) => (
            <g key={_}>
              <line
                x1={r}
                x2={p - u}
                y1={f(_)}
                y2={f(_)}
                className="qa-trend__grid"
              />
              <text
                x={r - 6}
                y={f(_) + 4}
                textAnchor="end"
                className="qa-trend__lbl"
              >
                {_}
              </text>
            </g>
          ))}
          {a.periods.map((_: string, T: number) => {
            const k = s[T]
            const C = r + b * T + b / 2
            const O = k != null && k.avg != null && k.audits > 0
            return (
              <g key={_}>
                {O ? (
                  <>
                    <rect
                      className={`cc-sweep-col qa-dot--${qaBand(k.avg, false)}${k.history * 2 > k.audits ? ' qa-cols__hist' : ''}`}
                      x={C - x / 2}
                      y={f(k.avg)}
                      width={x}
                      height={f(0) - f(k.avg)}
                      rx={2}
                      tabIndex={0}
                      role="img"
                      {...c(
                        `${n === 'week' ? `Week of ${_}` : _}: ${k.avg}% from ${k.audits} audits (${k.history} old-form history, ${k.audits - k.history} random)`
                      )}
                    />
                    <text
                      x={C}
                      y={f(k.avg) - 5}
                      textAnchor="middle"
                      className="qa-trend__lbl qa-cols__val"
                    >
                      {Math.round(k.avg)}
                    </text>
                  </>
                ) : null}
                <text
                  x={C}
                  y={m - 22}
                  textAnchor="middle"
                  className="qa-trend__lbl"
                >
                  {g(_)}
                </text>
                <text
                  x={C}
                  y={m - 6}
                  textAnchor="middle"
                  className="qa-trend__lbl qa-trend__n"
                >
                  {O ? k.audits : '–'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      {y ? null : (
        <div className="empty qa-cols__none">
          <div className="s">
            No audits in these {n === 'week' ? 'weeks' : 'months'}.
          </div>
        </div>
      )}
    </figure>
  )
}

/* --- sl — score over time -------------------------------------------------- */
function Columns({ d: t }: { d: any }) {
  const [n, a] = useState('')
  const s = t.columns
  if (!s) return null
  const i = new Map<string, string>()
  ;[...s.week.agents, ...s.month.agents].forEach((p: any) =>
    i.set(p.key, p.label)
  )
  const c = (p: any) =>
    n
      ? p.agents.find((m: any) => m.key === n)?.cells ??
        p.periods.map(() => null)
      : p.team
  const l = n ? i.get(n) ?? n : 'Team'

  return (
    <QaSection
      id="qa-cols-h"
      title="Score over time"
      hint="Plain average score of the audits in each period; under each column, how many audits. No column means no audits that period."
    >
      <div className="qa-cols__pick">
        <label className="cx-label" htmlFor="qa-cols-agent">
          Show
        </label>
        <Select
          id="qa-cols-agent"
          value={n}
          onChange={(p) => a(p.currentTarget.value)}
        >
          <option value="">Whole team</option>
          {[...i]
            .sort((p, m) => p[1].localeCompare(m[1]))
            .map(([p, m]) => (
              <option value={p} key={p}>
                {m}
              </option>
            ))}
        </Select>
      </div>
      <div className="qa-cols__grid">
        <ColsChart
          title={`${l} score, week over week`}
          grain="week"
          cols={s.week}
          cells={c(s.week)}
        />
        <ColsChart
          title={`${l} score, month over month`}
          grain="month"
          cols={s.month}
          cells={c(s.month)}
        />
      </div>
      <p className="qa-trend__legend">
        Includes old-form history audits (pale column: mostly history). Not the
        team score above: every audit counts once, no 10-audit rule.
      </p>
    </QaSection>
  )
}

/* --- rl — non-ticket types -------------------------------------------------- */
function NonTicket({ d: t }: { d: any }) {
  return t.nonTicket.length ? (
    <>
      {t.nonTicket.map((n: any) => (
        <QaSection
          id={`qa-nt-${n.type.replace(/\W+/g, '-')}`}
          title={n.type}
          hint={`Its own form and scale, kept out of the ticket scores. ${n.audits} audits, ${qaPct(n.avg)} ${qaMargin(n.margin)}.`}
          key={n.type}
        >
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col">Audits</th>
                  <th scope="col">Average</th>
                  <th scope="col">Critical</th>
                </tr>
              </thead>
              <tbody>
                {n.agents.map((a: any) => (
                  <tr key={a.email}>
                    <td>{a.name}</td>
                    <td className="cx-num">{a.audits}</td>
                    <td className="cx-num">{qaPct(a.avg)}</td>
                    <td className="cx-num">{a.fatal || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QaSection>
      ))}
    </>
  ) : null
}

/* --- Xs — coaching loop ----------------------------------------------------- */
function Coaching({ d: t, open: n }: { d: any; open: (pick: any) => void }) {
  const a = t.coaching
  const [s, i] = useState(false)
  const c = s ? t.repeats : t.repeats.slice(0, 10)
  return (
    <QaSection
      id="qa-rep-h"
      title="Coaching loop"
      hint={`Repeat failures in the 30 days to ${t.periodEnd}: the same question failed twice, or again on a ticket handled after the CTL on it.`}
    >
      <dl className="dq-totals">
        <div className="dq-totals__item">
          <dt>CTLs open</dt>
          <dd className="cx-num">
            <Count v={a.ctlOpen} />
          </dd>
        </div>
        <div
          className="dq-totals__item"
          data-status={a.ctlOverdue ? 'bad' : undefined}
        >
          <dt>Overdue</dt>
          <dd className="cx-num">
            <Count v={a.ctlOverdue} />
          </dd>
        </div>
        <div className="dq-totals__item">
          <dt>Failed again after coaching</dt>
          <dd className="cx-num">
            <Count v={a.postCtl ? qaPctl(a.postCtl) : '–'} />
          </dd>
          <span className="cx-faint qa-sub">
            {a.postCtlFails} of {a.postCtlAsked} later answers on coached
            questions
          </span>
        </div>
      </dl>
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Question</th>
              <th scope="col">Failed</th>
              <th scope="col">Why</th>
              <th scope="col">After CTL</th>
            </tr>
          </thead>
          <tbody>
            {c.length ? (
              c.map((l: any) => (
                <tr key={l.agentEmail + l.key}>
                  <td>
                    <QaLinkBtn
                      label={l.agentName}
                      onClick={() =>
                        n({
                          agent: l.agentEmail,
                          agentName: l.agentName,
                          question: l.key,
                          questionText: l.text,
                        })
                      }
                    />
                    <span className="cx-faint qa-sub">{l.tlName}</span>
                  </td>
                  <td>{l.text}</td>
                  <td className="cx-num">
                    {l.fails} of {l.asked}
                    <span className="cx-faint qa-sub">last {l.last}</span>
                  </td>
                  <td>{l.reason ? REASON_L[l.reason] : '–'}</td>
                  <td>
                    {l.afterCtl ? (
                      <>
                        <Chip status="bad">CTL {l.afterCtl}</Chip>
                        <span className="cx-faint qa-sub">
                          {l.afterFails} of {l.afterAsked} since failed
                        </span>
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No repeat failures in these 30 days.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {t.repeats.length > 10 ? (
        <Button
          variant="quiet"
          onClick={() => i(!s)}
        >
          {s ? 'Show the first 10' : `Show all ${t.repeats.length}`}
        </Button>
      ) : null}
    </QaSection>
  )
}

/* --- el — team leads ---------------------------------------------------------- */
function TeamLeads({ d: t }: { d: any }) {
  return (
    <QaSection
      id="qa-tl-h"
      title="Team leads"
      hint="How many of each lead's agents are on the list above, and their open CTLs. CTL on-time rate in the month view."
    >
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Team lead</th>
              <th scope="col">Agents needing a look</th>
              <th scope="col">CTLs open</th>
              <th scope="col">Overdue</th>
              {t.grain === 'month' ? <th scope="col">CTL on time</th> : null}
            </tr>
          </thead>
          <tbody>
            {t.byTl.length ? (
              t.byTl.map((n: any) => (
                <tr key={n.tlEmail}>
                  <td>{n.tlName}</td>
                  <td className="cx-num">
                    {n.attention} of {n.agents}
                    {n.attentionPct !== null ? ` (${n.attentionPct}%)` : ''}
                  </td>
                  <td className="cx-num">{n.ctlOpen}</td>
                  <td className="cx-num">
                    {n.ctlOverdue ? (
                      <Chip status="bad">{n.ctlOverdue}</Chip>
                    ) : (
                      0
                    )}
                  </td>
                  {t.grain === 'month' ? (
                    <td>
                      <Chip
                        status={
                          n.slaPct === null
                            ? 'neutral'
                            : n.slaPct >= t.targets.ctlSla
                              ? 'ok'
                              : 'bad'
                        }
                      >
                        {qaPct(n.slaPct)}
                      </Chip>
                    </td>
                  ) : null}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  No team leads with audited agents in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </QaSection>
  )
}

/* --- ll — agents against the team (spread) ------------------------------------- */
function Spread({ d: t }: { d: any }) {
  const { ref: n, tipFor: a, tipEl: s } = useTip<HTMLElement>()
  const i = t.byAgent.filter((g: any) => g.avg !== null)
  if (!i.length) return null
  const c = t.health.score
  const l = 22,
    p = 150,
    m = 76,
    r = 560,
    u = 20,
    d = u + i.length * l + 22,
    o = Math.max(
      0,
      Math.floor(
        Math.min(...i.map((g: any) => g.avg - (g.margin ?? 0)), c ?? 100) / 10
      ) * 10
    ),
    h = 100,
    b = (g: number) =>
      p + ((Math.min(h, Math.max(o, g)) - o) * (r - p - m)) / (h - o)
  const x: Record<string, number> = { ok: 0, warn: 0, bad: 0 }
  i.forEach((g: any) => {
    if (g.verdict) x[qaBand(g.avg, false)]++
  })
  const f = x.ok + x.warn + x.bad

  return (
    <QaSection
      id="qa-spread-h"
      title="Agents against the team"
      hint={`Each agent's random-audit score with its 95% range, lowest first; the dashed line is the team score. Grey dot: under 16 audits, no verdict yet. ${f ? `Of the ${f} agents with a verdict: ${x.ok} green, ${x.warn} amber, ${x.bad} red.` : 'No agent has 16 audits yet.'}`}
    >
      <figure className="qa-trend qa-spread cc-chart" ref={n as any}>
        {s}
        <svg
          viewBox={`0 0 ${r} ${d}`}
          role="group"
          aria-label="Agent quality scores against the team score"
        >
          {[o, Math.round((o + h) / 2), h].map((g) => (
            <g key={g}>
              <line
                x1={b(g)}
                x2={b(g)}
                y1={u - 4}
                y2={d - 18}
                className="qa-trend__grid"
              />
              <text
                x={b(g)}
                y={d - 4}
                textAnchor="middle"
                className="qa-trend__lbl"
              >
                {g}
              </text>
            </g>
          ))}
          {c !== null ? (
            <g>
              <line
                x1={b(c)}
                x2={b(c)}
                y1={u - 4}
                y2={d - 18}
                className="qa-spread__team"
              />
              <text
                x={b(c)}
                y={u - 8}
                textAnchor="middle"
                className="qa-trend__lbl"
              >
                Team {c}%
              </text>
            </g>
          ) : null}
          {i.map((g: any, y: number) => {
            const _ = u + y * l + l / 2
            const T = qaVerdictStatus(g)
            return (
              <g className={g.verdict ? undefined : 'qa-spread__thin'} key={g.key}>
                <text
                  x={p - 8}
                  y={_ + 4}
                  textAnchor="end"
                  className="qa-trend__lbl"
                >
                  {g.label.length > 20 ? g.label.slice(0, 19) + '…' : g.label}
                </text>
                {g.margin !== null ? (
                  <line
                    className="qa-spread__ci"
                    x1={b(g.avg - g.margin)}
                    x2={b(g.avg + g.margin)}
                    y1={_}
                    y2={_}
                  />
                ) : null}
                <circle
                  className={`cc-sweep-fade qa-dot--${T}`}
                  cx={b(g.avg)}
                  cy={_}
                  r={5}
                  tabIndex={0}
                  role="img"
                  {...a(
                    `${g.label}: ${g.avg}%${g.margin !== null ? ` ±${g.margin}` : ''} from ${g.audits} audits${c !== null ? `, ${qaVsText(g.avg, c).replace('on the period before', 'against the team').replace('same as the period before', 'level with the team')}` : ''}`
                  )}
                />
                <text x={r - m + 8} y={_ + 4} className="qa-trend__lbl">
                  {g.avg}% · {g.audits}
                </text>
              </g>
            )
          })}
        </svg>
        <figcaption className="qa-trend__legend">
          <span>Right: score · audits.</span>
        </figcaption>
      </figure>
    </QaSection>
  )
}

/* --- Zs — fix outside the team ------------------------------------------------- */
function Outside({ d: t }: { d: any }) {
  return t.outside.length ? (
    <QaSection
      id="qa-out-h"
      title="Fix outside the team"
      hint="Questions where most tagged fails (60% or more of at least 10) are Process, Product or KB: a fix for their owner, not coaching."
    >
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Outside the agent</th>
              <th scope="col">Process</th>
              <th scope="col">Product</th>
              <th scope="col">KB</th>
              <th scope="col">KB gaps logged</th>
            </tr>
          </thead>
          <tbody>
            {t.outside.map((n: any) => (
              <tr key={n.key}>
                <td>
                  {n.text}
                  <span className="cx-faint qa-sub">{n.channel}</span>
                </td>
                <td className="cx-num">
                  {n.outside} of {n.tagged} ({n.sharePct}%)
                </td>
                <td className="cx-num">{n.process}</td>
                <td className="cx-num">{n.product}</td>
                <td className="cx-num">{n.kb}</td>
                <td className="cx-num">{n.kbGaps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </QaSection>
  ) : null
}

/* --- ml / xn / pl — the coverage machinery -------------------------------------- */
function CoverageTotals({ c: t }: { c: any }) {
  return (
    <div className="cx-panel cx-tablewrap">
      <table className="cx-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Audited</th>
            <th scope="col">Queued</th>
            <th scope="col">Quota</th>
          </tr>
        </thead>
        <tbody>
          {t.days
            .map((n: string, a: number) => (
              <tr key={n}>
                <td>
                  {qaDowName(n)} {n}
                </td>
                <td>
                  <Chip status={qaCountBand(t.totals.audited[a], t.totals.target[a])}>
                    {t.totals.audited[a]}
                  </Chip>
                </td>
                <td className="cx-num">{t.totals.queued[a]}</td>
                <td className="cx-num">{t.totals.target[a]}</td>
              </tr>
            ))
            .reverse()}
        </tbody>
      </table>
    </div>
  )
}

/** xn — the per-agent status line (verbatim). */
function xn(t: any): [string, string] {
  const n = t.audited.slice(-7).reduce((a: number, s: number) => a + s, 0)
  return t.queuedTotal
    ? t.auditedTotal
      ? n < t.perWeek
        ? [`${n} of ${t.perWeek} in 7 days`, 'warn']
        : [`${n} of ${t.perWeek} in 7 days`, 'ok']
      : ['Queued, never audited', 'bad']
    : ['Never queued', 'bad']
}

function Coverage({ c: t }: { c: any }) {
  const [n, a] = useState('queued')
  const [s, i] = useState('')
  if (t.error)
    return (
      <QaSection id="qa-cov-h" title="Samples per agent per day">
        <p className="cx-error">
          The Queue Log could not be read: {t.error}
        </p>
      </QaSection>
    )
  if (!t.agents.length)
    return (
      <QaSection id="qa-cov-h" title="Samples per agent per day">
        <div className="empty">
          <div className="s">
            No agents on the roster and nothing in the Queue Log for the last{' '}
            {t.days.length} days.
          </div>
        </div>
      </QaSection>
    )
  const c = t.agents.filter((m: any) => xn(m)[1] !== 'ok').length
  const l = t.agents.find((m: any) => m.expected && !m.actionPlan)?.offerPerDay ?? 0
  const p = (
    <Seg
      className="qa-view"
      name="qa-cov-count"
      value={n}
      onChange={a}
      options={[
        { value: 'queued', label: 'Queued' },
        { value: 'audited', label: 'Audited' },
      ]}
      aria-label="Count"
    />
  )
  return (
    <>
      <QaSection
        id="qa-cov-h"
        title="Samples per agent per day"
        hint={
          n === 'queued'
            ? `Last ${t.days.length} days: items added to the queue each day (Queued Date), whatever happened to them later, against the daily offer of ${l}.`
            : `Last ${t.days.length} days: audits done each day, against the daily quota. ${c} of ${t.agents.length} agents below quota.`
        }
      >
        {p}
        {n === 'queued' ? (
          <p className="qa-cov-tip cx-faint" aria-live="polite">
            {s || 'Point at or tab to a day under the offer to see why.'}
          </p>
        ) : null}
        <div className="cx-panel cx-tablewrap qa-cov-wrap">
          <table className="cx-table qa-cov">
            <thead>
              <tr>
                <th scope="col" className="qa-cov__name">
                  Agent
                </th>
                {t.days.map((m: string) => (
                  <th
                    scope="col"
                    className="qa-cov__day"
                    title={`${qaDowName(m)} ${m}`}
                    key={m}
                  >
                    <span>{qaDowName(m).slice(0, 2)}</span>
                    {+m.slice(8)}
                  </th>
                ))}
                <th scope="col">Audited</th>
                <th scope="col">Queued</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {t.agents.map((m: any) => {
                const [r, u] = xn(m)
                const d = qaPerDay(m, n)
                return (
                  <tr key={m.key}>
                    <th scope="row" className="qa-cov__name">
                      {m.name}
                      <span className="cx-faint qa-sub">
                        {[
                          m.tlName,
                          m.actionPlan ? `action plan, ${m.perDay} a day` : '',
                          m.expected ? '' : 'not on the agent roster',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </th>
                    {m[n].map((o: number, h: number) => {
                      const b = n === 'queued' ? m.reasons?.[h] : ''
                      const x = `${m.name}, ${qaDowName(t.days[h])} ${t.days[h]}: ${m.queued[h]} queued (offer ${m.offerPerDay}), ${m.audited[h]} audited (quota ${m.perDay})${b ? '. ' + b : ''}`
                      return (
                        <td
                          className="qa-cov__cell"
                          data-l={qaCountBand(o, d)}
                          data-noq={
                            n === 'audited' && !m.queued[h] ? 'true' : undefined
                          }
                          title={x}
                          tabIndex={b ? 0 : undefined}
                          aria-label={b ? x : undefined}
                          onMouseEnter={b ? () => i(x) : undefined}
                          onFocus={b ? () => i(x) : undefined}
                          key={t.days[h]}
                        >
                          {o}
                        </td>
                      )
                    })}
                    <td className="cx-num">{m.auditedTotal}</td>
                    <td className="cx-num">
                      {m.queuedTotal}
                      {m.passed || m.expired ? (
                        <span className="cx-faint qa-sub">
                          {m.passed} passed, {m.expired} expired
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <Chip status={u}>{r}</Chip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="qa-cov-legend cx-faint">
          <span className="qa-cov__cell" data-l="bad">
            0
          </span>{' '}
          none
          <span className="qa-cov__cell" data-l="warn">
            2
          </span>{' '}
          below the daily {n === 'queued' ? 'offer' : 'quota'}
          <span className="qa-cov__cell" data-l="ok">
            {n === 'queued' ? l : 4}
          </span>{' '}
          {n === 'queued' ? 'offer' : 'quota'} met
          {n === 'audited' ? (
            <>
              <span className="qa-cov__cell" data-l="bad" data-noq="true">
                0
              </span>{' '}
              striped: nothing was queued for them that day
            </>
          ) : null}
        </p>
      </QaSection>
      <QaSection id="qa-cov-t-h" title="All agents: audits per day against the quota">
        <CoverageTotals c={t} />
      </QaSection>
    </>
  )
}

/* --- ol — the extras (month auditors, coverage, form rules) -------------------- */
function Extras({ d: t }: { d: any }) {
  return (
    <>
      {t.grain === 'month' ? (
        <details className="qa-more">
          <summary>Auditors and CTL timeliness this month</summary>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Auditor</th>
                  <th scope="col">Audits</th>
                  <th scope="col">Dispute rate</th>
                  <th scope="col">Alignment</th>
                  <th scope="col">KB gaps (same day)</th>
                </tr>
              </thead>
              <tbody>
                {t.auditors.length ? (
                  t.auditors.map((n: any) => (
                    <tr key={n.email}>
                      <td>{n.name}</td>
                      <td className="cx-num">{n.audits}</td>
                      <td>
                        <Chip
                          status={
                            n.disputePct === null
                              ? 'neutral'
                              : n.disputePct < t.targets.disputePass
                                ? 'ok'
                                : 'bad'
                          }
                        >
                          {qaPct(n.disputePct)}
                        </Chip>
                        {n.disputes ? (
                          <span className="cx-faint qa-sub">
                            {n.disputes} raised
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <Chip
                          status={
                            n.alignmentPct === null
                              ? 'neutral'
                              : n.alignmentPct >= t.targets.alignment
                                ? 'ok'
                                : 'bad'
                          }
                        >
                          {qaPct(n.alignmentPct)}
                        </Chip>
                      </td>
                      <td className="cx-num">
                        {n.kbGaps} ({n.kbSameDay})
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No auditor activity this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Team lead</th>
                  <th scope="col">On time</th>
                  <th scope="col">SLA</th>
                  <th scope="col">Done</th>
                </tr>
              </thead>
              <tbody>
                {t.ctlSla.length ? (
                  t.ctlSla.map((n: any) => (
                    <tr key={n.tlEmail}>
                      <td>{n.tlName}</td>
                      <td className="cx-num">
                        {n.onTime} of {n.due}
                      </td>
                      <td>
                        <Chip
                          status={
                            n.slaPct === null
                              ? 'neutral'
                              : n.slaPct >= t.targets.ctlSla
                                ? 'ok'
                                : 'bad'
                          }
                        >
                          {qaPct(n.slaPct)}
                        </Chip>
                      </td>
                      <td className="cx-num">{qaPct(n.donePct)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No CTLs due this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      {t.coverage ? (
        <details className="qa-more">
          <summary>Audit coverage, last 30 days</summary>
          <Coverage c={t.coverage} />
        </details>
      ) : null}
      {t.formRules.length ? (
        <details className="qa-more">
          <summary>What a critical fail does on each form</summary>
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Form</th>
                  <th scope="col">Scoring</th>
                  <th scope="col">Critical questions</th>
                  <th scope="col">A critical fail</th>
                </tr>
              </thead>
              <tbody>
                {t.formRules.map((n: any) => (
                  <tr key={n.formId}>
                    <td>
                      {n.title}
                      <span className="cx-faint qa-sub">{n.channel}</span>
                    </td>
                    <td>{n.scoring === 'deduction' ? 'Deduction' : 'Weighted'}</td>
                    <td className="cx-num">{n.critical}</td>
                    <td>
                      {n.critical === 0 ? (
                        '–'
                      ) : n.zeroes ? (
                        'Sets the audit to 0'
                      ) : (
                        <Chip status="warn">Deducts less than 100%</Chip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </>
  )
}

/* --- ea — the drill drawer ----------------------------------------------------- */
function Drill({
  scope: t,
  pick: n,
  open: a,
  close: s,
}: {
  scope: any
  pick: any
  open: (pick: any) => void
  close: () => void
}) {
  const { data: i, error: c, reload: l } = useSe(() =>
    P.analyticsAudits(
      t.grain,
      t.period,
      n.agent ?? '',
      n.question ?? '',
      t.basis
    )
  )
  const p = useRef<HTMLElement | null>(null)
  const m = [n.agentName, n.questionText ? `“${n.questionText.slice(0, 80)}”` : '']
    .filter(Boolean)
    .join(': ')

  return (
    <section className="cx-section qa-drill" aria-labelledby="qa-drill-h" ref={p as any}>
      <div className="cx-section__head">
        <h2 className="cx-section__title" id="qa-drill-h" tabIndex={-1}>
          {m}
        </h2>
        <span className="cx-section__hint">
          {t.label}. Every counted audit of the period, whatever its basis.
        </span>
        <Button variant="quiet" onClick={s}>
          Close
        </Button>
      </div>
      {c ? (
        <LoadError message={c} onRetry={l} />
      ) : i ? (
        <>
          {n.agent && !n.question && i.questions.length ? (
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Question failed</th>
                    <th scope="col">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {i.questions.map((r: any) => (
                    <tr key={r.key}>
                      <td>
                        <QaLinkBtn
                          label={r.text}
                          onClick={() =>
                            a({ ...n, question: r.key, questionText: r.text })
                          }
                        />
                        <span className="cx-faint qa-sub">{r.channel}</span>
                      </td>
                      <td className="cx-num">
                        {r.fails} of {r.asked}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {n.question && !n.agent && i.agents.length ? (
            <div className="cx-panel cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Agent who failed it</th>
                    <th scope="col">Fails</th>
                  </tr>
                </thead>
                <tbody>
                  {i.agents.map((r: any) => (
                    <tr key={r.email}>
                      <td>
                        <QaLinkBtn
                          label={r.name}
                          onClick={() =>
                            a({ ...n, agent: r.email, agentName: r.name })
                          }
                        />
                      </td>
                      <td className="cx-num">{r.fails}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="cx-panel cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Audit</th>
                  <th scope="col">Score</th>
                  <th scope="col">Failed</th>
                  <th scope="col">Auditor&apos;s note</th>
                </tr>
              </thead>
              <tbody>
                {i.audits.length ? (
                  i.audits.map((r: any) => (
                    <tr key={r.auditId}>
                      <td>
                        {r.ticketUrl ? (
                          <a
                            href={r.ticketUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            #{r.ticketId}
                          </a>
                        ) : (
                          <span className="qa-ref">{r.ticketId}</span>
                        )}
                        <span className="cx-faint qa-sub">
                          {r.date}, {r.agentName}, {r.channel},{' '}
                          {BASIS_L[r.basis].toLowerCase()}
                        </span>
                      </td>
                      <td>
                        <ScoreChip score={r.score} fatal={r.critical} />
                        {r.rescored ? (
                          <span className="cx-faint qa-sub">re-scored</span>
                        ) : null}
                      </td>
                      <td>
                        {r.failed.length
                          ? r.failed.map((u: any) => (
                              <span className="qa-sub" key={u.key}>
                                {u.text}
                                {u.reason
                                  ? ` (${REASON_L[u.reason] ?? u.reason})`
                                  : ''}
                              </span>
                            ))
                          : '–'}
                      </td>
                      <td className="qa-note">
                        {r.comment || '–'}
                        <span className="cx-faint qa-sub">{r.auditorName}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No audits match in this period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="cx-muted">Loading the audits…</p>
      )}
    </section>
  )
}

/* --- ta — the basis toggle ------------------------------------------------------ */
function BasisSeg({
  basis: t,
  onChange: n,
}: {
  basis: string
  onChange: (basis: string) => void
}) {
  return (
    <Seg
      name="qa-basis"
      value={t}
      onChange={n}
      options={[
        { value: 'interaction', label: 'By interaction date' },
        { value: 'audit', label: 'Audited in period' },
      ]}
      aria-label="Count audits by"
    />
  )
}

/* --- gl — the page -------------------------------------------------------------- */
export function QualityAnalyticsPage({ route }: { route: { title: string } }) {
  const [n, setScope] = useState({ grain: 'week', period: '', basis: 'interaction' })
  const { data: a, error: s, reload: i } = useSe(() =>
    P.analyticsPage(n.grain, n.period, n.basis)
  )
  const [c, l] = useState<any>(null)
  const [p, m] = useState(false)

  const r = (o: string, h: string, b = n.basis) => {
    setScope({ grain: o, period: h, basis: b })
    l(null)
    i()
  }
  const u = (o: any) => {
    l(o)
    requestAnimationFrame(() =>
      document.getElementById('qa-drill-h')?.focus()
    )
  }
  const d = a?.grain ?? n.grain

  return (
    <QaPage
      route={route}
      d={a}
      error={s}
      reload={i}
      sub="Scores use the random daily sample, each agent counted once; other bases are shown apart, and disputed audits return when decided."
    >
      {a ? (
        <>
          <div className="cx-filters">
            <Seg
              name="qa-grain"
              value={d}
              onChange={(o) => r(o, '')}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
              aria-label="Period length"
            />
            <Select
              className="qa-narrow"
              aria-label="Period"
              value={a.period}
              onChange={(o) => r(d, o.currentTarget.value)}
            >
              {a.periods.map((o: string) => (
                <option value={o} key={o}>
                  {qaPeriodLabel(a, o)}
                </option>
              ))}
            </Select>
            <BasisSeg
              basis={a.basis ?? 'interaction'}
              onChange={(o) => r(d, a.period, o)}
            />
            <Button
              variant="quiet"
              aria-expanded={p}
              onClick={() => m(!p)}
            >
              How scores work
            </Button>
            <a className="cx-btn cx-btn--quiet" href="#/quality-scores">
              Team scores for any dates
            </a>
          </div>
          <p className="cx-faint qa-basisnote">
            {qaBasisNote(a.basis ?? 'interaction', a.fallbackDates ?? 0)}
            {a.grain === 'week'
              ? ` Weeks run ${a.weekStartsOn === 1 ? 'Monday to Sunday' : 'Sunday to Saturday'}, like the audit quota.`
              : ''}
          </p>
          {p ? (
            <p className="cx-muted">
              Each score has a 95% range from its audits. Low confidence (under
              10 audits, or wider than ±5) is greyed; a score is coloured from
              16 audits; an arrow only when the change beats both ranges. A run
              of identical scores gets a cautious range, not ±0.
            </p>
          ) : null}
          {c ? (
            <Drill
              key={`${c.agent ?? ''}|${c.question ?? ''}`}
              scope={{
                grain: a.grain,
                period: a.period,
                basis: a.basis,
                label: qaPeriodLabel(a),
              }}
              pick={c}
              open={u}
              close={() => l(null)}
            />
          ) : null}
          <div className={p ? undefined : 'qa-hints-off'}>
            <HealthHead d={a} />
            <Attention d={a} open={u} />
            <Agents d={a} open={u} />
            <Columns d={a} />
            <Questions d={a} open={u} />
            <ByChannel d={a} />
            <NonTicket d={a} />
            <details className="qa-more">
              <summary>
                Coaching loop, team leads, agent spread and questions failed
                for outside reasons
              </summary>
              <Coaching d={a} open={u} />
              <TeamLeads d={a} />
              <Spread d={a} />
              <Outside d={a} />
            </details>
          </div>
          <Extras d={a} />
        </>
      ) : null}
    </QaPage>
  )
}
