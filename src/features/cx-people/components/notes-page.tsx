'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Notes page (notes.closure.js symbols Ca/Ta/$a).
 * Private scratchpad: capture box, search, inline edit, tag, status, make-task, delete. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchJson, useSe } from './shared'
import { PwShell, PwLate, PwSkel, PwErr, useBusy, dayTime, taskDraft, routeOf } from './pw'
import { Button, Empty, Input, Select, Textarea } from '@/features/shared/components/ui'

/* Sa / ta — note statuses. */
const STATUS_LABELS: Record<string, string> = {
  raw: 'Raw',
  exploring: 'Exploring',
  decided: 'Decided',
  dropped: 'Dropped',
}
const STATUS_IDS = ['raw', 'exploring', 'decided', 'dropped']

/* Nt / Aa — ⌘ Enter (Mac) or Ctrl Enter saves. */
const isSaveKey = (e: React.KeyboardEvent) => e.key === 'Enter' && (e.metaKey || e.ctrlKey)
const SAVE_HINT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ Enter' : 'Ctrl Enter'

/* Ke — the notes facade. */
const api = {
  page: () => fetchJson('/api/people/notes'),
  save: (input: Record<string, unknown>) => fetchJson('/api/people/notes', input),
  remove: (id: string) =>
    fetch(`/api/people/notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(async (res) => {
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(String((data && data.error) || res.statusText || 'Request failed'))
      return data
    }),
}

/* $a — the capture box. */
function NoteCapture({ onSaved }: { onSaved: (note: any) => void }) {
  const [text, setText] = useState('')
  const [tag, setTag] = useState('')
  const [error, setError] = useState('')
  const boxRef = useRef<HTMLTextAreaElement | null>(null)
  const save = () => {
    const t = text.trim()
    if (!t) return
    const tg = tag.trim()
    setText('')
    setTag('')
    setError('')
    boxRef.current?.focus()
    api.save({ text: t, tag: tg }).then(onSaved, (e) => {
      setError(`Not saved: ${e.message}. Your text is back in the box.`)
      setText((o) => (o ? `${t}\n\n${o}` : t))
      setTag((o) => o || tg)
    })
  }
  return (
    <section className="nt-capture" aria-label="New note">
      <Textarea
        ref={boxRef}
        className="input nt-capture-box"
        rows={4}
        placeholder="What's on your mind?"
        aria-label="New note"
        value={text}
        onInput={(e) => setText(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (isSaveKey(e)) {
            e.preventDefault()
            save()
          }
        }}
      />
      <div className="nt-capture-foot">
        <Input
          className="input nt-tag"
          list="note-tags"
          placeholder="Tag: a person or topic (optional)"
          aria-label="Tag"
          value={tag}
          onInput={(e) => setTag(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (isSaveKey(e)) {
              e.preventDefault()
              save()
            }
          }}
        />
        <span className="pw-muted pw-small nt-hint">{SAVE_HINT} saves</span>
        <Button variant="primary" disabled={!text.trim()} onClick={save}>
          Save note
        </Button>
      </div>
      <PwErr message={error} />
    </section>
  )
}

/* Ta — one note row. */
function NoteRow({
  note,
  busy,
  onPatch,
  onDelete,
}: {
  note: any
  busy: boolean
  onPatch: (patch: Record<string, unknown>) => Promise<unknown>
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.text)
  const [tag, setTag] = useState(note.tag)
  const [confirming, setConfirming] = useState(false)
  const editRef = useRef<HTMLTextAreaElement | null>(null)
  /* the closure re-synced tag with an effect; render-adjust is the sanctioned
   * React equivalent. */
  const [prevTag, setPrevTag] = useState(note.tag)
  if (note.tag !== prevTag) {
    setPrevTag(note.tag)
    setTag(note.tag)
  }
  useEffect(() => {
    if (editing) editRef.current?.focus()
  }, [editing])

  const saveText = () => {
    const t = draft.trim()
    if (!t || t === note.text) return setEditing(false)
    onPatch({ text: t }).then((r) => r !== undefined && setEditing(false))
  }
  const saveTag = () => {
    if (tag.trim() !== note.tag) onPatch({ tag: tag.trim() })
  }
  const makeTask = () => {
    const first = note.text.split('\n')[0].trim()
    taskDraft.title = first.length > 120 ? `${first.slice(0, 117)}…` : first
    taskDraft.description = note.text
    location.hash = '#/tl-tasks'
  }

  return (
    <li className="nt-item cx-panel" data-status={note.status}>
      {editing ? (
        <Textarea
          className="input nt-edit"
          rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
          aria-label="Edit note"
          value={draft}
          ref={editRef}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (isSaveKey(e)) {
              e.preventDefault()
              saveText()
            } else if (e.key === 'Escape') {
              setDraft(note.text)
              setEditing(false)
            }
          }}
        />
      ) : (
        <p className="nt-text">{note.text}</p>
      )}
      <div className="nt-meta">
        <Input
          className="input nt-tag nt-tag-inline"
          list="note-tags"
          placeholder="Add a tag"
          aria-label="Tag"
          value={tag}
          onInput={(e) => setTag(e.currentTarget.value)}
          onBlur={saveTag}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <Select
          className="select nt-status"
          aria-label="Status"
          value={note.status}
          onChange={(e) => void onPatch({ status: e.currentTarget.value })}
        >
          {STATUS_IDS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <time className="pw-muted pw-small pw-num" dateTime={note.createdAt}>
          {dayTime(note.createdAt)}
        </time>
        <span className="nt-actions">
          {editing ? (
            <>
              <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={saveText}>
                Save
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setDraft(note.text)
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
            </>
          ) : confirming ? (
            <>
              <span className="pw-small">Delete this note?</span>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void onDelete()}>
                Delete
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="quiet" onClick={makeTask}>
                Make task
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setDraft(note.text)
                  setEditing(true)
                }}
              >
                Edit
              </Button>
              <Button size="sm" variant="quiet" className="nt-del" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            </>
          )}
        </span>
      </div>
    </li>
  )
}

/* Ca */
export function NotesPage({ route }: { route: { title: string; purpose?: string } }) {
  const { data, setData, error, reload } = useSe('people.notes', () => api.page())
  const [search, setSearch] = useState('')
  const busy = useBusy()
  const notes = useMemo(() => data?.notes ?? [], [data])
  const tags = useMemo(() => [...new Set(notes.map((n: any) => n.tag).filter(Boolean))].sort() as string[], [notes])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? notes.filter((n: any) => n.text.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q))
      : notes
  }, [notes, search])
  const patchLocal = (next: any) =>
    setData((f: any) => f && { notes: f.notes.map((w: any) => (w.id === next.id ? next : w)) })
  const patch = (id: string, body: Record<string, unknown>) => {
    busy.setError('')
    return api.save({ id, ...body }).then(
      (w) => (patchLocal(w), w),
      (e) => (busy.setError(e.message), undefined)
    )
  }
  return (
    <PwShell route={routeOf('notes', route)}>
      <datalist id="note-tags">
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <NoteCapture
        onSaved={(note) => setData((f: any) => ({ notes: [note, ...(f?.notes ?? [])] }))}
      />
      {error ? (
        <PwLate message={error} retry={reload} />
      ) : data ? (
        <>
          <div className="nt-bar">
            <Input
              className="input nt-search"
              type="search"
              placeholder="Search notes and tags"
              aria-label="Search notes and tags"
              value={search}
              onInput={(e) => setSearch(e.currentTarget.value)}
            />
            <span className="pw-muted pw-small pw-num">
              {search.trim() ? `${shown.length} of ${notes.length}` : `${notes.length} notes`}
            </span>
          </div>
          <PwErr message={busy.error} />
          {shown.length ? (
            <ol className="nt-list">
              {shown.map((note: any) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  busy={busy.busy}
                  onPatch={(body) => patch(note.id, body)}
                  onDelete={() =>
                    busy.run(async () => {
                      await api.remove(note.id)
                      setData((f: any) => f && { notes: f.notes.filter((w: any) => w.id !== note.id) })
                      return true
                    })
                  }
                />
              ))}
            </ol>
          ) : (
            <Empty
              title={notes.length ? 'No note matches that search.' : 'Nothing here yet.'}
              body={!notes.length ? 'Write the first thought in the box above.' : null}
            />
          )}
        </>
      ) : (
        <PwSkel lines={4} />
      )}
    </PwShell>
  )
}
