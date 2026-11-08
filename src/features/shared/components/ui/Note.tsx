import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from './cx'

export type NoteStatus = 'neutral' | 'info' | 'ok' | 'warn' | 'bad'

export interface NoteProps extends HTMLAttributes<HTMLDivElement> {
  status?: NoteStatus | string
  role?: string
  children?: ReactNode
}

export const Note = forwardRef<HTMLDivElement, NoteProps>(function Note(
  { status, role = 'status', className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx('cx-note', className)}
      data-status={status}
      role={role}
      {...rest}
    >
      {children}
    </div>
  )
})
