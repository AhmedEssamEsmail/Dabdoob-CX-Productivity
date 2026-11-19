import { expect, test, type Browser, type Page } from '@playwright/test'
import { ROUTES } from './routes'
import { E2E_USERS, login } from './users'

/**
 * PLAN #3 — page-frame geometry (S08-01). Every routed page renders the
 * PageShell head slots at identical coordinates: h1.page-title font metrics
 * and top/left equal ±2 px across all routes at 1024/1440 px; .page-actions
 * right edge == .page-head right edge ±2 px; .page-bar/.page-stats
 * inter-slot gaps equal ±2 px among routes sharing the slot. At 375 px the
 * slots stack strictly head → bar → stats → body with no horizontal scroll.
 * `/ecosystem` is exempt — bare .eco3 chrome outside .main (docs/PAGE-FRAME.md).
 * Routes come from e2e/routes.ts at spec-load time, same as page-contract.
 * Violations are collected for every route before asserting, so one failure
 * reports the full offender list instead of the first route only.
 */

const FRAME_EXCLUDED = new Set(['/ecosystem'])
const FRAME_ROUTES = ROUTES.filter((r) => !FRAME_EXCLUDED.has(r.path))
const WIDTHS = [1024, 1440] as const
const HEIGHT = 720
const TOL = 2 // px

/** Known-benign console noise — same convention as page-contract.spec.ts. */
const CONSOLE_ALLOWLIST: RegExp[] = [
  /favicon/,
  /devtools/i,
  /Hydration/i,
  /supabase.*(token|refresh)/i,
  /Fetch API cannot load .*localhost:3000.* due to access control checks/,
]

/** Generic ready-wait — same pattern as page-contract.spec.ts:53-56. */
async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
}

/** Per-route frame metrics collected in a single page.evaluate pass. */
interface FrameMetrics {
  ok: boolean
  reason?: string
  title?: { fontSize: string; fontWeight: string; lineHeight: string; top: number; left: number }
  purposeFontSize?: string | null
  /** .page-actions right edge minus .page-head right edge (px). */
  actionsDelta?: number | null
  /** Slot top minus preceding-slot bottom (px); null when slot absent. */
  gapBar?: number | null
  gapStats?: number | null
  tops?: { head: number; bar?: number; stats?: number; body?: number }
  hScroll?: number
}

/** Runs inside the page — must stay self-contained for page.evaluate. */
function measureFrame(): FrameMetrics {
  const top = (el?: Element | null) => (el ? el.getBoundingClientRect().top : undefined)
  const bottom = (el?: Element | null) => (el ? el.getBoundingClientRect().bottom : undefined)
  const hScroll = document.documentElement.scrollWidth - window.innerWidth
  const pageEl = document.querySelector('section.page') ?? document.querySelector('.page')
  if (!pageEl) return { ok: false, reason: 'no .page section (unframed/denied render)', hScroll }
  if (pageEl.querySelector('.cx-note[role="alert"]'))
    return { ok: false, reason: 'error state (Failed card rendered)', hScroll }
  const head = pageEl.querySelector('.page-head')
  const title = head?.querySelector('h1.page-title')
  if (!head || !title) return { ok: false, reason: 'no .page-head h1.page-title', hScroll }
  const cs = getComputedStyle(title)
  const headRect = head.getBoundingClientRect()
  const purpose = head.querySelector('.page-purpose')
  const actions = head.querySelector('.page-actions')
  const bar = pageEl.querySelector(':scope > .page-bar')
  const stats = pageEl.querySelector(':scope > .page-stats')
  // Body = first rendered in-flow child after the frame slots; fixed/absolute
  // overlays (toasts, modals) are out-of-flow and display:none helpers
  // (e.g. <datalist>) have no box — neither is the page body.
  const body = Array.from(pageEl.children).find((c) => {
    if (c.matches('.page-head, .page-bar, .page-stats')) return false
    if (!c.getClientRects().length) return false
    const pos = getComputedStyle(c).position
    return pos !== 'fixed' && pos !== 'absolute'
  })
  return {
    ok: true,
    title: {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      top: title.getBoundingClientRect().top,
      left: title.getBoundingClientRect().left,
    },
    purposeFontSize: purpose ? getComputedStyle(purpose).fontSize : null,
    actionsDelta: actions ? actions.getBoundingClientRect().right - headRect.right : null,
    gapBar: bar ? top(bar)! - headRect.bottom : null,
    gapStats: stats ? top(stats)! - (bottom(bar) ?? headRect.bottom) : null,
    tops: { head: headRect.top, bar: top(bar), stats: top(stats), body: top(body) },
    hScroll,
  }
}

