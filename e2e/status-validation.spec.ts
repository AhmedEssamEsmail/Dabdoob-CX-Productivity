import { test, expect } from '@playwright/test'

test.describe('Status Validation Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'tl@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/')
  })

  test('TL sees the GAS-style status validation shell', async ({ page }) => {
    await page.goto('/status-validation')

    await expect(page.getByRole('heading', { name: 'Status validation' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' }).getByText('Productivity', { exact: true })).toBeVisible()
    await expect(page.locator('.legacy-section__head h2').first()).toContainText(/\d+ to review|Nothing to review/)
    await expect(page.locator('body > header')).toHaveCount(0)
  })

  test('pending flags show the agent, interval, suggestion and review deadline', async ({ page }) => {
    await page.goto('/status-validation')

    const firstFlag = page.locator('.pv-item').first()
    if (await firstFlag.count()) {
      await expect(firstFlag.locator('.pv-item__who')).toBeVisible()
      await expect(firstFlag.locator('.pv-item__what')).toContainText('suggested')
      await expect(firstFlag.locator('.legacy-chip')).toBeVisible()
    } else {
      await expect(page.locator('.legacy-panel--empty')).toBeVisible()
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
    await expect(page.locator('.pv-toast')).toContainText(/^Accepted as /)

    // The flag leaves the queue and lands in the decided table.
    await expect(page.locator('.pv-detail')).toHaveCount(0)
    await expect(page.locator('.pv-table')).toBeVisible()
  })
})
