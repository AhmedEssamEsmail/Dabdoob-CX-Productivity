/**
 * Regression test — overview-single-refresh (specs/overview-single-refresh/reports/debug-1.md)
 *
 * Bug: /overview rendered two identical RefreshNow (Hf) controls for admin/TL —
 * one in PageShell `actions` (header, overview-page.tsx:451) and one inside
 * Mu's "Queues now" section head (overview-page.tsx:280). Both are the same Hf
 * -> RefreshButton -> POST /api/queue/refresh.
 *
 * Contract after the fix: exactly one `<Hf` in the file, living in
 * OverviewPage's header actions; the "Queues now" head keeps only the Freshdesk
 * freshness hint (xg) and no refresh control, while the header button's onDone
 * also signals Mu to reload /api/queue/health.
 *
 * FAILS until the Mu-side `<Hf onDone={t} />` is removed.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const src = readFileSync(
  path.join(root, 'src/features/cx-hub/components/overview-page.tsx'),
  'utf8'
)

describe('overview single refresh control', () => {
  it('the page source renders exactly one <Hf (RefreshNow)', () => {
    const count = (src.match(/<Hf[\s/>]/g) ?? []).length
    expect(count).toBe(1)
  })

  it('the "Queues now" section head carries only the freshness hint, no <Hf', () => {
    const at = src.indexOf('id="board-h"')
    expect(at, 'could not locate the Queues now heading').toBeGreaterThan(-1)
    // the section-head hint (xg + any control) sits right after the h2
    const head = src.slice(at, at + 800)
    expect(head).not.toContain('<Hf')
  })
})
