// P2-QA-02 audit probe — 5 cx-quality routes x {375,768,1024,1440}
// Read-only on source. Writes screenshots to results/ux3-screens/quality/
// and probe JSON to logs/qa2-probe.json. Requires dev server on :3000 and
// seeded e2e users (npm run test:e2e:seed).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(ROOT, 'results', 'ux3-screens', 'quality')
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'
const USERS = { admin: 'e2e.admin@dabdoob.com', agent: 'e2e.agent@dabdoob.com' }

const ROUTES = [
  { url: '/quality-scores', role: 'admin' },
  { url: '/quality-analytics', role: 'admin' },
  { url: '/my-auditor-kpis', role: 'admin' },
  { url: '/my-audits', role: 'agent' },
  { url: '/qa-forms', role: 'admin' },
]
const WIDTHS = [375, 768, 1024, 1440]
const slug = (r) => r.replace(/^\//, '').replace(/\//g, '-')

async function login(page, email) {
  for (let a = 0; a < 4; a++) {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    const em = page.locator('input[type="email"]')
    const pw = page.locator('input[type="password"]')
    for (let i = 0; i < 20; i++) {
      await em.fill(email); await pw.fill(PASSWORD)
      if ((await em.inputValue()) === email) break
      await page.waitForTimeout(200)
    }
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (res?.ok()) {
      try { await page.waitForURL('/', { timeout: 10000 }); return true } catch {}
    }
    await page.waitForTimeout(500 * (a + 1))
  }
  return false
}

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(900)
}

const PROBE = `(() => {
  const vw = window.innerWidth
  const doc = document.documentElement
  const vis = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
  const out = { vw, scrollW: doc.scrollWidth, hscroll: doc.scrollWidth > vw + 1 }
  out.wideEls = [...doc.querySelectorAll('body *')].filter(el => {
    const r = el.getBoundingClientRect(); return r.width > vw + 1
  }).slice(0, 8).map(el => {
    const c = (el.getAttribute('class') || '').toString()
    return el.tagName.toLowerCase() + (c ? '.' + c.split(/\\s+/).slice(0,3).join('.') : '') + ' w=' + Math.round(el.getBoundingClientRect().width)
  })
  out.headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map(h => h.tagName + ' ' + h.textContent.trim().replace(/\\s+/g,' ').slice(0,60))
  out.landmarks = {
    nav: doc.querySelectorAll('nav,[role="navigation"]').length,
    main: doc.querySelectorAll('main,[role="main"]').length,
    banner: doc.querySelectorAll('header,[role="banner"]').length,
    contentinfo: doc.querySelectorAll('footer,[role="contentinfo"]').length,
    labelledRegions: doc.querySelectorAll('section[aria-label],section[aria-labelledby],[role="region"][aria-label],[role="region"][aria-labelledby]').length,
  }
  const nameOk = (el) => {
    if (el.getAttribute('aria-label')) return true
    const lb = el.getAttribute('aria-labelledby')
    if (lb && lb.split(/\\s+/).some(id => (document.getElementById(id)?.textContent || '').trim())) return true
    if (el.getAttribute('title')) return true
    const t = el.tagName.toLowerCase()
    if (t === 'input' || t === 'select' || t === 'textarea') {
      if ((el.getAttribute('type') || '') === 'hidden') return true
      if (el.id && doc.querySelector('label[for="' + el.id + '"]')) return true
      if (el.closest('label')) return true
      if (el.getAttribute('placeholder')) return 'placeholder'
      return false
    }
    if ((el.textContent || '').trim()) return true
    if (el.querySelector('img[alt],svg[aria-label],[aria-label]')) return true
    return false
  }
  const ctrls = [...doc.querySelectorAll('button,input,select,textarea,a[href],[role="button"],[role="tab"],[role="switch"],[role="combobox"]')].filter(vis)
  out.ctrlCount = ctrls.length
  out.unnamed = []
  out.placeholderNamed = []
  for (const el of ctrls) {
    const n = nameOk(el)
    if (n === false) out.unnamed.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' ' + (el.getAttribute('type') || '') + ' ' + (el.getAttribute('class') || '').toString().split(/\\s+/).slice(0,2).join('.'))
    if (n === 'placeholder') out.placeholderNamed.push((el.getAttribute('name') || el.getAttribute('type') || el.tagName.toLowerCase()) + ' ph=' + (el.getAttribute('placeholder') || '').slice(0, 30))
  }
  out.unnamed = out.unnamed.slice(0, 15)
  out.placeholderNamed = out.placeholderNamed.slice(0, 10)
  out.rawLinks = doc.querySelectorAll('a[href]:not([class])').length
  out.rawBtns = doc.querySelectorAll('button:not([class])').length
  out.rawInputs = doc.querySelectorAll('input:not([class]),select:not([class]),textarea:not([class])').length
  const styled = [...doc.querySelectorAll('[style]')]
  out.inlinePx = styled.map(e => e.getAttribute('style')).filter(s => /\\d+px/.test(s)).slice(0, 10)
  out.inlinePxCount = styled.filter(e => /\\d+px/.test(e.getAttribute('style') || '')).length
  out.disabled = doc.querySelectorAll('[disabled],[aria-disabled="true"]').length
  out.statusRegions = doc.querySelectorAll('[role="status"],[role="alert"],[aria-live]').length
  out.skeletons = doc.querySelectorAll('[class*="skeleton"],[class*="animate-pulse"]').length
  const bt = document.body.innerText || ''
  const m = bt.match(/[^.\\n]{0,70}(no (results|data|audits|records|items|entries|forms|scores)|nothing (to show|here)|get started|empty)[^.\\n]{0,70}/i)
  out.emptyText = m ? m[0].trim().slice(0, 140) : null
  out.tables = doc.querySelectorAll('table,[role="table"],[role="grid"]').length
  out.canvas = doc.querySelectorAll('canvas,svg.recharts-surface').length
  out.title = doc.title
  return out
})()`

