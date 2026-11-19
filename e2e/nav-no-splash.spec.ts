import { expect, test, type Page } from '@playwright/test'
import { E2E_USERS, login } from './users'

/**
 * PLAN #5 — no boot splash on client navigation. Crawls every rail link
 * (plus a Slow-3G pass) and proves .boot-splash never becomes visible, #app
 * never empties, the .rail element is never remounted, and the only wait
 * cue is .page-loading .spinner (src/app/loading.tsx). A MutationObserver
 * watches for the whole crawl so a one-frame flash cannot slip between
 * Playwright assertions.
 */

const NAV_LINK = '.nav a[href^="/"]'

interface NavWatch {
  splashSeen: boolean
  appEmptied: boolean
  railMounts: number
}

declare global {
  interface Window {
    __navWatch?: NavWatch
  }
}

/**
 * Same settle convention as page-contract.spec.ts, with a longer busy drain:
 * it is a wait, not the 15s page-contract assertion — under dev-compile +
 * remote-data load a page can legitimately stay aria-busy past 15s (S06).
 */
async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 45000 })
}

/**
 * Observer on document.body: records .boot-splash ever computed-visible,
 * #app ever empty, and every .rail node added. The live rail is tagged
 * data-e2e-rail and counted as mount 1 — a remount shows as mounts > 1 and
 * loses the tag (same-element check across nav).
 */
async function installWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const flags: NavWatch = { splashSeen: false, appEmptied: false, railMounts: 0 }
    window.__navWatch = flags
    const rail = document.querySelector('.rail')
    if (rail) {
      flags.railMounts = 1
      rail.setAttribute('data-e2e-rail', '1')
    }
    const scan = () => {
      const splash = document.querySelector('.boot-splash')
      if (splash) {
        const cs = getComputedStyle(splash)
        if (cs.display !== 'none' && cs.visibility !== 'hidden') flags.splashSeen = true
      }
      const app = document.getElementById('app')
      if (app && app.childElementCount === 0) flags.appEmptied = true
    }
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList')
          m.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement) {
              if (n.matches('.rail')) flags.railMounts++
              flags.railMounts += n.querySelectorAll('.rail').length
            }
          })
        scan()
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'data-booted'],
    })
    scan()
  })
}

/** Unique rail hrefs in nav order — admin sees the most links. */
async function navHrefs(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator(NAV_LINK)
    .evaluateAll((els) => els.map((a) => a.getAttribute('href') ?? ''))
  return [...new Set(hrefs.filter(Boolean))]
}

/** Groups collapse by default (sessionStorage); expand all so every link is clickable. */
async function expandAllGroups(page: Page): Promise<void> {
  const closed = page.locator('.nav-group-label[aria-expanded="false"]')
  for (let i = 0; i < 12 && (await closed.count()) > 0; i++) await closed.first().click()
}

/** Post-login boot wait: `!boot` renders null (no aria-busy to drain), so
 *  ready() alone can pass before /api/bootstrap resolves — gate on the rail. */
async function bootReady(page: Page): Promise<void> {
  await ready(page)
  await expect(page.locator(NAV_LINK).first()).toBeAttached({ timeout: 30000 })
  await expect(page.locator('.rail')).toBeVisible()
}

/** Pending marker clears (data-pending/aria-busy on the clicked link), then the route settles. */
async function settleNav(page: Page): Promise<void> {
  await expect(page.locator(`${NAV_LINK}[data-pending="true"]`)).toHaveCount(0, {
    timeout: 20000,
  })
  await ready(page)
}

/** Settled-state invariants: splash hidden, #app non-empty, one-shot latch held. */
async function expectSettled(page: Page): Promise<void> {
  await expect(page.locator('.boot-splash')).toBeHidden()
  await expect(page.locator('#app')).toHaveAttribute('data-booted', '')
  expect(
    await page.evaluate(() => document.getElementById('app')?.childElementCount ?? 0)
  ).toBeGreaterThan(0)
}

/** Whole-crawl invariants: observer flags + rail fingerprint. */
async function expectInvariants(page: Page): Promise<void> {
  const flags = await page.evaluate(() => window.__navWatch)
  expect(flags?.splashSeen, 'boot splash became visible during client nav').toBeFalsy()
  expect(flags?.appEmptied, '#app emptied during client nav').toBeFalsy()
  expect(flags?.railMounts, '.rail remounted during client nav').toBe(1)
  await expect(page.locator('.rail[data-e2e-rail="1"]')).toHaveCount(1)
  await expectSettled(page)
}

test('client nav crawl never shows the boot splash or remounts the shell', async ({ page }) => {
  test.setTimeout(600000) // ~38 rail links x dev-compile + remote-data ready waits
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page, E2E_USERS.admin)
  await bootReady(page)
  await installWatch(page)
  await expandAllGroups(page)
  const hrefs = await navHrefs(page)
  expect(hrefs.length, 'rail rendered no nav links').toBeGreaterThan(0)

  for (const href of hrefs) {
    await page.locator(`.nav a[href="${href}"]`).click()
    await settleNav(page)
    await expectSettled(page)
  }
  await expectInvariants(page)
})

test('throttled nav (Slow 3G, 4x CPU) shows only .page-loading, never the splash', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP network/CPU throttling is chromium-only')
  test.setTimeout(300000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page, E2E_USERS.admin)
  await bootReady(page)
  await installWatch(page)
  await expandAllGroups(page)
  const hrefs = (await navHrefs(page)).slice(0, 3)
  expect(hrefs.length, 'rail rendered no nav links').toBeGreaterThan(0)

  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8, // Slow 3G ~400 kb/s
    uploadThroughput: (400 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  try {
    for (const href of hrefs) {
      await page.locator(`.nav a[href="${href}"]`).click()
      await settleNav(page)
      // The only allowed wait cue — and it must have resolved within budget.
      await expect(page.locator('.page-loading')).toBeHidden({ timeout: 30000 })
      await expectSettled(page)
    }
  } finally {
    await cdp
      .send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      })
      .catch(() => {})
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {})
  }
  await expectInvariants(page)
})
