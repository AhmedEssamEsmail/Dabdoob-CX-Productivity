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
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  BootProvider,
  loadBootstrap,
  setBoot,
  shellApi,
  type Bootstrap,
} from '@/features/shared/shell/context'
import {
  applyAppearance,
  D,
  prefersReducedMotion,
  readAppearance,
  useLang,
} from '@/features/shared/shell/i18n'
import {
  appForGroup,
  appTitle,
  displayRole,
  groupEntryAllowed,
  groupEntryLink,
  inApp,
  pageAllowed,
  pageHref,
  resolveLink,
  WHO_ROLE_LABELS,
} from '@/features/shared/shell/gates'
import {
  GROUP_DEFAULT_PAGE,
  GROUP_LABELS,
  GROUP_ORDER,
  GROUP_TONE,
  PAGES,
} from '@/features/shared/components/shell/registry'
import NavIcon from '@/features/shared/components/shell/NavIcon'
import ErrorBoundary from '@/features/shared/components/shell/ErrorBoundary'
import { Button } from '@/features/shared/components/ui'
import { ViewAsBanner, ViewAsPicker } from '@/features/shared/components/shell/ViewAs'
import Popups from '@/features/shared/components/shell/Popups'
import CommandPalette from '@/features/shared/components/shell/CommandPalette'

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
  const [paletteOpen, setPaletteOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const navRef = useRef<HTMLElement>(null)
  const indRef = useRef<HTMLSpanElement>(null)
  const railSearchRef = useRef<HTMLButtonElement>(null)
  const reposition = useRef<() => void>(() => {})
  useLang()

  const path = routePath(pathname)
  const route = PAGES.find((page) => page.path === path) ?? PAGES[0]
  /* The app context follows the current route's group: a Quality page renders
     the rail, brand and title of the legacy Quality app; a Hub page renders
     the Hub's. Unknown (non-registry) paths default to the hub context. */
  const ctxApp = appForGroup(route.group)
  const ctxTitle = appTitle(ctxApp)

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'k') return
      const target = event.target
      if (target instanceof HTMLElement) {
        const editable =
          target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'
        if (editable && !target.classList.contains('cpk-input')) return
      }
      event.preventDefault()
      setPaletteOpen((open) => !open)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  /* Legacy k/A/V: a requested page that cannot render in this app (external
     or not permitted) redirects to the fallback page, carrying ?from=<path>
     so the cx-note can render above it. */
  useEffect(() => {
    if (!boot) return
    const req = PAGES.find((page) => page.path === (path || 'overview'))
    if (!req) return
    const vis = PAGES.filter((page) => pageAllowed(page, boot)).filter((page) =>
      inApp(page, ctxApp)
    )
    const fb =
      vis.find((page) => page.path === 'my-day') ??
      vis.find((page) => page.path === 'overview') ??
      vis[0]
    const cur = vis.includes(req) ? req : fb
    if (!cur || req === cur) return
    const query = new URLSearchParams(searchParams.toString())
    query.set('from', req.path)
    router.replace(`/${cur.path}?${query.toString()}`)
  }, [path, boot, router, searchParams, ctxApp])

  /* The document title is the app title of the context, as in each legacy app. */
  useEffect(() => {
    document.title = ctxTitle
  }, [ctxTitle])

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
    setPaletteOpen(false)
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
        <h1>{D('{app} could not start', { app: ctxTitle })}</h1>
        <p>{bootError}</p>
        {/* kept raw: legacy .btn contract */}
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
  const whoParts = user.name.trim().split(/\s+/).filter(Boolean)
  const initials = (
    (whoParts[0]?.[0] ?? '') +
    (whoParts.length > 1 ? whoParts[whoParts.length - 1][0] : '')
  ).toUpperCase()

  if (user.role === 'unknown') {
    if (viewingAs) {
      return (
        <div className="viewing-as">
          <ViewAsBanner user={user} />
          <main className="state-screen">
            <h1>{D('{name} has no access', { name: user.name })}</h1>
            <p>
              {user.email} is not an active admin, team lead or agent on the
              roster, so {ctxTitle} shows them nothing.
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

  /* Legacy n1: the ecosystem page renders bare — no rail, banner or popups. */
  if (path === 'ecosystem') {
    return <BootProvider value={boot}>{children}</BootProvider>
  }

  const visible = PAGES.filter((page) => pageAllowed(page, boot)).filter((page) =>
    inApp(page, ctxApp)
  )
  /* Legacy hash router: 'requested' is the URL's page; an empty path has none —
     the fallback page renders at the root URL with no note and no redirect. */
  const requested = path
    ? PAGES.find((page) => page.path === path)
    : undefined
  const fallback =
    visible.find((page) => page.path === 'my-day') ??
    visible.find((page) => page.path === 'overview') ??
    visible[0]
  const current = path && visible.includes(route) ? route : fallback

  /* The cx-note's route: the requested page mid-redirect, else the ?from=
     carried on the fallback URL after it. */
  const noteRoute =
    requested && requested !== current
      ? requested
      : requested === current
        ? PAGES.find((page) => page.path === searchParams.get('from'))
        : undefined
  const note =
    noteRoute && noteRoute !== current
      ? !inApp(noteRoute, ctxApp) && groupEntryAllowed(noteRoute, boot)
        ? { kind: 'external' as const, route: noteRoute, link: resolveLink(`#/${noteRoute.path}`, PAGES, true, ctxApp) }
        : { kind: 'denied' as const, route: noteRoute }
      : undefined

  const hubLink = resolveLink('#/overview', PAGES, false)
  const isAdmin = user.role === 'admin'

  const body = !current ? (
    <div className="state-screen">
      <h1>{D('Nothing in {app} for you yet', { app: ctxTitle })}</h1>
      <p>
        {D('{app} has no page for your role. Everything else is in the Hub.', {
          app: ctxTitle,
        })}
      </p>
      {hubLink.missing ? null : (
        <a className="btn btn-primary" href={hubLink.href} target="_top">
          {D('Open the Hub')}
        </a>
      )}
    </div>
  ) : requested && requested !== current ? (
    /* Redirect to the fallback is in flight — render nothing rather than the
       catch-all's UnbuiltPage for a route this app does not serve. */
    <div className="page" />
  ) : (
    children
  )

  return (
    <BootProvider value={boot}>
      <div
        className={`shell ${navOpen ? 'nav-open' : ''} ${railOff ? 'rail-off' : ''} ${
          viewingAs ? 'viewing-as' : ''
        }`}
        data-app={ctxApp}
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
              <span className="brand-mark" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M5 19V9M10 19V5M15 19v-7M20 19v-3" />
                </svg>
              </span>
              <div>
                <div className="brand-name">Dabdoob CX</div>
                <div className="brand-sub">Operations console</div>
              </div>
            </a>
            <Button
              className="nav-toggle"
              aria-expanded={navOpen}
              aria-controls="nav"
              onClick={() => setNavOpen((open) => !open)}
            >
              {D(navOpen ? 'Close' : 'Menu')}
            </Button>
          </div>
          <button
            type="button"
            className="rail-search"
            ref={railSearchRef}
            aria-haspopup="dialog"
            aria-expanded={paletteOpen}
            onClick={() => setPaletteOpen(true)}
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            {D('Search or jump to…')}
            <kbd>⌘K</kbd>
          </button>
          <nav id="nav" className="nav" aria-label={D('Main')} ref={navRef}>
            <span className="nav-ind" ref={indRef} aria-hidden="true" hidden />
            {GROUP_ORDER.map((group) => {
              /* Other apps: a single entry labelled with the group name that
                 opens that group's first visible page (internal here). */
              if (appForGroup(group) !== ctxApp) {
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
            <div className="avatar" aria-hidden="true">
              {initials}
            </div>
            <div className="rail-who">
              <p className="who who-name">{user.name}</p>
              <p className="who-meta who-role">
                {viewingAs
                  ? D('{role}, viewed by you', { role: displayRole(user) })
                  : D(WHO_ROLE_LABELS[user.role] ?? user.role)}
              </p>
            </div>
            <Button
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
            </Button>
          </div>
        </aside>
        <main id="main" className="main" tabIndex={-1}>
          {viewingAs ? <ViewAsBanner user={user} /> : null}
          {note?.kind === 'external' ? (
            <p className="cx-note" data-status="neutral" role="status">
              <span>
                {note.route.title} is in {appTitle(note.route.group)}.{' '}
                {note.link && !note.link.missing ? (
                  <a href={note.link.href} target="_top">
                    Open {note.route.title}
                  </a>
                ) : (
                  'Ask the CX admin to connect it.'
                )}
              </span>
            </p>
          ) : null}
          {note?.kind === 'denied' ? (
            <p className="cx-note" data-status="neutral" role="status">
              <span>
                {note.route.title} is not available to you
                {current ? `, so you are on ${current.title}` : ''}. Ask the CX
                admin if you need it.
              </span>
            </p>
          ) : null}
          <ErrorBoundary title={current?.title ?? ctxTitle} key={current?.path ?? 'none'}>
            {body}
          </ErrorBoundary>
        </main>
        <Popups popups={boot.popups} />
        {paletteOpen ? (
          <CommandPalette
            boot={boot}
            ctxApp={ctxApp}
            onClose={() => {
              setPaletteOpen(false)
              railSearchRef.current?.focus()
            }}
          />
        ) : null}
      </div>
    </BootProvider>
  )
}
