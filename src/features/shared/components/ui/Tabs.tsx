'use client'

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'

export interface TabItem {
  id: string
  label: ReactNode
  panel?: ReactNode
}

export interface TabsProps {
  tabs: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (id: string) => void
  'aria-label'?: string
  className?: string
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
  const [inner, setInner] = useState(defaultValue ?? tabs[0]?.id ?? '')
  const active = value ?? inner

  const select = (id: string) => {
    if (value === undefined) setInner(id)
    onChange?.(id)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const step =
      event.key === 'ArrowRight' ? (rtl ? -1 : 1) : event.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0
    const next = step
      ? (index + step + tabs.length) % tabs.length
      : event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : -1
    if (next < 0 || index < 0) return
    event.preventDefault()
    select(tabs[next].id)
    requestAnimationFrame(() =>
      document.getElementById(`${baseId}-tab-${tabs[next].id}`)?.focus()
    )
  }

  return (
    <div>
      <div
        className={cx('cx-tabs', className)}
        role="tablist"
        onKeyDown={onKeyDown}
        {...rest}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            className={cx(
              'cx-btn',
              'cx-btn--quiet',
              active === tab.id && 'cx-btn--primary'
            )}
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
          >
            {tab.panel}
          </div>
        ) : null
      )}
    </div>
  )
}
