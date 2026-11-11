// P-19 render profiling — scripted main-thread measurement for /tph-grid and
// /audit-queue. Logs in with the seeded e2e admin, instruments longtask /
// long-animation-frame via PerformanceObserver, runs 1-2 scripted interactions
// per page, and dumps raw entries to specs/perf-pushdown/logs/perf-profile.json.
// Usage: node scripts/perf-profile.mjs   (requires `npm run dev` on :3000)
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.PERF_BASE_URL || 'http://localhost:3000'
const EMAIL = 'e2e.admin@dabdoob.com'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'specs', 'perf-pushdown', 'logs', 'perf-profile.json')

const ROUTES = ['/tph-grid', '/audit-queue']

async function login(page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(`${BASE}/auth/login`)
    await page.waitForLoadState('networkidle')
    const email = page.locator('input[type="email"]')
    const password = page.locator('input[type="password"]')
    for (let i = 0; i < 20; i++) {
      await email.fill(EMAIL)
      await password.fill(PASSWORD)
      if ((await email.inputValue()) === EMAIL && (await password.inputValue()) === PASSWORD) break
      await page.waitForTimeout(200)
    }
    const [response] = await Promise.all([
      page
        .waitForResponse(
          (res) => res.url().includes('/api/auth/login') && res.request().method() === 'POST',
          { timeout: 12000 }
        )
        .catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (response?.ok()) {
      try {
        await page.waitForURL(`${BASE}/`, { timeout: 8000 })
        return
      } catch {
        /* transient session bounce — retry */
      }
    }
    await page.waitForTimeout(500 * (attempt + 1))
  }
  throw new Error(`perf-profile: login failed for ${EMAIL}`)
}

async function instrument(page) {
  await page.addInitScript(() => {
    window.__perfEntries = []
    const push = (type, e) =>
      window.__perfEntries.push({
        type,
        duration: Math.round(e.duration * 100) / 100,
        startTime: Math.round(e.startTime),
        attribution:
          e.attribution?.map?.((a) => a.containerName || a.containerId || a.name || '') ||
          e.scripts?.map?.((s) => `${s.sourceURL || ''}:${s.sourceFunctionName || ''}`) ||
          undefined,
      })
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => push('longtask', e))).observe({
        entryTypes: ['longtask'],
      })
    } catch {}
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => push('long-animation-frame', e))).observe({
        entryTypes: ['long-animation-frame'],
      })
    } catch {}
  })
}

const snap = async (page, label) => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(300)
  const entries = await page.evaluate(() => window.__perfEntries || [])
  return { label, entries }
}

const tryClick = async (page, selector, label) => {
  const loc = page.locator(selector).first()
  if ((await loc.count()) === 0 || !(await loc.isVisible().catch(() => false))) {
    return { label, ran: false, reason: 'not present' }
  }
  if (!(await loc.isEnabled().catch(() => false))) {
    return { label, ran: false, reason: 'disabled' }
  }
  const t = await page.evaluate(() => performance.now())
  await loc.click()
  await page.waitForTimeout(800)
  await page.waitForLoadState('networkidle').catch(() => {})
  return { label, ran: true, at: Math.round(t) }
}

async function profilePage(page, route) {
  const before = await page.evaluate(() => (window.__perfEntries || []).length).catch(() => 0)
  await instrument(page)
  await page.goto(`${BASE}${route}`)
  // Let client-fetched page data settle before snapshotting. /audit-queue
  // renders a skeleton until its queue payload arrives — wait for the first
  // .workitem row or a LoadError alert, then give the list a beat to paint.
  const settleSel =
    route === '/audit-queue' ? '.workitem, [role="alert"]' : 'section.cx-panel, .tph-panel, [role="alert"]'
  await page.waitForSelector(settleSel, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(route === '/audit-queue' ? 2500 : 1500)
  const initial = await snap(page, 'initial-render')

  const interactions = []
  if (route === '/tph-grid') {
    interactions.push(await tryClick(page, '#tph-tab-grid', 'switch to grid tab'))
    interactions.push(await tryClick(page, '.tph-day button:has-text("Previous day")', 'step back one day'))
    interactions.push(await tryClick(page, 'button:has-text("remaining")', 'paged-list next page'))
  } else {
    interactions.push(await tryClick(page, 'button:has-text("Done")', 'seg filter: done'))
    interactions.push(await tryClick(page, '.workitem', 'select first work item'))
    interactions.push(await tryClick(page, 'input[type="search"], input[placeholder*="earch" i]', 'search/filter input'))
  }
  const all = await page.evaluate(() => window.__perfEntries || [])
  const meta = await page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    workitems: document.querySelectorAll('.workitem').length,
    tphTabs: document.querySelectorAll('[role="tab"]').length,
    alerts: [...document.querySelectorAll('[role="alert"]')]
      .map((e) => (e.textContent || '').trim().slice(0, 200))
      .filter(Boolean),
  }))
  return {
    route,
    meta,
    entries: all.slice(before),
    interactions,
    segments: [initial, ...interactions.map((i) => ({ label: i.label, ran: i.ran, at: i.at }))],
  }
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
try {
  await login(page)
  page.on('response', async (res) => {
    if (res.url().includes('/api/qa') && res.status() >= 400) {
      const body = await res.text().catch(() => '')
      console.log(`  api/qa ${res.status()} ${res.url().slice(-60)} :: ${body.slice(0, 300)}`)
    }
  })
  const result = { generatedAt: new Date().toISOString(), baseURL: BASE, pages: {} }
  for (const route of ROUTES) {
    result.pages[route] = await profilePage(page, route)
  }
  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(result, null, 2))
  for (const route of ROUTES) {
    const p = result.pages[route]
    const over = p.entries.filter((e) => e.duration > 50)
    console.log(`${route}: ${p.entries.length} long entries, ${over.length} >50ms`)
    for (const i of p.interactions) console.log(`  interaction "${i.label}": ${i.ran ? 'ran' : 'skipped (' + i.reason + ')'}`)
  }
  console.log(`wrote ${OUT}`)
} finally {
  await browser.close()
}
