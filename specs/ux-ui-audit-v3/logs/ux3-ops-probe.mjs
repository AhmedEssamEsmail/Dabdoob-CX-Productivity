// UX3 P2-OPS-01 probe v2 — read-only audit driver. Screenshots + DOM metrics.
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = 'http://localhost:3000'
const OUT = 'specs/ux-ui-audit-v3/results/ux3-screens/operations'
const JSON_OUT = 'specs/ux-ui-audit-v3/logs/ux3-ops-probe.json'
const EMAIL = 'e2e.admin@dabdoob.com'
const PASS = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'
const result = { routes: {}, notes: [] }
const save = () => fs.writeFileSync(JSON_OUT, JSON.stringify(result, null, 1))

async function fillSticky(page, sel, val) {
  await page.waitForLoadState('networkidle')
  const input = page.locator(sel)
  for (let i = 0; i < 20; i++) {
    await input.fill(val)
    if ((await input.inputValue()) === val) return
    await page.waitForTimeout(200)
  }
  throw new Error('fill failed ' + sel)
}

async function login(page) {
  for (let a = 0; a < 4; a++) {
    await page.goto(BASE + '/auth/login')
    await fillSticky(page, 'input[type="email"]', EMAIL)
    await fillSticky(page, 'input[type="password"]', PASS)
    const [res] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 12000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (res?.ok()) {
      try { await page.waitForURL(BASE + '/', { timeout: 8000 }); return } catch {}
    }
    await page.waitForTimeout(500 * (a + 1))
  }
  throw new Error('login failed')
}

const idle = async (page, ms = 8000) => page.waitForLoadState('networkidle', { timeout: ms }).catch(() => null)

