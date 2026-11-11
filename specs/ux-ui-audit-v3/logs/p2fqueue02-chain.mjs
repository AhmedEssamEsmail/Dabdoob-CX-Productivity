// P2FQUEUE-02 bisect pt2: geometry of overflowing input/textarea chain @375 /checkins
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
const out = await p.evaluate(() => {
  const el = document.getElementById('q-Chats-ag') || document.querySelector('input.cx-num')
  const chain = []
  let n = el
  while (n && n !== document.documentElement) {
    const r = n.getBoundingClientRect()
    const cs = getComputedStyle(n)
    chain.push({
      tag: n.tagName.toLowerCase(), cls: String(n.getAttribute('class') || '').slice(0, 60),
      left: +r.left.toFixed(2), right: +r.right.toFixed(2), w: +r.width.toFixed(2),
      bs: cs.boxSizing, wCss: cs.width, pad: cs.padding, border: cs.borderRightWidth,
      disp: cs.display, minw: cs.minWidth, ox: cs.overflowX,
    })
    n = n.parentElement
  }
  return { sw: document.documentElement.scrollWidth, iw: innerWidth, chain }
})
writeFileSync(join(ROOT, 'p2fqueue02-chain.json'), JSON.stringify(out, null, 1))
await b.close()
console.log('DONE')
