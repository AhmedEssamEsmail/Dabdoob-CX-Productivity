'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */

import {
  type CSSProperties,
  type ReactNode,
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Input, Seg, Select } from '@/features/shared/components/ui'
import { Failed } from '@/features/shared/components/ui/PageStates'
import { getBoot, setBoot, useBootSelector } from '@/features/shared/shell/context'
import { applyAppearance, D } from '@/features/shared/shell/i18n'
import {
  fetchJson as sharedFetchJson,
  FetchError,
  postJson,
} from '@/features/shared/lib/fetch-json'
import { usePageData } from '@/features/shared/lib/use-page-data'
import { loadOptions } from '@/features/shared/lib/use-options'
import { usePoll } from '@/features/shared/lib/use-poll'

/**
 * Shared machinery of the Hub pages, ported once: the oi()/yn() api objects
 * (Of/Vi/Ln/Fs/Ug), Eo useSe, the cc-tip/Count machinery (zm/Bf/Jl/zf/kf),
 * page-head (Vf), the skeletons (lo/jl), the age chips (Ao/gg/fg/Gf),
 * RefreshNow (Hf), the up-next pair (If/Nf + Om), the Dropdown (oo) with its
 * option store, and Kuwait formatters (Yn/To/Df).
 */

/* ----------------------------------------------------------------- f / Ft */
export const Ft = Fragment

/* ------------------------------------------------------------ Yn / To / Df */
const ug = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const dg = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
export const Yn = (n: string | number | Date | null | undefined): string =>
  n ? ug.format(new Date(n)) : ''
export const To = (n: string | number | Date | null | undefined): string =>
  n ? dg.format(new Date(n)) : ''
export const Df = (n: number): string =>
  n < 12 ? 'Good morning' : n < 17 ? 'Good afternoon' : 'Good evening'

