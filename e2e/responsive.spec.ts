import { test, expect } from '@playwright/test'
import { E2E_USERS, login } from './users'

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
    // Auth screens render bare (no shell nav) — signed-in shell covered below
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('navigation adapts to screen size', async ({ page }) => {
    test.setTimeout(45000) // login + remote ready-wait can exceed 30s under load
    await login(page, E2E_USERS.admin)
    await page.waitForURL('/')

    // Desktop: the rail nav is always visible — the boot splash can hold
    // it back >5s under parallel load, so allow the ready wait to breathe.
    await page.setViewportSize({ width: 1280, height: 720 })
    const desktopNav = page.locator('#nav')
    await expect(desktopNav).toBeVisible({ timeout: 15000 })

    // Mobile (<=820px): the nav collapses behind the Menu toggle
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(desktopNav).toBeHidden()
    await page.getByRole('button', { name: 'Menu', exact: true }).click()
    await expect(desktopNav).toBeVisible()
  })
})
