import { expect, test, type Locator, type Page } from '@playwright/test'
import { E2E_USERS, login } from './users'

const NAV = '#nav'
const OPEN_SET_KEY = 'cx.nav-groups'

/** NAV-03: unified collapsible nav — toggle / persistence / SPA nav / mobile. */
test.describe('Unified collapsible nav', () => {
  // login + remote boot wait can exceed the 30s default under parallel load
  test.setTimeout(45000)

  async function bootedNav(page: Page): Promise<Locator> {
    // <=820px collapses the rail behind Menu — desktop viewport for nav tests.
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page, E2E_USERS.admin)
    const nav = page.locator(NAV)
    await expect(nav).toBeVisible({ timeout: 15000 })
    return nav
  }

  /** The .nav-group holding the current route's link. */
  const currentGroup = (page: Page): Locator =>
    page.locator(`${NAV} .nav-group`, {
      has: page.locator('.nav-link[aria-current="page"]'),
    })

  /** A group NOT holding the current page — admin always has several. */
  const otherGroup = (page: Page): Locator =>
    page
      .locator(`${NAV} .nav-group`, {
        hasNot: page.locator('.nav-link[aria-current="page"]'),
      })
      .first()

  /** Registry group key, read off the label's aria-controls="nav-items-<key>". */
  const groupKey = async (group: Locator): Promise<string> =>
    ((await group.locator('.nav-group-label').getAttribute('aria-controls')) ?? '').replace(
      'nav-items-',
      ''
    )

  const openSet = (page: Page): Promise<string[]> =>
    page.evaluate(
      (key) => JSON.parse(sessionStorage.getItem(key) ?? '[]') as string[],
      OPEN_SET_KEY
    )

  test('group headers toggle their submenus', async ({ page }) => {
    const nav = await bootedNav(page)
    const labels = nav.locator('.nav-group-label')
    expect(await labels.count()).toBeGreaterThan(1)
    for (const label of await labels.all())
      await expect(label).toHaveAttribute('aria-expanded', /^(true|false)$/)

    // The group holding the current route starts expanded.
    const cur = currentGroup(page)
    await expect(cur.locator('.nav-group-label')).toHaveAttribute('aria-expanded', 'true')
    await expect(cur.locator('ul')).toBeVisible()

    // Another group collapses (ul hidden + aria-expanded=false), then re-opens.
    const other = otherGroup(page)
    const label = other.locator('.nav-group-label')
    const list = other.locator('ul')
    if ((await label.getAttribute('aria-expanded')) === 'false') await label.click()
    await expect(label).toHaveAttribute('aria-expanded', 'true')
    await label.click()
    await expect(label).toHaveAttribute('aria-expanded', 'false')
    await expect(list).toBeHidden()
    await label.click()
    await expect(label).toHaveAttribute('aria-expanded', 'true')
    await expect(list).toBeVisible()
  })

  test('open-set persists in sessionStorage across client nav', async ({ page }) => {
    const nav = await bootedNav(page)
    const other = otherGroup(page)
    const label = other.locator('.nav-group-label')
    const collapsedKey = await groupKey(other)

    // Collapse a non-current group (open it first if the session started it shut).
    if ((await label.getAttribute('aria-expanded')) === 'false') await label.click()
    await label.click()
    await expect(label).toHaveAttribute('aria-expanded', 'false')
    expect(await openSet(page)).not.toContain(collapsedKey)

    // Client-nav via a visible link in an open group.
    const before = page.url()
    await nav.locator('.nav-link:visible:not([aria-current="page"])').first().click()
    await page.waitForURL((url) => url.href !== before)

    // The collapse survived the nav; the new route's group auto-expanded.
    const stored = await openSet(page)
    expect(stored).not.toContain(collapsedKey)
    const newCur = currentGroup(page)
    expect(stored).toContain(await groupKey(newCur))
    await expect(newCur.locator('.nav-group-label')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  test('nav links route client-side — no reload, no BootSplash', async ({ page }) => {
    await bootedNav(page)
    await page.evaluate(() => {
      ;(window as unknown as { __navStay: number }).__navStay = 1
    })

    // Open a different group so one of its links is clickable.
    const other = otherGroup(page)
    const label = other.locator('.nav-group-label')
    if ((await label.getAttribute('aria-expanded')) === 'false') await label.click()

    const before = page.url()
    await other.locator('.nav-link').first().click()
    await page.waitForURL((url) => url.href !== before)

    // A document reload would clear __navStay and re-show the boot splash.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __navStay?: number }).__navStay))
      .toBe(1)
    await expect(page.locator('.boot-splash')).toBeHidden()
    await expect(page.locator(`${NAV} .nav-link[aria-current="page"]`)).toHaveCount(1)
    await expect(page.locator('#main')).not.toBeEmpty()
  })

  test('mobile nav-open + group toggle still works at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const nav = page.locator(NAV)
    await login(page, E2E_USERS.admin)

    // <=820px: nav collapses behind the Menu toggle.
    await expect(nav).toBeHidden({ timeout: 15000 })
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await expect(nav).toBeVisible()
    await expect(page.locator('.shell')).toHaveClass(/nav-open/)

    // A group header still flips its submenu.
    const label = otherGroup(page).locator('.nav-group-label')
    const expanded = await label.getAttribute('aria-expanded')
    await label.click()
    await expect(label).toHaveAttribute(
      'aria-expanded',
      expanded === 'true' ? 'false' : 'true'
    )
  })
})