/* --------------------------------------------------------------- Gs / Om */
export function Gs(): boolean {
  return (
    (typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    document.documentElement.hasAttribute('data-reduce-motion')
  )
}
export const Lf = 'up-next'
export function Om(): void {
  const n = document.getElementById(Lf)
  if (n) {
    n.scrollIntoView({ block: 'center', behavior: Gs() ? 'auto' : 'smooth' })
    ;(n as HTMLElement).focus({ preventScroll: true })
  }
}

/* ----------------------------------------------------------------- fetchJson */
export { FetchError, postJson }
const hubFetchJson = <T = unknown>(url: string, init?: RequestInit): Promise<T> =>
  sharedFetchJson(url, init)
export { hubFetchJson as fetchJson }
const post = <T = any>(url: string, body?: unknown) => postJson(url, body ?? {}) as Promise<T>

/* --------------------------------------------------------------- api objects */
export const Of = {
  queueHealth: () => hubFetchJson<any>('/api/queue/health'),
  refreshNow: () => post<any>('/api/queue/refresh'),
}
export const Vi = {
  home: () => hubFetchJson<any>('/api/hub/home'),
  rosterAdmin: () => hubFetchJson<any>('/api/hub/roster'),
  setPerson: (email: string, fields: unknown) =>
    post('/api/hub/roster', { action: 'setPerson', email, fields }),
  addHoliday: (h: unknown) => post('/api/hub/roster', { action: 'addHoliday', h }),
  removeHoliday: (id: string) => post('/api/hub/roster', { action: 'removeHoliday', id }),
  syncRoster: () => post('/api/hub/roster', { action: 'syncRoster' }),
  setOverrides: (email: string, o: unknown) =>
    post('/api/hub/roster', { action: 'setOverrides', email, o }),
}
export const Ln = {
  getBootstrap: () => hubFetchJson('/api/bootstrap'),
  getDropdownOptions: (listKey: string) =>
    hubFetchJson<{ options: string[] }>('/api/options/' + encodeURIComponent(listKey)).then((r) => r.options),
  addDropdownOption: (listKey: string, value: string) =>
    post('/api/options/' + encodeURIComponent(listKey), { value }),
  getConfig: () => hubFetchJson<Record<string, unknown>>('/api/hub/admin?fn=config'),
  setConfig: (key: string, value: unknown) =>
    post('/api/hub/admin', { action: 'setConfig', key, value }),
  getConfigRows: () => hubFetchJson<ConfigRow[]>('/api/hub/admin'),
  saveConfigSetting: (key: string, value: unknown) =>
    post<ConfigRow[]>('/api/hub/admin', { action: 'saveConfig', key, value }),
  setAppUrl: (app: string, url: string) =>
    post<Record<string, string>>('/api/hub/admin', { action: 'setAppUrl', app, url }),
  getViewAsPeople: () => hubFetchJson<unknown[]>('/api/view-as/people'),
  startViewAs: (email: string) => post('/api/view-as', { email }),
  stopViewAs: () => hubFetchJson('/api/view-as', { method: 'DELETE' }),
  getViewAsState: () => hubFetchJson<{ target?: unknown }>('/api/view-as'),
}
export const Fs = {
  myDay: (refresh = false) =>
    hubFetchJson<any>('/api/hub/my-day' + (refresh ? '?refresh=1' : '')),
  myDayPart: (part: string, refresh = false) =>
    hubFetchJson<any>(
      '/api/hub/my-day?part=' + encodeURIComponent(part) + (refresh ? '&refresh=1' : '')
    ),
  searchMail: (query: string) => post('/api/hub/my-day', { action: 'searchMail', query }),
  createFocusBlock: (start: string, end: string, title?: string) =>
    post('/api/hub/my-day', { action: 'focusBlock', start, end, title }),
  setSettings: (patch: Record<string, unknown>) =>
    post('/api/hub/my-day', { action: 'setSettings', patch }),
  markFollowUpDone: (threadId: string, lastAtMs: number) =>
    post('/api/hub/my-day', { action: 'followUpDone', threadId, lastAtMs }),
  installDigest: () => post('/api/hub/my-day', { action: 'installDigest' }),
}
export const Ug = { get: () => hubFetchJson<any>('/api/health') }

export interface ConfigRow {
  key: string
  value: unknown
  kind: 'boolean' | 'number' | 'list' | 'json' | 'text'
  description: string
  updatedBy?: string
  updatedAt?: string
}

/* --------------------------------------------------------------------- Eo */
export function Eo<T>(fn: () => Promise<T>) {
  return usePageData<T>(null, fn, { cacheKey: fn.name ? fn : null })
}

/* ------------------------------------------------------- skeletons (lo/jl) */
const Bm = [55, 70, 48, 82, 64, 90, 58, 74, 40, 68, 86, 60, 52]
const lu = [78, 62, 90, 54, 70, 46, 84, 58, 66, 50]
export function lo({ shape, n = 6 }: { shape: 'tiles' | 'ladder' | 'chart' | 'rows'; n?: number }) {
  return shape === 'tiles' ? (
    <div className="cc-skel__tiles" aria-hidden="true">
      {Array.from({ length: n }, (_t, i) => (
        <span key={i} className="skeleton cc-skel__tile" />
      ))}
    </div>
  ) : (
    <div className="cx-panel cx-panel--pad cc-skel" aria-hidden="true">
      <span className="skeleton cc-skel__title" />
      {shape === 'ladder' ? <span className="skeleton cc-skel__ladder" /> : null}
      {shape === 'chart' ? (
        <div className="cc-skel__chart">
          {Bm.map((t, i) => (
            <span key={i} className="skeleton" style={{ blockSize: `${t}%` }} />
          ))}
        </div>
      ) : null}
      {shape === 'rows' || shape === 'ladder'
        ? Array.from({ length: n }, (_t, i) => (
            <span key={i} className="cc-skel__row">
              <span className="skeleton" />
              <span className="skeleton" style={{ inlineSize: `${lu[i % lu.length]}%` }} />
              <span className="skeleton" />
            </span>
          ))
        : null}
    </div>
  )
}
export function jl({ lines = 3, tall = false }: { lines?: number; tall?: boolean }) {
  return tall && lines <= 2
    ? lo({ shape: 'tiles', n: 3 })
    : lo({ shape: tall ? 'ladder' : 'rows', n: tall ? lines - 1 : lines })
}

/* ------------------------------------------------------------------ sh */
export { Failed as sh }

/* ------------------------------------------------------------------ Vf */
export function Vf({ title, sub, aside }: { title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1 id="page-title" className="page-title">
          {title}
        </h1>
        {sub ? <p className="page-purpose">{sub}</p> : null}
      </div>
      {aside}
    </header>
  )
}

/* ------------------------------------------------------------- Count (zf) */
const hu = 900
const ag = '٠١٢٣٤٥٦٧٨٩'
function Bf(n: number | null): { ref: React.RefObject<HTMLElement | null>; k: number; ease: number } {
  const ref = useRef<HTMLElement | null>(null)
  const started = useRef(false)
  const [k, setK] = useState(1)
  useEffect(() => {
    if (started.current || n === null || n === 0 || Gs() || document.hidden) return
    started.current = true
    setK(0)
    let raf = 0
    let to = 0
    const run = () => {
      const t0 = performance.now()
      const step = (d: number) => {
        const p = Math.min(1, (d - t0) / hu)
        setK(p)
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      to = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        setK(1)
      }, hu + 100)
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
  }, [n])
  return { ref, k, ease: 1 - (1 - k) ** 3 }
}
export function uu(n: string): string {
  return document.documentElement.lang !== 'ar'
    ? n
    : n
        .replace(/(\d)([.,])(?=\d)/g, (_e, t: string, i: string) => t + (i === '.' ? '٫' : '٬'))
        .replace(/\d/g, (e) => ag[+e])
}
export function Jl({ live, final, spanRef }: { live: string; final: string; spanRef: React.RefObject<HTMLElement | null> }) {
  return (
    <Ft>
      <span ref={spanRef as React.RefObject<HTMLSpanElement>} aria-hidden="true">
        {uu(live)}
      </span>
      <span className="cx-sr">{uu(final)}</span>
    </Ft>
  )
}
const lg = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/
export function Zf({ v }: { v: unknown }) {
  const e = v == null ? '' : String(v)
  const t = lg.exec(e)
  const i = t ? Number(t[2] + t[3].replace(/,/g, '') + (t[4] ?? '')) : null
  const { ref, k, ease } = Bf(i)
  if (!t || i === null || k >= 1) return <Jl live={e} final={e} spanRef={ref} />
  const o = t[4] ? t[4].length - 1 : 0
  const c = (i * ease).toLocaleString('en-US', {
    minimumFractionDigits: o,
    maximumFractionDigits: o,
    useGrouping: t[3].includes(','),
  })
  return <Jl live={t[1] + c + t[5]} final={e} spanRef={ref} />
}
const og = (n: number) => Math.min(2, (String(n).split('.')[1] ?? '').length)
export function Kf({ value, format = String }: { value: number; format?: (n: number) => string }) {
  const { ref, k, ease } = Bf(Number.isFinite(value) ? value : null)
  const r = format(value)
  const a = k >= 1 ? r : format(Number((value * ease).toFixed(og(value))))
  return <Jl live={a} final={r} spanRef={ref} />
}
export const Hi = (n: number) => n.toLocaleString('en-US')
export const Ql = (n: number | null) => (n === null ? '–' : n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

/* ------------------------------------------------------------- th / zm */
const Fm = 820
/** Th — the fade-in hook. Named useTh so react-hooks sees the ref use. */
export function useTh(ref: React.RefObject<HTMLElement | null>): void {
  const state = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (state.current) {
      el.classList.add('is-in')
      if (state.current === 2) el.classList.add('is-done')
      return
    }
    if (document.hidden || Gs()) {
      state.current = 2
      el.classList.add('is-in', 'is-done')
      return
    }
    state.current = 1
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.add('is-in'))
    )
    setTimeout(() => {
      state.current = 2
      el.classList.add('is-in', 'is-done')
    }, Fm)
  })
}
export function Zm(): {
  ref: React.RefObject<HTMLDivElement | null>
  tipFor: (text: string) => Record<string, unknown>
  tipEl: ReactNode
} {
  const ref = useRef<HTMLDivElement | null>(null)
  useTh(ref)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const on = (text: string) => (e: React.SyntheticEvent) => {
    const el = ref.current
    if (!el) return
    const h = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const u = el.getBoundingClientRect()
    const x = Math.max(64, Math.min(u.width - 64, h.left + h.width / 2 - u.left))
    setTip({ text, x, y: Math.max(0, h.top - u.top) })
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
    <span
      className="cc-tip"
      aria-hidden="true"
      style={{ left: `${tip.x}px`, top: `${tip.y}px` } as CSSProperties}
    >
      {tip.text}
    </span>
  ) : null
  return { ref, tipFor, tipEl }
}

