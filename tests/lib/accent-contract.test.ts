import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = new URL('../../src/app/', import.meta.url)
const files = ['cx-kit.css', ...readdirSync(new URL('styles/', app)).map(name => `styles/${name}`)]

describe('accent foreground contract', () => {
  it('uses a text token instead of fill/hover colors for accent text', () => {
    const violations: string[] = []
    for (const file of files) {
      const css = readFileSync(new URL(file, app), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!/(?:^|;)\s*color\s*:\s*var\(--(?:cx-accent(?:-hover)?|pine(?:-2)?)\s*[,)]/.test(body)) continue
        // This SVG stroke is non-text and retains the >=3:1 icon contract.
        if (file === 'cx-kit.css' && selector.trim() === ':root .nav-link[aria-current="page"] .nav-icon') continue
        violations.push(`${file}: ${selector.trim()}`)
      }
    }
    expect(violations).toEqual([])
  })
})
