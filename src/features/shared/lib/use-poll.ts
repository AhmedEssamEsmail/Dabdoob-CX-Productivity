'use client'
/* --- usePoll — the one scheduler for all timers (S02-04) --------------
 * setInterval that pauses while `document.hidden` (visibilitychange
 * listener), refires when the tab returns, and always clears its interval
 * on unmount. `fn` is read through a ref so a changing callback identity
 * never restarts the timer. `ms: null`/`<= 0` = idle. `immediate` (default
 * true) fires once on mount instead of waiting the first interval.
 */

import { useEffect, useRef } from 'react'

export function usePoll(
  ms: number | null,
  fn: () => void | Promise<void>,
  opts?: { immediate?: boolean },
): void {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })
  const immediate = opts?.immediate !== false

  useEffect(() => {
    if (ms === null || ms <= 0) return
    const tick = () => {
      void fnRef.current()
    }
    let timer: ReturnType<typeof setInterval> | undefined
    const start = () => {
      if (timer === undefined) timer = setInterval(tick, ms)
    }
    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }
    const onVisibility = () => (document.hidden ? stop() : start())
    if (immediate) tick()
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [ms, immediate])
}
