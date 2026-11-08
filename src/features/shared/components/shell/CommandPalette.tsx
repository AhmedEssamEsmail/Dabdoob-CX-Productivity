'use client'

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import type { Bootstrap } from '@/features/shared/shell/context'
import { D, useLang } from '@/features/shared/shell/i18n'
import { inApp, pageAllowed, resolveLink } from '@/features/shared/shell/gates'
import {
  GROUP_LABELS,
  GROUP_ORDER,
  PAGES,
  type RouteDef,
} from '@/features/shared/components/shell/registry'
import NavIcon from '@/features/shared/components/shell/NavIcon'

const MAX_ITEMS = 20

/** Case-insensitive subsequence match against `title path group`. */
function fuzzyHit(query: string, haystack: string): boolean {
  const q = query.toLowerCase()
  const h = haystack.toLowerCase()
  let i = 0
  for (const ch of h) {
    if (ch === q[i]) i += 1
    if (i === q.length) return true
  }
  return q.length === 0
}

/**
 * Fuzzy page filter for the command palette. Empty/blank query returns the
 * input order untouched; otherwise pages matching as a subsequence of
 * `title + ' ' + path + ' ' + group` (case-insensitive) are kept in order.
 */
export function filterPalettePages(pages: RouteDef[], query: string): RouteDef[] {
  if (!query.trim()) return pages
  return pages.filter((page) =>
    fuzzyHit(query.trim(), `${page.title} ${page.path} ${page.group}`)
  )
}

export interface PaletteGroup {
  group: string
  pages: RouteDef[]
}

/** Bucket pages by group, ordered by GROUP_ORDER (unknown groups last). */
export function groupPalettePages(pages: RouteDef[]): PaletteGroup[] {
  const byGroup = new Map<string, RouteDef[]>()
  for (const page of pages) {
    const list = byGroup.get(page.group)
    if (list) list.push(page)
    else byGroup.set(page.group, [page])
  }
  const known = GROUP_ORDER.filter((group) => byGroup.has(group))
  const extra = [...byGroup.keys()].filter((group) => !GROUP_ORDER.includes(group))
  return [...known, ...extra].map((group) => ({ group, pages: byGroup.get(group) ?? [] }))
}

/**
 * ⌘K page switcher: every PAGES entry the signed-in user may open
 * (pageAllowed — not inApp-gated, the palette crosses apps), fuzzy-filtered,
 * keyboard navigable. Cross-app picks reload via location.assign like _top.
 */
export default function CommandPalette({
  boot,
  ctxApp,
  onClose,
}: {
  boot: Bootstrap
  ctxApp: string
  onClose: () => void
}) {
  const router = useRouter()
  useLang()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const allowed = useMemo(
    () => PAGES.filter((page) => pageAllowed(page, boot)),
    [boot]
  )
  const filtered = useMemo(
    () => filterPalettePages(allowed, query).slice(0, MAX_ITEMS),
    [allowed, query]
  )
  const groups = useMemo(() => groupPalettePages(filtered), [filtered])
  const flat = useMemo(() => groups.flatMap((group) => group.pages), [groups])
  const indexOf = useMemo(() => {
    const map = new Map<RouteDef, number>()
    flat.forEach((page, index) => map.set(page, index))
    return map
  }, [flat])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    listRef.current
      ?.querySelector('.cpk-item.on')
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const linkFor = (page: RouteDef) =>
    inApp(page, ctxApp)
      ? { href: `/${page.path}`, external: false, missing: false }
      : resolveLink(`#/${page.path}`, PAGES, true, ctxApp)

  const activate = (page: RouteDef) => {
    const link = linkFor(page)
    if (link.missing) return
    if (link.external) {
      location.assign(link.href)
      return
    }
    router.push(link.href)
    onClose()
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (!flat.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (index + 1) % flat.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (index - 1 + flat.length) % flat.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(flat.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const page = flat[active]
      if (page) activate(page)
    }
  }

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="cpk-backdrop" onClick={onBackdropClick}>
      <div
        className="cpk"
        role="dialog"
        aria-modal="true"
        aria-label={D('Search pages')}
        onKeyDown={onKeyDown}
      >
        <input
          className="cpk-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="cpk-list"
          aria-autocomplete="list"
          aria-activedescendant={flat.length ? `cpk-item-${active}` : undefined}
          autoFocus
          aria-label={D('Search pages')}
          placeholder={D('Search pages')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
        />
        <div className="cpk-list" id="cpk-list" role="listbox" ref={listRef}>
          {groups.map((group) => (
            <div className="cpk-group" role="presentation" key={group.group}>
              <span className="cpk-group-label">
                {D(GROUP_LABELS[group.group] ?? group.group)}
              </span>
              {group.pages.map((page) => {
                const index = indexOf.get(page) ?? 0
                const disabled = linkFor(page).missing
                return (
                  <div
                    className={`cpk-item${index === active ? ' on' : ''}`}
                    role="option"
                    id={`cpk-item-${index}`}
                    aria-selected={index === active}
                    aria-disabled={disabled || undefined}
                    key={page.path}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      if (!disabled) activate(page)
                    }}
                  >
                    <NavIcon path={page.path} />
                    <span className="cpk-item-title">{D(page.title)}</span>
                    <span className="cpk-kbd">
                      {D(GROUP_LABELS[page.group] ?? page.group)}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
          {flat.length === 0 ? (
            <div className="cpk-empty">{D('No pages match')}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
