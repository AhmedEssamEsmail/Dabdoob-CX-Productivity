'use client'

import Link from 'next/link'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type NavIconName =
  | 'home'
  | 'quality'
  | 'status'
  | 'analytics'
  | 'tph'
  | 'queue'
  | 'people'
  | 'operations'
  | 'desk'
  | 'fcr'
  | 'admin'
  | 'roster'

type NavItem = {
  href: string | null
  label: string
  icon: NavIconName
}

const appLinks: NavItem[] = [
  { href: '/', label: 'Hub', icon: 'home' },
  { href: null, label: 'Quality', icon: 'quality' },
  { href: null, label: 'Queue & Workforce', icon: 'queue' },
  { href: null, label: 'People & Performance', icon: 'people' },
  { href: null, label: 'Operations & Trackers', icon: 'operations' },
  { href: null, label: 'TL desk', icon: 'desk' },
  { href: null, label: 'FCR', icon: 'fcr' },
]

const iconTones: Record<NavIconName, string> = {
  home: 'work',
  quality: 'quality',
  status: 'work',
  analytics: 'work',
  tph: 'work',
  queue: 'team',
  people: 'team',
  operations: 'system',
  desk: 'team',
  fcr: 'quality',
  admin: 'system',
  roster: 'system',
}

const navGroups: { label: string; tone: string; items: NavItem[] }[] = [
  {
    label: 'Productivity',
    tone: 'work',
    items: [
      { href: '/status-validation', label: 'Status validation', icon: 'status' },
      { href: null, label: 'Productivity analytics', icon: 'analytics' },
      { href: '/my-status', label: 'My status', icon: 'people' },
      { href: '/tph-grid', label: 'TPH and caps', icon: 'tph' },
    ],
  },
  {
    label: 'Admin',
    tone: 'system',
    items: [
      { href: '/admin/config', label: 'Config', icon: 'admin' },
      { href: '/admin/roster', label: 'Roster', icon: 'roster' },
    ],
  },
]

function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
    quality: 'm12 3 2.3 5 5.5.7-4 3.8 1 5.5-4.8-2.7-4.8 2.7 1-5.5-4-3.8 5.5-.7L12 3Z',
    status: 'M12 3v3m0 12v3M3 12h3m12 0h3m-3.6-6.4 2.1-2.1M5.5 18.5l2.1-2.1m8.8 0 2.1 2.1M5.5 5.5l2.1 2.1M15.5 8.5 10 14l-2.5-2.5',
    analytics: 'M4 19V5m0 14h16M7 15l4-4 3 2 5-6',
    tph: 'M4 5h16M4 12h16M4 19h16M8 3v4m8-4v4M8 10v4m8-4v4M8 17v4m8-4v4',
    queue: 'M4 6h16M4 12h10M4 18h16m-3-9 3 3-3 3',
    people: 'M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20m7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.7a4 4 0 0 1 0 7.4m2 3h.5a4.5 4.5 0 0 1 4.5 4.5V20',
    operations: 'M4 5h16v14H4zM8 9h8m-8 4h5m-5 3h8',
    desk: 'M3 19V9l9-6 9 6v10M8 19v-6h8v6m-5-7h2',
    fcr: 'M12 3v4m0 10v4M3 12h4m10 0h4m-3.6-5.6 2.8-2.8M5.8 18.2l2.8-2.8m6.8 0 2.8 2.8M5.8 5.8l2.8 2.8',
    admin: 'M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4',
    roster: 'M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 2 18.5V20m7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-6h6m-3-3v6',
  }

  return (
    <svg className="legacy-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} />
    </svg>
  )
}

function Item({
  item,
  tone,
  collapsed,
  active = false,
  onNavigate,
}: {
  item: NavItem
  tone: string
  collapsed: boolean
  active?: boolean
  onNavigate: () => void
}) {
  const content = (
    <>
      <NavIcon name={item.icon} />
      <span className="legacy-nav-text">{item.label}</span>
    </>
  )

  if (!item.href) {
    return (
      <span
        className="legacy-nav-link legacy-nav-link--off"
        data-tone={tone}
        aria-disabled="true"
        title={`${item.label} is not available in this app yet`}
      >
        {content}
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      className="legacy-nav-link"
      data-tone={tone}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
    >
      {content}
    </Link>
  )
}

export default function SideRail({
  pathname,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onToggleMobile,
}: {
  pathname: string
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapse: () => void
  onToggleMobile: () => void
}) {
  const closeMobileMenu = () => {
    if (mobileOpen) onToggleMobile()
  }

  return (
    <aside
      className={`legacy-rail${collapsed ? ' legacy-rail--collapsed' : ''}${mobileOpen ? ' legacy-rail--mobile-open' : ''}`}
    >
      <div className="legacy-rail__head">
        <Link href="/" className="legacy-brand" onClick={closeMobileMenu}>
          <span className="legacy-brand__mark" aria-hidden="true" />
          <span className="legacy-brand__name">CX Helm Productivity</span>
        </Link>
        <button
          type="button"
          className="legacy-mobile-toggle"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={onToggleMobile}
        >
          <span aria-hidden="true">{mobileOpen ? '×' : '☰'}</span>
        </button>
      </div>

      <nav className="legacy-nav" aria-label="Main">
        <div className="legacy-nav__apps">
          {appLinks.map((item) => {
            const tone = iconTones[item.icon]

            return (
              <div key={item.label} className="legacy-nav__item" data-tone={tone}>
                <Item
                  item={item}
                  tone={tone}
                  collapsed={collapsed}
                  active={item.href === pathname}
                  onNavigate={closeMobileMenu}
                />
              </div>
            )
          })}
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="legacy-nav__group" data-tone={group.tone}>
            <p className="legacy-nav__label">{group.label}</p>
            {group.items.map((item) => {
              const isActive = item.href === pathname

              return (
                <div key={item.label} className="legacy-nav__item" data-tone={group.tone}>
                  {isActive && item.href ? (
                    <Link
                      href={item.href}
                      className="legacy-nav-link"
                      data-tone={group.tone}
                      aria-current="page"
                      onClick={closeMobileMenu}
                      title={collapsed ? item.label : undefined}
                    >
                      <NavIcon name={item.icon} />
                      <span className="legacy-nav-text">{item.label}</span>
                    </Link>
                  ) : (
                    <Item
                      item={item}
                      tone={group.tone}
                      collapsed={collapsed}
                      onNavigate={closeMobileMenu}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="legacy-rail__foot">
        <div className="legacy-profile">
          <span className="legacy-profile__name">CX Helm team</span>
          <span className="legacy-profile__role">Productivity workspace</span>
        </div>
        <div className="legacy-rail__tools">
          <details className="legacy-preferences">
            <summary title="Appearance and language" aria-label="Appearance and language settings">
              <span aria-hidden="true">⋯</span>
            </summary>
            <div className="legacy-preferences__menu">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </details>
          <Link href="/auth/logout" className="legacy-signout" title="Sign out" aria-label="Sign out">
            <span aria-hidden="true">↗</span>
          </Link>
          <button
            type="button"
            className="legacy-collapse-toggle"
            aria-label={collapsed ? 'Show the menu' : 'Hide the menu'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
