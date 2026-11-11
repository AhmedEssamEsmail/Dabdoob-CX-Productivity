import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// S13-01: /ecosystem must render EcosystemPage through a dynamic ssr:false
// wrapper so the ~2.7k-line three.js page stays out of the initial bundle.
describe('ecosystem route import shape (P-18)', () => {
  const root = resolve(__dirname, '..', '..')
  const page = readFileSync(
    resolve(root, 'src/app/ecosystem/page.tsx'),
    'utf8'
  )
  const wrapper = readFileSync(
    resolve(root, 'src/features/cx-hub/components/ecosystem-dynamic.tsx'),
    'utf8'
  )

  it('page.tsx does not statically import ecosystem-page', () => {
    expect(page).not.toMatch(/from\s+['"][^'"]*ecosystem-page['"]/)
    expect(page).not.toContain('EcosystemPage')
    expect(page).toContain('ecosystem-dynamic')
  })

  it('wrapper loads ecosystem-page via next/dynamic with ssr:false', () => {
    expect(wrapper).toContain("'use client'")
    expect(wrapper).toMatch(/next\/dynamic/)
    expect(wrapper).toMatch(/ssr:\s*false/)
    expect(wrapper).toContain("import('./ecosystem-page')")
    expect(wrapper).toContain('m.EcosystemPage')
  })

  it('loading fallback is a covered, announced loader', () => {
    expect(wrapper).toContain('eco3-page')
    expect(wrapper).toContain('role="status"')
    expect(wrapper).toContain('Loading the ecosystem…')
  })
})
