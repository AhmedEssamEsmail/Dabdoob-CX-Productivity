// Find which element forces document h-scroll on /quality-analytics @375
// and whether the big .cx-table wrappers are inside overflow-x:auto containers.
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
for (const [route, w] of [['/quality-analytics', 375], ['/my-auditor-kpis', 375], ['/qa-forms', 375], ['/quality-scores', 375]]) {
  await p.setViewportSize({ width: w, height: 900 })
  await p.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(900)
  out[route] = await p.evaluate(`(() => {
    const vw = innerWidth
    const docScroll = document.documentElement.scrollWidth
    // elements whose bounding right edge extends the document
    const ext = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1 && r.width <= docScroll + 40 && r.height > 0) {
        const cs = getComputedStyle(el)
        ext.push({ tag: el.tagName.toLowerCase(), cls: String(el.getAttribute('class') || '').slice(0, 60), right: Math.round(r.right), w: Math.round(r.width), pos: cs.position, ox: cs.overflowX })
      }
    }
    // table containers: does the .cx-table sit in an overflow-x auto parent?
    const tbls = [...document.querySelectorAll('table.cx-table')].map(t => {
      let n = t.parentElement, hops = []
      while (n && hops.length < 5) { const c = getComputedStyle(n); hops.push(n.tagName.toLowerCase() + '.' + String(n.getAttribute('class') || '').slice(0, 40) + ' ox=' + c.overflowX); n = n.parentElement }
      return { tw: Math.round(t.getBoundingClientRect().width), hops }
    })
    return { vw, docScroll, ext: ext.slice(0, 12), tbls: tbls.slice(0, 3) }
  })()`)
}
writeFileSync(join(ROOT, 'logs', 'qa2-overflow.json'), JSON.stringify(out, null, 1))
await b.close()
console.log('DONE')
