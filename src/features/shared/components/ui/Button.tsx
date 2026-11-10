'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'quiet' | 'danger' | 'danger-quiet' | 'icon'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'cx-btn',
        variant && `cx-btn--${variant}`,
        size === 'sm' && 'cx-btn--sm',
        icon && 'cx-btn--icon',
        className
      )}
      {...rest}
    />
  )
})
