'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * cx-quality shared widgets — second five pages (qa-shared2).
 *
 * The PM merges this into qa-shared.tsx once both batches land; the legacy
 * symbol names stay in comments for traceability:
 *   P       — google.script.run seam  → qa() POST /api/qa/<fn> {args}
 *   se/dn   — data loader + named-thunk cache
 *   de      — QaPage shell, D — QaSection (non-collapsible, aside slot)
 *   E       — Chip (shell/ui), _t — status text map, ae — StatusChip
 *   oe      — score band, Ie — ScoreChip, U — pct
 *   Mt/Ce   — ticket regex/label, ne — TicketRef, me — qa-link
 *   It      — "why it failed" reasons, os — answer labels
 *   Te      — ListSelect (Ve/Ma/Zt/ft/Hn store, it in-flight, lt sentinel)
 *   Q       — toast (shell Toasts)
 *   Zn      — AuditForm (+ ds, hs, us, rs client-side scoring)
 *   na      — basis note, Count/te — animated number
 */
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
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

/* Re-exports so the pages draw from one file (PM merges into qa-shared). */
export { Chip, LinesSkeleton, LoadError, toast }

/* --- api seam ---------------------------------------------------------
 * L(fn, ...args) — legacy called google.script.run[fn](...args). The
 * dispatcher lives at POST /api/qa/<fn> with {args: [...]}.
 */
export async function fetchJson(url: string, body?: any): Promise<any> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.error) throw new Error(j.error || `${r.status} ${r.statusText}`)
  return j
}

export const qa = (fn: string, ...args: any[]): Promise<any> =>
  fetchJson(`/api/qa/${fn}`, { args })

/** P — verbatim call surface for these pages. */
export const P = {
  queuePage: (t = '') => qa('getQaQueuePage', t),
  calibrationPage: () => qa('getQaCalibrationPage'),
  createCalibration: (t: any) => qa('createQaCalibration', t),
  submitCalibration: (t: any) => qa('submitQaCalibrationAudit', t),
  kbGapsPage: () => qa('getQaKbGapsPage'),
  addKbGap: (t: any) => qa('addQaKbGap', t),
  markKbGapAdded: (t: any) => qa('markQaKbGapAdded', t),
  myAuditorKpis: (t: any) => qa('getQaMyAuditorKpis', t ?? ''),
  scoresPage: (t: any, n: any, a = 'interaction') =>
    qa('getQaScoresPage', t, n, a),
  analyticsPage: (t: any, n: any, a = 'interaction') =>
    qa('getQaAnalyticsPage', t, n ?? '', a),
  analyticsAudits: (t: any, n: any, a: any, s: any, i = 'interaction') =>
    qa('getQaAnalyticsAudits', t, n, a, s, i),
  formsPage: () => qa('getQaFormsPage'),
  saveForm: (t: any) => qa('saveQaForm', t),
}

/* --- se/dn — the loader hook ------------------------------------------ */
const dn = new Map()

/** se(t) — verbatim: named thunks are cached across remounts in dn. */
export function useSe(load: () => Promise<any>) {
  const cacheable = !!load.name
  const [data, setData] = useState<any>(() =>
    cacheable ? dn.get(load) ?? null : null
  )
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (cacheable && data !== null) dn.set(load, data)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true
    load().then(
      (u) => {
        if (!live) return
        setData(u)
        setError('')
      },
      (u) => live && setError(u.message)
    )
    return () => {
      live = false
    }
  }, [tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((r) => r + 1), [])
  return { data, error, reload, setData }
}

/* --- de / D — page shell + section ------------------------------------ */
export function QaPage({
  route,
  sub,
  d,
  error,
  reload,
  aside,
  children,
}: {
  route: { title: string }
  sub?: ReactNode
  d: any
  error?: string
  reload?: () => void
  aside?: ReactNode
  children?: ReactNode
}) {
  return (
    <section
      className="cxp dq-page"
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
        <h2 className="cx-section__title" id={id}>
          {title}
        </h2>
        {hint ? <span className="cx-section__hint">{hint}</span> : null}
        {aside}
      </div>
      {children}
    </section>
  )
}