async function probeInteractive(page) {
  // Q1: header/toolbar stability across a state-changing control click.
  const r = { headerSel: null, before: null, after: null, clicked: null }
  const header = page.locator('header, [role="banner"]').first()
  if (await header.count()) {
    r.headerSel = 'header'
    r.before = await header.boundingBox()
  }
  const cand = page.locator([
    'button[aria-label*="refresh" i]', 'button[title*="refresh" i]',
    'button:has-text("Refresh")', 'button:has-text("Retry")',
    'button:has-text("Reload")',
  ].join(',')).first()
  try {
    if (await cand.count() && await cand.isVisible()) {
      r.clicked = (await cand.getAttribute('aria-label')) || (await cand.innerText()).slice(0, 40)
      await cand.click()
      await page.waitForTimeout(1300)
      await settle(page)
      if (await header.count()) r.after = await header.boundingBox()
    }
  } catch (e) { r.clickErr = String(e).slice(0, 100) }
  return r
}

async function probeFocusHover(page) {
  // Q2 focus ring: Tab to first non-skip control, read outline/box-shadow.
  const focus = []
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(120)
    const f = await page.evaluate(`(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName.toLowerCase(), role: el.getAttribute('role'),
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g,' ').slice(0, 45),
        outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
        shadow: (cs.boxShadow || 'none').slice(0, 90),
        ring: /focus|ring/.test((el.getAttribute('class') || '').toString()),
        visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 200,
      }
    })()`)
    if (!f) break
    focus.push(f)
    if (focus.length >= 3 && /^(a|button|input|select|textarea)$/.test(f.tag)) break
  }
  // Q8: hover distinctness on first visible button in main.
  const hover = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll('main button, [role="main"] button, button')].find(e => e.offsetWidth > 0 && !e.disabled)
    if (!b) return null
    const cs = getComputedStyle(b)
    return { text: (b.textContent || '').trim().slice(0, 40), before: { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor } }
  })()`)
  if (hover) {
    const btn = page.locator('main button, [role="main"] button, button').filter({ hasText: hover.text || undefined }).first()
    try {
      await btn.hover({ timeout: 2000 })
      await page.waitForTimeout(250)
      hover.after = await page.evaluate(`(() => {
        const b = [...document.querySelectorAll('main button, [role="main"] button, button')].find(e => e.offsetWidth > 0 && !e.disabled)
        if (!b) return null
        const cs = getComputedStyle(b)
        return { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor }
      })()`)
    } catch {}
  }
  // selected/tab states present?
  const sel = await page.evaluate(`(() => ({
    tabs: document.querySelectorAll('[role="tab"]').length,
    selected: document.querySelectorAll('[aria-selected="true"],[aria-pressed="true"],[data-state="active"],[aria-current]').length,
    errText: document.querySelectorAll('[role="alert"],.text-destructive,[class*="destructive"]').length,
  }))()`)
  return { focus, hover, sel }
}

async function main() {
  mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  const ctxByRole = {}
  for (const [role, email] of Object.entries(USERS)) {
    const ctx = await browser.newContext({ baseURL: BASE })
    const page = await ctx.newPage()
    const ok = await login(page, email)
    console.log(`login ${role}: ${ok ? 'ok' : 'FAILED'}`)
    ctxByRole[role] = { ctx, ok }
    await page.close()
  }

  for (const { url, role } of ROUTES) {
    const entry = { route: url, role, widths: {} }
    if (!ctxByRole[role]?.ok) { entry.blocked = 'login failed'; results.push(entry); continue }
    for (const w of WIDTHS) {
      const page = await ctxByRole[role].ctx.newPage()
      const wres = {}
      try {
        await page.setViewportSize({ width: w, height: 900 })
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await settle(page)
        wres.finalUrl = page.url()
        wres.http = resp ? resp.status() : null
        if (wres.finalUrl.includes('/auth/login') || wres.finalUrl.replace(BASE, '') === '/' ) {
          wres.blocked = `bounced to ${wres.finalUrl.replace(BASE, '') || '/'}`
        } else {
          wres.static = await page.evaluate(PROBE)
          wres.inter = await probeInteractive(page)
          const fh = await probeFocusHover(page)
          wres.focus = fh.focus; wres.hover = fh.hover; wres.sel = fh.sel
          wres.staticAfter = await page.evaluate('document.documentElement.scrollWidth')
          const file = `${slug(url)}-${w}.png`
          await page.screenshot({ path: join(SHOTS, file), fullPage: true })
          wres.shot = `ux3-screens/quality/${file}`
        }
      } catch (e) {
        wres.error = String(e).slice(0, 200)
      } finally { await page.close().catch(() => {}) }
      entry.widths[w] = wres
      console.log(`${url} @${w}: ${wres.blocked ? 'BLOCKED ' + wres.blocked : wres.error ? 'ERR ' + wres.error : 'ok'}`)
    }
    results.push(entry)
  }
  writeFileSync(join(ROOT, 'logs', 'qa2-probe.json'), JSON.stringify(results, null, 1))
  await browser.close()
  console.log('DONE')
}
main().catch((e) => { console.error(e); process.exit(1) })
