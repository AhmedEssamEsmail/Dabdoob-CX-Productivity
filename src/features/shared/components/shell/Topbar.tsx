'use client'

/**
 * ys — the .topbar row every shell page renders inside <main>: crumbs on
 * the left ("Group / Page", or just the page on overview), and the
 * notification bell + appearance toggle + user avatar on the right.
 * DOM and classes match mockups/assets/mock.css 1:1.
 */

import { D } from '@/features/shared/shell/i18n'

type Props = {
  crumbGroup: string | null
  crumbTitle: string
  initials: string
  pending: number
  onBell: () => void
  onAppearance: () => void
  theme: string
}

export default function Topbar({
  crumbGroup,
  initials,
  pending,
  onBell,
  onAppearance,
  theme,
}: Props) {
  const notifLabel =
    pending > 0
      ? D('Notifications — {n} pending', { n: String(pending) })
      : D('Notifications')
  const notifStatus =
    pending > 0
      ? D(pending === 1 ? '{n} notification pending' : '{n} notifications pending', {
          n: String(pending),
        })
      : ''
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbGroup ? <b>{crumbGroup}</b> : null}
      </div>
      <div className="topbar-right">
        <button
          type="button"
          className="icon-btn"
          aria-label={notifLabel}
          title={notifLabel}
          onClick={onBell}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0" />
          </svg>
          {pending > 0 ? (
            <span className="dot" aria-hidden="true">
              {pending > 99 ? '99+' : pending}
            </span>
          ) : null}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {notifStatus}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={D('Appearance')}
          title={D('Appearance — {theme}', { theme })}
          onClick={onAppearance}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>
        <div className="avatar" aria-hidden="true">
          {initials}
        </div>
      </div>
    </div>
  )
}
