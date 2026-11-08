'use client'

import type { ReactNode } from 'react'
import { cx } from './cx'

export interface SegOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SegProps {
  name: string
  value: string
  onChange: (value: string) => void
  options: SegOption[]
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
  required?: boolean
}

export function Seg({
  name,
  value,
  onChange,
  options,
  className,
  ...rest
}: SegProps) {
  return (
    <div className={cx('cx-seg', className)} role="radiogroup" {...rest}>
      {options.map((option) => (
        <label key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}
