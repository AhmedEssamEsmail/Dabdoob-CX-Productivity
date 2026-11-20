import { expect, test, type Page } from '@playwright/test'
import { E2E_USERS, login } from './users'

/** Regression for PLAN nav-scroll-top: rail navigation must land at scrollY=0. */
const NAV_LINK = '.nav a[href^="/"]'

async function bootReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await expect(page.locator('.rail')).toBeVisible({ timeout: 30000 })
  await expect(page.locator(NAV_LINK).first()).toBeAttached({ timeout: 30000 })
}

async function expandAllGroups(page: Page): Promise<void> {
  const closed = page.locator('.nav-group-label[aria-expanded="false"]')
  for (let i = 0; i < 12 && (await closed.count()) > 0; i++) await closed.first().click()
}

async function scrollBelowFold(page: Page): Promise<number> {
  const y = await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const y = Math.min(600, Math.max(0, max))
    window.scrollTo(0, y)
    return window.scrollY
  })
  expect(y, 'route is not tall enough to exercise window scroll').toBeGreaterThan(200)
  return y
}

async function navAndExpectTop(page: Page, href: string): Promise<void> {
  await page.locator(`.nav a[href="${href}"]`).click()
  await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 45000 })
  await expect
    .poll(() => page.evaluate(() => window.scrollY), {
      message: `rail navigation to ${href} did not reset window scroll`,
      timeout: 5000,
    })
    .toBe(0)
}

test.describe('nav rail scroll restoration', () => {
  test.setTimeout(180000)

  test('desktop rail links land at top', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await login(page, E2E_USERS.admin)
    await page.goto('/overview')
    await bootReady(page)
    await expandAllGroups(page)

    await scrollBelowFold(page)
    await navAndExpectTop(page, '/one-on-ones')
  })

  test('mobile rail links land at top', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await login(page, E2E_USERS.admin)
    await page.goto('/overview')
    await bootReady(page)
    await page.locator('.nav-toggle').click()
    await expect(page.locator('.shell.nav-open')).toBeVisible()
    await expandAllGroups(page)

    await scrollBelowFold(page)
    await navAndExpectTop(page, '/one-on-ones')
  })
})
