import { test, expect } from '@playwright/test'

test.describe('My Status Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as agent
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'agent@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
  })

  test('agent can view own productivity score', async ({ page }) => {
    await page.goto('/my-status')
    
    await expect(page.locator('h1')).toContainText('My Status')
    await expect(page.locator('h2')).toContainText('Productivity Score')
  })

  test('productivity score displays correctly', async ({ page }) => {
    await page.goto('/my-status')
    
    const score = page.locator('text=%')
    await expect(score).toBeVisible()
  })

  test('intervals list displays correctly', async ({ page }) => {
    await page.goto('/my-status')
    
    await expect(page.locator('h2')).toContainText('Recent Intervals')
    const intervals = page.locator('div:has-text("min")')
    await expect(intervals.first()).toBeVisible()
  })

  test('status colors match design', async ({ page }) => {
    await page.goto('/my-status')
    
    const badges = page.locator('[data-status]')
    await expect(badges.first()).toBeVisible()
  })
})
