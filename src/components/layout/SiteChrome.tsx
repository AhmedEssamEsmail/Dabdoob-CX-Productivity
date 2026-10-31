'use client'

import type { ReactNode } from 'react'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import SideRail from '@/components/layout/SideRail'

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth/')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  if (isAuthPage) {
    return (
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
    )
  }

  return (
    <div className={`legacy-shell${collapsed ? ' legacy-shell--collapsed' : ''}`}>
      <SideRail
        pathname={pathname}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onToggleMobile={() => setMobileOpen((value) => !value)}
      />
      <main id="main-content" className="legacy-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  )
}
