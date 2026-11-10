'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * cx-quality shared widgets — the module pieces the ten Quality closures
 * share (qa-shared2 merged in; the closures it served had the same symbols).
 * Legacy symbol names are kept in comments for traceability:
 *   P            — google.script.run seam  → qa() POST /api/qa/<fn> {args}
 *   se/dn        — data loader + named-thunk cache, qa() — useCallback
 *   de           — QaPage shell, D — QaSection (non-collapsible, aside slot)
 *   E            — Chip (shell/ui), _t — status text map, ae — StatusChip
 *   oe           — score band, Ie — ScoreChip, U — pct, Dt — AuditFails
 *   Mt/Ce        — ticket regex/label, ne — TicketRef, me — QaLink (button)
 *   It/os        — "why it failed" reasons + answer labels
 *   Te           — ListSelect (Ve/Ma/Zt/ft store, it in-flight, lt sentinel)
 *   Zn           — AuditForm (+ ds, hs, us, rs client-side scoring)
 *   M/_e/mn/pn/bs/ys — sortable table headers
 *   te           — Count: animated number (+ is, rn, on, cs, cn, ls)
 *   Ke/xt/ye/Me/Ge/Et/Pe/bn/Ks/Ot/yn/vn/kl/tl/nl/al — score table vocabulary
 *   ia/vl/_l/He/rt/ot/xl/pe/dt/ca — date + preset helpers
 *   dl/he/ul/Rt  — week-coverage helpers, ta — basis seg, ea — DrillSection
 *   na           — the count-basis hint, Q — toast
 */
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Chip,
  LinesSkeleton,
  LoadError,
  PageHead,
} from '@/features/shared/components/shell/ui'
import { toast } from '@/features/shared/components/shell/Toasts'
import {
  Button,
  ConfirmInline,
  Input,
  Seg,
  Select,
  TableScroll,
  Textarea,
} from '@/features/shared/components/ui'
import type { ChipStatus } from '@/features/shared/components/ui/Chip'
import { FetchError, fetchJson, postJson } from '@/features/shared/lib/fetch-json'
import { usePageData } from '@/features/shared/lib/use-page-data'
import { loadOptions } from '@/features/shared/lib/use-options'

/* Re-exports so the pages draw from one file (merged from qa-shared2). */
export { Chip, LinesSkeleton, LoadError, toast }
export { FetchError, fetchJson, postJson }

/* --- api seam -----------------------------------------------------------
 * L(fn, ...args) — legacy called google.script.run[fn](...args). The
 * dispatcher lives at POST /api/qa/<fn> with {args: [...]}.
 */
/** qa(fn, ...args) — the dispatcher (exported; internal alias L). */
export const qa = (fn: string, ...args: any[]): Promise<any> =>
  postJson(`/api/qa/${fn}`, { args })

const L = qa

/** P — verbatim call surface (all ten Quality pages). */
export const P = {
  queuePage: (t = '') => L('getQaQueuePage', t),
  startAudit: (t: string) => L('startQaAudit', t),
  submitAudit: (t: Record<string, unknown>) => L('submitQaAudit', t),
  importNow: () => L('importQaQueueNow'),
  passItem: (t: string, n: string) => L('passQaQueueItem', t, n),
  requestAudit: (t: Record<string, unknown>) => L('requestQaAudit', t),
  waiveRequest: (t: string, n: string) => L('waiveQaAuditRequest', t, n),
  createNonTicket: (t: Record<string, unknown>) => L('createQaNonTicketAudit', t),
  createOffQueue: (t: Record<string, unknown>) => L('createQaOffQueueAudit', t),
  samplingPage: () => L('getQaSamplingPage'),
  access: () => L('getQaAccess'),
  setAuditorGrant: (t: string, n: unknown) => L('setQaAuditorGrant', t, n),
  saveSampling: (t: Record<string, unknown>) => L('saveQaSampling', t),
  myAuditsPage: () => L('getQaMyAuditsPage'),
  confirmCtl: (t: string, n: unknown, a: string) => L('confirmQaCtl', t, n, a),
  ctlPage: () => L('getQaCtlPage'),
  submitCtl: (t: Record<string, unknown>) => L('submitQaCtl', t),
  resendAuditMail: (t: string, n: unknown) => L('resendQaAuditEmail', t, n),
  disputesPage: () => L('getQaDisputesPage'),
  decideDispute: (t: Record<string, unknown>) => L('decideQaDispute', t),
  calibrationPage: () => L('getQaCalibrationPage'),
  createCalibration: (t: Record<string, unknown>) => L('createQaCalibration', t),
  submitCalibration: (t: Record<string, unknown>) => L('submitQaCalibrationAudit', t),
  kbGapsPage: () => L('getQaKbGapsPage'),
  myAuditorKpis: (t?: string) => L('getQaMyAuditorKpis', t ?? ''),
  addKbGap: (t: Record<string, unknown>) => L('addQaKbGap', t),
  markKbGapAdded: (t: string) => L('markQaKbGapAdded', t),
  scoresPage: (t: string, n: string, a = 'interaction') =>
    L('getQaScoresPage', t, n, a),
  analyticsPage: (t: string, n?: string, a = 'interaction') =>
    L('getQaAnalyticsPage', t, n ?? '', a),
  analyticsAudits: (t: string, n: string, a: string, s: string, i = 'interaction') =>
    L('getQaAnalyticsAudits', t, n, a, s, i),
  formsPage: () => L('getQaFormsPage'),
  saveForm: (t: any) => L('saveQaForm', t),
}

