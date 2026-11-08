import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export interface EmptyProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  sub?: ReactNode
  children?: ReactNode
}

export const Empty = forwardRef<HTMLDivElement, EmptyProps>(function Empty(
  { title, sub, className, children, ...rest },
  ref
) {
  return (
    <div ref={ref} className={cx('cx-empty', className)} {...rest}>
      <strong>{title}</strong>
      {sub ? <p>{sub}</p> : null}
      {children}
    </div>
  )
})