/* --- _t / ae / oe / Ie / U — chips ------------------------------------ */
/** oe(t, n) — score band: null → neutral, fatal || <80 bad, <90 warn, else ok. */
export const qaBand = (t: number | null, n?: boolean): string =>
  t === null ? 'neutral' : n || t < 80 ? 'bad' : t < 90 ? 'warn' : 'ok'

/** _t — status → [label, tone] (identical across the Quality closures). */
export const QA_STATUS: Record<string, [string, string]> = {
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
      {QA_STATUS[s]?.[0] ?? s}
    </Chip>
  )
}

/** Ie({score, fatal}) — score chip. */
export function ScoreChip({
  score,
  fatal,
}: {
  score: number | null
  fatal?: boolean
}) {
  return (
    <Chip status={qaBand(score, !!fatal)}>
      {score === null ? '–' : `${score}%${fatal ? ', critical' : ''}`}
    </Chip>
  )
}

/** U — plain pct or dash. */
export const qaPct = (t: number | null): string =>
  t == null ? '–' : `${t}%`

/* --- Mt / Ce / ne / me — tickets + links ------------------------------- */
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

/** me — inline link styled like the legacy qa-link. */
export function QaLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a className="qa-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

/* --- na — basis note --------------------------------------------------- */
/** na(t, n) — verbatim basis-copy line. */
export const qaBasisNote = (t: string, n: number): string =>
  t === 'audit'
    ? 'Counted by the day each audit was done.'
    : `Counted by the date of the interaction${n ? `; ${n} ${n === 1 ? 'audit has' : 'audits have'} no interaction date and count by audit date` : ''}.`

/* --- Te — ListSelect: dropdown with an "Other…" free-text option --------
 * Store: Ve holds options per listKey; Zt writes + Hn() notifies every
 * mounted select via the ft subscriber set (verbatim store semantics).
 */
const Ve: Record<string, string[]> = {}
const ft = new Set<() => void>()
const it = new Map<string, Promise<any>>()
const LT = '__other__'

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
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return a
}

