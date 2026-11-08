'use client'

import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cx } from './cx'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cx('cx-textarea', className)} {...rest} />
  }
)
