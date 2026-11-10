'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { cx } from './cx'

export interface ConfirmInlineProps {
  /** The question the two-step confirm asks, e.g. "Remove this log?" */
  label: ReactNode
  /** Optional detail line under the label. */
  detail?: ReactNode
  /** Confirm button text; defaults to "Confirm". */
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  className?: string
}

export function ConfirmInline({
  label,
  detail,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  className,
}: ConfirmInlineProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const labelId = useId()
  const detailId = useId()

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={detail ? detailId : undefined}
      className={cx('cx-confirm', className)}
    >
      <h4 ref={headingRef} id={labelId} tabIndex={-1} className="cx-confirm__label">
        {label}
      </h4>
      {detail ? (
        <p id={detailId} className="cx-confirm__detail">
          {detail}
        </p>
      ) : null}
      <div className="cx-confirm__actions">
        <Button variant="danger" size="sm" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="quiet" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
