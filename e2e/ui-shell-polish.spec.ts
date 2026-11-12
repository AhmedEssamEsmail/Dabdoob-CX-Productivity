import { expect, test, type Page } from '@playwright/test'
import { E2E_USERS, fillSticky, login } from './users'

/**
 * ui-shell-polish debug/repro spec — one test per PLAN.md success criterion.
 * Each test captures evidence screenshots under specs/ui-shell-polish/reports/
 * and asserts the FIXED behaviour, so they fail now for the right reason.
 * Debug artifact: will be tightened by the implementer; do not edit to pass.
 */

const SHOTS = 'specs/ui-shell-polish/reports'

async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
}

/** POST a /api/qa action inside the page's session; return status + body head. */
function qaProbe(page: Page, action: string, args: unknown[]) {
  return page.evaluate(
    async ([a, ar]) => {
      const r = await fetch(`/api/qa/${a}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ args: ar }),
      })
      const t = await r.text()
      // dev 500 pages embed the message; extract the interesting window
      const m = t.match(/"message":"([^"]{0,600})"/) || t.match(/Error[^<]{0,600}/) || t.match(/[\s\S]{0,600}error[\s\S]{0,600}/i)
      return { status: r.status, body: m ? m[0].slice(0, 1200) : t.slice(0, 1200) }
    },
    [action, args] as const
  )
}

test('item1: /quality-scores TL drill — agents table headers align with cells', async ({
  page,
}) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, E2E_USERS.admin)
  await page.goto('/quality-scores')
  await ready(page)

  // probe the data API to capture the real server error if the page fails
  for (const [a, ar] of [
    ['getQaAccess', []],
    ['getQaScoresPage', ['2026-01-25', '2026-02-24', 'interaction']],
  ] as const) {
    const probe = await qaProbe(page, a, [...ar])
    console.log(`item1 api probe ${a}:`, JSON.stringify(probe))
  }
  await page.screenshot({ path: `${SHOTS}/item1-quality-scores-state.png`, fullPage: true })

  const table = page.locator('section[aria-labelledby="qs-tbl-h"] table')
  await expect(table.locator('tbody tr').first()).toBeVisible({ timeout: 30000 })

  // click the first team-lead link in "Who is behind the score"
  await table.locator('tbody tr td button.qa-link').first().click()
  await expect(page.locator('.qs-crumbs')).toBeVisible()
  await page.waitForTimeout(400) // let the drilled rows paint
  await page.screenshot({ path: `${SHOTS}/item1-agents-for-tl-1440.png`, fullPage: true })

  // measure per-column header-text vs cell-content inline-start offsets
  const align = await page.evaluate(() => {
    const t = document.querySelector('section[aria-labelledby="qs-tbl-h"] table')!
    const ths = [...t.querySelectorAll('thead th')]
    const firstRow = t.querySelector('tbody tr')!
    const tds = [...firstRow.querySelectorAll('td')]
    return ths.map((th, i) => ({
      col: i,
      header: (th.textContent ?? '').trim(),
      thLeft: th.getBoundingClientRect().left,
      tdLeft: tds[i]?.getBoundingClientRect().left ?? null,
      thTextLeft:
        th.querySelector('button')?.getBoundingClientRect().left ??
        th.getBoundingClientRect().left,
    }))
  })
  console.log('item1 alignment:', JSON.stringify(align))

  await page.setViewportSize({ width: 375, height: 720 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/item1-agents-for-tl-375.png`, fullPage: true })
  expect(align.length, 'expected 6 measured columns').toBe(6)
  for (const col of align) {
    expect(
      col.tdLeft !== null && Math.abs(col.thLeft - col.tdLeft) <= 1,
      `col ${col.col} "${col.header}": thLeft=${col.thLeft} tdLeft=${col.tdLeft} differ >1px`
    ).toBe(true)
  }
})

