// Probe v3: identify which elements actually extend document.scrollWidth on /overview @390.
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

  const p = await ctx.newPage()
  await p.setViewportSize({ width: 390, height: 844 })
  await p.goto('/overview', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(900)
  const out = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth
    // For every element, compute "unclipped right": does a positioned-or-
    // overflow ancestor between el and root clip it? Report top offenders.
    const info = (el) => {
      const r = el.getBoundingClientRect()
      const chain = []
      for (let a = el.parentElement; a && chain.length < 8; a = a.parentElement) {
        const cs = getComputedStyle(a)
        chain.push(`${a.tagName.toLowerCase()}.${String(a.className).slice(0, 40)}[ox=${cs.overflowX},pos=${cs.position},r=${Math.round(a.getBoundingClientRect().right)}]`)
      }
      return { right: Math.round(r.right), chain }
    }
    const sus = []
    for (const el of document.querySelectorAll('.cx-sr, .sr-only')) {
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1) sus.push(info(el))
    }
    // also check top-level layout boxes wider than vw
    const wide = []
    for (const el of document.querySelectorAll('main, section, .page, .cx-panel, .cc-chart, .cx-tablewrap, [data-app] *')) {
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1 && r.width > 60) {
        wide.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)} right=${Math.round(r.right)}`)
        if (wide.length > 8) break
      }
    }
    return { vw, scrollW: document.documentElement.scrollWidth, sus: sus.slice(0, 3), wide }
  })
  console.log(`vw=${out.vw} scrollW=${out.scrollW}`)
  console.log('sr/cx-sr offenders (containing-block chains):')
  out.sus.forEach((s, i) => console.log(` #${i} right=${s.right}\n   ` + s.chain.join('\n   ')))
  console.log('wide layout boxes:')
  out.wide.forEach((w) => console.log('  ' + w))
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
