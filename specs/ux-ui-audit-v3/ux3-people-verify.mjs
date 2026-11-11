// P2-PEOPLE-01 focused re-probes: tl-tasks seg jump, raw controls, scroll
// containers, meetings unnamed inputs, logo, hover targets.
import { chromium } from 'playwright'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(ROOT, 'results', 'ux3-screens', 'people')
const BASE = 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'

async function login(page) {
  for (let i = 0; i < 4; i++) {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    const em = page.locator('input[type="email"]'); const pw = page.locator('input[type="password"]')
    for (let t = 0; t < 20; t++) { await em.fill('e2e.admin@dabdoob.com'); if ((await em.inputValue()) === 'e2e.admin@dabdoob.com') break; await page.waitForTimeout(200) }
    for (let t = 0; t < 20; t++) { await pw.fill(PASSWORD); if ((await pw.inputValue()) === PASSWORD) break; await page.waitForTimeout(200) }
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]')])
    if (res?.ok()) { try { await page.waitForURL('/', { timeout: 10000 }); return true } catch {} }
    await page.waitForTimeout(500 * (i + 1))
  }
  return false
}
const settle = async (p) => { await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800) }

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE })
  const lp = await ctx.newPage()
  console.log('login:', await login(lp)); await lp.close()

  // (a)+(b)+(c) tl-tasks @375
  let page = await ctx.newPage()
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/tl-tasks', { waitUntil: 'domcontentloaded', timeout: 60000 }); await settle(page)
  const raw = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    return [...document.querySelectorAll('main button:not([class]), main a[href]:not([class]), main input:not([class]), main select:not([class]), main textarea:not([class])')]
      .filter(vis).map((el) => el.tagName + '|' + (el.getAttribute('type') || '') + '|' + el.textContent.trim().slice(0, 40))
  })
  console.log('tl-tasks raw controls:', JSON.stringify(raw))
  const ganttScroll = await page.evaluate(() => {
    const g = document.querySelector('.pw-gantt')
    if (!g) return null
    let p = g, chain = []
    while (p && p !== document.body) { const cs = getComputedStyle(p); chain.push({ el: p.className?.toString().split(' ')[0], ox: cs.overflowX, sw: p.scrollWidth, cw: p.clientWidth }); p = p.parentElement }
    return chain.slice(0, 5)
  })
  console.log('tl-tasks gantt scroll chain:', JSON.stringify(ganttScroll))
  const before = await page.evaluate(() => ({ y: window.scrollY, head: document.querySelector('main .page-head, main header, main>*:first-child')?.getBoundingClientRect().top }))
  const seg = page.locator('main [class*=seg] button, main [role=tablist] button').nth(1)
  const segTxt = await seg.textContent().catch(() => '?')
  await seg.click().catch(() => {}); await page.waitForTimeout(1500); await settle(page)
  const after = await page.evaluate(() => ({ y: window.scrollY, head: document.querySelector('main .page-head, main header, main>*:first-child')?.getBoundingClientRect().top }))
  console.log(`tl-tasks@375 seg "${segTxt?.trim().slice(0, 40)}" scroll ${before.y}->${after.y} headTop ${before.head}->${after.head}`)
  await page.screenshot({ path: join(SHOTS, 'tl-tasks-375-postseg.png'), fullPage: true })
  // logo check
  const logo = await page.evaluate(() => { const i = document.querySelector('img'); return i ? { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 } : null })
  console.log('logo img:', JSON.stringify(logo))
  await page.close()

  // agents: table scrollability + tab overflower @375
  page = await ctx.newPage()
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/agents', { waitUntil: 'domcontentloaded', timeout: 60000 }); await settle(page)
  const tbl = await page.evaluate(() => {
    const t = document.querySelector('table.cx-table')
    if (!t) return null
    let p = t, chain = []
    while (p && p !== document.body) { const cs = getComputedStyle(p); if (cs.overflowX !== 'visible' || chain.length === 0) chain.push({ el: (p.className?.toString() || p.tagName).split(' ')[0], ox: cs.overflowX, sw: p.scrollWidth, cw: p.clientWidth }); p = p.parentElement }
    return chain.slice(0, 4)
  })
  console.log('agents table scroll chain:', JSON.stringify(tbl))
  const tabOv = await page.evaluate(() => { const b = [...document.querySelectorAll('button.cx-tab')].find((e) => e.getBoundingClientRect().right > innerWidth + 1); if (!b) return null; const r = b.getBoundingClientRect(); return { txt: b.textContent.trim().slice(0, 30), right: Math.round(r.right), parentOx: getComputedStyle(b.parentElement).overflowX, parentScrollable: b.parentElement.scrollWidth > b.parentElement.clientWidth } })
  console.log('agents tab overflower:', JSON.stringify(tabOv))
  await page.close()

  // meetings: identify unnamed inputs + first control hover @1024
  page = await ctx.newPage()
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto('/meetings', { waitUntil: 'domcontentloaded', timeout: 60000 }); await settle(page)
  const mi = await page.evaluate(() => {
    const vis = (el) => el.getBoundingClientRect().width > 0
    return [...document.querySelectorAll('main input.cx-input')].filter(vis).map((el) => ({ type: el.type, ph: el.placeholder, aria: el.getAttribute('aria-label'), prev: el.previousElementSibling?.textContent?.trim().slice(0, 30), wrap: el.parentElement?.className?.toString().slice(0, 40) }))
  })
  console.log('meetings inputs:', JSON.stringify(mi))
  const first = await page.evaluate(() => { const el = document.querySelector('main button, main a[href]'); return el ? el.tagName + '|' + el.className + '|' + el.textContent.trim().slice(0, 40) : null })
  console.log('meetings first control:', first)
  await page.close()

  // my-actions + notes: first control identity @1024
  for (const route of ['/my-actions', '/notes']) {
    page = await ctx.newPage()
    await page.setViewportSize({ width: 1024, height: 900 })
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 }); await settle(page)
    const fc = await page.evaluate(() => { const el = document.querySelector('main button, main a[href]'); return el ? el.tagName + '|' + el.className + '|' + el.textContent.trim().slice(0, 40) : 'none' })
    const btn = page.locator('main button').first()
    let hv = null
    if (await btn.count() && await btn.isVisible().catch(() => false)) {
      const b = await btn.evaluate((el) => { const c = getComputedStyle(el); return [c.backgroundColor, c.color, c.boxShadow].join('|') })
      await btn.hover(); await page.waitForTimeout(400)
      const a = await btn.evaluate((el) => { const c = getComputedStyle(el); return [c.backgroundColor, c.color, c.boxShadow].join('|') })
      hv = b !== a
    }
    console.log(`${route} firstCtrl="${fc}" btnHoverChanged=${hv}`)
    await page.close()
  }
  await browser.close()
  console.log('VERIFY-DONE')
}
main().catch((e) => { console.error(e); process.exit(1) })
