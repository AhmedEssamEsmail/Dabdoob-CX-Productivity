'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* Queue & Workforce shared widgets — ports of the closure-bundle helpers
 * (cx-chip, cx-agechip, cx-refresh, the useSe loader, Kuwait formatters,
 * the cc-sweep/cc-tip/count-up machinery (bt/Oe/ps/fs/Bt/nn/gs/On/$a/Qe),
 * the Ca filter bar, it status-line, vs chip, xe skeletons,
 * and the Qa dropdown + options cache from checkins.closure.js).
 */
import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import { PageHead } from '@/features/shared/components/shell/ui'
import { Button, Input, PageShell, Select } from '@/features/shared/components/ui'
import { pageParams } from '@/features/shared/shell/gates'
import { FetchError, fetchJson as baseFetchJson, postJson } from '@/features/shared/lib/fetch-json'
import { useOptions } from '@/features/shared/lib/use-options'
import { usePageData } from '@/features/shared/lib/use-page-data'
import { usePoll } from '@/features/shared/lib/use-poll'

export { FetchError, postJson }
export { Failed as LoadError, LinesSkeleton as Skeleton, Skeleton as Xe } from '@/features/shared/components/ui/PageStates'
export { StatusChip } from '@/features/shared/components/ui'

export const kwTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const kwDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', weekday: 'short', day: 'numeric', month: 'short' })
export const hm = (t?: string | null) => (t ? kwTime.format(new Date(t)) : '')
export const dayAt = (t?: string | null) => (t ? kwDay.format(new Date(t)) : '')

export const AGE_RANKS = [0, 1, 3, 4, 6]
export const ageRank = (t: number, n = 13) => {
  const s = Math.max(0, Math.min(n - 1, t))
  return n === AGE_RANKS.length ? String(AGE_RANKS[s]) : String(n <= 1 ? 0 : Math.round((s * 6) / (n - 1)))
}
export const bandTop = (t: number) => (t >= 24 && t % 24 === 0 ? `${t / 24} d` : `${t} h`)
export const humanH = (t: number) => (t < 1 ? `${Math.max(1, Math.round(t * 60))} min` : t < 24 ? `${Math.floor(t)} h` : `${Math.floor(t / 24)} d ${Math.floor(t % 24)} h`)
export const fmt = (n: number) => n.toLocaleString('en-US')

export function AgeChip({ hours, band }: { hours: number; band: number }) {
  return (
    <span className="cx-agechip" data-age={ageRank(band)}>
      {humanH(hours)}
    </span>
  )
}

export function Head({ title, sub, aside }: { title: string; sub: string; aside?: React.ReactNode }) {
  return <PageShell title={title} purpose={sub} aside={aside} id="page-title" />
}

export function AsOfHint({ iso, what = 'Freshdesk' }: { iso?: string | null; what?: string }) {
  return iso ? (
    <span className="cx-section__hint">
      {what}, read {dayAt(iso)} at {hm(iso)} Kuwait time
    </span>
  ) : (
    <span className="cx-section__hint">No data yet: the first scheduled run has not finished.</span>
  )
}

/** Legacy (url, body?) facade over the canonical fetch-json: a second arg
    auto-POSTs JSON via postJson; RequestInit callers use postJson/baseFetchJson. */
const fetchJsonLegacy = (url: string, body?: unknown): Promise<any> =>
  body === undefined ? baseFetchJson(url) : postJson(url, body)
export { fetchJsonLegacy as fetchJson }

/** The vt() loader from the bundles: cached data, error, reload — usePageData. */
function useSeLegacy<T = any>(name: string, load: () => Promise<T>, deps: unknown[] = []) {
  return usePageData<T>(name, load, { deps })
}
export { useSeLegacy as useSe }

export function useHashParams(): URLSearchParams {
  /* The legacy read the params off '#/path?…'; the shim moves them to
     location.search and pageParams reads both. Memoized once — the params
     seed initial state, same as the legacy mount read. */
  return useMemo(() => pageParams(), [])
}

