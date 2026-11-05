import type { ReactNode } from 'react'
import type { RouteDef } from '@/features/shared/components/shell/registry'

/**
 * The full-area screens the shell swaps in: boot failure, no access, and
 * empty app — all `.state-screen` — plus hs(), the unbuilt-page placeholder.
 */

export default function StateScreen({
  as: Tag = 'main',
  children,
}: {
  as?: 'main' | 'div'
  children?: ReactNode
}) {
  return <Tag className="state-screen">{children}</Tag>
}

/** hs — the placeholder shown for registry pages not built yet. */
export function UnbuiltPage({
  route,
  narrow,
  children,
}: {
  route: RouteDef
  narrow?: boolean
  children?: ReactNode
}) {
  return (
    <section className={narrow ? 'page page-narrow' : 'page'} aria-labelledby="page-title">
      <header className="page-head">
        <h1 id="page-title" className="page-title">
          {route.title}
        </h1>
        <p className="page-purpose">{route.purpose}</p>
      </header>
      <div className="pending">
        <p className="pending-line">
          Not built yet.
          {route.reqs.length
            ? ` Covers requirement${route.reqs.length > 1 ? 's' : ''} ${route.reqs.join(', ')} in the brief.`
            : ''}
        </p>
      </div>
      {children}
    </section>
  )
}
