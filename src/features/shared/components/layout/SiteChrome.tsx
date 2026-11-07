'use client'

import type { ReactNode } from 'react'
import { Suspense, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import AppShell from '@/features/shared/components/shell/AppShell'
import HashShim from '@/features/shared/components/shell/HashShim'
import { applyAppearance, readAppearance } from '@/features/shared/shell/i18n'

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

  /* Auth screens bypass AppShell — apply the stored cx.appearance here so
     theme/accent/transparency still take effect (legacy ia(ca()) ran on every
     page load; AppShell does the same for app pages). */
  useEffect(() => {
    if (isAuthPage) applyAppearance(readAppearance())
  }, [isAuthPage])

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