const collect = () => {
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  const doc = document.documentElement
  const hscroll = { scrollW: doc.scrollWidth, innerW: window.innerWidth, ok: doc.scrollWidth <= window.innerWidth }
  const overflowEls = []
  document.querySelectorAll('body *').forEach(el => {
    if (!vis(el)) return
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const cs = getComputedStyle(el)
      const isScrollBox = /(auto|scroll)/.test(cs.overflowX)
      if (!isScrollBox && el.getBoundingClientRect().right > window.innerWidth + 1)
        overflowEls.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 80), right: Math.round(el.getBoundingClientRect().right), sw: el.scrollWidth, cw: el.clientWidth })
    }
  })
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({ lvl: h.tagName, text: h.textContent.trim().slice(0, 60) }))
  const landmarks = []
  document.querySelectorAll('nav,main,header,footer,aside,[role=navigation],[role=main],[role=banner],[role=contentinfo],section[aria-labelledby],section[aria-label]').forEach(el => {
    landmarks.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '', label: el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || '', cls: (el.className || '').toString().slice(0, 50) })
  })
  const controls = []
  document.querySelectorAll('button,input,select,textarea,a[href],[tabindex]').forEach(el => {
    if (!vis(el)) return
    const id = el.id
    const lbl = id ? document.querySelector(`label[for="${id}"]`) : null
    const wrappingLabel = el.closest('label')
    controls.push({
      tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || '', cls: (el.className || '').toString().slice(0, 60),
      name: (el.getAttribute('aria-label') || lbl?.textContent || wrappingLabel?.textContent || el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 60),
      disabled: !!el.disabled, tabindex: el.getAttribute('tabindex'), inlineStyle: el.getAttribute('style') || null,
    })
  })
  const inlineStyled = []
  document.querySelectorAll('[style]').forEach(el => { const s = el.getAttribute('style'); if (/px|#[0-9a-fA-F]|rgb/.test(s)) inlineStyled.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 50), style: s.slice(0, 80) }) })
  const alerts = [...document.querySelectorAll('[role=alert],[role=status]')].map(e => e.textContent.trim().slice(0, 100))
  const head = document.querySelector('.page-head')
  const headRect = head ? { y: Math.round(head.getBoundingClientRect().y), h: Math.round(head.getBoundingClientRect().height) } : null
  return { hscroll, overflowEls: overflowEls.slice(0, 15), headings, landmarks: landmarks.slice(0, 20), controls: controls.slice(0, 80), nControls: controls.length, inlineStyled: inlineStyled.slice(0, 15), nInlineStyled: inlineStyled.length, alerts, headRect, title: document.title }
}

async function focusAudit(page, n = 14) {
  const out = []
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(80)
    const d = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      const lbl = el.getAttribute('aria-label') || el.textContent?.trim() || el.getAttribute('placeholder') || el.id || ''
      return { tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 50), label: lbl.slice(0, 40), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`.slice(0, 80), boxShadow: cs.boxShadow === 'none' ? '' : cs.boxShadow.slice(0, 80) }
    })
    out.push(d)
  }
  return out
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const consoleErrs = []
page.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text().slice(0, 160)) })
page.on('pageerror', e => consoleErrs.push('PAGEERROR ' + String(e).slice(0, 160)))

await login(page)
result.notes.push('login ok'); save()

// ---------------- /trackers at 4 widths ----------------
for (const w of [375, 768, 1024, 1440]) {
  const key = `trackers@${w}`
  try {
    await page.setViewportSize({ width: w, height: 900 })
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await page.goto(BASE + '/trackers')
    await page.waitForTimeout(250)
    const skel = await page.locator('.trk-skel').count()
    if (w === 1024 && skel) await page.screenshot({ path: `${OUT}/trackers-loading-1024.png` })
    await idle(page)
    await page.waitForSelector('.trk-body, .trk-banner-error, .trk-empty, .trk-create, .trk-page', { timeout: 15000 }).catch(() => null)
    await page.waitForTimeout(400)
    // diagnose API payload + DOM mode
    const diag = await page.evaluate(async () => {
      const d = await fetch('/api/trackers?t=').then(r => r.json()).catch(e => ({ apiErr: String(e) }))
      const sel = document.querySelector('#trk-switch')
      return {
        api: d ? { nTrackers: d.trackers?.length, names: (d.trackers || []).map(t => t.name).slice(0, 8), error: d.error || null, hasCurrent: !!d.current, canCreate: d.canCreate } : null,
        hasBody: !!document.querySelector('.trk-body'), hasCreate: !!document.querySelector('.trk-create'),
        hasBannerErr: !!document.querySelector('.trk-banner-error'), hasEmpty: !!document.querySelector('.trk-empty'),
        switchValue: sel?.value, switchOptions: sel ? [...sel.options].map(o => o.value + '|' + o.textContent.trim().slice(0, 40)) : [],
      }
    })
    const snap1 = await page.evaluate(collect)
    snap1.diag = diag
    // Q1 exercise: switch tracker via the switcher, watch header stability + busy state
    const vals = (diag.switchOptions || []).map(o => o.split('|')[0]).filter(v => v !== '__new__' && v !== '')
    let switchInfo = { options: diag.switchOptions?.length ?? 0, realOptions: vals.length }
    if (vals.length > 1 || (vals.length === 1 && diag.switchValue !== vals[0])) {
      const cur = diag.switchValue
      const next = vals.find(v => v !== cur) ?? vals[0]
      await page.selectOption('#trk-switch', next)
      await page.waitForTimeout(150)
      switchInfo.busyShown = (await page.locator('.trk-body.is-busy').count()) > 0
      await idle(page)
      await page.waitForTimeout(500)
      const snap2 = await page.evaluate(collect)
      switchInfo.headBefore = snap1.headRect
      switchInfo.headAfter = snap2.headRect
      switchInfo.stable = snap1.headRect && snap2.headRect && snap1.headRect.y === snap2.headRect.y && snap1.headRect.h === snap2.headRect.h
      await page.selectOption('#trk-switch', cur).catch(() => null)
      await idle(page, 5000)
      await page.waitForTimeout(300)
    } else switchInfo.skipped = 'one-or-zero real tracker options'
    const snap = await page.evaluate(collect)
    snap.diag = diag
    snap.switchInfo = switchInfo
    snap.focusTrail = await focusAudit(page)
    await page.screenshot({ path: `${OUT}/trackers-${w}.png`, fullPage: true })
    // empty state via records search (375)
    if (w === 375) {
      const search = page.locator('input[placeholder="Search records"]')
      if (await search.count()) {
        await search.fill('zzzzno-such-record')
        await page.waitForTimeout(300)
        snap.emptyStateText = await page.locator('.trk-empty').first().textContent().catch(() => null)
        await page.screenshot({ path: `${OUT}/trackers-search-empty-375.png`, fullPage: true })
        await search.fill('')
        await page.waitForTimeout(200)
      } else snap.emptyStateText = 'NO-SEARCH-INPUT (no tracker body)'
    }
    // error state via network abort on records API (1024)
    if (w === 1024 && vals.length) {
      await page.route('**/api/trackers/records**', r => r.abort())
      const cur = await page.locator('#trk-switch').inputValue()
      const next = vals.find(v => v !== cur)
      if (next) {
        await page.selectOption('#trk-switch', next)
        await page.waitForTimeout(900)
        snap.errorBanner = await page.locator('.trk-banner-error, [role=alert]').first().textContent().catch(() => null)
        const snapErr = await page.evaluate(collect)
        snap.errorHeadRect = snapErr.headRect
        snap.errorHscroll = snapErr.hscroll
        await page.screenshot({ path: `${OUT}/trackers-error-1024.png`, fullPage: true })
      } else snap.errorBanner = 'NO-SECOND-TRACKER'
      await page.unrouteAll({ behavior: 'ignoreErrors' })
    }
    result.routes[key] = snap
  } catch (e) {
    result.routes[key] = { crashed: String(e).slice(0, 300) }
    result.notes.push(`${key} crashed`)
    await page.screenshot({ path: `${OUT}/trackers-${w}-crash.png`, fullPage: true }).catch(() => null)
  }
  save()
}

// ---------------- /escalation-matrix placeholder (375 + 1440) ----------------
for (const w of [375, 1440]) {
  const key = `escalation-matrix@${w}`
  try {
    await page.setViewportSize({ width: w, height: 900 })
    const resp = await page.goto(BASE + '/escalation-matrix')
    await idle(page)
    await page.waitForTimeout(300)
    const snap = await page.evaluate(collect)
    snap.status = resp?.status()
    snap.unbuilt = {
      hasPageHead: await page.locator('.page-head').count(),
      hasEmpty: await page.locator('.empty, [class*=empty]').count(),
      bodyText: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 240),
    }
    await page.screenshot({ path: `${OUT}/escalation-matrix-${w}.png`, fullPage: true })
    result.routes[key] = snap
  } catch (e) {
    result.routes[key] = { crashed: String(e).slice(0, 300) }
  }
  save()
}

result.consoleErrs = consoleErrs.slice(0, 20)
save()
await browser.close()
console.log('DONE ' + Object.keys(result.routes).join(','))
