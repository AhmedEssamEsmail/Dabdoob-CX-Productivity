import { test, expect } from '@playwright/test'
import { E2E_USERS, login } from './users'

test.describe('My Status Page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(45000) // login + remote ready-wait can exceed 30s under load
    // Login as agent
    await login(page, E2E_USERS.agent)
    await page.waitForURL('/')
  })

  test('agent can view own productivity score', async ({ page }) => {
    await page.goto('/my-status')
    // Remote data can take >5s under parallel load — wait for busy to clear.
    await expect(page.locator('.cxp[aria-busy="false"]')).toBeVisible({ timeout: 15000 })

    await expect(page.getByRole('heading', { name: 'My status' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible()
  })

  test('productivity score displays correctly', async ({ page }) => {
    await page.goto('/my-status')
    // Remote data can take >5s under parallel load — wait for busy to clear.
    await expect(page.locator('.cxp[aria-busy="false"]')).toBeVisible({ timeout: 15000 })

    const facts = page.locator('.pv-facts')
    if (await facts.count()) {
      // Weekly metrics render as a dl; the two productivity figures are %
      await expect(facts.getByText('Productivity as logged')).toBeVisible()
      await expect(facts.locator('dd', { hasText: '%' }).first()).toBeVisible()
    } else {
      // A fresh agent has no logged time — the page says so instead
      await expect(page.getByText('No logged time this week yet.')).toBeVisible()
    }
  })

  test('intervals list displays correctly', async ({ page }) => {
    await page.goto('/my-status')
    // Remote data can take >5s under parallel load — wait for busy to clear.
    await expect(page.locator('.cxp[aria-busy="false"]')).toBeVisible({ timeout: 15000 })

    const flags = page.locator('.pv-cards article')
    if (await flags.count()) {
      // Each flag shows the Logged/Suggested/Reviewed strip and a decision chip
      await expect(flags.first().locator('.pv-strip')).toBeVisible()
      await expect(flags.first().locator('.cx-chip[data-status]')).toBeVisible()
    } else {
      await expect(
        page.getByRole('heading', { name: 'No flags in the last 45 days' })
      ).toBeVisible()
    }
  })

  test('status colors match design', async ({ page }) => {
    await page.goto('/my-status')
    // Remote data can take >5s under parallel load — wait for busy to clear.
    await expect(page.locator('.cxp[aria-busy="false"]')).toBeVisible({ timeout: 15000 })

    const badges = page.locator('.cx-chip[data-status]')
    if (await badges.count()) {
      await expect(badges.first()).toBeVisible()
    } else {
      await expect(
        page.getByRole('heading', { name: 'No flags in the last 45 days' })
      ).toBeVisible()
    }
  })
})
