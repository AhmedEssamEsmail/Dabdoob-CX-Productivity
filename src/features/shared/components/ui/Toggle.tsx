'use client'

import type { ReactNode } from 'react'
import { cx } from './cx'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  name?: string
  value?: string
  disabled?: boolean
  className?: string
  children?: ReactNode
}

export function Toggle({
  checked,
  onChange,
  name,
  value,
  disabled,
  className,
  children,
}: ToggleProps) {
  return (
    <label className={cx('cx-toggle', className)}>
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>{children}</span>
    </label>
  )
}