// ---------------------------------------------------------------------------
// The cc-sweep / cc-tip / count-up machinery (bt/Oe/ps/fs/Bt/nn/gs/On/$a/Qe),
// the it() status line, vs() chip, Ca() filter bar and xe() skeletons — all
// verbatim ports of the closure-bundle helpers.
// ---------------------------------------------------------------------------

/** bt — true when motion should be suppressed. */
export function reduceMotion(): boolean {
  return (
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    document.documentElement.hasAttribute('data-reduce-motion')
  )
}

const SWEEP_MS = 820 // ka

/** Oe — the cc-sweep "is-in/is-done" reveal applied to a ref'd container. */
export function useSweep(ref: React.RefObject<HTMLElement | null>): void {
  const state = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (state.current) {
      el.classList.add('is-in')
      if (state.current === 2) el.classList.add('is-done')
      return
    }
    if (document.hidden || reduceMotion()) {
      state.current = 2
      el.classList.add('is-in', 'is-done')
      return
    }
    state.current = 1
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')))
    setTimeout(() => {
      state.current = 2
      el.classList.add('is-in', 'is-done')
    }, SWEEP_MS)
  })
}

/** Qe — the per-row stagger delay var, capped at 12. */
export const sweepStyle = (i: number) => ({ '--i': Math.min(i, 12) }) as React.CSSProperties

/** ps — the cc-tip hover/focus tooltip on a cc-chart container (includes the Oe sweep). */
export function useTip(): {
  ref: React.RefObject<HTMLDivElement | null>
  tipFor: (text: string) => Record<string, unknown>
  tipEl: React.ReactNode
} {
  const ref = useRef<HTMLDivElement | null>(null)
  useSweep(ref)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const on = (text: string) => (e: React.SyntheticEvent) => {
    const el = ref.current
    if (!el) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const box = el.getBoundingClientRect()
    const x = Math.max(64, Math.min(box.width - 64, r.left + r.width / 2 - box.left))
    setTip({ text, x, y: Math.max(0, r.top - box.top) })
  }
  const off = () => setTip(null)
  const tipFor = (text: string) => ({
    'aria-label': text,
    onPointerEnter: on(text),
    onFocus: on(text),
    onPointerLeave: off,
    onBlur: off,
  })
  const tipEl = tip ? (
    <span className="cc-tip" aria-hidden="true" style={{ left: `${tip.x}px`, top: `${tip.y}px` }}>
      {tip.text}
    </span>
  ) : null
  return { ref, tipFor, tipEl }
}

const COUNT_MS = 900 // qn
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩' // Aa

/** On — latin digits -> arabic-indic when the document is rtl-ar. */
export function arDigits(t: string): string {
  return document.documentElement.lang !== 'ar'
    ? t
    : t.replace(/(\d)([.,])(?=\d)/g, (_m, d: string, s: string) => d + (s === '.' ? '٫' : '٬')).replace(/\d/g, (d) => AR_DIGITS[+d])
}

/** $a — decimals to keep while counting (max 2). */
const fracDigits = (t: number) => Math.min(2, (String(t).split('.')[1] ?? '').length)

/** fs — the eased count-up: returns the span ref, progress k and the eased value. */
function useCountUp(t: number | null): { ref: React.RefObject<HTMLElement | null>; k: number; ease: number } {
  const ref = useRef<HTMLElement | null>(null)
  const started = useRef(false)
  const [k, setK] = useState(1)
  useEffect(() => {
    if (started.current || t === null || t === 0 || reduceMotion() || document.hidden) return
    started.current = true
    setK(0)
    let raf = 0
    let to = 0
    const run = () => {
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / COUNT_MS)
        setK(p)
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      to = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        setK(1)
      }, COUNT_MS + 100)
    }
    const el = ref.current
    const io =
      el && typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((entries) => {
            if (entries.some((u) => u.isIntersecting)) {
              io?.disconnect()
              run()
            }
          })
        : null
    if (io && el) io.observe(el)
    else run()
    return () => {
      io?.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(to)
      setK(1)
    }
  }, [t])
  return { ref, k, ease: 1 - (1 - k) ** 3 }
}

