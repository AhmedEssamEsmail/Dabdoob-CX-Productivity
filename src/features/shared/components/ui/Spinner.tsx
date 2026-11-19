import type { ReactNode } from 'react'
import { cx } from './cx'

export interface SpinnerProps {
  /** Screen-reader label announced via role="status". */
  label?: ReactNode
  className?: string
}

export function Spinner({ label = 'Loading…', className }: SpinnerProps) {
  return (
    <span className={cx('spinner', className)} role="status">
      <span className="cx-sr">{label}</span>
    </span>
  )
}
