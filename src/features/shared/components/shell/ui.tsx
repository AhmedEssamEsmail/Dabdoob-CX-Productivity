'use client'

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { prefersReducedMotion } from '@/features/shared/shell/i18n'

/**
 * Shared UI primitives ported from the legacy bundle with exact classes:
 *   Wt → Skeleton, Mn → LinesSkeleton, Sn → LoadError, j → Section,
 *   Y → Chip, Pa → PageHead, plus xt() entrance animation and the
 *   qe/Oa section-fold memory, ot() stagger style, va() relative time,
 *   Qn() Kuwait time.
 */

const CHART_HEIGHTS = [55, 70, 48, 82, 64, 90, 58, 74, 40, 68, 86, 60, 52] // Ma
const ROW_WIDTHS = [78, 62, 90, 54, 70, 46, 84, 58, 66, 50] // Ut

/** Wt */
export function Skeleton({
  shape,
  n = 6,
}: {
  shape: 'tiles' | 'ladder' | 'chart' | 'rows'
  n?: number
}) {
  if (shape === 'tiles') {
    return (
      <div className="cc-skel__tiles" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span className="skeleton cc-skel__tile" key={i} />
        ))}
      </div>
    )
  }
  return (
    <div className="cx-panel cx-panel--pad cc-skel" aria-hidden="true">
      <span className="skeleton cc-skel__title" />
      {shape === 'ladder' ? <span className="skeleton cc-skel__ladder" /> : null}
      {shape === 'chart' ? (
        <div className="cc-skel__chart">
          {CHART_HEIGHTS.map((height, i) => (
            <span
              className="skeleton"
              style={{ blockSize: `${height}%` }}
              key={i}
            />
          ))}
        </div>
      ) : null}
      {shape === 'rows' || shape === 'ladder'
        ? Array.from({ length: n }, (_, i) => (
            <span className="cc-skel__row" key={i}>
              <span className="skeleton" />
              <span
                className="skeleton"
                style={{ inlineSize: `${ROW_WIDTHS[i % ROW_WIDTHS.length]}%` }}
              />
              <span className="skeleton" />
            </span>
          ))
        : null}
    </div>
  )
}

/** Mn */
export function LinesSkeleton({ lines = 3, tall = false }: { lines?: number; tall?: boolean }) {
  if (tall && lines <= 2) return <Skeleton shape="tiles" n={3} />
  return <Skeleton shape={tall ? 'ladder' : 'rows'} n={tall ? lines - 1 : lines} />
}

/** Sn */
export function LoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="cx-note" data-status="bad" role="alert">
      <div>
        <strong>This page could not load.</strong> {message}{' '}
        <button type="button" className="cx-btn cx-btn--quiet" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}

/* --- qe/Oa — section fold memory ------------------------------------- */

const FOLD_KEY = 'cx.sections-open' // Cn

let foldMemory: Record<string, boolean> = (() => {
  try {
    return JSON.parse(localStorage.getItem(FOLD_KEY) || '{}')
  } catch {
    return {}
  }
})()

function writeFold(id: string, open: boolean) {
  foldMemory = { ...foldMemory, [id]: open }
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify(foldMemory))
  } catch {
    /* storage unavailable */
  }
}

/** j */
export function Section({
  id,
  title,
  hint,
  children,
  collapsible,
  defaultOpen = true,
  summary,
  lead,
  forceOpen,
  unmount,
}: {
  id: string
  title: ReactNode
  hint?: ReactNode
  children?: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  summary?: ReactNode
  lead?: ReactNode
  forceOpen?: boolean
  unmount?: boolean
}) {
  const [open, setOpen] = useState(() => !!forceOpen || (foldMemory[id] ?? defaultOpen))
  const [wasForced, setWasForced] = useState(!!forceOpen)
  if (forceOpen && !wasForced) {
    setWasForced(true)
    setOpen(true)
  } else if (!forceOpen && wasForced) {
    setWasForced(false)
  }

  if (!collapsible) {
    return (
      <section className="cx-section" aria-labelledby={id}>
        <div className="cx-section__head">
          <h2 className="cx-section__title" id={id}>
            {title}
          </h2>
          {hint ? <span className="cx-section__hint">{hint}</span> : null}
        </div>
        {children}
      </section>
    )
  }

  return (
    <section className="cx-section" aria-labelledby={id}>
      <details
        className="cxp-fold"
        open={open}
        onToggle={(event) => {
          const next = event.currentTarget.open
          if (next !== open) {
            setOpen(next)
            writeFold(id, next)
          }
        }}
      >
        <summary className="cx-section__head cxp-fold__head">
          <h2 className="cx-section__title" id={id}>
            {title}
          </h2>
          {summary ? (
            <span className="cx-section__hint cxp-fold__sum">{summary}</span>
          ) : null}
        </summary>
        {open && hint ? <p className="cx-section__hint">{hint}</p> : null}
        {open ? lead : null}
        {open || !unmount ? children : null}
      </details>
      {open ? null : lead}
    </section>
  )
}

