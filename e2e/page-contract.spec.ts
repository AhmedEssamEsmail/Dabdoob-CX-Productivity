import { expect, test, type Page } from '@playwright/test'
import { ROUTES } from './routes'
import { E2E_USERS, login } from './users'

/**
 * PLAN C1 — page contract. One test per live route per width (375 / 1024):
 *  1. no horizontal scroll (re-asserted after the primary-action click)
 *  2. toolbar stability — .page-head .page-actions box must not move when its
 *     first button (primary action) flips status text
 *  3. zero console errors (CONSOLE_ALLOWLIST filters known dev/auth noise)
 *  4. every input/select/textarea and button has an accessible name
 *
 * Routes come from e2e/routes.ts at spec-load time — a new page.tsx is
 * covered automatically. Role-denied routes may render an error state
 * instead of the page; that is a finding, not a test bug, so no URL assert.
 */

const WIDTHS = [375, 1024] as const

/**
 * Routes whose server data path is heavy enough that a remote login + route
 * ready-wait can outrun even the raised base budget under fullyParallel load
 * (S06 — e2e-contract-green). Everything is remote-auth (login() per test);
 * these get the top budget.
 */
const SLOW_DATA = new Set([
  '/scheduler',
  '/status-validation',
  '/tl-performance',
  '/tl-tasks',
  '/tph',
  '/tph-grid',
  '/trackers',
])

/** Known-benign console noise (exact-ish patterns; tune in P3-C1-03 only). */
const CONSOLE_ALLOWLIST: RegExp[] = [
  /favicon/,
  /devtools/i,
  /Hydration/i,
  /supabase.*(token|refresh)/i,
  // WebKit-on-Windows/Playwright env quirk: same-origin localhost fetches
  // (incl. Next dev internals) fail engine-level access-control checks.
  // Verdict + evidence: specs/e2e-contract-green/results/S05.md.
  /Fetch API cannot load .*localhost:3000.* due to access control checks/,
]

/**
 * Generic ready-wait: best-effort network idle, then all aria-busy regions
 * settle. networkidle is capped — under fullyParallel dev-server load it can
 * never settle (S06); the aria-busy gate is the real settle check.
 */
async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
}

/** documentElement overflow past the viewport in px (<=0 means no h-scroll). */
const hScrollPx = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

/** Controls lacking an accessible name; returns offender outerHTMLs. */
function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const labelledByText = (el: Element): string => {
      const ids = el.getAttribute('aria-labelledby')
      if (!ids) return ''
      return ids
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim()
    }
    const offenders: string[] = []
    for (const el of document.querySelectorAll(
      'input:not([type=hidden]), select, textarea'
    )) {
      const named =
        (el.getAttribute('aria-label') ?? '').trim() !== '' ||
        labelledByText(el) !== '' ||
        ((el as HTMLInputElement).labels?.length ?? 0) > 0 ||
        el.closest('label') !== null ||
        (el.getAttribute('title') ?? '').trim() !== ''
      if (!named) offenders.push(el.outerHTML)
    }
    for (const el of document.querySelectorAll('button')) {
      const named =
        (el.textContent ?? '').trim() !== '' ||
        (el.getAttribute('aria-label') ?? '').trim() !== '' ||
        labelledByText(el) !== '' ||
        (el.getAttribute('title') ?? '').trim() !== ''
      if (!named) offenders.push(el.outerHTML)
    }
    return offenders
  })
}

for (const r of ROUTES) {
  for (const w of WIDTHS) {
    test(`${r.path} contract @${w}px`, async ({ page }) => {
      // login() retries + remote ready-wait under load exceed 45s (S06);
      // heavy-data routes get the top budget.
      test.setTimeout(SLOW_DATA.has(r.path) ? 150000 : 90000)
      await page.setViewportSize({ width: w, height: 720 })

      await login(page, E2E_USERS[r.user])

      // Collect console/pageerror from the route's load onward (login noise
      // is out of scope — P3-C1-03 tunes the allowlist).
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })
      page.on('pageerror', (err) => consoleErrors.push(String(err)))

      // domcontentloaded, not 'load': subresource waits (fonts/chunks) queue
      // unboundedly under dev-server load — ready() covers settling (S06).
      await page.goto(r.path, { waitUntil: 'domcontentloaded' })
      await ready(page)

      // 1. no horizontal scroll
      expect(await hScrollPx(page), `h-scroll on ${r.path} @${w}px`).toBeLessThanOrEqual(0)

      // 2. toolbar stability: primary-action click must not move the box
      const actions = page.locator('.page-head .page-actions')
      const primary = actions.locator('button').first()
      if (r.skipToolbar || !(await actions.count()) || !(await primary.count())) {
        test.info().annotations.push({
          type: 'toolbar-skip',
          description: `${r.path}: ${r.note ?? 'no .page-head .page-actions button'}`,
        })
      } else {
        const before = await actions.boundingBox()
        await primary.click()
        await page.waitForTimeout(400) // status-text swap settles
        const after = await actions.boundingBox()
        if (!before || !after) {
          test.info().annotations.push({
            type: 'toolbar-skip',
            description: `${r.path}: .page-actions not visible`,
          })
        } else {
          expect(
            Math.abs(after.x - before.x),
            `.page-actions x moved on ${r.path}`
          ).toBeLessThanOrEqual(1)
          expect(
            Math.abs(after.y - before.y),
            `.page-actions y moved on ${r.path}`
          ).toBeLessThanOrEqual(1)
        }
        // clicking must not introduce h-scroll either
        expect(
          await hScrollPx(page),
          `h-scroll after primary click on ${r.path} @${w}px`
        ).toBeLessThanOrEqual(0)
      }

      // 3. zero console errors (allowlist filtered)
      const offenders = consoleErrors.filter(
        (t) => !CONSOLE_ALLOWLIST.some((re) => re.test(t))
      )
      expect(
        offenders,
        `console errors on ${r.path}:\n${offenders.slice(0, 5).join('\n')}`
      ).toEqual([])

      // 4. accessible names on every control
      const unnamed = await unnamedControls(page)
      expect(
        unnamed,
        `${unnamed.length} unnamed control(s) on ${r.path} @${w}px; first 5:\n` +
          unnamed.slice(0, 5).join('\n')
      ).toEqual([])
    })
  }
}
