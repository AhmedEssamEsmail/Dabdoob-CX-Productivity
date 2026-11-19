'use client'

import { type ReactNode, useId } from 'react'
import { Failed, LinesSkeleton } from './PageStates'

/** PageShell — the ONE page chrome: .page + .page-head with
 *  h1.page-title (unique id via useId) + p.page-purpose + action/bar/stats slots.
 *  busy → LinesSkeleton, error → Failed (PageStates).
 *  `purpose`/`aside` are kept as back-compat aliases (`sub` wins over
 *  `purpose`; `actions` is wrapped in .page-actions, `aside` renders bare). */
export function PageShell({
  title,
  kicker,
  sub,
  purpose,
  actions,
  toolbar,
  status,
  stats,
  aside,
  busy,
  error,
  onRetry,
  id,
  className,
  children,
}: {
  title: ReactNode
  kicker?: ReactNode
  sub?: ReactNode
  purpose?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
  status?: ReactNode
  stats?: ReactNode
  aside?: ReactNode
  busy?: boolean
  error?: string | null
  onRetry?: () => void
  id?: string
  className?: string
  children?: ReactNode
}) {
  const generatedId = useId()
  const headingId = id ?? generatedId
  const purposeText = sub ?? purpose
  return (
    <section
      className={`page${className ? ` ${className}` : ''}`}
      aria-labelledby={headingId}
      aria-busy={busy}
    >
      <header className="page-head">
        <div>
          {kicker ? <p className="kicker">{kicker}</p> : null}
          <h1 id={headingId} className="page-title">
            {title}
          </h1>
          {purposeText ? <p className="page-purpose">{purposeText}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : aside}
      </header>
      {toolbar || status ? (
        <div className="page-bar">
          {toolbar ? <div className="page-bar__tools">{toolbar}</div> : null}
          {status ? <div className="page-bar__status">{status}</div> : null}
        </div>
      ) : null}
      {stats ? <div className="page-stats">{stats}</div> : null}
      {busy ? (
        <LinesSkeleton />
      ) : error ? (
        <Failed message={error} onRetry={onRetry} />
      ) : (
        children
      )}
    </section>
  )
}
