// Post-fix UX spot-check (round-1 FULL gate): login as admin, capture key
// routes at 1440 + 390, flag horizontal scroll + page errors.
// Run: node specs/ux-ui-audit-v2/verify-ux-final.mjs  (dev server on :3000)
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, 'shots', 'post-fix')
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'
const EMAIL = 'e2e.admin@dabdoob.com'

const ROUTES = ['/overview', '/queue', '/my-day', '/status-validation', '/auth/login']
const VPS = [
  { tag: '1440', width: 1440, height: 900 },
  { tag: '390', width: 390, height: 844 },
]

const results = []

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(900)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE })
  const page = await ctx.newPage()

  // login
  let loggedIn = false
  for (let i = 0; i < 4 && !loggedIn; i++) {
    await page.goto('/auth/login')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    const [res] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
        { timeout: 15000 }
      ).catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (res?.ok()) {
      try { await page.waitForURL('/', { timeout: 10000 }); loggedIn = true } catch {}
    }
    if (!loggedIn) await page.waitForTimeout(600 * (i + 1))
  }
  console.log(`login: ${loggedIn ? 'ok' : 'FAILED'}`)

  for (const route of ROUTES) {
    for (const vp of VPS) {
      const p = await ctx.newPage()
      const errs = []
      p.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
      const r = { route, vp: vp.tag }
      try {
        await p.setViewportSize({ width: vp.width, height: vp.height })
        if (route === '/auth/login') {
          // fresh unauthenticated context for the public page
          const pub = await browser.newContext({ baseURL: BASE })
          const pp = await pub.newPage()
          await pp.setViewportSize({ width: vp.width, height: vp.height })
          await pp.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 })
          await settle(pp)
          r.hScroll = await pp.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
          )
          const file = `login--${vp.tag}.png`
          await pp.screenshot({ path: join(OUT, file), fullPage: true })
          r.shot = file
          await pub.close()
          results.push(r)
          console.log(`${route} @${vp.tag}: hScroll=${r.hScroll} -> ${file}`)
          continue
        }
        if (!loggedIn) { r.skip = 'no login'; results.push(r); continue }
        await p.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await settle(p)
        r.url = p.url()
        r.hScroll = await p.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        )
        r.h1 = await p.locator('h1').first().innerText().catch(() => null)
        r.pageErrs = errs
        const file = `${route.replace(/^\//, '').replace(/\//g, '__')}--${vp.tag}.png`
        await p.screenshot({ path: join(OUT, file), fullPage: true })
        r.shot = file
      } catch (e) {
        r.error = String(e).slice(0, 160)
      } finally {
        await p.close().catch(() => {})
      }
      results.push(r)
      console.log(`${route} @${vp.tag}: hScroll=${r.hScroll} h1=${JSON.stringify(r.h1)} -> ${r.shot || r.error}`)
    }
  }
  writeFileSync(join(OUT, '_results.json'), JSON.stringify(results, null, 2))
  await browser.close()
  console.log('DONE')
}

main().catch((e) => { console.error(e); process.exit(1) })