interface CollectResult {
  /** Routes with a measurable PageShell frame. */
  metrics: Map<string, FrameMetrics>
  /** Routes skipped (role/session redirect, error state, unframed render). */
  skipped: Map<string, string>
  /** h-scroll px for every evaluated route, measured or skipped. */
  hScrolls: Map<string, number>
  consoleErrors: Map<string, string[]>
}

/**
 * Visit every frame route once per fixture role at the given viewport. A
 * fresh context per role keeps login() honest (clean session per role)
 * while reusing it across that role's routes — per-route logins would
 * multiply remote-auth round trips for no extra coverage. Role-denied
 * redirects and error-state renders are recorded as skips, not failures
 * (same convention as page-contract.spec.ts).
 */
async function collectFrame(
  browser: Browser,
  baseURL: string | undefined,
  width: number,
  height: number
): Promise<CollectResult> {
  const res: CollectResult = {
    metrics: new Map(),
    skipped: new Map(),
    hScrolls: new Map(),
    consoleErrors: new Map(),
  }
  for (const user of ['admin', 'tl', 'agent'] as const) {
    const entries = FRAME_ROUTES.filter((r) => r.user === user)
    if (!entries.length) continue
    const ctx = await browser.newContext({ baseURL, viewport: { width, height } })
    const page = await ctx.newPage()
    await login(page, E2E_USERS[user])
    for (const r of entries) {
      const errors: string[] = []
      const onConsole = (msg: { type: () => string; text: () => string }) => {
        if (msg.type() === 'error') errors.push(msg.text())
      }
      const onPageError = (err: Error) => errors.push(String(err))
      page.on('console', onConsole)
      page.on('pageerror', onPageError)
      try {
        await page.goto(r.path, { waitUntil: 'domcontentloaded' })
        await ready(page)
        const landed = new URL(page.url()).pathname
        if (landed !== r.path) {
          res.skipped.set(r.path, `redirected to ${landed} (role/session gate)`)
        } else {
          const m = await page.evaluate(measureFrame)
          if (m.hScroll != null) res.hScrolls.set(r.path, m.hScroll)
          if (m.ok) res.metrics.set(r.path, m)
          else res.skipped.set(r.path, m.reason ?? 'unframed render')
        }
      } catch (err) {
        res.skipped.set(r.path, `load failed: ${String(err).split('\n')[0]}`)
      } finally {
        const bad = errors.filter((t) => !CONSOLE_ALLOWLIST.some((re) => re.test(t)))
        if (bad.length) res.consoleErrors.set(r.path, bad.slice(0, 3))
        page.off('console', onConsole)
        page.off('pageerror', onPageError)
      }
    }
    await ctx.close()
  }
  return res
}

/** Record skips/console noise as test annotations; require >=1 measured route. */
function annotate(res: CollectResult, width: number): void {
  for (const [p, why] of res.skipped)
    test.info().annotations.push({ type: 'frame-skip', description: `${p} @${width}px: ${why}` })
  for (const [p, errs] of res.consoleErrors)
    test.info().annotations.push({
      type: 'console-errors',
      description: `${p} @${width}px: ${errs.join(' | ')}`,
    })
}

