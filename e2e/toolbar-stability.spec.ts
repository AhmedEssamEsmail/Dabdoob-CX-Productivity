import { test, expect, type Page } from '@playwright/test'
import { E2E_USERS, login } from './users'

/**
 * PLAN C2 / A2 — toolbar stability, class-wide (P3-C2-02). Live-page companion
 * to aging-refresh-layout.spec.ts (setContent, aging markup only): navigates
 * the three routes whose header toolbar renders `.cx-refresh`, then drives the
 * control through its real states — button label swaps plus [role=status]
 * insert/remove — inside one evaluate per state (deterministic, atomic: no
 * live /api/*\/refresh call, no mid-measure React re-render). Every watched
 * toolbar element must keep its bounding box within 1px and no h-scroll may
 * appear — label/status changes must never move siblings.
 *
 * Toolbar shapes:
 *   /aging    — `.aging-page-head` grid contract fixed by S01-02 (control: green)
 *   /queue    — RefreshNow is a direct `.page-head` child (no `.page-actions`)
 *   /overview — Hf inside `.page-head .page-actions` (+ optional up-next)
 */

const WIDTHS = [375, 1024] as const

const PAGES = [
  {
    path: '/aging',
    watch: [
      '.page-head .page-actions > .cx-seg',
      '.page-head .page-actions > .cx-section__hint',
      '.page-head .cx-refresh > button',
    ],
  },
  {
    path: '/queue',
    watch: [
      '.page-head > div:first-child',
      '.page-head > .cx-filter',
      '.page-head > .cx-btn',
      '.page-head .cx-refresh > button',
    ],
  },
  {
    path: '/overview',
    watch: [
      '.page-head .page-actions',
      '.page-head .page-actions > :not(.cx-refresh)',
      '.page-head .cx-refresh > button',
    ],
  },
] as const

/** Real RefreshNow/Hf states — same sequence as aging-refresh-layout.spec.ts. */
const STATES = [
  { label: 'Refreshing…', message: '' },
  {
    label: 'Refresh now',
    message: "Could not find the 'submitted_at' column of 'refresh_log' in the schema cache",
  },
  { label: 'Refresh again in 60 s', message: 'Freshdesk changes up to 01:20 Kuwait time.' },
] as const

/** Generic ready-wait (same as page-contract.spec.ts). */
async function ready(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15000 })
}

interface Snap {
  boxes: ({ x: number; y: number } | null)[]
  scrollOverflow: number
}

/**
 * Mutate `.page-head .cx-refresh` to `state` (null = measure only), force
 * layout, then read every watch selector's box + the h-scroll delta. One
 * evaluate keeps mutation+measurement atomic against React re-renders.
 */
function probe(page: Page, watch: readonly string[], state: { label: string; message: string } | null): Promise<Snap> {
  return page.evaluate(
    ({ watch, state }) => {
      if (state) {
        const refresh = document.querySelector('.page-head .cx-refresh')
        const btn = refresh?.querySelector('button')
        if (btn) btn.textContent = state.label
        refresh?.querySelector('[role="status"]')?.remove()
        if (refresh && state.message) {
          const status = document.createElement('span')
          status.className = 'cx-section__hint'
          status.setAttribute('role', 'status')
          status.textContent = state.message
          refresh.append(status)
        }
      }
      const boxes = watch.map((sel) => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y }
      })
      return {
        boxes,
        scrollOverflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    },
    { watch: [...watch], state }
  )
}

for (const { path, watch } of PAGES) {
  test(`${path} toolbar stays anchored through refresh states`, async ({ page }) => {
    test.setTimeout(60000) // login + remote data load + two widths
    await login(page, E2E_USERS.admin)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      await ready(page)
      // .cx-refresh only mounts once the page's data arrives (aging/overview).
      await expect(page.locator('.page-head .cx-refresh > button').first()).toBeVisible({
        timeout: 15000,
      })

      const baseline = await probe(page, watch, null)
      for (const state of STATES) {
        const snap = await probe(page, watch, state)
        for (const [i, box] of snap.boxes.entries()) {
          const base = baseline.boxes[i]
          if (!box || !base) continue // element not rendered (e.g. up-next sibling)
          expect.soft(
            Math.abs(box.x - base.x),
            `${path} @${width} "${state.label}": ${watch[i]} x moved ${Math.abs(box.x - base.x)}px`
          ).toBeLessThanOrEqual(1)
          expect.soft(
            Math.abs(box.y - base.y),
            `${path} @${width} "${state.label}": ${watch[i]} y moved ${Math.abs(box.y - base.y)}px`
          ).toBeLessThanOrEqual(1)
        }
        expect.soft(
          snap.scrollOverflow,
          `${path} @${width} "${state.label}": h-scroll +${snap.scrollOverflow}px`
        ).toBeLessThanOrEqual(0)
      }
    }
  })
}
