import { test, expect } from '@playwright/test'

test.describe('Status Validation Page', () => {
  test.beforeEach(async ({ page }) => {
    // Login as TL
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'tl@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
  })

  test('TL can view team flags', async ({ page }) => {
    await page.goto('/status-validation')
    
    await expect(page.locator('h1')).toContainText('Status Validation')
    await expect(page.locator('table')).toBeVisible()
  })

  test('flag table displays correctly', async ({ page }) => {
    await page.goto('/status-validation')
    
    const table = page.locator('table')
    await expect(table.locator('thead')).toContainText('Agent')
    await expect(table.locator('thead')).toContainText('Status')
    await expect(table.locator('thead')).toContainText('Confidence')
  })

  test('status badges have correct colors', async ({ page }) => {
    await page.goto('/status-validation')
    
    const badges = page.locator('[data-status]')
    await expect(badges.first()).toBeVisible()
  })

  test('confidence scores display correctly', async ({ page }) => {
    await page.goto('/status-validation')
    
    const confidenceColumn = page.locator('td:has-text("%")')
    await expect(confidenceColumn.first()).toBeVisible()
  })

  test('TL can accept flag', async ({ page }) => {
    await page.goto('/status-validation')
    
    await page.click('button:has-text("Accept")')
    
    await expect(page.locator('.success')).toBeVisible()
  })

  test('TL can reject flag', async ({ page }) => {
    await page.goto('/status-validation')
    
    await page.click('button:has-text("Reject")')
    
    await expect(page.locator('.error')).toBeVisible()
  })
})