/** Bt — the dual span: animated live text + the final value for screen readers. */
export function CountSpans({ live, final, spanRef }: { live: string; final: string; spanRef: React.RefObject<HTMLElement | null> }) {
  return (
    <Fragment>
      <span ref={spanRef as React.RefObject<HTMLSpanElement>} aria-hidden="true">
        {arDigits(live)}
      </span>
      <span className="cx-sr">{arDigits(final)}</span>
    </Fragment>
  )
}

/** nn — an animated number: counts up to `value`, formatted by `format`. */
export function Count({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const { ref, k, ease } = useCountUp(Number.isFinite(value) ? value : null)
  const final = format(value)
  const live = k >= 1 ? final : format(Number((value * ease).toFixed(fracDigits(value))))
  return <CountSpans live={live} final={final} spanRef={ref} />
}

const TEXT_NUM_RE = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/ // Ta

/** gs — like nn but inside an arbitrary string: only the number counts up. */
export function CountText({ v }: { v: unknown }) {
  const s = v == null ? '' : String(v)
  const m = TEXT_NUM_RE.exec(s)
  const n = m ? Number(m[2] + m[3].replace(/,/g, '') + (m[4] ?? '')) : null
  const { ref, k, ease } = useCountUp(n)
  if (!m || n === null || k >= 1) return <CountSpans live={s} final={s} spanRef={ref} />
  const dec = m[4] ? m[4].length - 1 : 0
  const p = (n * ease).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
    useGrouping: m[3].includes(','),
  })
  return <CountSpans live={m[1] + p + m[5]} final={s} spanRef={ref} />
}

/** Ra — how many band edges are at or under `hours`: the bucket index for AgeChip. */
export const edgeRank = (hours: number, edges: number[]) => edges.reduce((s, a, l) => (hours >= a ? l + 1 : s), 0)

/** ct — a delta: +n, −n, 0 or –. */
export const deltaFmt = (n: number | null): string => (n === null ? '–' : n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

/** qa — the known status ordering for it(). */
const STATUS_ORDER = ['open', 'new', 'assigned', 'pending on cx', 'pending']

/** Je — status sort rank: counted first, "customer" after, "not counted" last. */
function statusRank(t: string): number {
  const n = t.toLowerCase()
  if (n.includes('not counted')) return 40
  if (n.includes('customer')) return 30
  const s = STATUS_ORDER.indexOf(n)
  return s === -1 ? 20 : s
}

/** Oa — ALL-CAPS statuses are title-cased. */
const statusTitle = (t: string) => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t)

/** it — "Open 12 · Assigned 8 (also Not counted 2)" for the row's status line. */
export function statusLine(t: Record<string, number> | null | undefined): string {
  const n = Object.entries(t || {})
  const s = n
    .filter(([l]) => statusRank(l) < 40)
    .sort((l, r) => statusRank(l[0]) - statusRank(r[0]) || r[1] - l[1])
    .map(([l, r]) => `${statusTitle(l)} ${r.toLocaleString('en-US')}`)
    .join(' · ')
  const a = n.filter(([l]) => statusRank(l) >= 40).map(([l, r]) => `${l} ${r.toLocaleString('en-US')}`)
  return a.length ? `${s} (also ${a.join(', ')})` : s
}

interface FilterPick {
  value: string
  onChange: (v: string) => void
  all?: string
  options: { value: string; label: string }[]
}

/**
 * Ca — the cx-filters bar: owner/team selects, a pw-seg priority pick and a
 * search box. Verbatim: only the props passed are rendered (the queue board
 * passes just `search`).
 */
