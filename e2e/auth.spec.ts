import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('user can log in with valid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL('/')
  })

  test('user cannot log in with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')
    
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('.error')).toBeVisible()
  })

  test('user is redirected to login when accessing protected route', async ({ page }) => {
    await page.goto('/status-validation')
    
    await expect(page).toHaveURL('/auth/login')
  })

  test('user can log out', async ({ page }) => {
    // Login first
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    // Then logout
    await page.goto('/auth/logout')
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL('/auth/login')
  })

  test('session persists across page reloads', async ({ page }) => {
    // Login
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password')
    await page.click('button[type="submit"]')
    
    // Reload page
    await page.reload()
    
    // Should still be logged in
    await expect(page.locator('nav')).toBeVisible()
  })
})
