// Focused DOM probe for P2-QA-02 leftovers: header region, raw elements on
// /quality-scores, hover-state check on a real content button, Q1 toolbar
// stability on a state-changing control.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = dirname(fileURLToPath(import.meta.url))
const out = {}
const b = await chromium.launch()
const ctx = await b.newContext({ baseURL: 'http://localhost:3000' })
const p = await ctx.newPage()
await p.goto('/auth/login')
await p.waitForLoadState('networkidle')
await p.fill('input[type=email]', 'e2e.admin@dabdoob.com')
await p.fill('input[type=password]', process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!')
await Promise.all([
  p.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
  p.click('button[type=submit]'),
])
await p.waitForURL('/', { timeout: 10000 }).catch(() => {})
await p.setViewportSize({ width: 1024, height: 900 })
await p.goto('/quality-scores', { waitUntil: 'domcontentloaded', timeout: 90000 })
await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await p.waitForTimeout(1000)

out.dom = await p.evaluate(`(() => {
 const q = s => [...document.querySelectorAll(s)]
 const cls = e => String(e.getAttribute('class') || '').slice(0, 70)
 return {
  headers: q('header,[role="banner"]').map(e => e.tagName + '.' + cls(e)),
  toolbarish: q('[class*=toolbar],[class*=header],[class*=page-head],[data-toolbar]').slice(0, 10).map(e => e.tagName + '.' + cls(e)),
  rawInputs: q('input:not([class]),select:not([class]),textarea:not([class])').map(e => e.outerHTML.slice(0, 140)),
  rawLinks: q('a[href]:not([class])').map(e => e.outerHTML.slice(0, 140)),
  mainBtns: q('main button,[role="main"] button').slice(0, 12).map(e => String(e.textContent || '').trim().slice(0, 35) + '|' + String(e.getAttribute('aria-label') || '') + '|' + cls(e)),
  mainInputs: q('main input,main select,main textarea').slice(0, 14).map(e => e.outerHTML.slice(0, 120)),
 }
})()`)

// Q1: find the top chrome region + exercise a filter control.
out.chrome = await p.evaluate(`(() => {
 const el = document.querySelector('header,[role="banner"]') ||
   document.querySelector('[class*=toolbar]') ||
   document.querySelector('main')?.parentElement?.firstElementChild
 if (!el) return null
 const r = el.getBoundingClientRect()
 return { sel: el.tagName + '.' + String(el.getAttribute('class') || '').slice(0, 60), rect: { x: r.x, y: r.y, w: r.width, h: r.height } }
})()`)
// click a page-level toggle (filter select/segment) and re-measure
const sel = p.locator('main select, [role="main"] select, main [role="tab"], main button').first()
try {
  if (await sel.count()) {
    await sel.click({ timeout: 3000 })
    await p.waitForTimeout(900)
    out.chromeAfter = await p.evaluate(`(() => {
      const el = document.querySelector('header,[role="banner"]') || document.querySelector('[class*=toolbar]')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, w: r.width, h: r.height }
    })()`)
    await p.keyboard.press('Escape')
  }
} catch (e) { out.clickErr = String(e).slice(0, 120) }

// Q8 hover on a REAL content control (first enabled button inside main)
const btn = p.locator('main button:not([disabled]), [role="main"] button:not([disabled])').first()
try {
  if (await btn.count()) {
    out.hoverBtn = (await btn.innerText()).trim().slice(0, 40)
    const cs = (el) => p.evaluate(`(()=>{const b=[...document.querySelectorAll('main button,[role="main"] button')].find(e=>e.offsetWidth>0&&!e.disabled);if(!b)return null;const c=getComputedStyle(b);return {bg:c.backgroundColor,color:c.color,br:c.borderColor,tr:c.transform,sh:(c.boxShadow||'').slice(0,60),op:c.opacity}})()`)
    out.hoverBefore = await cs()
    await btn.hover({ timeout: 3000 })
    await p.waitForTimeout(300)
    out.hoverAfter = await cs()
    // also check a table row hover
    const row = p.locator('main tbody tr, [role="main"] tbody tr').first()
    if (await row.count()) {
      await row.hover({ timeout: 2000 }).catch(() => {})
      await p.waitForTimeout(250)
      out.rowHover = await p.evaluate(`(()=>{const t=document.querySelector('main tbody tr,[role="main"] tbody tr');if(!t)return null;const c=getComputedStyle(t);return {bg:c.backgroundColor}})()`)
    }
  }
} catch (e) { out.hoverErr = String(e).slice(0, 120) }

writeFileSync(join(ROOT, 'logs', 'qa2-extra.json'), JSON.stringify(out, null, 1))
await b.close()
console.log('DONE')
