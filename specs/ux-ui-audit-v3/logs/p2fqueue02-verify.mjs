// P2FQUEUE-02 verify: /checkins scrollWidth at 375/768/1024
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = dirname(fileURLToPath(import.meta.url))
const b = await chromium.launch()
const ctx = await b.newContext({ baseURL: 'http://localhost:3000' })
const p = await ctx.newPage()
await p.goto('/auth/login'); await p.waitForLoadState('networkidle')
await p.fill('input[type=email]', 'e2e.admin@dabdoob.com')
await p.fill('input[type=password]', process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!')
await Promise.all([
  p.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
  p.click('button[type=submit]'),
])
await p.waitForURL('/', { timeout: 10000 }).catch(() => {})
const out = {}
for (const w of [375, 768, 1024]) {
  await p.setViewportSize({ width: w, height: 900 })
  await p.goto('/checkins', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(900)
  out[w] = await p.evaluate(() => ({ iw: innerWidth, sw: document.documentElement.scrollWidth }))
}
writeFileSync(join(ROOT, 'p2fqueue02-verify.json'), JSON.stringify(out, null, 1))
await b.close()
console.log('DONE', JSON.stringify(out))
