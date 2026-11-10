'use client'

import { useEffect, useRef, useState } from 'react'
import {
  alertsApi,
  type OneOnOneAlert,
  type ShellPopup,
} from '@/features/shared/shell/context'
import { resolveLink } from '@/features/shared/shell/gates'
import { usePoll } from '@/features/shared/lib/use-poll'
import { useDialogModal } from '@/features/shared/lib/use-dialog-modal'
import { timeAgo } from '@/features/shared/components/shell/ui'
import { D } from '@/features/shared/shell/i18n'
import OneOnOneAlerts, { chime } from '@/features/shared/components/shell/OneOnOneAlerts'
import { Toasts } from '@/features/shared/components/shell/Toasts'

/**
 * ya — reminder popup dialog + the 1:1 alert stack + the toast region.
 * Polls /api/popups every 60 s while visible; newly seen popups chime or
 * flash the title ('New: <title>') when audio is still blocked.
 */

const POLL_MS = 6e4 // Bt

export default function Popups({
  popups: initial,
  reopenTick = 0,
  onPendingChange,
}: {
  popups: ShellPopup[]
  reopenTick?: number
  onPendingChange?: (n: number) => void
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [polled, setPolled] = useState<ShellPopup[] | null>(null)
  const [alerts, setAlerts] = useState<OneOnOneAlert[]>([])
  const seen = useRef(new Set(initial.map((p) => p.id)))
  const popups = polled ?? initial

  const poll = async () => {
    try {
      const data = await alertsApi.pollTick()
      const fresh = data.popups.filter((p) => !seen.current.has(p.id))
      data.popups.forEach((p) => seen.current.add(p.id))
      setPolled(data.popups)
      setAlerts(data.alerts)
      if (fresh.length && !chime()) {
        const original = document.title
        let tick = 0
        const interval = window.setInterval(() => {
          document.title = tick++ % 2 ? original : D('New: {title}', { title: fresh[0].title })
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

  /* __CC_BOOT__ already delivered popups — first refresh at the next
     POLL_MS boundary, then every POLL_MS while the tab is visible. */
  usePoll(POLL_MS, poll, { immediate: false })

  const current = popups.find((p) => !dismissed.has(p.id))
  const remaining = popups.filter((p) => !dismissed.has(p.id)).length
  const link = current?.link ? resolveLink(current.link) : null

  const later = () =>
    current && setDismissed((set) => new Set(set).add(current.id))

  /* Shared dialog lifecycle: showModal/close sync, ESC → dismiss, focus
     restore to the invoking element. */
  const { dialogRef, onCancel } = useDialogModal(!!current, later)

  /* Topbar bell: re-open the reminder dialog by clearing dismissals
     (adjust-during-render, same pattern as prevRoutePath). */
  const [prevReopenTick, setPrevReopenTick] = useState(reopenTick)
  if (prevReopenTick !== reopenTick) {
    setPrevReopenTick(reopenTick)
    setDismissed(new Set())
  }

  useEffect(() => {
    onPendingChange?.(remaining)
  }, [remaining, onPendingChange])

  return (
    <>
      <dialog
        ref={dialogRef}
        className="popup"
        aria-labelledby="popup-title"
        onCancel={onCancel}
      >
        {current ? (
          <div className="popup-body">
            <p className="popup-kicker">
              {remaining > 1
                ? D('1 of {n} reminders', { n: String(remaining) })
                : D('Reminder')}
              {current.createdAt
                ? ` — ${D('raised {ago}', { ago: timeAgo(current.createdAt) })}`
                : ''}
            </p>
            <h2 id="popup-title" className="popup-title">
              {current.title}
            </h2>
            <p className="popup-text">{current.body}</p>
            <p className="popup-note">
              {D('This comes back each time you open the tool until it is resolved.')}
            </p>
            <div className="popup-actions">
              {link && !link.missing ? (
                <a
                  className="btn btn-primary"
                  href={link.href}
                  target={link.external ? '_top' : undefined}
                  onClick={() => later()}
                >
                  {current.kind.startsWith('qa_') ? D('Open') : D('Log it now')}
                </a>
              ) : null}
              {/* kept raw: legacy .btn contract */}
              <button type="button" className="btn btn-quiet" onClick={later}>
                {D('Later')}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
      <OneOnOneAlerts incoming={alerts} />
      <Toasts />
    </>
  )
}
