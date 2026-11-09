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
    // Parallel projects share the e2e.admin identity — a sibling context's
    // refresh-token rotation can poison this session, so a reload can bounce
    // to /auth/login (same transient login() retries for). Re-login for a
    // fresh session and retry; a real session regression fails every attempt.
    test.setTimeout(60000)
    const nav = page.locator('#nav')
    for (let i = 0; i < 4; i++) {
      await login(page, E2E_USERS.admin)
      await expect(page).toHaveURL('/')
      await page.reload()
      const ok = await nav
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true, () => false)
      if (ok) break
    }

    // Should still be logged in (#nav — the dev error overlay also renders nav)
    await expect(nav).toBeVisible()
  })
})

test.describe('Google sign-in', () => {
  test('Continue with Google button is visible on the login page', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  })

  test('?error=denied shows the roster denial banner', async ({ page }) => {
    await page.goto('/auth/login?error=denied')

    // .login-error — Next dev also renders #__next-route-announcer__[role=alert]
    await expect(page.locator('.login-error[role="alert"]')).toContainText(
      'authorised for the CX Hub'
    )
  })

  test('clicking Continue with Google fires POST /api/auth/google', async ({ page }) => {
    // Mock the kickoff endpoint; the OAuth consent leg never leaves the test.
    await page.route('**/api/auth/google', (route) =>
      route.fulfill({
        json: { url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' },
      })
    )
    // Block the real external navigation after kickoff — no real network.
    await page.route('https://accounts.google.com/**', (route) => route.abort())

    await page.goto('/auth/login')
    // Wait out hydration so the onClick handler is attached before clicking.
    await page.waitForLoadState('networkidle')
    const kickoff = page.waitForRequest('**/api/auth/google')
    await page.getByRole('button', { name: 'Continue with Google' }).click()

    await kickoff
  })
})
