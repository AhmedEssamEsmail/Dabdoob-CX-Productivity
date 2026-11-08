import { forwardRef, type HTMLAttributes } from 'react'
import { cx } from './cx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  pad?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { pad, className, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx('cx-panel', pad && 'cx-panel--pad', className)}
      {...rest}
    />
  )
})
