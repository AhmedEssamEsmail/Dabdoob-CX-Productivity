'use client'

import { useCallback, useEffect, useRef, type SyntheticEvent } from 'react'

/**
 * useDialogModal — the shared <dialog> lifecycle (S03-05).
 *
 * Syncs an `open` flag with `dialog.showModal()`/`dialog.close()`, captures
 * the element that opened the dialog and restores focus to it on close, and
 * provides a cancel handler that routes ESC through `onClose`.
 */
export function useDialogModal(
  open: boolean,
  onClose?: () => void,
  options?: { restoreFocus?: boolean }
) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const invokerRef = useRef<HTMLElement | null>(null)
  const restoreFocus = options?.restoreFocus !== false

  useEffect(() => {
    if (open) {
      invokerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      return
    }
    const invoker = invokerRef.current
    invokerRef.current = null
    if (restoreFocus && invoker && document.contains(invoker)) invoker.focus()
  }, [open, restoreFocus])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const onCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement, Event>) => {
      event.preventDefault()
      onClose?.()
    },
    [onClose]
  )

  return { dialogRef, onCancel }
}
