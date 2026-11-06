import { test, expect } from '@playwright/test'
import { E2E_USERS, login } from './users'

test.describe('Status Validation Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, E2E_USERS.tl)
    await page.waitForURL('/')
  })

  test('TL sees the GAS-style status validation shell', async ({ page }) => {
    // Desktop viewport: the rail nav is display:none <=820px (behind Menu)
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/status-validation')

    await expect(page.getByRole('heading', { name: 'Status validation' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' }).getByText('Productivity', { exact: true })).toBeVisible()
    // Ported Section header: .cx-section__head > h2.cx-section__title
    await expect(page.locator('.cx-section__head h2').first()).toContainText(/\d+ to review|Nothing to review/)
    await expect(page.locator('body > header')).toHaveCount(0)
  })

  test('pending flags show the agent, interval, suggestion and review deadline', async ({ page }) => {
    await page.goto('/status-validation')

    const firstFlag = page.locator('.pv-item').first()
    if (await firstFlag.count()) {
      await expect(firstFlag.locator('.pv-item__who')).toBeVisible()
      await expect(firstFlag.locator('.pv-item__what')).toContainText('suggested')
      await expect(firstFlag.locator('.cx-chip')).toBeVisible()
    } else {
      // No pending flags: the list renders empty under "Nothing to review"
      await expect(page.locator('.pv-item')).toHaveCount(0)
    }
  })

  test('opening a flag shows the strip, cases and decision form', async ({ page }) => {
    await page.goto('/status-validation')

    const firstFlag = page.locator('.pv-item').first()
    test.skip(!(await firstFlag.count()), 'No pending flags to open')

    await firstFlag.click()
    const detail = page.locator('.pv-detail')
    await expect(detail).toBeVisible()
    await expect(detail.locator('.pv-strip')).toBeVisible()
    await expect(detail.getByText('Logged')).toBeVisible()
    await expect(detail.getByText('Suggested')).toBeVisible()
    await expect(detail.getByText('Reviewed')).toBeVisible()

    const form = detail.locator('.pv-form')
    if (await form.count()) {
      await expect(form.getByRole('radiogroup')).toBeVisible()
      await expect(form.getByRole('button', { name: /^Accept as / })).toBeVisible()
      await expect(form.getByRole('button', { name: /^Revert to / })).toBeVisible()
    }
  })

  test('accepting a flag records the decision and toasts', async ({ page }) => {
    await page.goto('/status-validation')

    const firstFlag = page.locator('.pv-item').first()
    test.skip(!(await firstFlag.count()), 'No pending flags to decide')

    await firstFlag.click()
    await page.locator('.pv-form').waitFor()

    await page.getByRole('button', { name: /^Accept as / }).click()
    // ee() toasts render as .toast inside the .toasts live region
    await expect(page.locator('.toast')).toContainText(/^Accepted as /)

    // The flag leaves the queue and lands in the decided table.
    await expect(page.locator('.pv-detail')).toHaveCount(0)
    await expect(page.locator('.cx-table')).toBeVisible()
  })
})
