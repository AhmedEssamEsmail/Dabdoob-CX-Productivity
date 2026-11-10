'use client'

import {
  forwardRef,
  useRef,
  type DialogHTMLAttributes,
  type MouseEvent,
} from 'react'
import { useDialogModal } from '@/features/shared/lib/use-dialog-modal'
import { cx } from './cx'

export interface DialogProps
  extends Omit<
    DialogHTMLAttributes<HTMLDialogElement>,
    'open' | 'onClose' | 'onCancel' | 'aria-label' | 'aria-labelledby' | 'aria-describedby'
  > {
  open: boolean
  onClose?: () => void
  /** id of the element labelling the dialog (maps to aria-labelledby). */
  labelledby?: string
  /** accessible name when there is no visible label element (aria-label). */
  label?: string
  /** id of the element describing the dialog (aria-describedby). */
  describedby?: string
  /** close when the user clicks the backdrop (target === dialog). */
  lightDismiss?: boolean
}

export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(
  function Dialog(
    {
      open,
      onClose,
      labelledby,
      label,
      describedby,
      lightDismiss = false,
      className,
      children,
      onClick,
      ...rest
    },
    ref
  ) {
    const inner = useRef<HTMLDialogElement | null>(null)
    const { dialogRef, onCancel } = useDialogModal(open, onClose)

    const setRefs = (el: HTMLDialogElement | null) => {
      inner.current = el
      dialogRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    }

    const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
      onClick?.(event)
      if (lightDismiss && event.target === event.currentTarget) onClose?.()
    }

    return (
      <dialog
        ref={setRefs}
        className={cx('popup', className)}
        aria-labelledby={labelledby}
        aria-label={label}
        aria-describedby={describedby}
        onCancel={onCancel}
        onClick={handleClick}
        {...rest}
      >
        {children}
      </dialog>
    )
  }
)
