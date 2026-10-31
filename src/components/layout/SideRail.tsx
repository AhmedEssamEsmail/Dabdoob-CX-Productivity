'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function SideRail() {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/status-validation', label: 'Status Validation', icon: '✓' },
    { href: '/my-status', label: 'My Status', icon: '👤' },
    { href: '/auth/logout', label: 'Logout', icon: '🚪' },
  ]

  return (
    <aside
      className={`
        fixed left-0 top-[var(--cx-topbar-height)] h-[calc(100vh-var(--cx-topbar-height))]
        bg-white border-r border-gray-200 transition-all duration-300 z-40
        ${isCollapsed ? 'w-16' : 'w-[var(--cx-rail-width)]'}
        md:relative md:translate-x-0
        ${isCollapsed ? '-translate-x-full' : 'translate-x-0'}
      `}
    >
      <div className="p-[var(--cx-space-4)]">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full p-[var(--cx-space-2)] rounded-[var(--cx-radius-control)] hover:bg-gray-100 md:hidden"
          aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {isCollapsed ? '☰' : '✕'}
        </button>
      </div>

      <nav className="p-[var(--cx-space-4)] space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex items-center gap-3 p-[var(--cx-space-3)] rounded-[var(--cx-radius-control)]
              hover:bg-[var(--cx-accent-soft)] text-[var(--cx-text-primary)] transition-colors
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <span className="text-xl">{item.icon}</span>
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
