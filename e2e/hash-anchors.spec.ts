import { expect, test, type Page } from '@playwright/test'
import { login } from './users'

/**
 * REGRESSION — SettingsToc pills are in-page anchors, not routes.
 * HashShim rewrote any `#id` matching /^#?[a-z0-9-]+$/ into a route nav, so
 * clicking an admin section pill landed on `/<id>` → catch-all → `/`
 * (reported as a bounce to /overview?from=admin). Only registry paths may
 * rewrite now — `dropdown-choices` & friends are not registry paths, while
 * legacy `#/path` deep links keep working.
 */

const SECTIONS = ['dropdown-choices', 'reminders', 'appearance', 'settings'] as const

/** Generic ready-wait: network idle, then all aria-busy regions settle. */
async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
}

test('admin section pills scroll in place — no route bounce', async ({ page }) => {
  await login(page)
  await page.goto('/admin')
  await ready(page)

  for (const id of SECTIONS) {
    const link = page.locator(`nav.cx-toc[aria-label="Admin sections"] a[href="#${id}"]`)
    await expect(link).toBeVisible()
    await link.click()
    // The buggy bounce was async (hashchange → router.replace → catch-all
    // redirect). Give it a beat to fire, then settle any in-flight nav.
    await page.waitForTimeout(1200)
    await page.waitForLoadState('networkidle')
    const url = new URL(page.url())
    expect(url.pathname, `clicking #${id} navigated away from /admin`).toBe('/admin')
    expect(url.hash).toBe(`#${id}`)
    await expect(page.locator(`section#${id}`)).toBeInViewport()
  }
})

test('legacy #/path and ?page= deep links still rewrite to their route', async ({ page }) => {
  await login(page)

  await page.goto('/#/aging')
  await expect
    .poll(() => new URL(page.url()).pathname, { message: '#/aging did not rewrite to /aging' })
    .toBe('/aging')

  await page.goto('/?page=aging')
  await expect
    .poll(() => new URL(page.url()).pathname, { message: '?page=aging did not rewrite to /aging' })
    .toBe('/aging')
})
