import type { ReactNode } from 'react'
import type { RouteDef } from '@/features/shared/components/shell/registry'
import { D } from '@/features/shared/shell/i18n'

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
      <div className="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
          <path d="M22 4 12 14l-3-3" />
        </svg>
        <div className="t">{D('Not built yet')}</div>
        <div className="s">
          {route.reqs.length
            ? D('Covers requirement{s} {reqs} in the brief.', {
                s: route.reqs.length > 1 ? 's' : '',
                reqs: route.reqs.join(', '),
              })
            : D('This page is not built yet.')}
        </div>
      </div>
      {children}
    </section>
  )
}
