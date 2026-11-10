// ux-ui-audit-v2 Phase A CAPTURE — screenshots every src/app route at
// 1440w + 390w (768w extra for table/dashboard routes) into shots/.
// Reuses e2e seeded users (e2e/seed-users.mjs) + the real login form
// (e2e/users.ts contract). Run: node specs/ux-ui-audit-v2/capture-shots.mjs
// Requires `npm run dev` already serving http://localhost:3000.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)))
const SHOTS = join(ROOT, 'shots')
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'

const USERS = {
  admin: 'e2e.admin@dabdoob.com',
  tl: 'e2e.tl@dabdoob.com',
  agent: 'e2e.agent@dabdoob.com',
}

// Every src/app/**/page.tsx route. [...slug] is the catch-all — probed via
// a bogus path. auth/logout is a redirect page (lands on /auth/login).
const ROUTES = [
  '/', '/overview', '/agents', '/analytics', '/ecosystem',
  '/quality-scores', '/quality-analytics', '/qa-forms', '/calibration',
  '/disputes', '/audit-queue',
  '/queue', '/mail-desk', '/heatmap', '/scheduler',
  '/people-holidays', '/coaching', '/one-on-ones', '/meetings',
  '/checkins', '/notes', '/my-actions', '/my-auditor-kpis', '/my-audits',
  '/my-day', '/my-status',
  '/productivity-analytics', '/tph', '/tph-grid', '/kpi-logs',
  '/status-validation', '/trackers',
  '/admin', '/admin/config', '/admin/roster', '/aging', '/ctls',
  '/kb-gaps', '/kb-tracker', '/tl-performance', '/tl-tasks',
  '/auth/login', '/auth/logout', '/__catchall_probe__',
]

// Routes whose primary content is tables/dashboards -> also shoot 768w.
const TABLE_ROUTES = new Set([
  '/overview', '/analytics', '/quality-analytics', '/productivity-analytics',
  '/heatmap', '/aging', '/queue', '/mail-desk', '/tph', '/tph-grid',
  '/trackers', '/tl-performance', '/tl-tasks', '/audit-queue', '/kpi-logs',
  '/status-validation', '/my-day', '/scheduler', '/disputes', '/calibration',
  '/kb-tracker', '/kb-gaps', '/admin', '/admin/config', '/admin/roster',
  '/quality-scores', '/qa-forms', '/checkins', '/meetings', '/one-on-ones',
  '/coaching', '/notes', '/my-audits', '/my-actions', '/my-auditor-kpis',
  '/agents', '/ecosystem', '/people-holidays', '/ctls', '/my-status',
])

const VIEWPORTS = [
  { tag: '1440', width: 1440, height: 900 },
  { tag: '390', width: 390, height: 844 },
  { tag: '768', width: 768, height: 1024 },
]

const DENIED_RE =
  /(not authorised|unauthori[sz]ed|access denied|permission denied|don't have (access|permission)|do not have (access|permission)|insufficient (role|permission)|forbidden)/i

const slug = (route) =>
  route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '__') || 'home'

async function login(page, email) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/auth/login')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(PASSWORD)
    const [res] = await Promise.all([
      page
        .waitForResponse(
          (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
          { timeout: 15000 }
        )
        .catch(() => null),
      page.click('button[type="submit"]'),
    ])
    if (res?.ok()) {
      try {
        await page.waitForURL('/', { timeout: 10000 })
        return true
      } catch { /* retry */ }
    }
    await page.waitForTimeout(500 * (attempt + 1))
  }
  return false
}

async function settle(page) {
  // Wait for the boot splash / client fetches to quiet down, bounded.
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
}

