'use client'

import { useEffect, useRef, useState } from 'react'
import { alertsApi, type OneOnOneAlert } from '@/features/shared/shell/context'
import { resolveLink } from '@/features/shared/shell/gates'
import { kuwaitTime } from '@/features/shared/components/shell/ui'

/**
 * ga — the 1:1 reminder stack: merges `incoming` alerts (fed by Popups' one
 * merged poll), schedules 'soon' alerts to promote to 'start', chimes
 * (1318.5 → 987.8 Hz) once the user has interacted, and flashes the title
 * '1:1 now' while blocked.
 */

const SEEN_KEY = 'cx.oo-alerts-seen' // vn

function readSeen(): Record<string, number> {
  try {
    const stored = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')
    const cutoff = Date.now() - 24 * 36e5
    return Object.fromEntries(
      Object.entries<number>(stored).filter(([, ts]) => ts > cutoff)
    )
  } catch {
    return {}
  }
}

function writeSeen(seen: Record<string, number>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  } catch {
    /* storage unavailable */
  }
}

let audio: AudioContext | null = null

/** yn() — lazy AudioContext. */
function audioContext(): AudioContext | null {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!audio && Ctor) audio = new Ctor()
  } catch {
    audio = null
  }
  return audio
}

/** wn() — the two-tone chime; false when the context is still blocked. */
export function chime(): boolean {
  const ctx = audioContext()
  if (!ctx || ctx.state !== 'running') return false
  const start = ctx.currentTime + 0.02
  ;[
    [1318.5, 0],
    [987.8, 0.28],
  ].forEach(([frequency, offset]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(1e-4, start + offset)
    gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(1e-4, start + offset + 0.9)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start + offset)
    osc.stop(start + offset + 1)
  })
  return true
}

/** fa() — a 'soon' alert's key becomes its 'start' twin's key. */
const startKey = (key: string) => key.replace(/^oosoon\|/, 'oostart|')

export default function OneOnOneAlerts({ incoming }: { incoming: OneOnOneAlert[] }) {
  const [alerts, setAlerts] = useState<OneOnOneAlert[]>([])
  const [sound, setSound] = useState<'blocked' | 'on'>('blocked')
  const [flash, setFlash] = useState(false)
  const timers = useRef(new Map<string, number>())
  const chimed = useRef(new Set<string>())

  /* h() — merge a poll result, scheduling 'soon' keys to promote at start. */
  const merge = useRef<(incoming: OneOnOneAlert[]) => void>(() => {})
  useEffect(() => {
    merge.current = (incoming: OneOnOneAlert[]) => {
    const seen = readSeen()
    setAlerts((current) => {
      const have = new Set(current.map((a) => a.key))
      const fresh = incoming.filter((a) => !seen[a.key] && !have.has(a.key))
      const started = new Set(
        fresh.filter((a) => a.type === 'start').map((a) => a.scheduleId)
      )
      return [
        ...current.filter(
          (a) => !(a.type === 'soon' && started.has(a.scheduleId))
        ),
        ...fresh,
      ]
    })
    incoming
      .filter((a) => a.type === 'soon')
      .forEach((a) => {
        const key = startKey(a.key)
        if (timers.current.has(key) || readSeen()[key]) return
        const wait = Date.parse(a.startAt) - Date.now()
        if (wait < 0 || wait > 20 * 6e4) return
        timers.current.set(
          key,
          window.setTimeout(
            () => merge.current([{ ...a, key, type: 'start' }]),
            wait
          )
        )
      })
    }
  }, [])

  /* Merge each incoming poll payload; clear scheduled promotions on unmount. */
  useEffect(() => merge.current(incoming), [incoming])
  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current.clear()
    },
    []
  )

  /* Unlock audio on first interaction so the chime can play. */
  useEffect(() => {
    const unlock = () => {
      const ctx = audioContext()
      if (ctx)
        void ctx.resume().then(() => setSound(ctx.state === 'running' ? 'on' : 'blocked'))
    }
    window.addEventListener('pointerdown', unlock, { capture: true })
    window.addEventListener('keydown', unlock, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      window.removeEventListener('keydown', unlock, { capture: true })
    }
  }, [])

  /* Chime once per 'start' alert; if blocked, flash the title instead. */
  useEffect(() => {
    const fresh = alerts.filter((a) => a.type === 'start' && !chimed.current.has(a.key))
    if (!fresh.length) return
    fresh.forEach((a) => chimed.current.add(a.key))
    if (!chime()) setTimeout(() => setFlash(true), 0)
  }, [alerts])

  const anyStart = alerts.some((a) => a.type === 'start')
  useEffect(() => {
    if (!flash || !anyStart) {
      if (!anyStart) setTimeout(() => setFlash(false), 0)
      return
    }
    const original = document.title
    let tick = false
    const interval = window.setInterval(() => {
      tick = !tick
      document.title = tick ? '1:1 now' : original
    }, 1e3)
    return () => {
      window.clearInterval(interval)
      document.title = original
    }
  }, [flash, anyStart])

  const dismiss = (alert: OneOnOneAlert) => {
    const seen = readSeen()
    // eslint-disable-next-line react-hooks/purity -- event handler: wall-clock timestamp is the point
    seen[alert.key] = Date.now()
    if (alert.type === 'start')
      // eslint-disable-next-line react-hooks/purity -- ditto
      seen[alert.key.replace(/^oostart\|/, 'oosoon|')] = Date.now()
    writeSeen(seen)
    setAlerts((current) => current.filter((a) => a.key !== alert.key))
    alertsApi.oneOnOneAlertsSeen([alert.key]).catch(() => {})
  }

  if (!alerts.length) return null
  return (
    <div className="oo-alerts" aria-label="1:1 reminders">
      {alerts.map((alert) => {
        const link = alert.link ? resolveLink(alert.link) : null
        return (
          <section
            className="oo-alert"
            data-type={alert.type}
            role={alert.type === 'start' ? 'alert' : 'status'}
            aria-live="assertive"
            key={alert.key}
          >
            <p className="oo-alert-when">
              {alert.type === 'start'
                ? 'Starting now'
                : // eslint-disable-next-line react-hooks/purity -- countdown text is relative to render time by design
                  `In ${Math.max(1, Math.round((Date.parse(alert.startAt) - Date.now()) / 6e4))} min`}
            </p>
            <h2 className="oo-alert-title">1:1 with {alert.withName}</h2>
            <p className="oo-alert-text">
              {kuwaitTime(alert.startAt)} Kuwait, {alert.durationMin} min.{' '}
              {alert.holder
                ? 'Open actions from earlier 1:1s come first.'
                : 'Bring where your open actions stand.'}
            </p>
            <div className="oo-alert-actions">
              {link && !link.missing ? (
                <a
                  className="btn btn-primary btn-small"
                  href={link.href}
                  target={link.external ? '_top' : undefined}
                  onClick={() => dismiss(alert)}
                >
                  Open the 1:1
                </a>
              ) : null}
              {/* kept raw: legacy .btn contract */}
              <button
                type="button"
                className="btn btn-quiet btn-small"
                onClick={() => dismiss(alert)}
              >
                Dismiss
              </button>
              <span className="oo-alert-sound">
                {sound === 'on'
                  ? 'Sound on'
                  : 'Sound off: click anywhere in the app to allow it'}
              </span>
            </div>
          </section>
        )
      })}
    </div>
  )
}
