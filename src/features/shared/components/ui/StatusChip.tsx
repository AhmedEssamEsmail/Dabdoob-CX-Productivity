import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { Chip, type ChipStatus } from './Chip'

export interface StatusChipProps extends HTMLAttributes<HTMLSpanElement> {
  status: ChipStatus
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
