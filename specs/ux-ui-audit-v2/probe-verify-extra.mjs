// verify-1 supplemental probe: qa-q via /calibration, admin kv-row cause,
// md-status token pair. Run: node specs/ux-ui-audit-v2/probe-verify-extra.mjs
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)))
const OUT = join(ROOT, 'shots', 'verify')
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'
const ADMIN = 'e2e.admin@dabdoob.com'
const R = {}

async function login(page, email) {
  for (let i = 0; i < 4; i++) {
    await page.goto('/auth/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(PASSWORD)
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (res?.ok()) { try { await page.waitForURL('/', { timeout: 10000 }); return true } catch { } }
    await page.waitForTimeout(600)
  }
  return false
}
const settle = async (p) => { await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ baseURL: BASE })
const page = await ctx.newPage()
console.log('login:', await login(page, ADMIN))

/* --- /calibration -> AuditForm --- */
await page.goto('/calibration', { waitUntil: 'domcontentloaded', timeout: 60000 })
await settle(page)
R.calibration = await page.evaluate(() => {
  return {
    buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim().slice(0, 50)).slice(0, 30),
    rows: document.querySelectorAll('tbody tr, .workitem, [class*="cal"]').length,
    bodyText: (document.querySelector('main')?.textContent || '').replace(/\s+/g, ' ').slice(0, 400),
  }
})
console.log('calibration:', JSON.stringify(R.calibration).slice(0, 800))
// try clicking first plausible calibration row/button
const clicked = await page.evaluate(() => {
  const cand = [...document.querySelectorAll('button, tr, [class*="workitem"], [class*="cal-item"], li')]
    .find((el) => /audit|calibrat|start/i.test(el.textContent || '') && !el.disabled && (el.textContent || '').length < 200)
  if (cand) { cand.click(); return (cand.textContent || '').trim().slice(0, 80) }
  return null
})
console.log('cal clicked:', clicked)
await page.waitForTimeout(2500)
await settle(page)
R.qaQ = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qa-q')]
  if (!rows.length) return { rows: 0 }
  const table = rows[0].closest('table')
  const out = { rows: rows.length }
  if (table) {
    const heads = [...table.querySelectorAll('thead th')]
    const cells = [...rows[0].querySelectorAll('td')]
    out.align = heads.map((h, i) => {
      const c = cells[i]
      return c ? +Math.abs(h.getBoundingClientRect().left - c.getBoundingClientRect().left).toFixed(1) : null
    })
    out.headCount = heads.length
  }
  return out
})
if (R.qaQ.rows) await page.screenshot({ path: join(OUT, 'auditform-qa-q.png'), fullPage: true })
console.log('qa-q:', JSON.stringify(R.qaQ))

/* --- /admin 390 kv-row cause --- */
await page.setViewportSize({ width: 390, height: 844 })
await page.goto('/admin', { waitUntil: 'domcontentloaded', timeout: 60000 })
await settle(page)
await page.waitForTimeout(1200)
R.kv = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.kv-row')]
  const hs = rows.map((r) => Math.round(r.getBoundingClientRect().height)).sort((a, b) => b - a)
  const top = rows.find((r) => Math.round(r.getBoundingClientRect().height) === hs[0])
  const detail = top ? {
    key: top.querySelector('.setting-key')?.textContent,
    valueLen: (top.querySelector('.setting-value')?.textContent || '').length,
    valuePreview: (top.querySelector('.setting-value')?.textContent || '').slice(0, 120),
    ddH: Math.round(top.querySelector('dd')?.getBoundingClientRect().height || 0),
    dtH: Math.round(top.querySelector('dt')?.getBoundingClientRect().height || 0),
    rowH: Math.round(top.getBoundingClientRect().height),
  } : null
  const lens = rows.map((r) => (r.querySelector('.setting-value')?.textContent || '').length)
  return { rowCount: rows.length, heightSum: hs.reduce((a, b) => a + b, 0), topHeights: hs.slice(0, 10), maxValueLen: Math.max(...lens, 0), detail }
})
console.log('kv:', JSON.stringify(R.kv))
await page.screenshot({ path: join(OUT, 'admin-390-kv.png'), fullPage: false })

/* --- /my-day md-status presence + token pair --- */
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto('/my-day', { waitUntil: 'domcontentloaded', timeout: 60000 })
await settle(page)
R.myDay = await page.evaluate(() => {
  const tok = (n) => { const d = document.createElement('i'); d.style.cssText = 'position:absolute;visibility:hidden;background:var(' + n + ')'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c }
  const pills = [...document.querySelectorAll('[class*="md-status"], [class*="status"]')].slice(0, 15).map((el) => ({ cls: (el.className || '').toString().slice(0, 60), text: (el.textContent || '').trim().slice(0, 30) }))
  const mdClasses = [...new Set([...document.querySelectorAll('[class*="md-"]')].flatMap((el) => (el.className || '').toString().split(' ')).filter((c) => c.startsWith('md-')))].slice(0, 40)
  return { pills, mdClasses, badBg: tok('--cx-status-bad-bg'), badFg: tok('--cx-status-bad-fg'), badEdge: tok('--cx-status-bad-edge') }
})
console.log('myDay:', JSON.stringify(R.myDay).slice(0, 1200))

/* compute bad-bg vs bad-fg ratio in node */
const parse = (c) => { const m = (c || '').match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : null }
const lum = (p) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]) }
const ratio = (a, b) => { const [h, l] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))]; return +((h + 0.05) / (l + 0.05)).toFixed(2) }
R.tokenPairs = {}
if (R.myDay.badBg && R.myDay.badFg) {
  R.tokenPairs['bad-fg on bad-bg'] = ratio(parse(R.myDay.badFg), parse(R.myDay.badBg))
  R.tokenPairs['bad-fg token'] = R.myDay.badFg; R.tokenPairs['bad-bg token'] = R.myDay.badBg
}
console.log('tokenPairs:', JSON.stringify(R.tokenPairs))

writeFileSync(join(OUT, 'measurements-extra.json'), JSON.stringify(R, null, 2))
await browser.close()
console.log('DONE')
