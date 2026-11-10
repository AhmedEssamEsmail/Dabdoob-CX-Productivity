'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  shellApi,
  type ShellUser,
  type ViewAsPerson,
} from '@/features/shared/shell/context'
import { displayRole, ROLE_LABELS } from '@/features/shared/shell/gates'
import { useDialogModal } from '@/features/shared/lib/use-dialog-modal'
import { Button, Input } from '@/features/shared/components/ui'
import { D } from '@/features/shared/shell/i18n'

/**
 * Vt + kn — the "View as" banner and people picker, ported 1:1.
 */

const EYE = (
  <>
    <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
    <circle cx="12" cy="12" r="3" />
  </>
)

/** xn() — start/stop viewing as someone, then reload everything. */
async function switchViewAs(email: string): Promise<void> {
  if (email) await shellApi.startViewAs(email)
  else await shellApi.stopViewAs()
  location.reload()
}

/** Vt — the sticky read-only banner shown while viewing as someone. */
export function ViewAsBanner({ user }: { user: ShellUser }) {
  const [exiting, setExiting] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="va-banner" role="region" aria-label={D('View as')}>
      <svg className="va-eye" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {EYE}
      </svg>
      <p className="va-banner-text">
        {D('Viewing as')} <strong>{user.name}</strong> ({D(displayRole(user))}) —{' '}
        {D('read-only')}
        {error ? (
          <span className="va-banner-error" style={{ color: 'var(--signal-ink)' }}>
            {error}
          </span>
        ) : null}
      </p>
      <ViewAsPicker label="Switch person" quiet />
      <Button
        className="va-exit"
        disabled={exiting}
        onClick={() => {
          setExiting(true)
          setError('')
          switchViewAs('').catch((cause: Error) => {
            setExiting(false)
            setError(D('Could not exit: {msg}', { msg: cause.message }))
          })
        }}
      >
        {exiting ? D('Exiting…') : D('Exit')}
      </Button>
    </div>
  )
}

/** kn — the rail "View as" button and its person-picker dialog. */
export function ViewAsPicker({
  label = 'View as',
  quiet = false,
}: {
  label?: string
  quiet?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<ViewAsPerson[] | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  /* Shared dialog lifecycle: showModal/close sync, ESC → close, focus
     restore to the invoking element. */
  const { dialogRef, onCancel } = useDialogModal(open, () => setOpen(false))

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || people) return
    shellApi.getViewAsPeople().then(setPeople, (cause: Error) => setError(cause.message))
  }, [open, people])

  const matches = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return (people ?? []).filter((person) => {
      const haystack =
        `${person.name} ${person.email} ${ROLE_LABELS[person.role]} ${person.position} ${person.tlName} ${
          person.auditor ? 'auditor audits' : ''
        }`.toLowerCase()
      return terms.every((term) => haystack.includes(term))
    })
  }, [people, query])

  const pick = (person: ViewAsPerson) => {
    setBusy(person.email)
    setError('')
    switchViewAs(person.email).catch((cause: Error) => {
      setBusy('')
      setError(cause.message)
    })
  }

  return (
    <>
      {quiet ? (
        <Button
          className="va-switch"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          <span className="va-open-text">{D(label)}</span>
        </Button>
      ) : (
        <button
          type="button"
          className="va-open"
          aria-haspopup="dialog"
          title={D('See the apps as one person sees them, read-only')}
          onClick={() => setOpen(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {EYE}
          </svg>
          <span className="va-open-text">{D(label)}</span>
        </button>
      )}
      <dialog
        ref={dialogRef}
        className="popup va-picker"
        aria-labelledby="va-title"
        onClose={() => setOpen(false)}
        onCancel={onCancel}
      >
        <div className="popup-body">
          <h2 id="va-title" className="popup-title">
            {D('View as')}
          </h2>
          <p className="popup-text">
            {D(
              'Pick a person to see every app as they do: their pages, their data and their pop-ups. Nothing can be changed until you exit.'
            )}
          </p>
          <label className="field va-search">
            <span className="field-label">{D('Find a person')}</span>
            <Input
              ref={inputRef}
              className="input"
              type="search"
              placeholder={D('Name, role, position or team lead')}
              value={query}
              onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && matches.length === 1) pick(matches[0])
              }}
            />
          </label>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          {!people && !error ? (
            <p className="va-empty" role="status">
              {D('Loading the roster…')}
            </p>
          ) : null}
          {people && !matches.length ? (
            <p className="va-empty">
              {D('No one on the roster matches “{q}”.', { q: query })}
            </p>
          ) : null}
          {matches.length ? (
            <ul className="va-list" aria-label={D('People')}>
              {matches.map((person) => (
                <li key={person.email}>
                  <button
                    type="button"
                    className="va-person"
                    disabled={!!busy}
                    onClick={() => pick(person)}
                  >
                    <span className="va-person-name">
                      {busy === person.email
                        ? D('Opening as {name}…', { name: person.name })
                        : person.name}
                    </span>
                    <span className="va-person-meta">
                      <span className={`va-role va-role--${person.role}`}>
                        {D(ROLE_LABELS[person.role])}
                      </span>
                      {person.auditor ? <span className="va-tag">{D('Audits')}</span> : null}
                      <span className="va-person-sub">
                        {[
                          person.position,
                          person.tlName ? D('Team lead: {name}', { name: person.tlName }) : '',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="popup-actions">
            <Button variant="quiet" onClick={() => setOpen(false)}>
              {D('Cancel')}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
