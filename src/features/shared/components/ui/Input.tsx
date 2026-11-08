'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cx } from './cx'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cx('cx-input', className)} {...rest} />
})
