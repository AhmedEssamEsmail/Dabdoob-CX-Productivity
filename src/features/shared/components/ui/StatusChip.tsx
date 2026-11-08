import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Chip } from './Chip'

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  status: string
  plain?: boolean
  children?: ReactNode
}

export const StatusChip = forwardRef<HTMLSpanElement, StatusChipProps>(
  function StatusChip({ status, plain, children, className, ...rest }, ref) {
    return (
      <Chip
        ref={ref}
        status={status}
        plain={plain}
        className={className}
        {...rest}
      >
        {children}
      </Chip>
    )
  }
)