test('item2: /calibration AssignForm — fields do not overlap', async ({ page }) => {
  test.setTimeout(120000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, E2E_USERS.admin)
  await page.goto('/calibration')
  await ready(page)

  const probe = await qaProbe(page, 'getQaCalibrationPage', [])
  console.log('item2 api probe:', JSON.stringify(probe))
  await page.screenshot({ path: `${SHOTS}/item2-calibration-state.png`, fullPage: true })

  const form = page.locator('form.qa-grid')
  await expect(form).toBeVisible({ timeout: 30000 })
  await form.screenshot({ path: `${SHOTS}/item2-calibration-assignform.png` })

  const overlaps = await page.evaluate(() => {
    const kids = [...document.querySelectorAll('form.qa-grid > *')].filter(
      (el) => !(el as HTMLElement).hidden
    )
    const bad: string[] = []
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect()
        const b = kids[j].getBoundingClientRect()
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ox > 0.5 && oy > 0.5) {
          bad.push(
            `${kids[i].className} x ${kids[j].className}: overlap ${ox.toFixed(1)}x${oy.toFixed(1)}`
          )
        }
      }
    }
    return bad
  })
  console.log('item2 overlaps:', JSON.stringify(overlaps))
  expect(overlaps, 'AssignForm field boxes overlap').toEqual([])
})

test('item3: /auth/login — persistent busy overlay with spinner until nav', async ({
  page,
}) => {
  test.setTimeout(60000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/auth/login')
  await fillSticky(page, 'input[type="email"]', E2E_USERS.admin)
  await fillSticky(page, 'input[type="password"]', 'E2E-cx-local-2026!')

  await page.click('button[type="submit"]')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/item3-login-after-click.png` })

  // sample the busy affordance until the URL leaves /auth/login (max 8s)
  const samples: { t: number; url: string; busy: boolean; btnText: string }[] = []
  const t0 = Date.now()
  for (let i = 0; i < 80; i++) {
    const state = await page.evaluate(() => {
      const btn = document.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement | null
      const spinner = document.querySelector('.spinner, .is-busy')
      const overlay = document.querySelector(
        '[role="status"], .login-overlay, dialog[open]'
      )
      const vis = (el: Element | null) =>
        !!el && (el as HTMLElement).offsetParent !== null
      return {
        url: location.pathname,
        busy: vis(spinner) || vis(overlay) || (btn?.disabled ?? false),
        btnText: btn?.textContent?.trim() ?? '',
      }
    })
    samples.push({ t: Date.now() - t0, ...state })
    if (state.url !== '/auth/login') break
    await page.waitForTimeout(100)
  }
  console.log('item3 samples:', JSON.stringify(samples.slice(0, 40)))
  console.log('item3 last:', JSON.stringify(samples.at(-1)))
  await page.screenshot({ path: `${SHOTS}/item3-login-end.png` })

  const dead = samples.filter((s) => s.url === '/auth/login' && !s.busy)
  console.log(`item3 dead-time samples on /auth/login: ${dead.length}`)
  // FIXED behaviour: a busy affordance is present while still on /auth/login
  expect(
    samples.some((s) => s.url === '/auth/login' && s.busy),
    'no busy sample while still on /auth/login'
  ).toBe(true)
  expect(dead.length, 'dead-time samples on /auth/login').toBe(0)
})

test('item4: nav link — immediate feedback + entry animation for new page', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, E2E_USERS.admin)
  await page.goto('/overview')
  await ready(page)

  const link = page.locator('.nav-link').filter({ hasNotText: /overview/i }).first()
  const href = await link.getAttribute('href')
  await link.click()
  // immediate feedback on the clicked link?
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${SHOTS}/item4-nav-click-250ms.png` })
  const clickedState = await page.evaluate((h) => {
    const el = document.querySelector(`.nav-link[href="${h}"]`)
    return {
      cls: el?.className ?? '',
      ariaBusy: el?.getAttribute('aria-busy'),
      dataPending: el?.getAttribute('data-pending'),
      entry: document.documentElement.dataset.entry,
      pageAnim: getComputedStyle(
        document.querySelector('.page > *') ?? document.body
      ).animationName,
      vtName: getComputedStyle(document.querySelector('.page') ?? document.body)
        .viewTransitionName,
    }
  }, href ?? '')
  console.log('item4 clicked state:', JSON.stringify(clickedState))
  await ready(page)

  // FIXED behaviour (either leg): clicked link shows pending affordance, or the
  // incoming page animates under data-entry="calm"
  const hasFeedback =
    clickedState.cls.includes('pending') ||
    clickedState.cls.includes('busy') ||
    clickedState.ariaBusy === 'true' ||
    clickedState.dataPending === 'true' ||
    clickedState.pageAnim !== 'none'
  expect(hasFeedback, JSON.stringify(clickedState)).toBe(true)
})

