'use client'

import { type ReactNode, useId } from 'react'
import { Failed, LinesSkeleton } from './PageStates'

/** PageShell — the ONE page chrome: .page + .page-head with
 *  h1.page-title (unique id via useId) + p.page-purpose + aside slot.
 *  busy → LinesSkeleton, error → Failed (PageStates). */
export function PageShell({
  title,
  purpose,
  aside,
  busy,
  error,
  onRetry,
  id,
  className,
  children,
}: {
  title: ReactNode
  purpose?: ReactNode
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
  return (
    <section
      className={`page${className ? ` ${className}` : ''}`}
      aria-labelledby={headingId}
      aria-busy={busy}
    >
      <header className="page-head">
        <div>
          <h1 id={headingId} className="page-title">
            {title}
          </h1>
          {purpose ? <p className="page-purpose">{purpose}</p> : null}
        </div>
        {aside}
      </header>
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
