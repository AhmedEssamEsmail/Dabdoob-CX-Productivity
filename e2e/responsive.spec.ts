import { test, expect } from '@playwright/test'

test.describe('Responsive Design', () => {
  test('layout works on mobile (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/auth/login')
    
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('layout works on tablet (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/auth/login')
    
    await expect(page.locator('form')).toBeVisible()
  })

  test('layout works on desktop (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/auth/login')
    
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('nav')).toBeVisible()
  })

  test('navigation adapts to screen size', async ({ page }) => {
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    const mobileNav = page.locator('nav')
    await expect(mobileNav).toBeVisible()

    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 })
    const desktopNav = page.locator('nav')
    await expect(desktopNav).toBeVisible()
  })
})
