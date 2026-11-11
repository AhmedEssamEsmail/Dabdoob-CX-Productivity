// ux-ui-audit-v3 P2-PEOPLE-01 capture — audits cx-people routes at
// 375/768/1024/1440 (placeholders 375+1440) against the 8-question contract.
// Read-only: screenshots + DOM probes only. Reuses e2e seeded admin login.
// Run: node specs/ux-ui-audit-v3/ux3-people-capture.mjs  (dev server @ :3000)
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(ROOT, 'results', 'ux3-screens', 'people')
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'
const EMAIL = 'e2e.admin@dabdoob.com'

const BUILT = ['/agents', '/one-on-ones', '/tl-tasks', '/meetings', '/my-actions', '/notes', '/coaching']
const PLACEHOLDERS = ['/hard-cases', '/kpi-close']
const WIDTHS = [375, 768, 1024, 1440]
const PH_WIDTHS = [375, 1440]
const slug = (r) => r.replace(/^\//, '')

async function login(page) {
  for (let i = 0; i < 4; i++) {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    for (const sel of ['input[type="email"]', 'input[type="password"]']) {
      const v = sel.includes('email') ? EMAIL : PASSWORD
      const input = page.locator(sel)
      for (let t = 0; t < 20; t++) {
        await input.fill(v)
        if ((await input.inputValue()) === v) break
        await page.waitForTimeout(200)
      }
    }
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (res?.ok()) {
      try { await page.waitForURL('/', { timeout: 10000 }); return true } catch {}
    }
    await page.waitForTimeout(500 * (i + 1))
  }
  return false
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
}

// ---- DOM probe (runs in browser) -------------------------------------------
const PROBE = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const out = {}
  const vw = window.innerWidth
  out.hscroll = document.documentElement.scrollWidth > vw
  out.overflowers = [...document.querySelectorAll('body *')].filter(vis)
    .filter((el) => { const r = el.getBoundingClientRect(); return r.right > vw + 1 })
    .slice(0, 6).map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''))
  const ctrls = [...document.querySelectorAll('main button, main a[href], main input, main select, main textarea')].filter(vis)
  const nameOf = (el) => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.getAttribute('placeholder') || (el.id && document.querySelector('label[for="' + el.id + '"]')?.textContent) || el.textContent
  out.controls = { total: ctrls.length,
    unnamed: ctrls.filter((el) => !(nameOf(el) || '').trim()).slice(0, 8).map((el) => el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]),
    unstyled: ctrls.filter((el) => !el.getAttribute('class') && !el.closest('[class]')).length,
    rawNoClass: ctrls.filter((el) => !el.getAttribute('class')).length }
  const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')].filter(vis)
  out.headings = hs.map((h) => h.tagName[1]).join(''), out.h1count = hs.filter((h) => h.tagName === 'H1').length
  out.headingTexts = hs.slice(0, 8).map((h) => h.tagName + ':' + h.textContent.trim().slice(0, 50))
  out.landmarks = { nav: document.querySelectorAll('nav,[role=navigation]').length,
    main: document.querySelectorAll('main,[role=main]').length,
    header: document.querySelectorAll('header').length,
    banner: document.querySelectorAll('[role=banner]').length }
  out.sectionsNoLabel = [...document.querySelectorAll('main section')].filter(vis).filter((s) => !s.getAttribute('aria-label') && !s.getAttribute('aria-labelledby')).length
  const inline = [...document.querySelectorAll('main [style]')].filter(vis)
    .filter((el) => /(^|;)\\s*(?!--)[a-z-]+\\s*:\\s*[^;]*(#[0-9a-fA-F]|rgb\\(|\\dpx)/i.test(el.getAttribute('style')))
  out.inlineLiterals = { count: inline.length, samples: inline.slice(0, 4).map((el) => el.tagName.toLowerCase() + ' style="' + el.getAttribute('style').slice(0, 80) + '"') }
  out.cxTokens = getComputedStyle(document.documentElement).getPropertyValue('--cx-space-4').trim().length > 0 || [...document.styleSheets].length > 0
  out.states = { status: document.querySelectorAll('[role=status]').length, alert: document.querySelectorAll('[role=alert]').length,
    skeletonish: document.querySelectorAll('[class*=skeleton],[class*=Skeleton]').length,
    emptyish: [...document.querySelectorAll('main [class]')].filter((e) => /empty|Empty/.test(e.className)).length,
    dialog: document.querySelectorAll('[role=dialog]').length }
  out.interactive = { disabled: document.querySelectorAll('main [disabled]').length,
    selected: document.querySelectorAll('[aria-selected=true]').length,
    current: document.querySelectorAll('[aria-current]').length,
    pressed: document.querySelectorAll('[aria-pressed=true]').length,
    tabs: document.querySelectorAll('[role=tab]').length,
    segButtons: document.querySelectorAll('[class*=seg] button, [role=tablist] button').length }
  const body = document.body.innerText || ''
  out.bodyLen = body.length
  out.titleText = document.querySelector('h1')?.textContent?.trim().slice(0, 80) || ''
  out.is404 = /404|not found/i.test(out.titleText)
  out.unbuilt = /Not built yet/i.test(body)
  return out
})()`

async function bbox(page) {
  return page.evaluate(() => {
    const el = document.querySelector('main .page-head, main header, .page-head, main > *:first-child')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  })
}

async function exercisePrimary(page) {
  // Returns {action, dialogOpened} — prefers refresh, then tab, then select, then first main button.
  const refresh = page.locator('main button:has-text("Refresh"), main button:has-text("refresh")').first()
  if (await refresh.count() && await refresh.isVisible().catch(() => false)) {
    await refresh.click().catch(() => {})
    return { action: 'refresh-click' }
  }
  const tab = page.locator('main [role=tab]').nth(1)
  if (await tab.count() && await tab.isVisible().catch(() => false)) {
    await tab.click().catch(() => {})
    return { action: 'tab-switch' }
  }
  const seg = page.locator('main [class*=seg] button, main [role=tablist] button').nth(1)
  if (await seg.count() && await seg.isVisible().catch(() => false)) {
    await seg.click().catch(() => {})
    return { action: 'seg-switch' }
  }
  const sel = page.locator('main select').first()
  if (await sel.count() && await sel.isVisible().catch(() => false)) {
    const opts = await sel.locator('option').all()
    if (opts.length > 1) { await sel.selectOption({ index: 1 }).catch(() => {}); return { action: 'select-change' } }
  }
  const btn = page.locator('main button').first()
  if (await btn.count() && await btn.isVisible().catch(() => false)) {
    await btn.click().catch(() => {})
    return { action: 'first-button-click' }
  }
  return { action: 'none-found' }
}

async function closeDialogIfAny(page) {
  const dlg = page.locator('[role=dialog]')
  if (await dlg.count() && await dlg.first().isVisible().catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    return true
  }
  return false
}

async function focusCheck(page) {
  // Tab through page, measure focus indicator on up to 10 stops.
  const res = await page.evaluate(() => { document.body.focus(); return 0 })
  const stops = []
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      const tag = el.tagName.toLowerCase()
      const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : ''
      return { tag: tag + (cls ? '.' + cls : ''), inMain: !!el.closest('main'),
        outline: cs.outlineStyle + '/' + cs.outlineWidth, shadow: cs.boxShadow !== 'none',
        ring: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none' }
    })
    if (!info) continue
    if (info.inMain) stops.push(info)
    if (stops.length >= 8) break
  }
  return stops
}

async function hoverCheck(page) {
  const btn = page.locator('main button, main a[href]').first()
  if (!(await btn.count()) || !(await btn.isVisible().catch(() => false))) return null
  const before = await btn.evaluate((el) => { const c = getComputedStyle(el); return [c.backgroundColor, c.color, c.boxShadow, c.borderColor].join('|') })
  await btn.hover()
  await page.waitForTimeout(250)
  const after = await btn.evaluate((el) => { const c = getComputedStyle(el); return [c.backgroundColor, c.color, c.boxShadow, c.borderColor].join('|') })
  return { changed: before !== after }
}

async function main() {
  mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE })
  const lp = await ctx.newPage()
  const ok = await login(lp)
  console.log('login:', ok ? 'ok' : 'FAILED')
  await lp.close()
  if (!ok) { await browser.close(); process.exit(2) }

  const results = {}
  const consoleErrs = {}

  async function audit(route, w, isPH) {
    const page = await ctx.newPage()
    consoleErrs[`${route}@${w}`] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrs[`${route}@${w}`].push(m.text().slice(0, 160)) })
    const r = { w, shots: [], checks: {} }
    try {
      await page.setViewportSize({ width: w, height: 900 })
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await settle(page)
      r.url = page.url()
      r.status = resp ? resp.status() : null
      if (r.url.includes('/auth/login')) { r.blocked = 'bounced to login'; results[`${route}@${w}`] = r; await page.close(); return }
      const file = `${slug(route)}-${w}.png`
      await page.screenshot({ path: join(SHOTS, file), fullPage: true })
      r.shots.push(file)
      const probe = await page.evaluate(PROBE)
      r.checks.probe = probe
      if (isPH) { results[`${route}@${w}`] = r; await page.close(); return }

      // Q1: header stability across a primary action
      const before = await bbox(page)
      const ex = await exercisePrimary(page)
      await page.waitForTimeout(1500)
      await settle(page)
      const openedDialog = await closeDialogIfAny(page)
      const after = await bbox(page)
      r.checks.q1 = { action: ex.action, dialogOpened: openedDialog, before, after,
        moved: before && after ? (Math.abs(before.x - after.x) > 2 || Math.abs(before.y - after.y) > 2 || Math.abs(before.w - after.w) > 2 || Math.abs(before.h - after.h) > 2) : null }
      r.checks.hscrollAfter = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      r.checks.focusStops = await focusCheck(page)
      r.checks.hover = await hoverCheck(page)
    } catch (e) {
      r.error = String(e).slice(0, 200)
    }
    results[`${route}@${w}`] = r
    await page.close()
  }

  for (const route of BUILT) for (const w of WIDTHS) {
    await audit(route, w, false)
    const r = results[`${route}@${w}`]
    console.log(`${route} @${w}: ${r.blocked ? 'BLOCKED' : r.error ? 'ERR ' + r.error.slice(0, 80) : 'ok'} hscroll=${r.checks?.probe?.hscroll} moved=${r.checks?.q1?.moved}`)
  }
  for (const route of PLACEHOLDERS) for (const w of PH_WIDTHS) {
    await audit(route, w, true)
    const r = results[`${route}@${w}`]
    console.log(`${route} @${w}: ${r.blocked ? 'BLOCKED' : r.error ? 'ERR' : 'ok'} unbuilt=${r.checks?.probe?.unbuilt}`)
  }

  writeFileSync(join(ROOT, 'results', 'ux3-people-1.json'), JSON.stringify({ results, consoleErrs }, null, 2))
  await browser.close()
  console.log('DONE')
}
main().catch((e) => { console.error(e); process.exit(1) })
