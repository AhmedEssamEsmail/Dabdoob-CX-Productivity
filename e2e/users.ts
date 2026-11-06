import type { Page } from '@playwright/test'

/**
 * e2e fixture identities — seeded by `node e2e/seed-users.mjs`
 * (npm run test:e2e:seed). They are real confirmed Supabase auth users on
 * dabdoob.com (allowed_domain) with matching roster rows, because every page
 * is gated by src/proxy.ts (Supabase session) + requireRole (roster role).
 * The old *@example.com creds can never pass the domain check — do not use them.
 */
export const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'

export const E2E_USERS = {
  admin: 'e2e.admin@dabdoob.com',
  tl: 'e2e.tl@dabdoob.com',
  agent: 'e2e.agent@dabdoob.com',
} as const

/**
 * Fill a controlled input, re-filling while React hydration still resets it.
 * A fill that lands before hydration is overwritten by the controlled
 * value='' — the giveaway is an inputValue that doesn't stick (webkit).
 */
export async function fillSticky(page: Page, selector: string, value: string): Promise<void> {
  const input = page.locator(selector)
  for (let i = 0; i < 20; i++) {
    await input.fill(value)
    if ((await input.inputValue()) === value) return
    await page.waitForTimeout(200)
  }
  throw new Error(`could not fill ${selector}`)
}

/**
 * Sign in through the real login form, the way every spec entry point does.
 * Retries a few times: 85 specs logging in fully-parallel against the remote
 * Supabase token endpoint occasionally hits a transient 4xx or a post-redirect
 * session bounce — a fresh attempt gets a clean session.
 */
export async function login(
  page: Page,
  email: string = E2E_USERS.admin,
  password: string = E2E_PASSWORD
): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/auth/login')
    await fillSticky(page, 'input[type="email"]', email)
    await fillSticky(page, 'input[type="password"]', password)
    const [response] = await Promise.all([
      page
        .waitForResponse(
          (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
          { timeout: 12000 }
        )
        .catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (response?.ok()) {
      try {
        await page.waitForURL('/', { timeout: 8000 })
        return
      } catch {
        /* landed back on /auth/login (transient session check) — retry */
      }
    }
    await page.waitForTimeout(500 * (attempt + 1))
  }
  throw new Error(`e2e login failed for ${email} — is e2e/seed-users.mjs run and the dev server up?`)
}
