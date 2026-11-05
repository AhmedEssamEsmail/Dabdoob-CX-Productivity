'use client'

import { useEffect, useState } from 'react'

/**
 * ee() — the global toast emitter — plus the `.toasts` live region it feeds.
 * Any code can call `toast('Saved', 'ok')`; toasts expire after 4 s.
 */

export interface ToastItem {
  id: number
  text: string
  tone: string
}

type ToastListener = (item: ToastItem) => void

let listener: ToastListener | null = null // it
let nextId = 0 // _a

/** ee() */
export function toast(text: string, tone = 'ok'): void {
  listener?.({ id: ++nextId, text, tone })
}

export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    listener = (item) => {
      setItems((current) => [...current, item])
      setTimeout(
        () => setItems((current) => current.filter((t) => t.id !== item.id)),
        4e3
      )
    }
    return () => {
      listener = null
    }
  }, [])

  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((item) => (
        <div className={`toast toast-${item.tone}`} key={item.id}>
          {item.text}
        </div>
      ))}
    </div>
  )
}
