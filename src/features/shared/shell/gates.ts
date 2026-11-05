import {
  APPS,
  APP_KEY,
  PAGES,
  type RouteDef,
} from '@/components/shell/registry'
import { getBoot, type Bootstrap, type ShellUser } from '@/lib/shell/context'

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

/** lt() — page belongs to this app. */
export const inThisApp = (route: RouteDef): boolean => appForGroup(route.group) === APP_KEY

/** Te() — the app title for a page/group. */
export const appTitle = (routeOrGroup: RouteDef | string): string =>
  APPS[appForGroup(typeof routeOrGroup === 'string' ? routeOrGroup : routeOrGroup.group)].title

export interface ResolvedLink {
  href: string
  external: boolean
  missing: boolean
}

/** aa() — the other app's web URL from the bootstrap. */
function appUrl(app: string): string {
  return getBoot()?.appUrls?.[app] ?? ''
}

/**
 * we() — resolve a `#/path[?query]` link. Pages in this app become internal
 * `/path` routes; pages in another app become that app's web URL with
 * `?page=path` (the legacy `external:true` branch — "not connected" when the
 * bootstrap has no URL for the app).
 */
export function resolveLink(
  href: string,
  pages: RouteDef[] = PAGES,
  withQuery = true
): ResolvedLink {
  const match = /^#\/?([^?]*)(?:\?(.*))?$/.exec(href)
  const route = match ? pages.find((page) => page.path === match[1]) : undefined
  if (!match || !route) return { href, external: false, missing: false }
  if (inThisApp(route)) {
    return {
      href: `/${route.path}${withQuery && match[2] ? `?${match[2]}` : ''}`,
      external: false,
      missing: false,
    }
  }
  const base = appUrl(appForGroup(route.group))
  if (!base) return { href: '', external: true, missing: true }
  if (!withQuery) return { href: base, external: true, missing: false }
  const query = new URLSearchParams(match[2] ?? '')
  query.set('page', match[1] as string)
  return { href: `${base}?${query.toString()}`, external: true, missing: false }
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
