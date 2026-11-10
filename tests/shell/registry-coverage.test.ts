import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { PAGES } from '@/features/shared/components/shell/registry'

/**
 * Route-coverage guard: every literal page.tsx route under src/app must resolve
 * to a real PAGES registry entry via the AppShell rule (exact match or deepest
 * parent prefix), never via the PAGES[0] fallback. Adding a page without a
 * registry-resolvable path fails this test.
 */

const APP_DIR = path.resolve(import.meta.dirname, '../../src/app')

function pageFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...pageFiles(full))
    else if (entry.name === 'page.tsx') out.push(full)
  }
  return out
}

function routePathFor(file: string): string {
  return path
    .relative(APP_DIR, file)
    .replace(/\\/g, '/')
    .replace(/(^|\/)page\.tsx$/, '')
    .replace(/^\/+|\/+$/g, '')
}

/** Same resolution rule as AppShell: exact match or longest parent prefix. */
function resolve(route: string) {
  return PAGES.filter(
    (page) => route === page.path || route.startsWith(page.path + '/')
  ).sort((a, b) => b.path.length - a.path.length)[0]
}

/* Routes that legitimately live outside the registry:
   - ''            root page renders the shell fallback (PAGES[0] context)
   - '[...slug]'   catch-all placeholder for unported registry paths
   - 'auth/*'      auth screens, no shell chrome
   - 'ecosystem'   special-cased standalone page in AppShell
   - 'tph-grid'    redirect-only page to /tph */
const SKIP = new Set(['', '[...slug]', 'ecosystem', 'tph-grid'])

describe('registry coverage', () => {
  const routes = pageFiles(APP_DIR)
    .map(routePathFor)
    .filter((route) => !route.startsWith('auth/') && !route.startsWith('api/'))
    .filter((route) => !SKIP.has(route))

  it('finds page routes', () => {
    expect(routes.length).toBeGreaterThan(0)
  })

  it('every page route resolves to a registry entry (no PAGES[0] fallback)', () => {
    const unresolved = routes.filter((route) => {
      const match = resolve(route)
      return !match
    })
    expect(
      unresolved,
      'routes with no registry entry: ' + unresolved.join(', ')
    ).toEqual([])
  })
})