async function main() {
  mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch()
  const index = [] // {route, file(s), status, note}

  // One context per role; login once each.
  const ctxByRole = {}
  for (const [role, email] of Object.entries(USERS)) {
    const ctx = await browser.newContext({ baseURL: BASE })
    const page = await ctx.newPage()
    const ok = await login(page, email)
    console.log(`login ${role}: ${ok ? 'ok' : 'FAILED'}`)
    ctxByRole[role] = { ctx, ok }
    await page.close()
  }

  // Public context for /auth/login (no session).
  const pubCtx = await browser.newContext({ baseURL: BASE })

  const work = []
  for (const route of ROUTES) {
    const isPublic = route === '/auth/login'
    const isLogout = route === '/auth/logout'
    const vps = VIEWPORTS.filter(
      (v) => v.tag !== '768' || TABLE_ROUTES.has(route)
    )
    work.push({ route, vps, kind: isPublic ? 'public' : isLogout ? 'logout' : 'auth' })
  }

  // Sequential per route keeps Next dev compile + remote Supabase sane.
  for (const { route, vps, kind } of work) {
    const entry = { route, shots: [], status: 'ok', note: '' }
    let chosen = null // {ctx, role, page?} — page is the successful probe, reused for vp[0]

    if (kind === 'public') {
      chosen = { ctx: pubCtx, role: 'anon' }
    } else if (kind === 'logout') {
      // /auth/logout bounces through the API sign-out -> /auth/login.
      // Capture the landing page once as admin and note the redirect.
      chosen = ctxByRole.admin.ok ? { ctx: ctxByRole.admin.ctx, role: 'admin' } : null
      entry.note = 'redirect page: /auth/logout -> /api/auth/logout -> /auth/login'
    } else {
      for (const role of ['admin', 'tl', 'agent']) {
        if (!ctxByRole[role].ok) continue
        const probe = await ctxByRole[role].ctx.newPage()
        try {
          await probe.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 })
          await settle(probe)
          const url = probe.url()
          const text = (await probe.locator('body').innerText().catch(() => '')).slice(0, 20000)
          if (url.includes('/auth/login')) {
            entry.note = `redirected to /auth/login (no session for ${role})`
            await probe.close().catch(() => {})
            continue
          }
          if (DENIED_RE.test(text)) {
            entry.note = `role-denied for ${role}: ${text.match(DENIED_RE)?.[0]}`
            await probe.close().catch(() => {})
            continue
          }
          chosen = { ctx: ctxByRole[role].ctx, role, page: probe }
          entry.note = role !== 'admin' ? `captured as ${role} (admin denied)` : ''
          break
        } catch (e) {
          entry.note = `error probing as ${role}: ${String(e).slice(0, 160)}`
          await probe.close().catch(() => {})
        }
        if (chosen) break
        await probe.close().catch(() => {})
      }
    }

    if (!chosen) {
      entry.status = 'unreachable'
      index.push(entry)
      console.log(`SKIP ${route} — ${entry.note || 'no working role'}`)
      continue
    }

    // Reuse the probe page for the first viewport (already on `route`).
    let shotIndex = 0
    if (chosen.page) {
      const vp = vps[0]
      const page = chosen.page
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await settle(page)
        const file = `${slug(route)}--${vp.tag}.png`
        await page.screenshot({ path: join(SHOTS, file), fullPage: true })
        entry.shots.push(file)
        shotIndex = 1
      } catch (e) {
        entry.status = 'error'
        entry.note += ` shot@${vp.tag} failed: ${String(e).slice(0, 120)}`
      } finally {
        await page.close().catch(() => {})
      }
    }

    for (const vp of vps.slice(shotIndex)) {
      const page = await chosen.ctx.newPage()
      try {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        const resp = await page.goto(route, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        })
        await settle(page)
        const file = `${slug(route)}--${vp.tag}.png`
        await page.screenshot({ path: join(SHOTS, file), fullPage: true })
        entry.shots.push(file)
        if (resp && resp.status() >= 400) entry.status = `http-${resp.status()}`
      } catch (e) {
        entry.status = 'error'
        entry.note += ` shot@${vp.tag} failed: ${String(e).slice(0, 120)}`
      } finally {
        await page.close()
      }
    }
    index.push(entry)
    console.log(`${entry.status.toUpperCase()} ${route} [${chosen.role}] -> ${entry.shots.length} shot(s)`)
  }

  // Persist index as JSON for INDEX.md generation.
  writeFileSync(join(SHOTS, '_index.json'), JSON.stringify(index, null, 2))
  await browser.close()
  console.log('DONE')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