test('item5: /admin Reminders — compact row with Toggle', async ({ page }) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, E2E_USERS.admin)
  await page.goto('/admin')
  await ready(page)

  const section = page.locator('#reminders')
  await expect(section).toBeVisible({ timeout: 20000 })
  await section.scrollIntoViewIfNeeded()
  await section.screenshot({ path: `${SHOTS}/item5-admin-reminders.png` })

  // FIXED behaviour: a cx-toggle switch, not a Turn on/off button
  await expect(
    section.locator('.cx-toggle input[type="checkbox"]'),
    'Reminders section has no Toggle checkbox'
  ).toHaveCount(1)
})

test('items6+7: rail footer — no avatar; user name small + truncated', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page, E2E_USERS.admin)
  await page.goto('/overview')
  await ready(page)

  const foot = page.locator('.rail-foot')
  await expect(foot).toBeVisible({ timeout: 20000 })
  // identify + hide anything overlapping the rail foot (test-only)
  const overlayers = await page.evaluate(() => {
    const foot = document.querySelector('.rail-foot')!
    const fr = foot.getBoundingClientRect()
    const hits: string[] = []
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (
        (cs.position === 'fixed' || cs.position === 'absolute') &&
        r.width > 4 && r.height > 4 &&
        r.left < fr.right && r.right > fr.left && r.top < fr.bottom && r.bottom > fr.top &&
        !foot.contains(el) && !el.contains(foot)
      ) {
        hits.push(`${el.tagName}.${el.className}@${Math.round(r.left)},${Math.round(r.top)}`)
        ;(el as HTMLElement).style.display = 'none'
      }
    })
    return hits
  })
  console.log('items6+7 overlayers:', JSON.stringify(overlayers))
  // identify the red pill via hit-testing at the rail-foot's centre-left
  const pill = await page.evaluate(() => {
    const foot = document.querySelector('.rail-foot')!.getBoundingClientRect()
    const stack = document.elementsFromPoint(foot.left + 55, foot.top + foot.height / 2)
    const info = stack.slice(0, 5).map((el) => ({
      tag: el.tagName,
      cls: (el as HTMLElement).className?.toString?.().slice(0, 80),
      pos: getComputedStyle(el).position,
      txt: (el.textContent ?? '').trim().slice(0, 60),
    }))
    const top = stack[0] as HTMLElement | undefined
    return { info, topHtml: top?.outerHTML?.slice(0, 400) ?? null }
  })
  console.log('items6+7 pill:', JSON.stringify(pill))
  // hide the Next.js dev-tools portal (not app UI) for a clean evidence shot
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' })
  await foot.screenshot({ path: `${SHOTS}/item6-7-rail-foot.png` })
  await page.locator('.rail').screenshot({ path: `${SHOTS}/item6-7-rail.png` })

  const who = await page.evaluate(() => {
    const el = document.querySelector('.rail-foot .who')
    if (!el) return null
    const cs = getComputedStyle(el)
    return {
      fontSize: cs.fontSize,
      overflow: cs.overflow,
      textOverflow: cs.textOverflow,
      whiteSpace: cs.whiteSpace,
      heightPx: el.getBoundingClientRect().height,
    }
  })
  console.log('items6+7 who styles:', JSON.stringify(who))

  await expect(
    foot.locator('.avatar'),
    'rail-foot still renders .avatar'
  ).toHaveCount(0)
  // FIXED behaviour: name line is compact — small font AND single-line ellipsis
  expect(
    who &&
      parseFloat(who.fontSize) <= 14 &&
      who.textOverflow === 'ellipsis',
    `.who styles ${JSON.stringify(who)} should be <=14px with ellipsis`
  ).toBe(true)
})
