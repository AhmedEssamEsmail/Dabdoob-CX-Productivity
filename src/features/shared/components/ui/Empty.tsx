import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export interface EmptyProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode
  title: ReactNode
  /** Heading level for the title. */
  level?: number
  body?: ReactNode
  /** @deprecated use `body`. */
  sub?: ReactNode
  action?: ReactNode
  children?: ReactNode
}

export const Empty = forwardRef<HTMLDivElement, EmptyProps>(function Empty(
  { icon, title, level = 2, body, sub, action, className, children, ...rest },
  ref
) {
  const text = body ?? sub
  return (
    <div ref={ref} className={cx('cx-empty', className)} {...rest}>
      {icon}
      <strong role="heading" aria-level={level}>{title}</strong>
      {text ? <p>{text}</p> : null}
      {action}
      {children}
    </div>
  )
})
