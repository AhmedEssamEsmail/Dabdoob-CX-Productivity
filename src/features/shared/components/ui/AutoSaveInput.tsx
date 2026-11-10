'use client'

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
} from 'react'
import { Input } from './Input'

export interface AutoSaveInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange'
  > {
  value: string
  onCommit: (value: string) => void | Promise<void>
  debounceMs?: number
  isSaving?: boolean
}

export const AutoSaveInput = forwardRef<HTMLInputElement, AutoSaveInputProps>(
  function AutoSaveInput(
    {
      value,
      onCommit,
      debounceMs,
      isSaving,
      onFocus,
      onBlur,
      onKeyDown,
      ...rest
    },
    ref
  ) {
    const [draft, setDraft] = useState<string | null>(null)
    const draftRef = useRef<string | null>(null)
    const committedRef = useRef<string | null>(null)
    const focusedRef = useRef(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const latestRef = useRef({ value, onCommit })
    latestRef.current = { value, onCommit }

    const setDraftBoth = (next: string | null) => {
      draftRef.current = next
      setDraft(next)
    }

    const clearTimer = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    const commitDraft = () => {
      clearTimer()
      const d = draftRef.current
      const { value: server, onCommit: commit } = latestRef.current
      if (d !== null && d !== server && d !== committedRef.current) {
        committedRef.current = d
        void commit(d)
      }
    }

    useEffect(() => {
      if (draft !== null && value === draft) {
        committedRef.current = null
        setDraftBoth(null)
      } else if (draft !== null && !focusedRef.current && value !== draft) {
        committedRef.current = null
        setDraftBoth(null)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    useEffect(() => clearTimer, [])

    return (
      <Input
        ref={ref}
        value={draft ?? value}
        data-saving={isSaving ? 'true' : undefined}
        aria-busy={isSaving || undefined}
        onFocus={(e) => {
          focusedRef.current = true
          onFocus?.(e)
        }}
        onChange={(e) => {
          const next = e.target.value
          setDraftBoth(next)
          if (debounceMs && debounceMs > 0) {
            clearTimer()
            timerRef.current = setTimeout(commitDraft, debounceMs)
          }
        }}
        onBlur={(e) => {
          focusedRef.current = false
          commitDraft()
          onBlur?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitDraft()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            committedRef.current = null
            clearTimer()
            setDraftBoth(null)
          }
          onKeyDown?.(e)
        }}
        {...rest}
      />
    )
  }
)
