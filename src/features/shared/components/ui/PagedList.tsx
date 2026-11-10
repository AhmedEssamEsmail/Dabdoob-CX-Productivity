'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { Button } from './Button'

export interface PagedListProps<T> {
  items: readonly T[]
  /** Items rendered per page (default 50). */
  pageSize?: number
  renderItem: (item: T, index: number) => ReactNode
  /** Custom "show more" label; receives the remaining count. */
  moreLabel?: (remaining: number) => ReactNode
}

export function PagedList<T>({
  items,
  pageSize = 50,
  renderItem,
  moreLabel,
}: PagedListProps<T>) {
  const [shown, setShown] = useState(pageSize)
  const visible = items.slice(0, shown)
  const remaining = items.length - shown
  return (
    <>
      {visible.map((item, i) => (
        <Fragment key={i}>{renderItem(item, i)}</Fragment>
      ))}
      {remaining > 0 ? (
        <Button
          variant="quiet"
          onClick={() => setShown((n) => n + pageSize)}
        >
          {moreLabel
            ? moreLabel(remaining)
            : `Show ${Math.min(pageSize, remaining)} more · ${remaining} remaining`}
        </Button>
      ) : null}
    </>
  )
}
