// Capture console + dev-overlay issue text for the 5 QA-02 routes.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const ROOT = dirname(fileURLToPath(import.meta.url))
const b = await chromium.launch()
const ctx = await b.newContext({ baseURL: 'http://localhost:3000' })
const p = await ctx.newPage()
const msgs = []
p.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') msgs.push(t + ': ' + m.text().slice(0, 300)) })
p.on('pageerror', e => msgs.push('pageerror: ' + String(e).slice(0, 300)))
await p.goto('/auth/login'); await p.waitForLoadState('networkidle')
await p.fill('input[type=email]', 'e2e.admin@dabdoob.com')
await p.fill('input[type=password]', process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!')
await Promise.all([
  p.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null),
  p.click('button[type=submit]'),
])
await p.waitForURL('/', { timeout: 10000 }).catch(() => {})
const routes = ['/quality-scores', '/quality-analytics', '/my-auditor-kpis', '/qa-forms']
const out = {}
for (const r of routes) {
  msgs.length = 0
  await p.setViewportSize({ width: 1024, height: 900 })
  await p.goto(r, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await p.waitForTimeout(1200)
  const overlay = await p.evaluate(`(() => {
    const el = document.querySelector('nextjs-portal,[data-nextjs-dialog],#nextjs__container_errors_title,[class*=nextjs]')
    const portal = document.querySelector('nextjs-portal')
    const txt = portal ? (portal.shadowRoot ? portal.shadowRoot.textContent : portal.textContent) : ''
    return txt.replace(/\\s+/g, ' ').slice(0, 400)
  })()`)
  out[r] = { console: msgs.slice(0, 8), overlay }
}
writeFileSync(join(ROOT, 'logs', 'qa2-console.json'), JSON.stringify(out, null, 1))
await b.close()
console.log('DONE')
