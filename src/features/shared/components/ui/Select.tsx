'use client'

import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cx } from './cx'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...rest },
  ref
) {
  return <select ref={ref} className={cx('cx-select', className)} {...rest} />
})
