'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import { prefersReducedMotion } from '@/features/shared/shell/i18n'

export interface TabItem {
  id: string
  label: ReactNode
  panel?: ReactNode
  content?: ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
  'aria-label'?: string
  className?: string
}

export function nextTabIndex(
  length: number,
  current: number,
  key: string,
  rtl: boolean
): number {
  if (length <= 0 || current < 0) return -1
  if (key === 'ArrowRight') return (current + (rtl ? -1 : 1) + length) % length
  if (key === 'ArrowLeft') return (current + (rtl ? 1 : -1) + length) % length
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  return -1
}

export function scrollSelectedTabIntoView(list: HTMLElement | null): void {
  if (!list) return
  const tab = list.querySelector<HTMLElement>('[aria-selected="true"]')
  if (!tab) return

  const listRect = list.getBoundingClientRect()
  const tabRect = tab.getBoundingClientRect()
  const delta =
    tabRect.left < listRect.left
      ? tabRect.left - listRect.left
      : tabRect.right > listRect.right
        ? tabRect.right - listRect.right
        : 0
  if (delta === 0) return

  const reduced = typeof document === 'undefined' ? false : prefersReducedMotion()

  list.scrollBy({ left: delta, behavior: reduced ? 'auto' : 'smooth' })
}

export function Tabs({
  tabs,
  value,
  defaultValue,
  onChange,
  className,
  ...rest
}: TabsProps) {
  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id ?? '')
  const active = value ?? inner

  const select = (id: string) => {
    if (value === undefined) setInner(id)
    onChange?.(id)
  }

  useEffect(() => {
    scrollSelectedTabIntoView(listRef.current)
  }, [active])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const next = nextTabIndex(tabs.length, index, event.key, rtl)
    if (next < 0) return
    event.preventDefault()
    select(tabs[next].id)
    requestAnimationFrame(() =>
      document.getElementById(`${baseId}-tab-${tabs[next].id}`)?.focus()
    )
  }

  return (
    <div>
      <div
        ref={listRef}
        className={cx('cx-tabs', className)}
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        {...rest}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            className="cx-tab"
            aria-selected={active === tab.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) =>
        active === tab.id ? (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            tabIndex={0}
          >
            {tab.panel ?? tab.content}
          </div>
        ) : null
      )}
    </div>
  )
}
