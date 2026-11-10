import {
  cloneElement,
  forwardRef,
  isValidElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cx } from './cx'

export interface TableScrollProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /** Accessible name for the scrollable region (WCAG 2.1.1 keyboard scrolling). */
  label: string
  /** Minimum width applied to the table child so narrow columns don't crush it. */
  minWidth?: CSSProperties['minWidth']
  /** Soft edge fade hinting that more content scrolls horizontally. */
  fade?: boolean
  children: ReactNode
}

export const TableScroll = forwardRef<HTMLDivElement, TableScrollProps>(
  function TableScroll(
    { label, minWidth, fade, className, children, ...rest },
    ref
  ) {
    let content = children
    if (minWidth != null) {
      content = isValidElement(children) ? (
        cloneElement(children as ReactElement<{ style?: CSSProperties }>, {
          style: {
            ...(children as ReactElement<{ style?: CSSProperties }>).props
              .style,
            minWidth,
          },
        })
      ) : (
        <div style={{ minWidth }}>{children}</div>
      )
    }
    return (
      <div
        ref={ref}
        role="region"
        tabIndex={0}
        aria-label={label}
        className={cx('tblscroll', fade && 'tblscroll--fade', className)}
        {...rest}
      >
        {content}
      </div>
    )
  }
)
