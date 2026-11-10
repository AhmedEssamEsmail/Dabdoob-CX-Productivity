// Probe: which elements overflow the 390px viewport on /overview and /queue.
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE })
  const page = await ctx.newPage()
  await page.goto('/auth/login')
  await page.locator('input[type="email"]').fill('e2e.admin@dabdoob.com')
  await page.locator('input[type="password"]').fill(PASSWORD)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])
  await page.waitForURL('/', { timeout: 10000 }).catch(() => {})

  for (const route of ['/overview', '/queue']) {
    const p = await ctx.newPage()
    await p.setViewportSize({ width: 390, height: 844 })
    await p.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await p.waitForTimeout(900)
    const out = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const bad = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width > vw + 1 || r.right > vw + 1) {
          const cs = el.className && typeof el.className === 'string' ? el.className.slice(0, 80) : el.tagName
          bad.push(`${el.tagName.toLowerCase()}.${cs} w=${Math.round(r.width)} right=${Math.round(r.right)}`)
          if (bad.length > 14) break
        }
      }
      return { vw, scrollW: document.documentElement.scrollWidth, bad }
    })
    console.log(`== ${route} vw=${out.vw} scrollW=${out.scrollW}`)
    out.bad.forEach((b) => console.log('  ' + b))
    await p.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
