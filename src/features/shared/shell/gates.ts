import {
  APPS,
  PAGES,
  type RouteDef,
} from '@/features/shared/components/shell/registry'
import { type Bootstrap, type ShellUser } from '@/features/shared/shell/context'

/**
 * Role gates and link resolution ported from the legacy bundle:
 *   Ft/ba/fs role labels, bn() display role, us() owner check,
 *   En() per-page gate, Qt() gate with the no-quality-data shortcut,
 *   Me() group→app, lt() in-this-app, Te() app title,
 *   we()/ra() link resolution, jt() internal href.
 *
 * In this unified Next.js app every registry page routes internally, so
 * we() resolves `#/path` fragments to real `/path` hrefs instead of other
 * apps' web URLs; an unknown path is `missing`.
 */

/** Ft — full role labels used in the view-as picker. */
export const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  tl: 'Team lead',
  agent: 'Agent',
  specialist: 'Specialist',
}

/** ba — role labels including the no-access state. */
const ROLE_LABELS_SHORT: Record<string, string> = {
  admin: 'Admin',
  tl: 'Team lead',
  agent: 'Agent',
  unknown: 'No access',
}

/** fs — rail who-meta role labels. */
export const WHO_ROLE_LABELS: Record<string, string> = { ...ROLE_LABELS_SHORT }

/** bn() — the role shown next to a viewed-as user. */
export function displayRole(user: ShellUser): string {
  return user.specialist ? 'Specialist' : (ROLE_LABELS_SHORT[user.role] ?? user.role)
}

/** us() — isOwner gate for my-day/notes. */
export function isOwner(boot: Bootstrap): boolean {
  return boot.isOwner === true
}

/** En() — roles + the extra per-path gates. */
export function pageAllowed(route: RouteDef, boot: Bootstrap): boolean {
  const { user } = boot
  if (!route.roles.includes(user.role)) return false
  const auditor = !!boot.quality?.auditor
  switch (route.path) {
    case 'my-day':
    case 'notes':
      return isOwner(boot)
    case 'coaching':
      return user.role !== 'agent' || !!user.specialist
    case 'aging':
      return !user.specialist
    case 'audit-queue':
    case 'my-auditor-kpis':
      return auditor
    case 'my-audits':
      return !user.specialist
    case 'disputes':
      return true
    case 'calibration':
      return user.role !== 'agent' || auditor
    case 'kb-gaps':
      return user.role !== 'agent' || auditor || !!boot.quality?.kbEditor
    default:
      return true
  }
}

/** Qt() — when the boot has no quality block, role membership alone decides. */
export function groupEntryAllowed(route: RouteDef, boot: Bootstrap): boolean {
  return route.group === 'quality' && !boot.quality
    ? route.roles.includes(boot.user.role)
    : pageAllowed(route, boot)
}

/** Me() — which logical app owns a group. */
export function appForGroup(group: string): string {
  return Object.keys(APPS).find((key) => APPS[key].groups.includes(group)) ?? 'hub'
}

/**
 * lt() — page belongs to the given app context. In the unified deployment the
 * context is the current route's app (its group), so each page renders the
 * rail exactly as the legacy app that owned it did.
 */
export const inApp = (route: RouteDef, app: string): boolean => appForGroup(route.group) === app

/** Te() — the app title for a page/group. */
export const appTitle = (routeOrGroup: RouteDef | string): string =>
  APPS[appForGroup(typeof routeOrGroup === 'string' ? routeOrGroup : routeOrGroup.group)].title

export interface ResolvedLink {
  href: string
  external: boolean
  missing: boolean
}

/**
 * we() — resolve a `#/path[?query]` link. In the unified deployment every
 * registered page routes internally to `/path`. `external` marks a cross-app
 * target so callers can keep the external glyph/tooltip; `missing` only
 * occurs for paths no registry page owns.
 */
export function resolveLink(
  href: string,
  pages: RouteDef[] = PAGES,
  withQuery = true,
  ctxApp?: string
): ResolvedLink {
  const match = /^#\/?([^?]*)(?:\?(.*))?$/.exec(href)
  const route = match ? pages.find((page) => page.path === match[1]) : undefined
  if (!match || !route) return { href, external: false, missing: false }
  return {
    href: `/${route.path}${withQuery && match[2] ? `?${match[2]}` : ''}`,
    external: ctxApp !== undefined && !inApp(route, ctxApp),
    missing: false,
  }
}

/** ra() — a group's rail entry links to its first page the user may see. */
export function groupEntryLink(
  group: string,
  pages: RouteDef[] = PAGES,
  gate: (route: RouteDef) => boolean = () => true
): ResolvedLink | null {
  const route = pages.find((page) => page.group === group && gate(page))
  if (!route) return null
  const app = appForGroup(group)
  const withQuery = group !== 'hub' && APPS[app].groups.length > 1
  return resolveLink(`#/${route.path}`, pages, withQuery)
}

/** jt() — internal href for a page path. */
export const pageHref = (path: string): string => `/${path}`

/**
 * The ?params on the current URL. The HashShim rewrites '#/path?params' and
 * '?page=path&params' to '/path?params', so page params live in
 * location.search in the port (the legacy read them out of location.hash).
 * A '#/path?…' hash tail — when present — takes precedence: it is the newer,
 * pre-shim form of the link and the shim always consumes it (the tail only
 * coexists with stale search params during the hashchange window).
 */
export function pageParams(): URLSearchParams {
  if (typeof location === 'undefined') return new URLSearchParams()
  const i = location.hash.indexOf('?')
  const merged = new URLSearchParams(i === -1 ? '' : location.hash.slice(i + 1))
  new URLSearchParams(location.search).forEach((value, key) => {
    if (!merged.has(key)) merged.set(key, value)
  })
  return merged
}
