'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/**
 * Shared pw-* primitives ported verbatim from the People closures:
 *   Z/Je/Y/G/F/V/ie/ne  — Kuwait (UTC+3) date helpers
 *   ee                  — useBusy (in-flight guard + error)
 *   q/z/Re/ot/rt        — pw-badge, pw-error, pw-skeleton, pw-late, page shell
 *   es                  — the pw-dialog delete/reason confirm dialog
 *   Ne                  — the dropdown "Other…" combo (getDropdownOptions/addDropdownOption)
 *   Wn/Ms/ln/Tt         — the tiny module store the combo caches options in
 *   Ie                  — oo-delta
 *   at                  — task normalizer (shared field shape)
 *   _e/Ot/Ds            — cross-app link resolver (appUrls from the boot)
 *   wt                  — hash ?param reader
 *   de                  — the toast emitter (re-exported)
 *   jt/st               — reduced-motion + the .is-in/.is-done entrance hook
 */
import { type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { fetchJson } from './shared'
import { toast } from '@/features/shared/components/shell/Toasts'
import { getBoot, useBootSelector } from '@/features/shared/shell/context'
import { PAGES, APPS } from '@/features/shared/components/shell/registry'
import { pageParams } from '@/features/shared/shell/gates'
import { prefersReducedMotion } from '@/features/shared/shell/i18n'
import { useEnterAnim } from '@/features/shared/components/shell/ui'
import { Button, Input, Select } from '@/features/shared/components/ui'

export { toast }
export { prefersReducedMotion, useEnterAnim }

/* ------------------------------------------------------------- dates */

const KW_OFF = 3 * 3600 * 1e3 // Zn
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] // bl
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] // fl

/** Z() — YYYY-MM-DD in Kuwait. Accepts iso string or epoch ms. */
export const kwDate = (t: string | number) => new Date(new Date(t).getTime() + KW_OFF).toISOString().slice(0, 10)
/** Je() — HH:MM in Kuwait. Accepts iso string or epoch ms. */
export const kwHm = (t: string | number) => new Date(new Date(t).getTime() + KW_OFF).toISOString().slice(11, 16)
/** Y() — today in Kuwait. */
export const today = () => kwDate(Date.now())
/** G(date, n) — a Kuwait date n days on. */
export const addDays = (t: string, n: number) => {
  const s = new Date(t + 'T00:00:00Z')
  s.setUTCDate(s.getUTCDate() + n)
  return s.toISOString().slice(0, 10)
}
/** F(iso|date) — "Sun 5 Jan". */
export const dayLabel = (t: string | null | undefined) => {
  if (!t) return ''
  const n = new Date(t.slice(0, 10) + 'T00:00:00Z')
  return `${DAY_NAMES[n.getUTCDay()]} ${n.getUTCDate()} ${MONTH_NAMES[n.getUTCMonth()]}`
}
/** V(iso) — "Sun 5 Jan, 14:30" Kuwait. */
export const dayTime = (t: string | null | undefined) => (t ? `${dayLabel(kwDate(t))}, ${kwHm(t)}` : '')
/** ie(iso) — the value a datetime-local input shows, Kuwait. */
export const inputDT = (t: string | number | null | undefined) => (t ? `${kwDate(t)}T${kwHm(t)}` : '')
/** ne(hours) — "1.5 h". */
export const hLabel = (t: number) => `${Math.round(t * 10) / 10} h`

/* --------------------------------------------------------- useBusy — ee() */

export function useBusy() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const run = useCallback(async (d: () => Promise<unknown>) => {
    if (inFlight.current) return undefined
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      return await d()
    } catch (r: any) {
      setError(r.message)
      return undefined
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }, [])
  return { busy, error, setError, run }
}

/* ------------------------------------------------- small pw widgets */

/** q() */
export function PwBadge({ tone, children }: { tone?: string; children?: ReactNode }) {
  return (
    <span className="pw-badge" data-tone={tone}>
      {children}
    </span>
  )
}

/** z() */
export function PwErr({ message }: { message?: string | null }) {
  return message ? (
    <p className="pw-error" role="alert">
      {message}
    </p>
  ) : null
}

/** Re() */
export function PwSkel({ lines = 5 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="pw-skeleton" style={{ width: `${90 - i * 9}%` }} />
      ))}
    </div>
  )
}

