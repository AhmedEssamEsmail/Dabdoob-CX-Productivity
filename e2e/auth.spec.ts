import { test, expect } from '@playwright/test'
import { E2E_USERS, fillSticky, login } from './users'

test.describe('Authentication Flow', () => {
  test('user can log in with valid credentials', async ({ page }) => {
    await login(page, E2E_USERS.admin)

    await expect(page).toHaveURL('/')
  })

  test('user cannot log in with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login')

    await fillSticky(page, 'input[type="email"]', 'wrong@example.com')
    await fillSticky(page, 'input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Login page renders field errors as <p class="field-error" role="alert">
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('user is redirected to login when accessing protected route', async ({ page }) => {
    await page.goto('/status-validation')

    await expect(page).toHaveURL('/auth/login')
  })

  test('user can log out', async ({ page }) => {
    // Login first
    await login(page, E2E_USERS.admin)
    await expect(page).toHaveURL('/')

    // Then logout — /auth/logout redirects through /api/auth/logout, which
    // signs the session out and lands back on the login form
    await page.goto('/auth/logout')

    await expect(page).toHaveURL('/auth/login')
  })

  test('session persists across page reloads', async ({ page }) => {
    // Desktop viewport: the rail nav is display:none <=820px (behind Menu)
    await page.setViewportSize({ width: 1280, height: 720 })
    await login(page, E2E_USERS.admin)
    await expect(page).toHaveURL('/')

    // Reload page
    await page.reload()

    // Should still be logged in (#nav — the dev error overlay also renders nav)
    await expect(page.locator('#nav')).toBeVisible()
  })
})