export function CxFilters({
  owner,
  team,
  priority,
  search,
  label,
  children,
}: {
  owner?: FilterPick
  team?: FilterPick
  priority?: { value: string; onChange: (v: string) => void; options: string[] }
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  label: string
  children?: React.ReactNode
}) {
  const sel = (name: string, p: FilterPick) => (
    <label className="cx-filter" key={name}>
      <span className="cx-sr">{name}</span>
      <Select className="select" value={p.value} onChange={(e) => p.onChange(e.target.value)}>
        <option value="">{p.all}</option>
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  )
  return (
    <div className="cx-filters" role="group" aria-label={label}>
      {owner ? sel('Owner', owner) : null}
      {team ? sel('Team', team) : null}
      {priority ? (
        <div className="pw-seg" role="group" aria-label="Priority">
          {/* kept raw:pw-seg toggle group (aria-pressed, deselectable) is not expressible by ui/Seg */}
          <button type="button" aria-pressed={!priority.value} onClick={() => priority.onChange('')}>
            Any priority
          </button>
          {priority.options.map((o) => (
            // kept raw:pw-seg toggle group (aria-pressed, deselectable) is not expressible by ui/Seg
            <button key={o} type="button" aria-pressed={priority.value === o} onClick={() => priority.onChange(priority.value === o ? '' : o)}>
              {o}
            </button>
          ))}
        </div>
      ) : null}
      {search ? (
        <label className="cx-filter cx-filter--search">
          <span className="cx-sr">Search</span>
          <Input
            className="input"
            type="search"
            value={search.value}
            placeholder={search.placeholder}
            onInput={(e) => search.onChange((e.target as HTMLInputElement).value)}
          />
        </label>
      ) : null}
      {children}
    </div>
  )
}