/** be — the shared-app options endpoints. */
const be = {
  getDropdownOptions: (listKey: string): Promise<string[]> =>
    fetch(`/api/options/${listKey}`)
      .then((r) => r.json())
      .then((j) => (Array.isArray(j) ? j : j?.options ?? [])),
  addDropdownOption: (listKey: string, value: string): Promise<any> =>
    fetchJson(`/api/options/${listKey}`, { value }),
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
  const m = useId()
  const r = useStoreSignal(() => Ma(listKey), [listKey])
  const [u, d] = useState(false)
  const [o, h] = useState('')
  const [b, x] = useState(false)
  const [f, g] = useState('')
  const [y, _] = useState('')
  const T = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (r !== undefined) return
    let R = it.get(listKey)
    if (!R) {
      R = be
        .getDropdownOptions(listKey)
        .then((Z) => Zt(listKey, Z))
      it.set(listKey, R)
      R.catch(() => it.delete(listKey))
    }
    R.catch((Z) => _(Z.message))
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
    <div className="field">
      <label htmlFor={m} className="field-label">
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <select
        id={m}
        className="select"
        value={u ? LT : value}
        onChange={O}
        disabled={disabled || r === undefined}
        required={required}
        aria-describedby={
          [A, S].filter(Boolean).join(' ') || undefined
        }
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
      </select>
      {hint ? (
        <p id={A} className="field-hint">
          {hint}
        </p>
      ) : null}
      {u ? (
        <div className="other-row">
          <input
            ref={T}
            className="input"
            type="text"
            maxLength={120}
            value={o}
            aria-label={`New choice for ${label}`}
            placeholder="Type the new choice"
            onInput={(R) => h(R.currentTarget.value)}
            onKeyDown={(R) => {
              if (R.key === 'Enter') {
                R.preventDefault()
                v()
              } else if (R.key === 'Escape') {
                w()
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={v}
            disabled={b || !o.trim()}
          >
            {b ? 'Adding…' : 'Add choice'}
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={w}
            disabled={b}
          >
            Cancel
          </button>
        </div>
      ) : null}
      {f || y ? (
        <p id={S} className="field-error" role="alert">
          {f || `Choices did not load: ${y}`}
        </p>
      ) : null}
    </div>
  )
}

/* --- It / os — audit-form vocab ---------------------------------------- */
/** It — "why it failed" reasons. */
export const QA_WHY = [
  { v: 'agent', label: 'Agent' },
  { v: 'process', label: 'Process' },
  { v: 'product', label: 'Product' },
  { v: 'kb', label: 'KB' },
]

/** os — answer labels. */
const QA_ANSWER: Record<string, string> = {
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
function rs(t: any, n: any) {
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
      score: r,
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
  return s ? `${s}.` : ''
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

  const C = useMemo(() => rs(t, u), [t, u])
  const O = (N: string, z: string) => d((X: any) => ({ ...X, [N]: z }))
  const v = (N: string[], z: boolean) =>
    d((X: any) => {
      const F = { ...X }
      for (const Xe of N) {
        if (z) F[Xe] = 'na'
        else delete F[Xe]
      }
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
    s(u, o, l ? Object.fromEntries(w.map((z) => [z, f[z]])) : {}, b.replace('T', ' ')).then(
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
    if (
      dirty &&
      !window.confirm(
        'Leave this audit? Your answers are not saved and will be lost.'
      )
    )
      return
    i()
  }

  const J = qaBand(C.score, C.fatal)
  const B = t.scoring === 'deduction'

  return (
    <form
      className="cx-panel cx-panel--pad qa-form"
      onSubmit={Z}
      aria-label={`Audit: ${t.title}`}
    >
      <div className="qa-form__back">
        <button
          type="button"
          className="cx-btn cx-btn--quiet"
          onClick={I}
          disabled={y}
        >
          <span aria-hidden="true">← </span>
          {c}
        </button>
      </div>
      <div className="qa-form__head">
        <div className="qa-form__facts">{n}</div>
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
      </div>
      <div className="cx-field">
        <label className="cx-label" htmlFor="qa-when">
          Interaction date and time (Riyadh)
        </label>
        <input
          className="cx-input"
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
          <fieldset
            className="qa-sec"
            data-skipped={X ? 'true' : undefined}
            key={N.id}
          >
            <legend className="qa-sec__title">{N.title}</legend>
            {N.optional ? (
              <div className="qa-sec__opt">
                <span className="cx-muted">
                  {X
                    ? 'Optional. Skipped: every question is N/A, so the score is not affected.'
                    : 'Optional. Answered questions count; N/A ones do not.'}
                </span>
                <button
                  type="button"
                  className="cx-btn cx-btn--quiet"
                  onClick={() => v(z, !X)}
                  aria-pressed={!X}
                >
                  {X ? 'Answer this section' : 'Skip section (N/A)'}
                </button>
              </div>
            ) : null}
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
                <div
                  className="qa-q"
                  data-answer={Je ?? ''}
                  data-fatal={F.fatal ? 'true' : undefined}
                  key={F.id}
                >
                  <div className="qa-q__text">
                    <span>{F.text}</span>
                    <span className="cx-faint qa-q__w">{ua}</span>
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
                  <div className="cx-seg" role="radiogroup" aria-label={F.text}>
                    {da.map((le) => (
                      <label key={le}>
                        <input
                          type="radio"
                          name={`qa-${F.id}`}
                          checked={Je === le}
                          onChange={() => O(F.id, le)}
                        />
                        <span>{QA_ANSWER[le]}</span>
                      </label>
                    ))}
                  </div>
                  {l && Je === 'fail' ? (
                    <div className="qa-q__why">
                      <span className="cx-faint" id={`qa-why-${F.id}`}>
                        Why it failed
                      </span>
                      <div
                        className="cx-seg"
                        role="radiogroup"
                        aria-labelledby={`qa-why-${F.id}`}
                        aria-required="true"
                      >
                        {QA_WHY.map((le) => (
                          <label key={le.v}>
                            <input
                              type="radio"
                              name={`qa-why-${F.id}`}
                              checked={f[F.id] === le.v}
                              onChange={() =>
                                g((ha: any) => ({ ...ha, [F.id]: le.v }))
                              }
                            />
                            <span>{le.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </fieldset>
        )
      })}
      <div className="cx-field">
        <label className="cx-label" htmlFor="qa-comment">
          Note for the agent and team lead
        </label>
        <textarea
          className="cx-textarea"
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
      <div className="qa-form__foot">
        <button
          type="submit"
          className="cx-btn cx-btn--primary"
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
        </button>
        <button
          type="button"
          className="cx-btn cx-btn--quiet"
          onClick={I}
          disabled={y}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
