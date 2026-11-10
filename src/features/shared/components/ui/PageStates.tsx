'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'
import { Skeleton, LinesSkeleton } from '@/features/shared/components/shell/ui'

/* Kuwait date helpers are NOT re-implemented here: feature *-shared barrels
   delegate to shared/platform/time.ts. */

export { Skeleton, LinesSkeleton }

/** Failed — the canonical retry card (role=alert). Accepts both the
    {message, retry} and LoadError-style {message|error, onRetry} shapes. */
export function Failed({
  message,
  error,
  retry,
  onRetry,
}: {
  message?: string | null
  error?: string | null
  retry?: () => void
  onRetry?: () => void
}) {
  const text = message ?? error ?? ''
  const act = retry ?? onRetry
  return (
    <div className="cx-note" data-status="bad" role="alert">
      <div>
        <strong>This page could not load.</strong> {text}{' '}
        {act ? (
          <Button variant="quiet" onClick={act}>
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** ErrMsg — inline error line; renders nothing for empty messages. */
export function ErrMsg({ message }: { message?: string | null }) {
  return message ? (
    <p className="cx-error" role="alert">
      {message}
    </p>
  ) : null
}

const AR_NUM = '٠١٢٣٤٥٦٧٨٩'
function arDigits(s: string) {
  return typeof document !== 'undefined' && document.documentElement.lang !== 'ar'
    ? s
    : s.replace(/(\d)([.,])(?=\d)/g, (_m, d, sep) => d + (sep === '.' ? '٫' : '٬')).replace(/\d/g, (d) => AR_NUM[+d])
}

function reducedMotion() {
  return (
    (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
    (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-reduce-motion'))
  )
}

const NUM = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/
const fracDigits = (n: number) => Math.min(2, (String(n).split('.')[1] ?? '').length)

/** Count — the canonical count-up: counts to `value` (or `v`) the first time
    it is shown, honoring prefers-reduced-motion/data-reduce-motion and
    rendering Arabic-Indic digits in ar mode. `format` receives the animated
    number; `dur` overrides the default 900ms ramp. */
export function Count({
  v,
  value,
  dur = 900,
  format,
}: {
  v?: string | number | null
  value?: string | number | null
  dur?: number
  format?: (n: number) => string
}) {
  const raw = v !== undefined ? v : value
  const final = format && typeof raw === 'number' ? format(raw) : raw === null || raw === undefined ? '' : String(raw)
  const m = NUM.exec(final)
  const numeric =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : m
        ? Number(m[2] + m[3].replace(/,/g, '') + (m[4] ?? ''))
        : null
  const ref = useRef<HTMLSpanElement>(null)
  const [k, setK] = useState(1)
  useEffect(() => {
    if (numeric === null || numeric === 0 || reducedMotion()) return
    queueMicrotask(() => setK(0))
    const el = ref.current
    let raf = 0
    let timer = 0
    const start = () => {
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / dur)
        setK(p)
        if (p < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
      timer = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        setK(1)
      }, dur + 200)
    }
    const io =
      el && typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((es) => {
            if (es.some((e) => e.isIntersecting)) {
              io?.disconnect()
              start()
            }
          })
        : null
    if (io && el) io.observe(el)
    else if (typeof document === 'undefined' || !document.hidden) start()
    return () => {
      io?.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      setK(1)
    }
  }, [numeric, dur])
  const ease = 1 - (1 - k) ** 3
  let live = final
  if (numeric !== null && k < 1) {
    if (format && typeof raw === 'number') {
      live = format(Number((numeric * ease).toFixed(fracDigits(numeric))))
    } else if (m) {
      const dec = m[4] ? m[4].length - 1 : 0
      live = m[1] + (numeric * ease).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: m[3].includes(',') }) + m[5]
    }
  }
  return (
    <>
      <span ref={ref} aria-hidden="true">
        {arDigits(live)}
      </span>
      <span className="sr-only">{arDigits(final)}</span>
    </>
  )
}