/* --------------------------------------------------- age bands (Ao/gg/fg/Gf) */
const pu = [0, 1, 3, 4, 6]
export const pg = (n: number, e: number[]): number => e.reduce((t, i, s) => (n >= i ? s + 1 : t), 0)
const mg = 13
export const Ao = (n: number, e = mg): string => {
  const t = Math.max(0, Math.min(e - 1, n))
  return e === pu.length ? String(pu[t]) : String(e <= 1 ? 0 : Math.round((t * 6) / (e - 1)))
}
export const gg = (n: number): string => (n >= 24 && n % 24 === 0 ? `${n / 24} d` : `${n} h`)
export function fg(n: number): string {
  return n < 1
    ? `${Math.max(1, Math.round(n * 60))} min`
    : n < 24
      ? `${Math.floor(n)} h`
      : `${Math.floor(n / 24)} d ${Math.floor(n % 24)} h`
}
export function Gf({ hours, band }: { hours: number; band: number }) {
  return (
    <span className="cx-agechip" data-age={Ao(band)}>
      {fg(hours)}
    </span>
  )
}
export const km = (n: number): CSSProperties => ({ '--i': Math.min(n, 12) }) as CSSProperties

/* ----------------------------------------------------------- chips/status */
export function _g({ status, children }: { status: string; children: ReactNode }) {
  return (
    <span className="cx-chip" data-status={status}>
      {children}
    </span>
  )
}
export const hg = (n: string) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n)
const cg = ['open', 'new', 'assigned', 'pending on cx', 'pending']
function na(n: string): number {
  const e = n.toLowerCase()
  if (e.includes('not counted')) return 40
  if (e.includes('customer')) return 30
  const t = cg.indexOf(e)
  return t === -1 ? 20 : t
}
export function du(n: Record<string, number>): string {
  const e = Object.entries(n || {})
  const t = e
    .filter(([s]) => na(s) < 40)
    .sort((s, r) => na(s[0]) - na(r[0]) || r[1] - s[1])
    .map(([s, r]) => `${hg(s)} ${r.toLocaleString('en-US')}`)
    .join(' · ')
  const i = e.filter(([s]) => na(s) >= 40).map(([s, r]) => `${s} ${r.toLocaleString('en-US')}`)
  return i.length ? `${t} (also ${i.join(', ')})` : t
}

