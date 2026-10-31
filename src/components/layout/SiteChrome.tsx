'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import SideRail from '@/components/layout/SideRail'
import TopBar from '@/components/layout/TopBar'

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth/')

  if (isAuthPage) {
    return (
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
    )
  }

  return (
    <>
      <TopBar />
      <div className="flex flex-1">
        <SideRail />
        <main
          id="main-content"
          className="flex-1 md:ml-(--cx-rail-width)"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </>
  )
}