/** Q(t, tone) — the toast emitter. */
export const Q = toast

/* --- se/dn — the loader hook -------------------------------------------
 * Named thunks keep their cross-remount cache via usePageData's
 * function-identity cacheKey; anonymous loaders stay uncached, exactly
 * like the legacy dn Map keyed on load.name.
 */
export const useSe = (load: () => Promise<any>) =>
  usePageData(load.name || null, load, {
    cacheKey: load.name ? load : null,
  })

/* --- de / D — page shell + section ------------------------------------- */
/** de — the routed page shell. */
export function QaPage({
  route,
  sub,
  d,
  error,
  reload,
  aside,
  children,
}: {
  route: { title: ReactNode }
  sub?: ReactNode
  d: any
  error?: string
  reload?: () => void
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <section
      className="cxp page"
      aria-labelledby="page-title"
      aria-busy={!d && !error}
    >
      <PageHead title={route.title} sub={sub} aside={aside} />
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!d && !error ? <LinesSkeleton lines={6} /> : d ? children : null}
    </section>
  )
}

/** D — non-collapsible section with the aside slot (verbatim). */
export function QaSection({
  id,
  title,
  hint,
  aside,
  children,
}: {
  id: string
  title: ReactNode
  hint?: ReactNode
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="cx-section" aria-labelledby={id}>
      <div className="cx-section__head">
        <h2 className="cx-section__title" id={id} tabIndex={-1}>
          {title}
        </h2>
        {hint ? <span className="cx-section__hint">{hint}</span> : null}
        {aside}
      </div>
      {children}
    </section>
  )
}

/* --- _t / ae / oe / Ie / U — chips ------------------------------------- */
/** oe(t, n) — score band: null → neutral, fatal || <80 bad, <90 warn, else ok. */
export const qaBand = (t: number | null, n?: boolean): ChipStatus =>
  t === null ? 'neutral' : n || t < 80 ? 'bad' : t < 90 ? 'warn' : 'ok'

/** _t — status → [label, tone] (identical across the Quality closures). */
export const QA_STATUS: Record<string, [string, ChipStatus]> = {
  submitted: ['Waiting for the CTL', 'neutral'],
  acknowledged: ['Acknowledged', 'ok'],
  disputed: ['Disputed: left out of scores', 'warn'],
  dispute_rejected: ['Dispute rejected', 'ok'],
  rescored: ['Re-scored after dispute', 'ok'],
  voided: ['Void after dispute', 'neutral'],
  historical: ['History (old QA form)', 'neutral'],
  expired: ['No longer in the queue', 'neutral'],
  passed: ['Passed on', 'neutral'],
  waived: ['Waived', 'neutral'],
  open: ['Open', 'neutral'],
  in_progress: ['In progress', 'warn'],
  done: ['Audited', 'ok'],
  on_hold: ['On hold: audit disputed', 'warn'],
  confirmed: ['Confirmed by the agent', 'ok'],
  not_confirmed: ['Agent says it did not happen', 'bad'],
  cancelled: ['Cancelled', 'neutral'],
  upheld: ['Upheld', 'ok'],
  rejected: ['Rejected', 'neutral'],
  escalated: ['Escalated to the owner', 'warn'],
  added: ['Added to KB', 'ok'],
}

/** ae({s}) — status chip. */
export function StatusChip({ s }: { s: string }) {
  return (
    <Chip status={QA_STATUS[s]?.[1] ?? 'neutral'}>
      {QA_STATUS[s]?.[0] ?? s.replace(/_/g, ' ')}
    </Chip>
  )
}

/** Ie({score, fatal}) — score chip. */
export function ScoreChip({
  score,
  fatal,
}: {
  score: number | null
  fatal?: boolean | null
}) {
  return (
    <Chip status={qaBand(score, !!fatal)}>
      {score === null ? '–' : `${score}%${fatal ? ', critical' : ''}`}
    </Chip>
  )
}

/** U — plain pct or dash. */
export const qaPct = (t: number | null | undefined): string =>
  t == null ? '–' : `${t}%`

/* --- Mt / Ce / ne / me — tickets + the qa-link button ------------------- */
/** Mt — digits-only ticket id; Ce — "#n" for ids, plain text otherwise. */
export const qaIsNum = (t: string): boolean => /^\d+$/.test(t)
export const qaTicketLabel = (t: string): string => (qaIsNum(t) ? `#${t}` : t)

/** ne — ticket ref: linked when the id is numeric, plain span otherwise. */
export function TicketRef({ url, id }: { url: string; id: string }) {
  return qaIsNum(id) ? (
    <a href={url + id} target="_blank" rel="noopener noreferrer">
      #{id}
    </a>
  ) : (
    <span className="qa-ref">{id || '–'}</span>
  )
}

