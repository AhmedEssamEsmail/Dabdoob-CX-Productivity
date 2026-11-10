'use client'

import {
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { cx } from './cx'

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  invalid?: boolean
  id?: string
  wide?: boolean
  children?: ReactNode
}

type FieldChildProps = {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

export function Field({
  label,
  hint,
  error,
  invalid,
  id,
  wide,
  children,
  className,
  ...rest
}: FieldProps) {
  const autoId = useId()
  const child = isValidElement<FieldChildProps>(children) ? children : null
  const childId = child?.props.id ?? id ?? autoId
  const describedBy =
    [hint ? `${childId}-hint` : null, error ? `${childId}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined

  const isInvalid = invalid ?? error != null
  const control =
    child != null
      ? cloneElement(child as ReactElement<FieldChildProps>, {
          id: childId,
          'aria-invalid': isInvalid || undefined,
          'aria-describedby':
            [child.props['aria-describedby'], describedBy]
              .filter(Boolean)
              .join(' ') || undefined,
        })
      : children

  return (
    <div className={cx('cx-field', wide && 'cx-field--wide', className)} {...rest}>
      <label className="field-label" htmlFor={child != null ? childId : id}>
        {label}
      </label>
      {control}
      {hint ? (
        <span className="field-hint" id={`${childId}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <p className="field-error" id={`${childId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
