// P2FQUEUE-02 bisect: find the 1px h-overflow source on /checkins @375
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
await p.setViewportSize({ width: 375, height: 900 })
await p.goto('/checkins', { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await p.waitForTimeout(900)
out.confirm = await p.evaluate(() => ({
  iw: innerWidth, sw: document.documentElement.scrollWidth,
  bodySw: document.body.scrollWidth,
}))
// per-element hide test: hide each candidate subtree and measure
out.bisect = await p.evaluate(() => {
  const sw = () => document.documentElement.scrollWidth
  const base = sw()
  const res = []
  const sels = ['.shell', '.rail', '.main', 'nav', 'header', 'footer', '.nav-ind', 'a.skip', 'main', '#__next', 'body > *']
  for (const s of sels) {
    for (const el of document.querySelectorAll(s)) {
      const prev = el.style.display
      el.style.display = 'none'
      const now = sw()
      if (now !== base) res.push({ sel: s, cls: String(el.getAttribute('class') || '').slice(0, 50), swBefore: base, swAfter: now })
      el.style.display = prev
    }
  }
  return { base, res }
})
// dump all elements whose box or fixed position could extend doc width
out.overflowing = await p.evaluate(() => {
  const vw = innerWidth
  const ext = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' || r.right > vw + 0.5 || r.left < -0.5) {
      ext.push({ tag: el.tagName.toLowerCase(), cls: String(el.getAttribute('class') || '').slice(0, 60), id: el.id, pos: cs.position, left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10, w: Math.round(r.width * 10) / 10, ow: cs.overflowX })
    }
  }
  return ext.slice(0, 40)
})
writeFileSync(join(ROOT, 'p2fqueue02-bisect.json'), JSON.stringify(out, null, 1))
await b.close()
console.log('DONE', JSON.stringify(out.confirm))
