import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'

/* Source scan (no browser): the legacy GAS / "Connected apps" UI vocabulary
   removed by Phase-1 A5 (S01-04) must not reappear in rendered component code.
   Lib/config files keep these strings on purpose ("config storage untouched"),
   so only src/features/**\/components/** and src/app/** are scanned. */

// file -> reason it may keep the vocabulary; cap 3 entries (spec contract)
const ALLOWLIST: Record<string, string> = {
  'src/features/cx-hub/components/ecosystem-page.tsx':
    'help text names the app_url_* settings field admins fill in ("web app URL", kept by design)',
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules') collectFiles(path, acc)
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(path)
    }
  }
  return acc
}

const FILES = ['src/features', 'src/app']
  .flatMap((root) => collectFiles(root))
  .map((file) => file.split(sep).join('/'))
  .filter((file) => file.startsWith('src/app/') || file.split('/').includes('components'))

// `//` counts as a comment only when it cannot be inside a URL string —
// a `//` preceded by `:` or a quote char is kept, so 'https://…/exec' survives.
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1')

function scan(re: RegExp): string[] {
  const offenders: string[] = []
  for (const file of FILES) {
    if (file in ALLOWLIST) continue
    const src = stripComments(readFileSync(file, 'utf8'))
    for (const match of src.matchAll(re)) {
      offenders.push(`${file}:${src.slice(0, match.index).split('\n').length}`)
    }
  }
  return offenders
}

test('no script.google.com URLs in component code', () => {
  const offenders = scan(/script\.google\.com/g)
  expect(offenders, `script.google.com offenders:\n${offenders.join('\n')}`).toEqual([])
})

test('no "connected apps" copy in component code', () => {
  const offenders = scan(/connected\s+apps/gi)
  expect(offenders, `"connected apps" offenders:\n${offenders.join('\n')}`).toEqual([])
})

test('no GAS deploy-URL UI text (/exec, manage deployments, web app URL)', () => {
  const offenders = scan(/\/exec\b|manage\s+deployments|web\s*app\s+url/gi)
  expect(offenders, `GAS deploy-URL offenders:\n${offenders.join('\n')}`).toEqual([])
})

test('ALLOWLIST entries exist on disk (stale allowlists fail)', () => {
  for (const file of Object.keys(ALLOWLIST)) {
    expect(existsSync(file), `stale ALLOWLIST entry: ${file}`).toBe(true)
  }
})
