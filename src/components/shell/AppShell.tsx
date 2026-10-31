'use client'

import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  BootProvider,
  loadBootstrap,
  setBoot,
  shellApi,
  type Bootstrap,
} from '@/lib/shell/context'
import {
  applyAppearance,
  D,
  prefersReducedMotion,
  readAppearance,
  useLang,
} from '@/lib/shell/i18n'
import {
  appForGroup,
  appTitle,
  displayRole,
  groupEntryAllowed,
  groupEntryLink,
  inThisApp,
  pageAllowed,
  pageHref,
  resolveLink,
  WHO_ROLE_LABELS,
} from '@/lib/shell/gates'
import {
  APP_KEY,
  APP_TITLE,
  GROUP_DEFAULT_PAGE,
  GROUP_LABELS,
  GROUP_ORDER,
  GROUP_TONE,
  PAGES,
} from '@/components/shell/registry'
import NavIcon from '@/components/shell/NavIcon'
import ErrorBoundary from '@/components/shell/ErrorBoundary'
import { ViewAsBanner, ViewAsPicker } from '@/components/shell/ViewAs'
import Popups from '@/components/shell/Popups'

/**
 * ys — the application shell: brand + rail nav (with the sliding .nav-ind
 * indicator), who/collapse footer, view-as plumbing, popup/toast layers and
 * the boot/state screens. DOM, class names and aria attributes match the
 * legacy bundle 1:1.
 */

const RAIL_OFF_KEY = 'cx.rail-off' // On

/** _s() */
function readRailOff(): boolean {
  try {
    return localStorage.getItem(RAIL_OFF_KEY) === '1'
  } catch {
    return false
  }
}

/** vs() */
function writeRailOff(off: boolean): void {
  try {
    localStorage.setItem(RAIL_OFF_KEY, off ? '1' : '0')
  } catch {
    /* storage unavailable */
  }
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => unknown
}

/** normalize a Next pathname to a registry path (strip slashes + query). */
function routePath(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, '').split('?')[0]
}