/** ys — Refresh now, with the retry cooldown countdown. */
export function RefreshNow({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [until, setUntil] = useState(0)
  // eslint-disable-next-line react-hooks/purity -- verbatim: cooldown timer seeds from Date.now()
  const [now, setNow] = useState(Date.now())
  usePoll(until > now ? 1000 : null, () => setNow(Date.now()), { immediate: false })
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  const go = () => {
    setBusy(true)
    setMsg('')
    fetchJsonLegacy('/api/queue/refresh', {}).then(
      (c) => {
        setBusy(false)
        const o = c.refreshed && c.synced_to ? `Freshdesk changes up to ${hm(c.synced_to)} Kuwait time.` : ''
        setMsg((o + ' ' + (c.message || '')).replace(/\s*Try again in \d+ s\.$/, '').trim())
        if (c.retryInS) {
          setUntil(Date.now() + c.retryInS * 1000)
          setNow(Date.now())
        }
        if (c.refreshed) onDone()
      },
      (c) => {
        setBusy(false)
        setMsg(c.message)
      },
    )
  }
  return (
    <span className="cx-refresh">
      <Button disabled={busy || left > 0} aria-busy={busy} onClick={go}>
        {busy ? 'Refreshing…' : left > 0 ? `Refresh again in ${left} s` : 'Refresh now'}
      </Button>
      {msg ? (
        <span className="cx-section__hint" role="status">
          {msg}
        </span>
      ) : null}
    </span>
  )
}

/** _s — the cx-ladder of age buckets, with cc-tip hovers; pickable on some pages. */
export function AgeLadder({
  counts,
  bands,
  pressed,
  onPick,
}: {
  counts: number[]
  bands: { labels: string[] }
  pressed?: number | null
  onPick?: (i: number | null) => void
}) {
  const { ref, tipFor, tipEl } = useTip()
  return (
    <div ref={ref} className="cc-chart" onKeyDown={onPick && pressed != null ? (e) => e.key === 'Escape' && onPick(null) : undefined}>
      {tipEl}
      <div className="cx-ladder cc-sweep-bar" role="group" aria-label="Open tickets by age">
        {counts.map((h, p) => (
          // kept raw:cx-ladder__seg is a bespoke age-ramp segment (data-age/--n sizing), not a ui/Button
          <button
            key={p}
            type="button"
            className={onPick ? 'cx-ladder__seg cc-pick' : 'cx-ladder__seg'}
            data-age={ageRank(p, counts.length)}
            style={{ '--n': Math.max(h, 4) } as React.CSSProperties}
            {...(tipFor(`${bands.labels[p]}: ${h} tickets`) as object)}
            aria-pressed={onPick ? pressed === p : undefined}
            onClick={onPick ? () => onPick(pressed === p ? null : p) : undefined}
            tabIndex={onPick ? 0 : -1}
          >
            <span>
              <CountText v={h} />
            </span>
          </button>
        ))}
      </div>
      <div className="cx-ladder__legend" aria-hidden="true">
        {counts.map((h, p) => (
          <span key={p} style={{ '--n': Math.max(h, 4) } as React.CSSProperties}>
            {bands.labels[p]}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The server-backed dropdown (checkins.closure.js symbols qt/Ot/ea/kn/ls/Qa).
// Options live per listKey and are shared by every mounted select; "Other…"
// appends through POST /api/options/<listKey>, which the data layer refuses
// in a View as session (assertWritable_).
// ---------------------------------------------------------------------------

const OPT_OTHER = '__other__' // qt

/**
 * Qa verbatim: a dropdown backed by GET /api/options/<listKey>, with an
 * "Other…" choice that posts a new option and selects it. While the choices
 * load the select is disabled and shows "Loading choices…"; a current value
 * that is not in the list is prepended so it stays visible.
 */
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
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  const p = useId()
  const { options: optOptions, loading: optLoading, error: optError, reload: optReload } = useOptions(listKey)
  const d = optError || optLoading ? undefined : optOptions
  const [u, c] = useState(false)
  const [o, f] = useState('')
  const [g, m] = useState(false)
  const [b, v] = useState('')
  const y = optError ?? ''
  const M = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (u) M.current?.focus()
  }, [u])
  const $ = d ?? []
  const L = value && !$.includes(value) ? [value, ...$] : $
  function H(q: React.ChangeEvent<HTMLSelectElement>) {
    const N = q.currentTarget.value
    if (N === OPT_OTHER) {
      c(true)
      v('')
      return
    }
    c(false)
    onChange(N)
  }
  async function O() {
    if (g) return
    m(true)
    v('')
    try {
      const q = await postJson('/api/options/' + encodeURIComponent(listKey), { value: o })
      optReload()
      onChange(q.value)
      c(false)
      f('')
    } catch (q: any) {
      v(q.message)
    } finally {
      m(false)
    }
  }
  function T() {
    c(false)
    f('')
    v('')
  }
  const S = hint ? `${p}-hint` : undefined
  const C = b || y ? `${p}-err` : undefined
  return (
    <div className="field">
      <label htmlFor={p} className="field-label">
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <Select
        id={p}
        className="select"
        value={u ? OPT_OTHER : value}
        onChange={H}
        disabled={disabled || d === undefined}
        required={required}
        aria-describedby={[S, C].filter(Boolean).join(' ') || undefined}
      >
        <option value="" disabled={required}>
          {d === undefined ? 'Loading choices…' : placeholder}
        </option>
        {L.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
        <option value={OPT_OTHER}>Other…</option>
      </Select>
      {hint ? (
        <p id={S} className="field-hint">
          {hint}
        </p>
      ) : null}
      {u ? (
        <div className="other-row">
          <Input
            ref={M}
            className="input"
            type="text"
            maxLength={120}
            value={o}
            aria-label={`New choice for ${label}`}
            placeholder="Type the new choice"
            onInput={(q) => f(q.currentTarget.value)}
            onKeyDown={(q) => {
              if (q.key === 'Enter') {
                q.preventDefault()
                O()
              } else if (q.key === 'Escape') T()
            }}
          />
          <Button variant="primary" onClick={O} disabled={g || !o.trim()}>
            {g ? 'Adding…' : 'Add choice'}
          </Button>
          <Button variant="quiet" onClick={T} disabled={g}>
            Cancel
          </Button>
        </div>
      ) : null}
      {b || y ? (
        <p id={C} className="field-error" role="alert">
          {b || `Choices did not load: ${y}`}
        </p>
      ) : null}
    </div>
  )
}

export { PageHead }