/** ot() — the pw-level load error with retry. */
export function PwLate({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="pw-panel pw-late" role="alert">
      <p>This page could not load: {message}</p>
      <div className="pw-actions-bar">
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

/** rt() — the pw page shell: .page(.page-narrow).pw-page + .page-head. */
export function PwShell({
  route,
  children,
  aside,
  narrow,
}: {
  route: { title: ReactNode; purpose?: ReactNode }
  children?: ReactNode
  aside?: ReactNode
  narrow?: boolean
}) {
  return (
    <section className={narrow ? 'page page-narrow pw-page' : 'page pw-page'} aria-labelledby="page-title">
      <header className="page-head">
        <h1 id="page-title" className="page-title">
          {route.title}
        </h1>
        <p className="page-purpose">{route.purpose}</p>
        {aside}
      </header>
      {children}
    </section>
  )
}

/** O() — Fragment passthrough. */
export const Frag = ({ children }: { children?: ReactNode }) => <>{children}</>

/**
 * routeOf(path, prop) — the registry RouteDef is the verbatim route object the
 * closures receive (it carries title + purpose). The page.tsx shims pass a
 * title-only stand-in, so the registry entry wins where it exists.
 */
export function routeOf(path: string, route?: { title?: ReactNode; purpose?: ReactNode }) {
  return { ...(route ?? {}), ...(PAGES.find((p) => p.path === path) ?? {}) } as {
    title: ReactNode
    purpose?: ReactNode
  }
}

/* ----------------------------------- be — the cross-page task draft
 * Notes "Make task" seeds it; TL tasks reads it once and clears it. */
export const taskDraft: { title?: string; description?: string } = {}

/* --------------------------------------------- wt() — hash ?param */

/** wt(name) — the ?param on the page URL ('#/path?…' in the legacy; the shim
 * moves it to location.search — pageParams reads both). */
export function hashParam(t: string): string {
  return pageParams().get(t) ?? ''
}

/* --------------------------------- the tiny options store — Wn/Ms/ln */

const storeSubs = new Set<() => void>() // Tt
let storeValues: Record<string, unknown> = {} // Xe

function storeGet(t: string) {
  return storeValues[t] // Ms
}

function storeSet(t: string, n: unknown) {
  // ln()
  storeValues = { ...storeValues, [t]: n }
  storeSubs.forEach((fn) => fn()) // Un()
}

/** Wn(selector, deps) — subscribe to a derived slice of the store. */
export function useStore<T>(selector: () => T, deps: unknown[] = []): T {
  const [value, setValue] = useState<T>(selector)
  useEffect(() => {
    const update = () => setValue(() => selector())
    storeSubs.add(update)
    update()
    return () => {
      storeSubs.delete(update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}

/* --------------------------------- the dropdown API facade — ve */

const dropdownCache = new Map<string, Promise<string[]>>() // vt

export const dropdownApi = {
  getDropdownOptions: (listKey: string) =>
    fetchJson('/api/options/' + encodeURIComponent(listKey)).then((r: any) => (Array.isArray(r) ? r : r?.options ?? [])) as Promise<string[]>,
  addDropdownOption: (listKey: string, value: string) =>
    fetchJson('/api/options/' + encodeURIComponent(listKey), { value }) as Promise<{ options: string[]; value: string }>,
}

const OTHER = '__other__' // gt

/** Ne() — the labelled select with an "Other… → add the choice" row. */
export function PwCombo({
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
  hint?: string
}) {
  const uid = useId()
  const options = useStore(() => storeGet(listKey) as string[] | undefined, [listKey])
  const [other, setOther] = useState(false)
  const [newChoice, setNewChoice] = useState('')
  const [adding, setAdding] = useState(false)
  const [addErr, setAddErr] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (options !== undefined) return
    let p = dropdownCache.get(listKey)
    if (!p) {
      p = dropdownApi.getDropdownOptions(listKey).then((list) => {
        storeSet(listKey, list)
        return list
      })
      dropdownCache.set(listKey, p)
      p.catch(() => dropdownCache.delete(listKey))
    }
    p.catch((e: any) => setLoadErr(e.message))
  }, [listKey, options])

  useEffect(() => {
    if (other) inputRef.current?.focus()
  }, [other])

  const list = options ?? []
  const shown = value && !list.includes(value) ? [value, ...list] : list

  function pick(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.currentTarget.value
    if (v === OTHER) {
      setOther(true)
      setAddErr('')
      return
    }
    setOther(false)
    onChange(v)
  }

  async function add() {
    if (adding) return
    setAdding(true)
    setAddErr('')
    try {
      const r = await dropdownApi.addDropdownOption(listKey, newChoice)
      storeSet(listKey, r.options)
      onChange(r.value)
      setOther(false)
      setNewChoice('')
    } catch (e: any) {
      setAddErr(e.message)
    } finally {
      setAdding(false)
    }
  }

  function cancel() {
    setOther(false)
    setNewChoice('')
    setAddErr('')
  }

  const hintId = hint ? `${uid}-hint` : undefined
  const errId = addErr || loadErr ? `${uid}-err` : undefined
  return (
    <div className="field">
      <label htmlFor={uid} className="field-label">
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <Select
        id={uid}
        className="select"
        value={other ? OTHER : value}
        onChange={pick}
        disabled={disabled || options === undefined}
        required={required}
        aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
      >
        <option value="" disabled={required}>
          {options === undefined ? 'Loading choices…' : placeholder}
        </option>
        {shown.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </Select>
      {hint ? (
        <p id={hintId} className="field-hint">
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
            value={newChoice}
            aria-label={`New choice for ${label}`}
            placeholder="Type the new choice"
            onInput={(e) => setNewChoice(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              } else if (e.key === 'Escape') {
                cancel()
              }
            }}
          />
          <Button variant="primary" onClick={add} disabled={adding || !newChoice.trim()}>
            {adding ? 'Adding…' : 'Add choice'}
          </Button>
          <Button variant="quiet" onClick={cancel} disabled={adding}>
            Cancel
          </Button>
        </div>
      ) : null}
      {addErr || loadErr ? (
        <p id={errId} className="field-error" role="alert">
          {addErr || `Choices did not load: ${loadErr}`}
        </p>
      ) : null}
    </div>
  )
}

/* --------------------------------------- es() — the pw-dialog */

export function PwDialog({
  title,
  lines,
  loading,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: ReactNode
  lines: string[]
  loading?: boolean
  confirmLabel: ReactNode
  onConfirm: (reason: string) => Promise<boolean | void>
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const [reason, setReason] = useState('')
  const busy = useBusy()
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])
  return (
    <dialog ref={ref} className="pw-dialog" aria-labelledby="pw-del-h" onCancel={onClose} onClose={onClose}>
      <h2 id="pw-del-h" className="pw-h2">
        {title}
      </h2>
      <p className="pw-sub">This is what happens:</p>
      {loading ? (
        <p className="pw-muted">Working out what goes with it…</p>
      ) : (
        <ul className="pw-del-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <label className="field">
        <span className="field-label">Reason (kept with the deleted record)</span>
        <Input
          className="input"
          value={reason}
          placeholder="For example: logged twice"
          onInput={(e) => setReason(e.currentTarget.value)}
        />
      </label>
      <PwErr message={busy.error} />
      <div className="pw-dialog-actions">
        <Button variant="quiet" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="danger"
          disabled={busy.busy || loading || !reason.trim()}
          onClick={() =>
            busy
              .run(() => onConfirm(reason.trim()))
              .then((r) => {
                if (r !== undefined) onClose()
              })
          }
        >
          {busy.busy ? 'Deleting…' : confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}

/* ------------------------------------------------ Ie() — oo-delta */

export function PwDelta({ now, before, unit = ' pts' }: { now: number | null; before: number | null; unit?: string }) {
  if (now === null || before === null) return null
  const d = Math.round((now - before) * 10) / 10
  if (d === 0) return <span className="oo-delta">no change</span>
  return (
    <span className="oo-delta" data-dir={d > 0 ? 'up' : 'down'}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d)}
      {unit}
    </span>
  )
}

/* --------------------------------------------- at() — task normalizer */

export function normTask(t: any) {
  const last = t.milestones?.length ? t.milestones[t.milestones.length - 1] : null
  return {
    actionId: t.actionId,
    title: t.title,
    description: t.description || '',
    ownerEmail: t.ownerEmail,
    status: t.status,
    priority: t.priority,
    startAt: t.startAt,
    deadlineAt: t.deadlineAt,
    estHours: t.estHours,
    freeHours: t.hours ? t.hours.free : null,
    fitStatus: t.fitStatus,
    percent: t.percent,
    progressState: t.progressState,
    ragSelf: t.ragSelf,
    blockedReason: t.blockedReason,
    overdue: t.overdue,
    riskReasons: t.riskReasons,
    expectation: t.expectation,
    lastUpdate: last
      ? { note: last.note, nextStep: last.nextStep, at: last.at, byName: last.byName }
      : null,
  }
}

/* ---------------------- cross-app link resolver — _e()/Ot()/Ds() */

const APP_KEY = 'people' // Wt

/** Ee(group) — which app a page group belongs to. */
function appForGroup(group: string): string {
  return Object.keys(APPS).find((key) => APPS[key].groups.includes(group)) ?? 'hub'
}

/** Ot(route) — same-app route. */
export const sameApp = (route: { group: string }) => appForGroup(route.group) === APP_KEY

/** Ds(appKey) — the deployed URL of another app, from the boot. */
export function useAppUrl(appKey: string): string {
  return useBootSelector(() => getBoot()?.appUrls?.[appKey] ?? '', [appKey])
}

export function appUrl(appKey: string, appUrls?: Record<string, string>): string {
  return appUrls?.[appKey] ?? ''
}

/**
 * _e(href, routes, withParams) — resolves a legacy #/path?params link.
 * Same-app links pass through untouched; cross-app links are rewritten onto
 * the target app's base URL with ?page=<path>.
 */
export function appLink(
  href: string,
  routes: { path: string; group: string }[] = PAGES,
  appUrls?: Record<string, string>,
  withParams = true,
): { href: string; external: boolean; missing: boolean } {
  const m = /^#\/?([^?]*)(?:\?(.*))?$/.exec(href)
  const route = m ? routes.find((r) => r.path === m[1]) : undefined
  if (!m || !route || sameApp(route)) return { href, external: false, missing: false }
  const base = appUrls?.[appForGroup(route.group)] ?? ''
  if (!base) return { href: '', external: true, missing: true }
  if (!withParams) return { href: base, external: true, missing: false }
  const params = new URLSearchParams(m[2] ?? '')
  params.set('page', m[1])
  return { href: `${base}?${params.toString()}`, external: true, missing: false }
}
