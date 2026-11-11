'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { D } from '@/features/shared/shell/i18n'

/**
 * ee() — the global toast emitter — plus the `.toasts` live region it feeds.
 * Any code can call `toast('Saved', 'ok')`; toasts expire after 4 s unless the
 * pointer or focus is inside them (error toasts persist until dismissed).
 */

export type ToastTone = 'ok' | 'info' | 'warn' | 'error'

export interface ToastItem {
  id: number
  text: string
  tone: ToastTone
}

type ToastListener = (item: ToastItem) => void

const TOAST_MS = 4e3

let listener: ToastListener | null = null // it
let nextId = 0 // _a

function normalizeTone(tone: string): ToastTone {
  if (tone === 'warn') return 'warn'
  if (tone === 'error' || tone === 'bad') return 'error'
  if (tone === 'info') return 'info'
  return 'ok'
}

/** ee() */
export function toast(text: string, tone = 'ok'): void {
  listener?.({ id: ++nextId, text, tone: normalizeTone(tone) })
}

function Toast({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remainingRef = useRef(TOAST_MS)
  const startedAtRef = useRef(0)
  const doneRef = useRef(onDone)
  const sticky = item.tone === 'error'

  useEffect(() => {
    doneRef.current = onDone
  }, [onDone])

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const arm = (ms: number) => {
    clearTimer()
    startedAtRef.current = Date.now()
    timerRef.current = setTimeout(() => doneRef.current(item.id), ms)
  }

  const pause = () => {
    if (sticky || timerRef.current === null) return
    clearTimer()
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current))
  }

  const resume = () => {
    if (sticky) return
    if (remainingRef.current <= 0) doneRef.current(item.id)
    else arm(remainingRef.current)
  }

  useEffect(() => {
    if (!sticky) arm(TOAST_MS)
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="toast"
      data-tone={item.tone}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <span className="toast-text">{item.text}</span>
      {/* intentionally raw: toast chrome; bespoke .toast-dismiss styling */}
      <button
        type="button"
        className="toast-dismiss"
        aria-label={D('Dismiss')}
        onClick={() => doneRef.current(item.id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    listener = (item) => {
      setItems((current) => [...current, item])
    }
    return () => {
      listener = null
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id))
  }, [])

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <Toast item={item} key={item.id} onDone={dismiss} />
      ))}
    </div>
  )
}
