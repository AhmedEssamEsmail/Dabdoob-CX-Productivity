import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  status?: string
  plain?: boolean
  children?: ReactNode
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { status, plain, className, children, ...rest },
  ref
) {
  return (
    <span
      ref={ref}
      className={cx('cx-chip', plain && 'cx-chip--plain', className)}
      data-status={status}
      {...rest}
    >
      {children}
    </span>
  )
})