/** Y */
export function Chip({ status, children }: { status?: string; children?: ReactNode }) {
  return (
    <span className="cx-chip" data-status={status}>
      {children}
    </span>
  )
}

/** Pa */
export function PageHead({
  title,
  sub,
  aside,
}: {
  title: ReactNode
  sub?: ReactNode
  aside?: ReactNode
}) {
  return (
    <header className="dq-head">
      <div>
        <h1 id="page-title" className="page-title">
          {title}
        </h1>
        <p className="page-purpose">{sub}</p>
      </div>
      {aside ? <div className="dq-head__aside">{aside}</div> : null}
    </header>
  )
}

/* --- xt/ka — the one-shot entrance animation -------------------------- */

const ENTER_MS = 820 // ka

/** xt() — add .is-in then .is-done to the referenced element once. */
export function useEnterAnim(ref: RefObject<HTMLElement | null>): void {
  const stageRef = useRef(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (stageRef.current) {
      el.classList.add('is-in')
      if (stageRef.current === 2) el.classList.add('is-done')
      return
    }
    if (document.hidden || prefersReducedMotion()) {
      stageRef.current = 2
      el.classList.add('is-in', 'is-done')
      return
    }
    stageRef.current = 1
    requestAnimationFrame(() =>
      requestAnimationFrame(() => el.classList.add('is-in'))
    )
    setTimeout(() => {
      stageRef.current = 2
      el.classList.add('is-in', 'is-done')
    }, ENTER_MS)
  })
}

/** ot() — stagger index style. */
export const stagger = (i: number): CSSProperties =>
  ({ '--i': Math.min(i, 12) }) as CSSProperties

/** Ca() — chart tooltip: positioned .cc-tip inside a ref'd container.
 *  tipFor(text) returns the aria/pointer/focus handlers a hotspot needs. */
export function useTip<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  useEnterAnim(ref as RefObject<HTMLElement | null>)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  const show = (text: string) => (event: SyntheticEvent) => {
    const container = ref.current
    if (!container) return
    const target = event.currentTarget.getBoundingClientRect()
    const box = container.getBoundingClientRect()
    const x = Math.max(64, Math.min(box.width - 64, target.left + target.width / 2 - box.left))
    setTip({ text, x, y: Math.max(0, target.top - box.top) })
  }
  const hide = () => setTip(null)
  const tipFor = (text: string) => ({
    'aria-label': text,
    onPointerEnter: show(text),
    onFocus: show(text),
    onPointerLeave: hide,
    onBlur: hide,
  })
  const tipEl = tip ? (
    <span className="cc-tip" aria-hidden="true" style={{ left: `${tip.x}px`, top: `${tip.y}px` }}>
      {tip.text}
    </span>
  ) : null
  return { ref, tipFor, tipEl }
}

/** Sa() — "Same as prev" / "▲ +N% vs prev" / "▼ −N% vs prev". */
export function vsPrev(value: number | null, prev: number | null): string {
  if (value == null || prev == null || !prev) return ''
  const pct = Math.round(((value - prev) / Math.abs(prev)) * 100)
  return pct === 0 ? 'Same as prev' : `${pct > 0 ? '▲ +' : '▼ −'}${Math.abs(pct)}% vs prev`
}

/** Qn() — HH:MM in Kuwait (UTC+3). */
export const kuwaitTime = (iso: string): string =>
  new Date(new Date(iso).getTime() + 3 * 3600 * 1e3).toISOString().slice(11, 16)

/** va() — "just now" / "N h ago" / "yesterday" / "N days ago". */
export function timeAgo(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime()
  if (!isFinite(elapsed) || elapsed < 0) return ''
  const hours = Math.round(elapsed / 36e5)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