export default function AppShell({ children }: { children?: ReactNode }) {
  const [boot, setBootState] = useState<Bootstrap | null>(null)
  const [bootError, setBootError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [railOff, setRailOff] = useState(readRailOff)
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const indRef = useRef<HTMLSpanElement>(null)
  const reposition = useRef<() => void>(() => {})
  useLang()

  const path = routePath(pathname)
  const route = PAGES.find((page) => page.path === path) ?? PAGES[0]

  /* xa() — reload when the view-as session changed elsewhere. */
  const viewAsTarget = boot?.viewAs?.canUse ? (boot.viewAs.target ?? null) : null
  useEffect(() => {
    if (viewAsTarget === null) return
    const check = () => {
      if (document.visibilityState === 'visible')
        shellApi.getViewAsState().then(
          (state) => {
            if (state.target !== viewAsTarget) location.reload()
          },
          () => {}
        )
    }
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [viewAsTarget])

  /* pn() — park the .nav-ind slider on the current link every render. */
  useLayoutEffect(() => {
    const update = () => {
      const nav = navRef.current
      const ind = indRef.current
      if (!nav || !ind) return
      const link = nav.querySelector<HTMLElement>('.nav-link[aria-current="page"]')
      ind.hidden = !link || !link.offsetParent
      if (!link || ind.hidden) return
      ind.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`
      ind.style.width = `${link.offsetWidth}px`
      ind.style.height = `${link.offsetHeight}px`
      ind.dataset.tone =
        link.closest('[data-tone]')?.getAttribute('data-tone') ?? 'work'
      if (!ind.dataset.ready) {
        void ind.offsetWidth
        ind.dataset.ready = 'true'
      }
    }
    reposition.current = update
    update()
  })

  useEffect(() => {
    const nav = navRef.current
    if (!nav || typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(() => reposition.current())
    observer.observe(nav)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!boot])

  /* entry animation budget: 'first' on load, 'calm' after the first nav. */
  const firstRoute = useRef(true)
  useEffect(() => {
    if (firstRoute.current) firstRoute.current = false
    else document.documentElement.dataset.entry = 'calm'
  }, [path])

  /* ia(ca()) — stored appearance holds from the first app paint. */
  useEffect(() => {
    applyAppearance(readAppearance())
  }, [])

  /* Bootstrap: __CC_BOOT__ or /api/bootstrap (fallback inside loadBootstrap). */
  useEffect(() => {
    loadBootstrap().then(
      (data) => {
        setBoot(data)
        setBootState(data)
      },
      (cause: unknown) =>
        setBootError(cause instanceof Error ? cause.message : String(cause))
    )
  }, [])

  /* Close the mobile nav whenever the route changes (adjust-during-render). */
  const [prevRoutePath, setPrevRoutePath] = useState(route.path)
  if (prevRoutePath !== route.path) {
    setPrevRoutePath(route.path)
    setNavOpen(false)
  }

  /* SPA navigation wrapped in a view transition when the browser allows it. */
  const navigate = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      event.preventDefault()
      const go = () => router.push(href)
      const doc = document as ViewTransitionDoc
      if (!doc.startViewTransition || document.hidden || prefersReducedMotion()) {
        go()
        return
      }
      doc.startViewTransition(go)
    },
    [router]
  )

  if (bootError) {
    return (
      <main className="state-screen">
        <h1>{D('{app} could not start', { app: APP_TITLE })}</h1>
        <p>{bootError}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => location.reload()}
        >
          {D('Reload')}
        </button>
      </main>
    )
  }
  if (!boot) return null

  const { user } = boot
  const viewingAs = !!boot.viewAs?.target

  if (user.role === 'unknown') {
    if (viewingAs) {
      return (
        <div className="viewing-as">
          <ViewAsBanner user={user} />
          <main className="state-screen">
            <h1>{D('{name} has no access', { name: user.name })}</h1>
            <p>
              {user.email} is not an active admin, team lead or agent on the
              roster, so {APP_TITLE} shows them nothing.
            </p>
          </main>
        </div>
      )
    }
    return (
      <main className="state-screen">
        <h1>{D('You are not set up yet')}</h1>
        <p>
          {D(
            'You are signed in as {email}, which is not on the CX roster. Ask the CX admin to add you, then reload this page.',
            { email: user.email }
          )}
        </p>
      </main>
    )
  }

  const visible = PAGES.filter((page) => pageAllowed(page, boot)).filter(inThisApp)
  const requested = path ? PAGES.find((page) => page.path === path) : undefined
  const fallback =
    visible.find((page) => page.path === 'my-day') ??
    visible.find((page) => page.path === 'overview') ??
    visible[0]
  const current = path && visible.includes(route) ? route : fallback
  const crossApp =
    requested && requested !== current && !inThisApp(requested) && groupEntryAllowed(requested, boot)
      ? requested
      : undefined
  const crossLink = crossApp ? resolveLink(`#/${crossApp.path}`) : null
  const deniedTitle = requested && requested !== current && !crossApp ? requested.title : ''
  const hubLink = resolveLink('#/overview', PAGES, false)
  const isAdmin = user.role === 'admin'

  const body = current ? (
    children
  ) : (
    <div className="state-screen">
      <h1>{D('Nothing in {app} for you yet', { app: APP_TITLE })}</h1>
      <p>
        {D('{app} has no page for your role. Everything else is in the Hub.', {
          app: APP_TITLE,
        })}
      </p>
      {hubLink.missing ? null : (
        <a className="btn btn-primary" href={hubLink.href} target="_top">
          {D('Open the Hub')}
        </a>
      )}
    </div>
  )

  return (
    <BootProvider value={boot}>
      <div
        className={`shell ${navOpen ? 'nav-open' : ''} ${railOff ? 'rail-off' : ''} ${
          viewingAs ? 'viewing-as' : ''
        }`}
      >
        <a className="skip" href="#main">
          {D('Skip to content')}
        </a>
        <aside className="rail">
          <div className="rail-head">
            <a
              className="brand"
              href={hubLink.missing ? pageHref('overview') : hubLink.href}
              target={hubLink.missing ? undefined : '_top'}
            >
              <span className="brand-mark" aria-hidden="true" />
              <span className="brand-name">{APP_TITLE}</span>
            </a>
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={navOpen}
              aria-controls="nav"
              onClick={() => setNavOpen((open) => !open)}
            >
              {D(navOpen ? 'Close' : 'Menu')}
            </button>
          </div>
          <nav id="nav" className="nav" aria-label={D('Main')} ref={navRef}>
            <span className="nav-ind" ref={indRef} aria-hidden="true" hidden />
            {GROUP_ORDER.map((group) => {
              /* Other apps: a single entry labelled with the group name that
                 opens that group's first visible page (internal here). */
              if (appForGroup(group) !== APP_KEY) {
                const link = groupEntryLink(group, PAGES, (page) =>
                  groupEntryAllowed(page, boot)
                )
                if (!link) return null
                const label = D(GROUP_LABELS[group])
                return (
                  <div
                    className="nav-group nav-group--app"
                    data-tone={GROUP_TONE[group]}
                    key={group}
                  >
                    <ul>
                      <li>
                        {link.missing ? (
                          <span
                            className="nav-link nav-link--off"
                            title={D(
                              isAdmin
                                ? '{app} is not connected yet. Add its web app URL in Admin, Connected apps.'
                                : '{app} is not connected yet. Ask the CX admin.',
                              { app: appTitle(group) }
                            )}
                          >
                            <NavIcon path={GROUP_DEFAULT_PAGE[group]} />
                            <span className="nav-text">{label}</span>
                            <span className="nav-ext-note">{D('not connected')}</span>
                          </span>
                        ) : (
                          <a
                            className="nav-link"
                            href={link.href}
                            target="_top"
                            title={D('Opens {name} in {app}', {
                              name: label,
                              app: appTitle(group),
                            })}
                          >
                            <NavIcon path={GROUP_DEFAULT_PAGE[group]} />
                            <span className="nav-text">{label}</span>
                            <svg
                              className="nav-ext"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                              focusable="false"
                            >
                              <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            </svg>
                            <span className="sr-only">
                              {D(' (opens in {app})', { app: appTitle(group) })}
                            </span>
                          </a>
                        )}
                      </li>
                    </ul>
                  </div>
                )
              }
              const items = visible.filter((page) => page.group === group)
              return items.length ? (
                <div className="nav-group" data-tone={GROUP_TONE[group]} key={group}>
                  <p className="nav-group-label">{D(GROUP_LABELS[group])}</p>
                  <ul>
                    {items.map((page) => (
                      <li key={page.path}>
                        <a
                          className="nav-link"
                          href={pageHref(page.path)}
                          aria-current={page.path === current?.path ? 'page' : undefined}
                          onClick={(event) => navigate(event, pageHref(page.path))}
                        >
                          <NavIcon path={page.path} />
                          <span className="nav-text">{D(page.title)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            })}
          </nav>
          {boot.viewAs?.canUse && !viewingAs ? (
            <div className="rail-va">
              <ViewAsPicker />
            </div>
          ) : null}
          <div className="rail-foot">
            <div className="rail-who">
              <p className="who">{user.name}</p>
              <p className="who-meta">
                {viewingAs
                  ? D('{role}, viewed by you', { role: displayRole(user) })
                  : D(WHO_ROLE_LABELS[user.role] ?? user.role)}
              </p>
            </div>
            <button
              type="button"
              className="rail-collapse"
              aria-label={D(railOff ? 'Show the menu' : 'Hide the menu')}
              aria-expanded={!railOff}
              aria-controls="nav"
              title={D(railOff ? 'Show the menu' : 'Hide the menu for more room')}
              onClick={() =>
                setRailOff((off) => {
                  writeRailOff(!off)
                  return !off
                })
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
          </div>
        </aside>
        <main id="main" className="main" tabIndex={-1}>
          {viewingAs ? <ViewAsBanner user={user} /> : null}
          {crossApp ? (
            <p className="cx-note" data-status="neutral" role="status">
              <span>
                {crossApp.title} is in {appTitle(crossApp.group)}.{' '}
                {crossLink && !crossLink.missing ? (
                  <a href={crossLink.href} target="_top">
                    Open {crossApp.title}
                  </a>
                ) : (
                  'Ask the CX admin to connect it.'
                )}
              </span>
            </p>
          ) : null}
          {deniedTitle ? (
            <p className="cx-note" data-status="neutral" role="status">
              <span>
                {deniedTitle} is not available to you
                {current ? `, so you are on ${current.title}` : ''}. Ask the CX
                admin if you need it.
              </span>
            </p>
          ) : null}
          <ErrorBoundary title={current?.title ?? APP_TITLE} key={current?.path ?? 'none'}>
            {body}
          </ErrorBoundary>
        </main>
        <Popups popups={boot.popups} />
      </div>
    </BootProvider>
  )
}
