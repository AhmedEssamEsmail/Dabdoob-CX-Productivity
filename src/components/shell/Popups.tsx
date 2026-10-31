'use client'

import { useEffect, useRef, useState } from 'react'
import { alertsApi, type ShellPopup } from '@/lib/shell/context'
import { resolveLink } from '@/lib/shell/gates'
import { timeAgo } from '@/components/shell/ui'
import OneOnOneAlerts, { chime } from '@/components/shell/OneOnOneAlerts'
import { Toasts } from '@/components/shell/Toasts'

/**
 * ya — reminder popup dialog + the 1:1 alert stack + the toast region.
 * Polls /api/popups every 60 s while visible; newly seen popups chime or
 * flash the title ('New: <title>') when audio is still blocked.
 */

const POLL_MS = 6e4 // Bt

export default function Popups({ popups: initial }: { popups: ShellPopup[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [polled, setPolled] = useState<ShellPopup[] | null>(null)
  const seen = useRef(new Set(initial.map((p) => p.id)))
  const popups = polled ?? initial

  useEffect(() => {
    let dead = false
    let timer = 0
    const poll = async () => {
      if (dead) return
      if (document.visibilityState === 'visible') {
        try {
          const data = await alertsApi.popupsPoll()
          if (dead) return
          const fresh = data.popups.filter((p) => !seen.current.has(p.id))
          data.popups.forEach((p) => seen.current.add(p.id))
          setPolled(data.popups)
          if (fresh.length && !chime()) {
            const original = document.title
            let tick = 0
            const interval = window.setInterval(() => {
              document.title = tick++ % 2 ? original : `New: ${fresh[0].title}`
              if (tick > 10) {
                window.clearInterval(interval)
                document.title = original
              }
            }, 1e3)
          }
        } catch {
          /* endpoint may not exist yet */
        }
      }
      timer = window.setTimeout(poll, POLL_MS)
    }
    timer = window.setTimeout(poll, POLL_MS)
    return () => {
      dead = true
      window.clearTimeout(timer)
    }
  }, [])

  const dialogRef = useRef<HTMLDialogElement>(null)
  const current = popups.find((p) => !dismissed.has(p.id))
  const remaining = popups.filter((p) => !dismissed.has(p.id)).length
  const link = current?.link ? resolveLink(current.link) : null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (current && !dialog.open) dialog.showModal()
    if (!current && dialog.open) dialog.close()
  }, [current])

  const later = () =>
    current && setDismissed((set) => new Set(set).add(current.id))

  return (
    <>
      <dialog
        ref={dialogRef}
        className="popup"
        aria-labelledby="popup-title"
        onCancel={(event) => {
          event.preventDefault()
          later()
        }}
      >
        {current ? (
          <div className="popup-body">
            <p className="popup-kicker">
              {remaining > 1 ? `1 of ${remaining} reminders` : 'Reminder'}
              {current.createdAt ? ` — raised ${timeAgo(current.createdAt)}` : ''}
            </p>
            <h2 id="popup-title" className="popup-title">
              {current.title}
            </h2>
            <p className="popup-text">{current.body}</p>
            <p className="popup-note">
              This comes back each time you open the tool until it is resolved.
            </p>
            <div className="popup-actions">
              {link && !link.missing ? (
                <a
                  className="btn btn-primary"
                  href={link.href}
                  target={link.external ? '_top' : undefined}
                  onClick={() => later()}
                >
                  {current.kind.startsWith('qa_') ? 'Open' : 'Log it now'}
                </a>
              ) : null}
              <button type="button" className="btn btn-quiet" onClick={later}>
                Later
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
      <OneOnOneAlerts />
      <Toasts />
    </>
  )
}
