import { expect, test, type Page } from '@playwright/test'
import { E2E_USERS, login } from '../../e2e/users'

/** S14-01 / SH-M5 — keyboard focus-model regressions on real routes. */
test.describe('a11y keyboard models', () => {
  // login + dev-compile + remote api waits can far exceed the 30s default
  test.setTimeout(90000)

  async function booted(page: Page, path: string): Promise<void> {
    await login(page, E2E_USERS.admin)
    await page.goto(path)
    await expect(page.locator('#main')).not.toBeEmpty({ timeout: 20000 })
  }

  test('Tabs: one tab stop, arrows/Home/End move selection and focus', async ({ page }) => {
    await booted(page, '/agents')
    await expect(page.locator('.cxp[aria-busy="false"]')).toBeVisible({ timeout: 20000 })

    const tablist = page.getByRole('tablist', { name: 'Scorecard view' })
    const tabs = tablist.getByRole('tab')
    expect(await tabs.count()).toBeGreaterThanOrEqual(2)

    // Roving tabindex: exactly one tab is in the tab order.
    await expect(tablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1)

    const selected = tablist.locator('[role="tab"][aria-selected="true"]')
    await selected.focus()
    await expect(selected).toBeFocused()

    await page.keyboard.press('ArrowRight')
    const next = tablist.locator('[role="tab"][aria-selected="true"]')
    await expect(next).toHaveCount(1)
    await expect(next).toBeFocused()
    await expect(next).toHaveAttribute('tabindex', '0')

    await page.keyboard.press('End')
    const last = tabs.last()
    await expect(last).toHaveAttribute('aria-selected', 'true')
    await expect(last).toBeFocused()

    await page.keyboard.press('Home')
    const first = tabs.first()
    await expect(first).toHaveAttribute('aria-selected', 'true')
    await expect(first).toBeFocused()
  })

  test('PaintGrid on /tph: one tab stop, arrows move inside the grid', async ({ page }) => {
    // The paint grid lives on the 'grid' tab (?tab=grid); the panel stays
    // mounted but hidden on the default overview tab. /api/tph/page is slow —
    // wait for the page shell's busy flag before looking for the grid.
    await booted(page, '/tph?tab=grid')
    // First hit compiles the route in dev; /api/tph/page is also slow.
    await expect(page.getByRole('heading', { name: 'TPH and caps' })).toBeVisible({ timeout: 40000 })
    await expect(page.locator('.cxp[aria-busy="false"]')).toBeVisible({ timeout: 30000 })
    const grid = page.getByRole('grid', { name: /Channel per agent/ })
    await expect(grid).toBeVisible({ timeout: 20000 })

    const cells = grid.getByRole('gridcell')
    await expect(cells.first()).toBeVisible()
    // Roving tabindex starts on cell index 0 — the first cell in DOM order.
    await expect(grid.locator('[role="gridcell"][tabindex="0"]')).toHaveCount(1)
    const start = cells.first()
    await expect(start).toHaveAttribute('tabindex', '0')
    await start.focus()
    await expect(start).toBeFocused()

    // ArrowRight advances the flat row-major index by one.
    await page.keyboard.press('ArrowRight')
    await expect(start).toHaveAttribute('tabindex', '-1')
    await expect(start).not.toBeFocused()
    const moved = cells.nth(1)
    await expect(moved).toBeFocused()
    await expect(moved).toHaveAttribute('tabindex', '0')

    // Every cell — including non-editable ones — stays keyboard reachable.
    await page.keyboard.press('End')
    const rowEnd = grid.locator('[role="gridcell"]:focus')
    await expect(rowEnd).toHaveCount(1)
    await page.keyboard.press('ArrowDown')
    await expect(grid.locator('[role="gridcell"]:focus')).toHaveCount(1)
  })

  test('palette close returns focus to the invoker', async ({ page }) => {
    await login(page, E2E_USERS.admin)
    await page.waitForURL('/')

    const invoker = page.locator('.rail-search')
    await expect(invoker).toBeVisible({ timeout: 15000 })
    await invoker.focus()

    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog', { name: 'Search pages' })
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(invoker).toBeFocused()
  })
})