for (const w of WIDTHS) {
  test(`uniform head geometry across routes @${w}px`, async ({ browser }) => {
    test.setTimeout(900000)
    const baseURL = (test.info().project.use as { baseURL?: string }).baseURL
    const res = await collectFrame(browser, baseURL, w, HEIGHT)
    annotate(res, w)

    const first = [...res.metrics.entries()][0]
    expect(first, `no measurable frame routes @${w}px`).toBeTruthy()
    const [basePath, base] = first
    const bt = base.title!
    const v: string[] = []

    for (const [path, m] of res.metrics) {
      const t = m.title!
      if (t.fontSize !== bt.fontSize) v.push(`${path}: h1 font-size ${t.fontSize} ≠ ${basePath} ${bt.fontSize}`)
      if (t.fontWeight !== bt.fontWeight) v.push(`${path}: h1 font-weight ${t.fontWeight} ≠ ${basePath} ${bt.fontWeight}`)
      if (t.lineHeight !== bt.lineHeight) v.push(`${path}: h1 line-height ${t.lineHeight} ≠ ${basePath} ${bt.lineHeight}`)
      const dTop = Math.abs(t.top - bt.top)
      if (dTop > TOL) v.push(`${path}: h1 top ${t.top.toFixed(1)} vs ${basePath} ${bt.top.toFixed(1)} (${dTop.toFixed(1)}px)`)
      const dLeft = Math.abs(t.left - bt.left)
      if (dLeft > TOL) v.push(`${path}: h1 left ${t.left.toFixed(1)} vs ${basePath} ${bt.left.toFixed(1)} (${dLeft.toFixed(1)}px)`)
      if (m.actionsDelta != null && Math.abs(m.actionsDelta) > TOL)
        v.push(`${path}: .page-actions right edge ${m.actionsDelta.toFixed(1)}px off .page-head`)
    }

    const purposeSizes = new Set(
      [...res.metrics.values()].map((m) => m.purposeFontSize).filter((s): s is string => s != null)
    )
    if (purposeSizes.size > 1)
      v.push(`.page-purpose font-sizes differ: ${[...purposeSizes].join(', ')}`)

    for (const key of ['gapBar', 'gapStats'] as const) {
      const vals = [...res.metrics.entries()].filter(([, m]) => m[key] != null)
      if (vals.length < 2) continue
      const refPath = vals[0][0]
      const refVal = vals[0][1][key]!
      for (const [path, m] of vals.slice(1)) {
        const d = Math.abs(m[key]! - refVal)
        if (d > TOL)
          v.push(`${path}: ${key} ${m[key]!.toFixed(1)} vs ${refPath} ${refVal.toFixed(1)} (${d.toFixed(1)}px)`)
      }
    }

    expect(
      v,
      `${v.length} frame geometry violation(s) @${w}px:\n${v.join('\n')}`
    ).toEqual([])
  })
}

test('375px: no h-scroll; slots stack head → bar → stats → body', async ({ browser }) => {
  test.setTimeout(900000)
  const baseURL = (test.info().project.use as { baseURL?: string }).baseURL
  const res = await collectFrame(browser, baseURL, 375, 667)
  annotate(res, 375)

  const first = [...res.metrics.entries()][0]
  expect(first, 'no measurable frame routes @375px').toBeTruthy()
  const v: string[] = []

  // h-scroll is asserted on measured frame routes; skipped-route overflow is
  // reported as an annotation (page-contract owns the all-routes h-scroll gate).
  for (const [path, px] of res.hScrolls) {
    if (res.metrics.has(path)) {
      if (px > 0) v.push(`${path}: h-scroll ${px}px @375px`)
    } else if (px > 0) {
      test.info().annotations.push({
        type: 'hscroll-skip',
        description: `${path} @375px: skipped route h-scroll ${px}px (${res.skipped.get(path)})`,
      })
    }
  }

  for (const [path, m] of res.metrics) {
    const t = m.tops!
    const seq: [string, number][] = [['head', t.head]]
    if (t.bar != null) seq.push(['bar', t.bar])
    if (t.stats != null) seq.push(['stats', t.stats])
    if (t.body != null) seq.push(['body', t.body])
    for (let i = 1; i < seq.length; i++)
      if (seq[i][1] <= seq[i - 1][1])
        v.push(
          `${path}: ${seq[i][0]} top ${seq[i][1].toFixed(1)} not strictly below ` +
            `${seq[i - 1][0]} ${seq[i - 1][1].toFixed(1)}`
        )
  }

  expect(v, `${v.length} 375px violation(s):\n${v.join('\n')}`).toEqual([])
})