/* ------------------------------------------------------------ ladder (Wf) */
export function Wf({
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
  const { ref, tipFor, tipEl } = Zm()
  return (
    <div
      ref={ref}
      className="cc-chart"
      onKeyDown={
        onPick && pressed != null
          ? (e) => e.key === 'Escape' && onPick(null)
          : undefined
      }
    >
      {tipEl}
      <div className="cx-ladder cc-sweep-bar" role="group" aria-label="Open tickets by age">
        {counts.map((o, c) => {
           
          const Tag: any = onPick ? 'button' : 'span'
          return (
            <Tag
              key={c}
              {...(onPick ? { type: 'button' } : {})}
              className={onPick ? 'cx-ladder__seg cc-pick' : 'cx-ladder__seg'}
              data-age={Ao(c, counts.length)}
              style={{ '--n': Math.max(o, 4) } as CSSProperties}
              {...tipFor(`${bands.labels[c]}: ${o} tickets`)}
              aria-pressed={onPick ? pressed === c : undefined}
              onClick={onPick ? () => onPick(pressed === c ? null : c) : undefined}
              tabIndex={onPick ? 0 : -1}
            >
              <span>
                <Zf v={o} />
              </span>
            </Tag>
          )
        })}
      </div>
      <div className="cx-ladder__legend" aria-hidden="true">
        {counts.map((o, c) => (
          <span key={c} style={{ '--n': Math.max(o, 4) } as CSSProperties}>
            {bands.labels[c]}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- rg (filters) */
interface FilterCtl {
  value: string
  onChange: (v: string) => void
  all: string
  options: { value: string; label: string }[]
}
export function rg({
  owner,
  team,
  priority,
  search,
  label,
  children,
}: {
  owner?: FilterCtl | null
  team?: FilterCtl | null
  priority?: { value: string; onChange: (v: string) => void; options: string[] } | null
  search?: { value: string; onChange: (v: string) => void; placeholder: string } | null
  label: string
  children?: ReactNode
}) {
  const sel = (name: string, c: FilterCtl) => (
    <label key={name} className="cx-filter">
      <span className="cx-sr">{name}</span>
      <Select className="select" value={c.value} onChange={(l) => c.onChange(l.target.value)}>
        <option value="">{c.all}</option>
        {c.options.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
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
        <Seg
          name="rg-priority"
          aria-label="Priority"
          value={priority.value}
          onChange={(v) => priority.onChange(v === priority.value ? '' : v)}
          options={[
            { value: '', label: 'Any priority' },
            ...priority.options.map((o) => ({ value: o, label: o })),
          ]}
        />
      ) : null}
      {search ? (
        <label className="cx-filter cx-filter--search">
          <span className="cx-sr">Search</span>
          <Input
            className="input"
            type="search"
            value={search.value}
            placeholder={search.placeholder}
            onInput={(o) => search.onChange((o.target as HTMLInputElement).value)}
          />
        </label>
      ) : null}
      {children}
    </div>
  )
}

/* -------------------------------------------------------------- Hf refresh */
export function Hf({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(Date.now) // legacy he(Date.now()) — lazy init, same value
  usePoll(until > now ? 1e3 : null, () => setNow(Date.now()), { immediate: false })
  const left = Math.max(0, Math.ceil((until - now) / 1e3))
  const run = () => {
    setBusy(true)
    setMsg('')
    Of.refreshNow().then(
      (u: Record<string, never>) => {
        setBusy(false)
        const d =
          u.refreshed && u.synced_to
            ? `Freshdesk changes up to ${Yn(u.synced_to as string)} Kuwait time.`
            : ''
        setMsg(
          (d + ' ' + ((u.message as string) || '')).replace(/\s*Try again in \d+ s\.$/, '').trim()
        )
        if (u.retryInS) {
          setUntil(Date.now() + (u.retryInS as number) * 1e3)
          setNow(Date.now())
        }
        if (u.refreshed) onDone()
      },
      (u) => {
        setBusy(false)
        setMsg((u as Error).message)
      }
    )
  }
  return (
    <span className="cx-refresh">
      <Button className="cx-btn" disabled={busy || left > 0} aria-busy={busy} onClick={run}>
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

/* ------------------------------------------------------------- If / Nf */
export interface UpNextItem {
  at: string
  title: string
  live: boolean
  meta?: string
  action?: { label: string; href: string }
}
export function If({ item }: { item: UpNextItem }) {
  return (
    <Button className="btn btn-quiet upnext-jump" onClick={Om}>
      {item.live ? 'Now' : 'Next'}: <span className="upnext-num">{item.at}</span>
    </Button>
  )
}
export function Nf({ item }: { item: UpNextItem }) {
  const upId = useId()
  return (
    <section id={Lf} className="upnext" tabIndex={-1} aria-labelledby={upId} data-live={item.live ? '' : undefined}>
      <p className="upnext-when">
        <span className="upnext-num">{item.at}</span>
        <span className="upnext-tag" id={upId}>
          {item.live ? 'Now' : 'Up next'}
        </span>
      </p>
      <div className="upnext-body">
        <p className="upnext-title">{item.title}</p>
        {item.meta ? <p className="upnext-meta">{item.meta}</p> : null}
      </div>
      {item.action ? (
        <a className="btn btn-primary upnext-go" href={item.action.href}>
          {item.action.label}
        </a>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------- appUrls / gu */
export function xf(app: string): string {
  return getBoot()?.appUrls?.[app] ?? ''
}
export function gu(): string {
  const n = xf('hub')
  return n ? `${n}${n.includes('?') ? '&' : '?'}page=ecosystem` : ''
}
export const useBootAppUrls = () => useBootSelector(() => getBoot()?.appUrls ?? {}, [])
export const Pr = getBoot
export const _f = setBoot
export const Ti = toast
export { applyAppearance, D, useId, useMemo }

/* ------------------------------------------------- options store + oo Dropdown */
const Go = '__other__'
const optListeners = new Set<() => void>()
let optStore: Record<string, string[]> = {}
export function nu(k: string, v: string[]): void {
  optStore = { ...optStore, [k]: v }
  optListeners.forEach((f) => f())
}
export function tm(k: string): string[] | undefined {
  return optStore[k]
}
function useOpt(k: string): string[] | undefined {
  const [v, setV] = useState(() => tm(k))
  useEffect(() => {
    const s = () => setV(() => tm(k))
    optListeners.add(s)
    s()
    return () => {
      optListeners.delete(s)
    }
  }, [k])
  return v
}
export function Oo({
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
  const c = useId()
  const l = useOpt(listKey)
  const [other, setOther] = useState(false)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (l !== undefined) return
    let live = true
    loadOptions(listKey).then(
      (H) => live && nu(listKey, H),
      (H) => live && setLoadErr((H as Error).message)
    )
    return () => {
      live = false
    }
  }, [listKey, l])
  useEffect(() => {
    if (other) inputRef.current?.focus()
  }, [other])
  const b = l ?? []
  const w = value && !b.includes(value) ? [value, ...b] : b
  function S(L: React.ChangeEvent<HTMLSelectElement>) {
    const H = L.currentTarget.value
    if (H === Go) {
      setOther(true)
      setErr('')
      return
    }
    setOther(false)
    onChange(H)
  }
  async function _() {
    if (!adding) {
      setAdding(true)
      setErr('')
      try {
        const L = (await Ln.addDropdownOption(listKey, draft)) as { value: string; options: string[] }
        nu(listKey, L.options)
        onChange(L.value)
        setOther(false)
        setDraft('')
      } catch (L) {
        setErr((L as Error).message)
      } finally {
        setAdding(false)
      }
    }
  }
  function T() {
    setOther(false)
    setDraft('')
    setErr('')
  }
  const R = hint ? `${c}-hint` : undefined
  const Dv = err || loadErr ? `${c}-err` : undefined
  return (
    <div className="field">
      <label htmlFor={c} className="field-label">
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <Select
        id={c}
        className="select"
        value={other ? Go : value}
        onChange={S}
        disabled={disabled || l === undefined}
        required={required}
        aria-describedby={[R, Dv].filter(Boolean).join(' ') || undefined}
      >
        <option value="" disabled={required}>
          {l === undefined ? 'Loading choices…' : placeholder}
        </option>
        {w.map((L) => (
          <option key={L} value={L}>
            {L}
          </option>
        ))}
        <option value={Go}>Other…</option>
      </Select>
      {hint ? (
        <p id={R} className="field-hint">
          {hint}
        </p>
      ) : null}
      {other ? (
        <div className="other-row">
          <Input
            ref={inputRef}
            className="input"
            type="text"
            maxLength={120}
            value={draft}
            aria-label={`New choice for ${label}`}
            placeholder="Type the new choice"
            onInput={(L) => setDraft(L.currentTarget.value)}
            onKeyDown={(L) => {
              if (L.key === 'Enter') {
                L.preventDefault()
                void _()
              } else if (L.key === 'Escape') T()
            }}
          />
          <Button type="button" className="btn btn-primary" onClick={() => void _()} disabled={adding || !draft.trim()}>
            {adding ? 'Adding…' : 'Add choice'}
          </Button>
          <Button type="button" className="btn btn-quiet" onClick={T} disabled={adding}>
            Cancel
          </Button>
        </div>
      ) : null}
      {err || loadErr ? (
        <p id={Dv} className="field-error" role="alert">
          {err || `Choices did not load: ${loadErr}`}
        </p>
      ) : null}
    </div>
  )
}
