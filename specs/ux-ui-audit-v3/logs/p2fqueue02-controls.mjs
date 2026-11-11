// P2FQUEUE-02 pt3: every field control's right edge on /checkins @375
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
await p.setViewportSize({ width: 375, height: 900 })
await p.goto('/checkins', { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await p.waitForTimeout(900)
const out = await p.evaluate(() => ({
  sw: document.documentElement.scrollWidth, iw: innerWidth,
  app: document.querySelector('[data-app]')?.getAttribute('data-app'),
  ctrls: [...document.querySelectorAll('.cx-input,.cx-textarea,.cx-select,select.cx-select,input.input,textarea.input')].map(el => {
    const r = el.getBoundingClientRect()
    return { id: el.id || String(el.getAttribute('class')).slice(0, 40), right: +r.right.toFixed(1), w: +r.width.toFixed(1), bs: getComputedStyle(el).boxSizing }
  }),
}))
writeFileSync(join(ROOT, 'p2fqueue02-controls.json'), JSON.stringify(out, null, 1))
await b.close()
console.log('DONE')