/** me — the qa-link *button* (the scores closures use it as an action, not a link). */
export function QaLink({
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

/* --- Dt — the failed-question list + auditor note ----------------------- */
export function AuditFails({ a }: { a: any }) {
  return (
    <div className="qa-fails">
      {a.failed.length ? (
        <ul>
          {a.failed.map((n: any) => (
            <li data-fatal={n.fatal ? 'true' : undefined} key={n.id ?? n.key}>
              {n.text}
              {n.fatal ? (
                <strong> (critical)</strong>
              ) : a.scoring === 'deduction' && n.weight ? (
                <span className="cx-faint"> (−{n.weight}%)</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="cx-muted">Full marks: nothing lost.</p>
      )}
      {a.comment ? <p className="qa-note">“{a.comment}”</p> : null}
    </div>
  )
}

/* --- na — the count-basis hint ------------------------------------------ */
/** na(t, n) — verbatim basis-copy line. */
export const qaBasisNote = (t: string, n: number): string =>
  t === 'audit'
    ? 'Counted by the day each audit was done.'
    : `Counted by the date of the interaction${n ? `; ${n} ${n === 1 ? 'audit has' : 'audits have'} no interaction date and count by audit date` : ''}.`

/* --- Te — ListSelect: dropdown with an "Other…" free-text option ---------
 * Store: Ve holds options per listKey; Zt writes + notifies every mounted
 * select via the ft subscriber set (verbatim store semantics).
 */
const Ve: Record<string, string[]> = {}
const ft = new Set<() => void>()
const LT = '__other__' // lt

const Ma = (key: string): string[] | undefined => Ve[key]

function Zt(key: string, value: string[]) {
  Object.assign(Ve, { [key]: value })
  ft.forEach((t) => t())
}

/** Wn(read, deps) — the signal hook: subscribes to Zt writes. */
function useStoreSignal<T>(read: () => T, deps: any[] = []): T {
  const [a, s] = useState(read)
  useEffect(() => {
    const i = () => s(() => read())
    ft.add(i)
    i()
    return () => {
      ft.delete(i)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps -- verbatim Wn
  return a
}

/** be — the shared-app options endpoints (loads dedupe via loadOptions). */
const be = {
  addDropdownOption: (listKey: string, value: string): Promise<any> =>
    postJson(`/api/options/${encodeURIComponent(listKey)}`, { value }),
}

/** Te — verbatim ListSelect. */
export function ListSelect({
  listKey,
  label,
  value,
  onChange,
  placeholder = 'Choose…',
  required,
  disabled,
  hint,
}: {
  listKey: string
  label: ReactNode
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: ReactNode
}) {
  const m = useId() // ka
  const r = useStoreSignal(() => Ma(listKey), [listKey])
  const [u, d] = useState(false)
  const [o, h] = useState('')
  const [b, x] = useState(false)
  const [f, g] = useState('')
  const [y, _] = useState('')
  const T = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (r !== undefined) return
    loadOptions(listKey).then(
      (Z) => Zt(listKey, Z),
      (Z) => _(Z instanceof Error ? Z.message : String(Z))
    )
  }, [listKey, r])

  useEffect(() => {
    if (u) T.current?.focus()
  }, [u])

  const k = r ?? []
  const C = value && !k.includes(value) ? [value, ...k] : k

  function O(R: React.ChangeEvent<HTMLSelectElement>) {
    const Z = R.currentTarget.value
    if (Z === LT) {
      d(true)
      g('')
      return
    }
    d(false)
    onChange(Z)
  }

  async function v() {
    if (!b) {
      x(true)
      g('')
      try {
        const R = await be.addDropdownOption(listKey, o)
        Zt(listKey, R.options)
        onChange(R.value)
        d(false)
        h('')
      } catch (R: any) {
        g(R.message)
      } finally {
        x(false)
      }
    }
  }

  function w() {
    d(false)
    h('')
    g('')
  }

  const A = hint ? `${m}-hint` : undefined
  const S = f || y ? `${m}-err` : undefined

  return (
    <div className="cx-field">
      <label htmlFor={m} className="cx-label">
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <Select
        id={m}
        value={u ? LT : value}
        onChange={O}
        disabled={disabled || r === undefined}
        required={required}
        aria-describedby={[A, S].filter(Boolean).join(' ') || undefined}
      >
        <option value="" disabled={required}>
          {r === undefined ? 'Loading choices…' : placeholder}
        </option>
        {C.map((R) => (
          <option value={R} key={R}>
            {R}
          </option>
        ))}
        <option value={LT}>Other…</option>
      </Select>
      {hint ? (
        <p id={A} className="cx-hint">
          {hint}
        </p>
      ) : null}
      {u ? (
        <div className="other-row">
          <Input
            ref={T}
            type="text"
            maxLength={120}
            value={o}
            aria-label={`New choice for ${label}`}
            placeholder="Type the new choice"
            onInput={(R) => h(R.currentTarget.value)}
            onKeyDown={(R) => {
              R.key === 'Enter' ? (R.preventDefault(), v()) : R.key === 'Escape' && w()
            }}
          />
          <Button
            variant="primary"
            onClick={v}
            disabled={b || !o.trim()}
          >
            {b ? 'Adding…' : 'Add choice'}
          </Button>
          <Button variant="quiet" onClick={w} disabled={b}>
            Cancel
          </Button>
        </div>
      ) : null}
      {f || y ? (
        <p id={S} className="cx-error" role="alert">
          {f || `Choices did not load: ${y}`}
        </p>
      ) : null}
    </div>
  )
}

/* --- M / _e / mn / pn / bs / ys — sortable table headers ----------------- */
export type QaSortCol = { get: (r: any) => any; type: 'num' | 'date' | 'text' }
export type QaSortCols = Record<string, QaSortCol>
export interface QaSort {
  s: { col: string; dir: 'asc' | 'desc' } | null
  toggle: (col: string) => void
  apply: (rows: any[]) => any[]
}

/** M — sortable <th> with the qa-sort button and arrow. */
export function SortTh({
  col,
  sort,
  children,
}: {
  col: string
  sort: QaSort
  children?: ReactNode
}) {
  const s = sort.s && sort.s.col === col ? sort.s.dir : null
  return (
    <th
      scope="col"
      aria-sort={s === 'asc' ? 'ascending' : s === 'desc' ? 'descending' : 'none'}
    >
      <Button type="button" className="qa-sort" onClick={() => sort.toggle(col)}>
        {children}
        <span className="qa-sort__arrow" aria-hidden="true">
          {s === 'asc' ? '▲' : s === 'desc' ? '▼' : ''}
        </span>
      </Button>
    </th>
  )
}

/** mn — coerce a cell value for comparison by column type. */
function mn(t: any, n: string) {
  const a = String(t).trim()
  if (n === 'num') {
    const s = Number(a.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(s) ? s : a.toLowerCase()
  }
  if (n === 'date') {
    const s = Date.parse(a.replace(' ', 'T'))
    return Number.isFinite(s) ? s : a
  }
  return a.toLowerCase()
}

/** pn — "blank" cells always sort last, whatever the direction. */
const pn = (t: any): boolean =>
  t == null || String(t).trim() === '' || String(t).trim() === '–'

/** bs — compare two raw cell values. */
function bs(t: any, n: any, a: string, s: 'asc' | 'desc'): number {
  const i = pn(t),
    c = pn(n)
  if (i || c) return i === c ? 0 : i ? 1 : -1
  const l = mn(t, a),
    p = mn(n, a),
    m =
      typeof l === 'number' && typeof p === 'number'
        ? l - p
        : String(l).localeCompare(String(p), undefined, {
            numeric: a !== 'text',
            sensitivity: 'base',
          })
  return s === 'desc' ? -m : m
}

/** ys — stable sort by extracted value. */
function ys(t: any[], n: ((r: any) => any) | undefined, a: string, s: 'asc' | 'desc') {
  return n
    ? t
        .map((i, c) => [i, c] as [any, number])
        .sort((i, c) => bs(n(i[0]), n(c[0]), a, s) || i[1] - c[1])
        .map((i) => i[0])
    : t
}

/** _e(t) — column sort state + apply(). */
export function useQaSort(t: QaSortCols): QaSort {
  const [n, a] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null)
  return {
    s: n,
    toggle: (s) =>
      a((i) =>
        i && i.col === s
          ? { col: s, dir: i.dir === 'asc' ? 'desc' : 'asc' }
          : { col: s, dir: 'asc' }
      ),
    apply: (s) =>
      n && t[n.col] ? ys(s, t[n.col].get, t[n.col].type, n.dir) : s,
  }
}

/* --- It / os — audit-form vocabulary ------------------------------------ */
/** It — "why it failed" reasons. */
export const QA_WHY = [
  { v: 'agent', label: 'Agent' },
  { v: 'process', label: 'Process' },
  { v: 'product', label: 'Product' },
  { v: 'kb', label: 'KB' },
]

/** os — answer labels. */
export const QA_ANSWER: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  na: 'N/A',
}

/** ds(t) — optional-section default answers (every question → "na"). */
const ds = (t: any) =>
  Object.fromEntries(
    t.sections
      .filter((n: any) => n.optional)
      .flatMap((n: any) => n.questions.map((a: any) => [a.id, 'na']))
  )

/** hs() — datetime-local "now" ceiling in Riyadh (verbatim). */
const hs = (): string =>
  new Date()
    .toLocaleString('sv-SE', { timeZone: 'Asia/Riyadh' })
    .slice(0, 16)
    .replace(' ', 'T')

/** rs(t, n) — client-side scoring (verbatim math). */
export function qaScoreAnswers(t: any, n: any) {
  let a = 0,
    s = 0,
    i = false
  const c: string[] = []
  let l = 0
  if (t.scoring === 'deduction') {
    let m = 0
    for (const u of t.sections || [])
      for (const d of u.questions || []) {
        l++
        const o = (n || {})[d.id]
        if (o !== 'pass' && o !== 'fail' && o !== 'na') {
          c.push(d.id)
          continue
        }
        if (o !== 'fail') continue
        const h = Number(d.weight) || 0
        m += h
        if (d.fatal || h >= 100) i = true
      }
    const r = Math.round(Math.max(0, 100 - m) * 10) / 10
    return {
      score: r as number | null,
      fatal: i,
      earned: r,
      possible: 100,
      missing: c,
      answered: l - c.length,
      total: l,
    }
  }
  for (const m of t.sections || [])
    for (const r of m.questions || []) {
      l++
      const u = (n || {})[r.id]
      if (u !== 'pass' && u !== 'fail' && u !== 'na') {
        c.push(r.id)
        continue
      }
      if (r.fatal) {
        if (u === 'fail') i = true
        continue
      }
      if (u === 'na') continue
      const d = Number(r.weight) || 0
      s += d
      if (u === 'pass') a += d
    }
  return {
    score: i ? 0 : s > 0 ? Math.round((a / s) * 1e3) / 10 : null,
    fatal: i,
    earned: a,
    possible: s,
    missing: c,
    answered: l - c.length,
    total: l,
  }
}

/** us(t) — the memory memo line for repeat fails. */
function us(t: any): string {
  const n = t.fails
      ? `Failed ${t.fails === 1 ? 'once' : `${t.fails} times`} in the last 30 days`
      : '',
    a = t.afterCtl
      ? `failed again after the CTL of ${t.afterCtl}`
      : t.coachedOn
        ? `coached in a CTL on ${t.coachedOn}`
        : '',
    s = [n, a].filter(Boolean).join(', ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* --- Zn — the audit form (verbatim port) -------------------------------- */
export function AuditForm({
  form: t,
  facts: n,
  submitLabel: a,
  onSubmit: s,
  onCancel: i,
  backLabel: c = 'Back to the queue',
  askReasons: l = false,
  memory: p,
  interactionAt: m = '',
}: {
  form: any
  facts: ReactNode
  submitLabel: string
  onSubmit: (
    answers: any,
    comment: string,
    reasons: any,
    interactionAt: string
  ) => Promise<any>
  onCancel: () => void
  backLabel?: string
  askReasons?: boolean
  memory?: any
  interactionAt?: string
}) {
  const r = useMemo(() => ds(t), [t])
  const [u, d] = useState<any>(r)
  const [o, h] = useState('')
  const [b, x] = useState(m.replace(' ', 'T'))
  const [f, g] = useState<any>({})
  const [y, _] = useState(false)
  const [T, k] = useState('')
  const [M, C2] = useState(false)

  const C = useMemo(() => qaScoreAnswers(t, u), [t, u])
  const O = (N: string, z: string) => d((X: any) => ({ ...X, [N]: z }))
  const v = (N: string[], z: boolean) =>
    d((X: any) => {
      const F = { ...X }
      for (const Xe of N) z ? (F[Xe] = 'na') : delete F[Xe]
      return F
    })
  const w = Object.keys(u).filter((N) => u[N] === 'fail')
  const A = l ? w.filter((N) => !f[N]).length : 0
  const S = (N: string) => p?.[`${t.formId}|${N}`]
  const R = t.sections.reduce(
    (N: number, z: any) =>
      N + z.questions.filter((X: any) => S(X.id)?.repeat).length,
    0
  )

  const Z = (N: React.FormEvent) => {
    N.preventDefault()
    _(true)
    k('')
    s(
      u,
      o,
      l ? Object.fromEntries(w.map((z) => [z, f[z]])) : {},
      b.replace('T', ' ')
    ).then(
      () => _(false),
      (z) => {
        _(false)
        k(z.message)
      }
    )
  }

  const I = () => {
    const dirty =
      [...new Set([...Object.keys(u), ...Object.keys(r)])].some(
        (X) => u[X] !== r[X]
      ) || o.trim() !== ''
    if (dirty) {
      C2(true)
      return
    }
    i()
  }

  const J = qaBand(C.score, C.fatal)
  const B = t.scoring === 'deduction'

  return (
    <form
      className="cx-panel qa-form"
      onSubmit={Z}
      aria-label={`Audit: ${t.title}`}
      tabIndex={-1}
    >
      <div className="cx-section__head">
        <div>
          <div className="cx-section__title">{t.title}</div>
          <div className="cx-section__hint">
            Under 100% opens a CTL for the team lead.
          </div>
        </div>
        <div className="flex">
          <Button
            variant="quiet"
            onClick={I}
            disabled={y}
          >
            <span aria-hidden="true">← </span>
            {c}
          </Button>
          <Chip status="warn">In progress</Chip>
        </div>
      </div>
      <div className="cx-panel--pad">
        <div>{n}</div>
        <div className="cx-field">
          <label className="cx-label" htmlFor="qa-when">
            Interaction date and time (Riyadh)
          </label>
          <Input
            type="datetime-local"
            id="qa-when"
            required
            max={hs()}
            value={b}
            onInput={(N) => x(N.currentTarget.value)}
          />
        </div>
        {t.placeholder ? (
          <p className="cx-note" data-status="warn">
            <span>
              This is the placeholder form. Its questions stand in until the real
              criteria are added in Audit forms.
            </span>
          </p>
        ) : null}
        {R ? (
          <p className="cx-note" data-status="warn">
            <span>
              {`This agent has failed ${R === 1 ? 'one question' : `${R} questions`} more than once lately, or again after coaching. They are marked below.`}
            </span>
          </p>
        ) : null}
        {t.sections.map((N: any) => {
          const z = N.questions.map((F: any) => F.id)
          const X = !!N.optional && z.every((F: string) => u[F] === 'na')
          return (
            <fieldset className="qa-sec" key={N.id}>
              <legend className="qa-sec__title">{N.title}</legend>
              {N.optional ? (
                <div className="qa-sec__opt">
                  <span className="cx-muted">
                    {X
                      ? 'Optional. Skipped: every question is N/A, so the score is not affected.'
                      : 'Optional. Answered questions count; N/A ones do not.'}
                  </span>
                  <Button
                    variant="quiet"
                    onClick={() => v(z, !X)}
                    aria-pressed={!X}
                  >
                    {X ? 'Answer this section' : 'Skip section (N/A)'}
                  </Button>
                </div>
              ) : null}
              <TableScroll label={`${N.title} questions`}>
                <table className="cx-table">
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th className="num" scope="col">
                        Weight
                      </th>
                      <th className="num" scope="col">
                        Answer
                      </th>
                    </tr>
                  </thead>
                <tbody>
                  {N.questions.map((F: any) => {
                    const da =
                      (F.fatal || (B && F.weight >= 100)) &&
                      !N.optional &&
                      N.title !== 'Call Control'
                        ? ['pass', 'fail']
                        : ['pass', 'fail', 'na']
                    const ua = B
                      ? F.fatal
                        ? 'Critical: −100%'
                        : `−${F.weight}% if failed`
                      : F.fatal
                        ? 'Critical'
                        : `${F.weight} pts`
                    const Je = u[F.id]
                    const et = S(F.id)
                    return (
                      <tr
                        className="qa-q"
                        data-answer={Je ?? ''}
                        data-fatal={F.fatal ? 'true' : undefined}
                        key={F.id}
                      >
                        <td>
                          <div className="qa-q__text">
                            <span className="lead">{F.text}</span>
                            {F.hint ? (
                              <span className="cx-muted qa-q__hint">{F.hint}</span>
                            ) : null}
                            {et ? (
                              <span
                                className="qa-q__memo"
                                data-repeat={et.repeat ? 'true' : undefined}
                              >
                                {us(et)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="num">{ua}</td>
                        <td className="num">
                          <Seg
                            name={`qa-${F.id}`}
                            value={Je ?? ''}
                            onChange={(v) => O(F.id, v)}
                            options={da.map((le) => ({
                              value: le,
                              label: QA_ANSWER[le],
                            }))}
                            aria-label={F.text}
                          />
                          {l && Je === 'fail' ? (
                            <div className="qa-q__why">
                              <span className="cx-faint" id={`qa-why-${F.id}`}>
                                Why it failed
                              </span>
                              <Seg
                                name={`qa-why-${F.id}`}
                                value={f[F.id] ?? ''}
                                onChange={(v) =>
                                  g((ha: any) => ({ ...ha, [F.id]: v }))
                                }
                                options={QA_WHY.map((le) => ({
                                  value: le.v,
                                  label: le.label,
                                }))}
                                aria-labelledby={`qa-why-${F.id}`}
                                {...{ 'aria-required': 'true' }}
                              />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </TableScroll>
            </fieldset>
          )
        })}
        <div className="cx-field">
          <label className="cx-label" htmlFor="qa-comment">
            Note for the agent and team lead
          </label>
          <Textarea
            id="qa-comment"
            value={o}
            onInput={(N) => h(N.currentTarget.value)}
            placeholder="What to keep doing, and what to change, with the moment in the ticket."
          />
        </div>
        {T ? (
          <p className="cx-error" role="alert">
            {T}
          </p>
        ) : null}
        {M ? (
          <ConfirmInline
            label="Leave this audit? Your answers are not saved and will be lost."
            confirmLabel="Leave without saving"
            onConfirm={() => {
              C2(false)
              i()
            }}
            onCancel={() => C2(false)}
          />
        ) : null}
        <div className="between">
          <div className="flex">
            <div className="qa-score" data-status={J} aria-live="polite">
              <span className="qa-score__num cx-num">
                {C.score === null ? '–' : `${C.score}%`}
              </span>
              <span className="qa-score__sub">
                {C.fatal
                  ? 'Critical fail: the audit scores 0'
                  : `${C.answered} of ${C.total} answered`}
              </span>
            </div>
            {C.score !== null && C.score < 100 ? (
              <Chip status="bad">opens CTL</Chip>
            ) : null}
          </div>
          <div className="qa-form__foot">
            <Button
              type="submit"
              variant="primary"
              disabled={
                y || C.missing.length > 0 || C.score === null || A > 0 || !b
              }
            >
              {y
                ? 'Saving…'
                : b
                  ? C.missing.length
                    ? `${a} (${C.missing.length} left)`
                    : A
                      ? `${a} (${A} ${A === 1 ? 'reason' : 'reasons'} left)`
                      : a
                  : `${a} (interaction time needed)`}
            </Button>
            <Button
              variant="quiet"
              onClick={I}
              disabled={y}
            >
              Cancel
            </Button>
          </div>
        </div>
        <div className="cx-note">
          <svg
            className="cx-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>
            Submitting emails the result to the agent. Under 100% opens a CTL
            for the team lead.
          </span>
        </div>
      </div>
    </form>
  )
}

/* --- te — Count: the count-up number (+ cs, cn, ls, is, rn, on, Nt) ----- */
const CS_NUM = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/ // cs
const COUNT_MS = 900 // cn
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩' // ls

/** Nt() — reduced motion check. */
export const reduceMotion = () =>
  (typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches) ||
  document.documentElement.hasAttribute('data-reduce-motion')

/** is(t) — on first view (or when t changes), k eases 0→1 over 900ms. */
function useCountIn(t: number | null) {
  const n = useRef<HTMLElement | null>(null)
  const a = useRef(false)
  const [s, i] = useState(1)
  useLayoutEffect(() => {
    if (a.current || t === null || t === 0 || reduceMotion() || document.hidden)
      return
    a.current = true
    i(0)
    let c = 0,
      l = 0
    const p = () => {
      const u = performance.now()
      const d = (o: number) => {
        const h = Math.min(1, (o - u) / COUNT_MS)
        i(h)
        if (h < 1) c = requestAnimationFrame(d)
      }
      c = requestAnimationFrame(d)
      l = window.setTimeout(() => {
        cancelAnimationFrame(c)
        i(1)
      }, COUNT_MS + 100)
    }
    const m = n.current
    const obs: IntersectionObserver | null =
      m && typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((u) => {
            if (u.some((d) => d.isIntersecting)) {
              obs?.disconnect()
              p()
            }
          })
        : null
    if (obs && m) obs.observe(m)
    else p()
    return () => {
      obs?.disconnect()
      cancelAnimationFrame(c)
      clearTimeout(l)
      i(1)
    }
  }, [t])
  return { ref: n as RefObject<HTMLElement | null>, k: s, ease: 1 - (1 - s) ** 3 }
}

/** rn(t) — swap digits for Arabic-Indic when the page is in ar. */
function rn(t: string): string {
  return document.documentElement.lang !== 'ar'
    ? t
    : t
        .replace(/(\d)([.,])(?=\d)/g, (n, a, s) => a + (s === '.' ? '٫' : '٬'))
        .replace(/\d/g, (n) => AR_DIGITS[+n])
}

/** on — live value for sighted users, final for screen readers. */
function CountSpans({
  live,
  final,
  spanRef,
}: {
  live: string
  final: string
  spanRef: RefObject<HTMLElement | null>
}) {
  return (
    <>
      <span ref={spanRef} aria-hidden="true">
        {rn(live)}
      </span>
      <span className="sr-only">{rn(final)}</span>
    </>
  )
}

/** te({v}) — counts up to the value the first time it is shown. */
export function Count({ v }: { v: string | null }) {
  const n = v == null ? '' : String(v)
  const a = CS_NUM.exec(n)
  const s = a ? Number(a[2] + a[3].replace(/,/g, '') + (a[4] ?? '')) : null
  const { ref: i, k: c, ease: l } = useCountIn(s)
  if (!a || s === null || c >= 1)
    return <CountSpans live={n} final={n} spanRef={i} />
  const p = a[4] ? a[4].length - 1 : 0
  const m = (s * l).toLocaleString('en-US', {
    minimumFractionDigits: p,
    maximumFractionDigits: p,
    useGrouping: a[3].includes(','),
  })
  return <CountSpans live={a[1] + m + a[5]} final={n} spanRef={i} />
}

/* --- score-table vocabulary (Ke/xt/ye/Me/Ge/Et/Pe/bn/Ks/Ot/yn/vn/kl/tl/nl/al) */
/** Ke — confidence labels. */
export const QA_CONF: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}
/** xt — confidence tones. */
export const QA_CONF_TONE: Record<string, ChipStatus> = {
  high: 'ok',
  medium: 'warn',
  low: 'neutral',
}
/** ye — "±m" margin text. */
export const qaMargin = (t: number | null): string =>
  t === null ? 'range unknown' : `±${t}`
/** Me — trend arrows. */
export const QA_TREND_ARROW: Record<string, string> = {
  up: '↑',
  down: '↓',
  '': '',
}
/** Ge — "pct% (lo–hi)" interval text. */
export const qaCi = (t: any): string =>
  t ? `${t.pct}% (${t.lo}–${t.hi})` : '–'
/** Et — verdict-aware row tone. */
export const qaVerdictTone = (t: any): ChipStatus =>
  t.verdict ? qaBand(t.avg, false) : 'neutral'
/** Pe — fail-reason labels + Untagged. */
export const QA_REASON_LABELS: Record<string, string> = {
  ...Object.fromEntries(QA_WHY.map((t) => [t.v, t.label])),
  untagged: 'Untagged',
}
/** bn — the fail-reason keys. */
export const QA_REASON_KEYS = QA_WHY.map((t) => t.v)
/** Ks — "Agent 40%, Process 30% (2 untagged)" mix text. */
export const qaReasonMix = (t: any): string => {
  const n = QA_REASON_KEYS.reduce((s, i) => s + t[i], 0)
  return (
    (QA_REASON_KEYS.filter((s) => t[s])
      .map((s) => `${QA_REASON_LABELS[s]} ${Math.round((t[s] / n) * 100)}%`)
      .join(', ') || '–') +
    (t.untagged ? ` (${t.untagged} untagged)` : '')
  )
}
/** Ot — sample-basis labels. */
export const QA_BASIS_LABELS: Record<string, string> = {
  random: 'Random',
  targeted: 'Targeted',
  request: 'Requested',
  'off-queue': 'Off-queue',
  'non-ticket': 'Non-ticket',
  historical: 'History',
  unknown: 'Unknown basis',
}
/** yn — the analytics flag chips. */
export const QA_FLAG_LABELS: Record<string, [string, ChipStatus]> = {
  critical: ['Critical fail', 'bad'],
  repeat: ['Repeat after CTL', 'bad'],
  below: ['Below the team', 'warn'],
  falling: ['Falling', 'warn'],
  under: ['Under-audited', 'neutral'],
}
/** vn — "Week of X" / raw period label. */
export const qaPeriodLabel = (t: any, n = t.period): string =>
  t.grain === 'week' ? `Week of ${n}` : n
/** kl — "+1.2 ↑" delta label. */
export const qaDeltaLabel = (t: number | null, n?: string): string =>
  t == null ? '–' : `${t > 0 ? '+' : ''}${t}${n ? ` ${QA_TREND_ARROW[n]}` : ''}`
/** tl — week period → "MM-DD", else the period. */
export const qaWeekKeyLabel = (t: any, n: string): string =>
  t.grain === 'week' ? n.slice(5) : n
/** nl — "same as / +N points on the period before". */
export const qaDeltaSentence = (t: number | null, n: number | null | undefined): string => {
  if (t === null || n == null) return ''
  const a = Math.round((t - n) * 10) / 10
  return a === 0
    ? 'same as the period before'
    : `${a > 0 ? '+' : ''}${a} points on the period before`
}
/** al — "Jan 26" short month label for a YYYY-MM period. */
export const qaMonthLabel = (t: string): string =>
  new Date(t + '-01T00:00:00Z').toLocaleString('en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })

/* --- dates + presets (ia/vl/_l/He/rt/ot/xl/pe/dt/ca, dl/he/ul/Rt) -------- */
/** ia — the period presets. */
export const QA_PRESETS: [string, string][] = [
  ['month', 'This month'],
  ['last-month', 'Last month'],
  ['week', 'This week'],
  ['30', 'Last 30 days'],
  ['quarter', 'This quarter'],
  ['custom', 'Custom'],
]
/** vl — the "Who is behind the score" levels. */
export const QA_LEVELS: [string, string][] = [
  ['tl', 'Team leads'],
  ['agent', 'Agents'],
  ['channel', 'Channels'],
]
const qaDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Riyadh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}) // _l
/** He — today in Riyadh, YYYY-MM-DD. */
export const qaToday = (): string => qaDayFmt.format(new Date())
/** rt — shift a YYYY-MM-DD by n days. */
export const qaDayShift = (t: string, n: number): string => {
  const a = new Date(t + 'T00:00:00Z')
  a.setUTCDate(a.getUTCDate() + n)
  return a.toISOString().slice(0, 10)
}
/** ot — first of the month of t, shifted back n months. */
export const qaMonthStart = (t: string, n = 0): string =>
  new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 - n, 1))
    .toISOString()
    .slice(0, 10)
const qaDayLong = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}) // xl
/** pe — "1 Jan 2026" label for YYYY-MM-DD. */
export const qaDayLabel = (t: string): string =>
  qaDayLong.format(new Date(t + 'T00:00:00Z'))
/** dt — strict YYYY-MM-DD test. */
export const qaIsDay = (t: string | null | undefined): boolean =>
  !!t && /^\d{4}-\d{2}-\d{2}$/.test(t)
/** ca — [from, to] for a preset, week starting on a (0 Sun / 1 Mon). */
export function qaRangeFor(t: string, n: string, a: number): [string, string] {
  return t === 'last-month'
    ? [qaMonthStart(n, 1), qaDayShift(qaMonthStart(n), -1)]
    : t === 'week'
      ? [
          qaDayShift(
            n,
            -((new Date(n + 'T00:00:00Z').getUTCDay() - a + 7) % 7)
          ),
          n,
        ]
      : t === '30'
        ? [qaDayShift(n, -29), n]
        : t === 'quarter'
          ? [
              new Date(
                Date.UTC(
                  +n.slice(0, 4),
                  Math.floor((+n.slice(5, 7) - 1) / 3) * 3,
                  1
                )
              )
                .toISOString()
                .slice(0, 10),
              n,
            ]
          : [qaMonthStart(n), n]
}
/** dl — short day names; he — day name of a YYYY-MM-DD; ul — add days. */
export const QA_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const qaDayName = (t: string): string =>
  QA_DAY_NAMES[new Date(t + 'T00:00:00Z').getUTCDay()]
export const qaAddDays = (t: string, n: number): string =>
  new Date(Date.parse(t + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10)
/** Rt — coverage tone: 0 bad, under quota warn, else ok. */
export const qaCovTone = (t: number, n: number): ChipStatus =>
  t <= 0 ? 'bad' : t < n ? 'warn' : 'ok'

/* --- ta — the interaction/audit basis segmented control ------------------ */
export function BasisSeg({
  basis,
  onChange,
}: {
  basis: string
  onChange: (basis: string) => void
}) {
  return (
    <Seg
      name="qa-basis"
      value={basis}
      onChange={onChange}
      options={[
        { value: 'interaction', label: 'By interaction date' },
        { value: 'audit', label: 'Audited in period' },
      ]}
      aria-label="Count audits by"
    />
  )
}

/* --- ea — the drill-down section (agent → questions → audits) ------------ */
export function DrillSection({
  scope,
  pick,
  open,
  close,
}: {
  scope: { grain: string; period: string; basis: string; label: string }
  pick: { agent?: string; agentName?: string; question?: string; questionText?: string }
  open: (pick: any) => void
  close: () => void
}) {
  const {
    data: i,
    error: c,
    reload: l,
  } = useSe(() =>
    P.analyticsAudits(scope.grain, scope.period, pick.agent ?? '', pick.question ?? '', scope.basis)
  )
  const m = [pick.agentName, pick.questionText ? `“${pick.questionText.slice(0, 80)}”` : '']
    .filter(Boolean)
    .join(': ')
  return (
    <section className="cx-section qa-drill" aria-labelledby="qa-drill-h">
      <div className="cx-section__head">
        <h2 className="cx-section__title" id="qa-drill-h" tabIndex={-1}>
          {m}
        </h2>
        <span className="cx-section__hint">
          {scope.label}. Every counted audit of the period, whatever its basis.
        </span>
        <Button variant="quiet" onClick={close}>
          Close
        </Button>
      </div>
      {c ? (
        <LoadError message={c} onRetry={l} />
      ) : i ? (
        <>
          {pick.agent && !pick.question && i.questions.length ? (
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
                        <QaLink
                          label={r.text}
                          onClick={() =>
                            open({ ...pick, question: r.key, questionText: r.text })
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
          {pick.question && !pick.agent && i.agents.length ? (
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
                        <QaLink
                          label={r.name}
                          onClick={() =>
                            open({ ...pick, agent: r.email, agentName: r.name })
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
                          <a href={r.ticketUrl} target="_blank" rel="noopener noreferrer">
                            #{r.ticketId}
                          </a>
                        ) : (
                          <span className="qa-ref">{r.ticketId}</span>
                        )}
                        <span className="cx-faint qa-sub">
                          {r.date}, {r.agentName}, {r.channel},{' '}
                          {QA_BASIS_LABELS[r.basis].toLowerCase()}
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
                                {u.reason ? ` (${QA_REASON_LABELS[u.reason] ?? u.reason})` : ''}
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
