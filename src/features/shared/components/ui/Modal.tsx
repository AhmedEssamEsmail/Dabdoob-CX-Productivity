'use client'

import {
  forwardRef,
  useEffect,
  useRef,
  type DialogHTMLAttributes,
} from 'react'
import { cx } from './cx'

export interface ModalProps extends DialogHTMLAttributes<HTMLDialogElement> {
  open?: boolean
  onClose?: () => void
}

export const Modal = forwardRef<HTMLDialogElement, ModalProps>(function Modal(
  { open, onClose, onCancel, className, children, ...rest },
  ref
) {
  const inner = useRef<HTMLDialogElement | null>(null)

  const setRefs = (el: HTMLDialogElement | null) => {
    inner.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  useEffect(() => {
    const dialog = inner.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={setRefs}
      className={cx('popup', className)}
      onCancel={(event) => {
        event.preventDefault()
        onCancel?.(event)
        onClose?.()
      }}
      {...rest}
    >
      {children}
    </dialog>
  )
})
