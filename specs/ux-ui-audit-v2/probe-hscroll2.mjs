// Probe v2: report only UNCLIPPED page-overflow sources at 390px.
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
      const clipped = (el) => {
        for (let a = el.parentElement; a; a = a.parentElement) {
          const ox = getComputedStyle(a).overflowX
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
            const ar = a.getBoundingClientRect()
            if (ar.right <= vw + 1) return true // ancestor clips and fits
          }
        }
        return false
      }
      const bad = []
      // report the SHALLOWEST unclipped overflowers (source, not descendants)
      const els = [...document.querySelectorAll('body *')]
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.right <= vw + 1) continue
        if (clipped(el)) continue
        // skip if an ancestor is already reported (report outermost only)
        if (bad.some((b) => b.el.contains(el))) continue
        bad.push({ el, desc: `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 90)} right=${Math.round(r.right)} w=${Math.round(r.width)}` })
        if (bad.length >= 10) break
      }
      return { vw, scrollW: document.documentElement.scrollWidth, bad: bad.map((b) => b.desc) }
    })
    console.log(`== ${route} vw=${out.vw} scrollW=${out.scrollW}`)
    out.bad.forEach((b) => console.log('  ' + b))
    await p.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
