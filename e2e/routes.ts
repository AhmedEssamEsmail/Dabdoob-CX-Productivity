import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Runtime route inventory for the page-contract spec (PLAN C1). Built by
 * walking src/app at spec-load time — a new `src/app/**\/page.tsx` is covered
 * automatically, so a hardcoded list cannot silently exempt new pages.
 * Pure Node (no Playwright): loaded by page-contract.spec.ts and reusable by
 * any spec that needs the live route set. Same module-scope `node:fs` read
 * convention as e2e/aging-refresh-layout.spec.ts.
 */

/** One routable page: `path` is the URL, `user` the e2e/users.ts fixture role. */
export interface RouteEntry {
  path: string
  user: 'admin' | 'tl' | 'agent'
  skipToolbar?: boolean
  note?: string
}

/**
 * Segments with no contract to assert: the `[...slug]` catch-all renders a
 * placeholder for unbuilt registry paths (no canonical URL) and `auth/**` is
 * the unauthenticated login/logout flow the session gate redirects to.
 */
export const EXCLUDED = ['[...slug]', 'auth'] as const

const EXCLUDED_SET: ReadonlySet<string> = new Set(EXCLUDED)

/**
 * Routes whose role gate excludes the `admin` fixture — the registry roles
 * (src/features/shared/components/shell/registry.ts RouteDef.roles) and the
 * feature libs' requireRole lists agree: only the two agent-self pages.
 * Value = first fixture-compatible role (E2E_USERS keys only).
 */
export const ROLE_OVERRIDES: Record<string, RouteEntry['user']> = {
  '/my-audits': 'agent',
  '/my-status': 'agent',
}

/**
 * Per-route contract quirks (skip the toolbar assertion / record why).
 * Seeded empty — the first baseline run (P3-C1-03) tunes this map.
 */
export const QUIRKS: Record<string, { skipToolbar?: boolean; note?: string }> = {
  // "Add a KB update" intentionally unmounts .page-actions on click (opens the
  // inline KbForm — kb-tracker-page.tsx aside is null while `editing`), so the
  // box-stability assertion cannot apply. Recorded in the baseline.
  '/kb-tracker': {
    skipToolbar: true,
    note: 'primary action opens an inline edit form, unmounting .page-actions',
  },
}

/** Append the parent rel-path of every page.tsx under `dir` to `out`. */
function collectPages(dir: string, rel: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      collectPages(resolve(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name, out)
    } else if (entry.name === 'page.tsx') {
      out.push(rel)
    }
  }
}

/** Every src/app route minus EXCLUDED, sorted, with its fixture role applied. */
function buildRoutes(): RouteEntry[] {
  const rels: string[] = []
  collectPages(resolve('src/app'), '', rels)
  return rels
    .map((rel) => (rel === '' ? '/' : `/${rel}`))
    .filter((path) => !path.split('/').some((seg) => EXCLUDED_SET.has(seg)))
    .sort()
    .map((path) => ({ path, user: ROLE_OVERRIDES[path] ?? 'admin', ...QUIRKS[path] }))
}

export const ROUTES: RouteEntry[] = buildRoutes()
