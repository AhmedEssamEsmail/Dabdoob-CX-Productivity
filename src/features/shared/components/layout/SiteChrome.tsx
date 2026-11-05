'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import HashShim from '@/components/shell/HashShim'

/**
 * The page chrome: the ported legacy application shell (rail, nav, footer,
 * popups/toasts) around the routed page. Auth screens render bare like the
 * legacy state screens.
 *
 * `usePathname()` reads a runtime-only value, so under Cache Components it must
 * sit behind a <Suspense> boundary — otherwise prerendering aborts. The boundary
 * wraps the whole shell: the app is behind auth, so there is no meaningful
 * static shell to emit anyway, and the boot splash covers the stream-in.
 */
export default function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <SiteChromeBody>{children}</SiteChromeBody>
    </Suspense>
  )
}

function SiteChromeBody({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth/')

  if (isAuthPage) {
    return (
      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>
    )
  }

  return (
    <>
      <HashShim />
      <AppShell>{children}</AppShell>
    </>
  )
}
