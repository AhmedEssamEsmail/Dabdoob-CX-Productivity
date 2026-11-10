import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export type ChipStatus = 'neutral' | 'info' | 'ok' | 'warn' | 'bad'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  status?: ChipStatus
  tone?: ChipStatus
  plain?: boolean
  children?: ReactNode
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { status, tone, plain, className, children, ...rest },
  ref
) {
  return (
    <span
      ref={ref}
      className={cx('cx-chip', plain && 'cx-chip--plain', className)}
      data-status={status ?? tone}
      {...rest}
    >
      {children}
    </span>
  )
})
