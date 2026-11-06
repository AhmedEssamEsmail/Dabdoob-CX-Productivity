'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* verbatim port of the legacy Quality Audit forms page
 * (qa-forms.closure.js symbols yl page + bl FormBuilder + sa/la/fl factories).
 */
import { useState } from 'react'
import {
  Chip,
  LinesSkeleton,
  ListSelect,
  LoadError,
  P,
  useSe,
} from './qa-shared'
import { PageHead } from '@/features/shared/components/shell/ui'
import { toast } from '@/features/shared/components/shell/Toasts'

let aa = 0

/** sa() — new-question factory (verbatim id scheme). */
const sa = () => ({
  id: `n${Date.now().toString(36)}${++aa}`,
  text: '',
  weight: 10,
  fatal: false,
  hint: '',
})

/** la() — new-section factory. */
const la = () => ({
  id: `s${Date.now().toString(36)}${++aa}`,
  title: '',
  questions: [sa()],
})

/** fl(t, n) — edit-draft factory from a stored form. */
const fl = (t: any, n: string[]) => ({
  formId: t.formId,
  title: t.title,
  channel: t.channel === '*' ? '' : t.channel,
  everyChannel: t.channel === '*',
  nonTicket: n.includes(t.channel),
  placeholder: t.placeholder,
  active: t.active,
  scoring: t.scoring === 'deduction' ? 'deduction' : 'weighted',
  sections: JSON.parse(JSON.stringify(t.sections)),
})

/** bl — the form builder (verbatim). */
function FormBuilder({
  draft: t,
  onClose: n,
}: {
  draft: any
  onClose: (saved: boolean) => void
}) {
  const [a, s] = useState<any>(t)
  const [i, c] = useState(false)
  const [l, p] = useState('')

  const m = (h: number, b: any) =>
    s((x: any) => ({
      ...x,
      sections: x.sections.map((f: any, g: number) =>
        g === h ? { ...f, ...b } : f
      ),
    }))
  const r = (h: number, b: number, x: any) =>
    m(h, {
      questions: a.sections[h].questions.map((f: any, g: number) =>
        g === b ? { ...f, ...x } : f
      ),
    })
  const u = a.scoring === 'deduction'
  const d = a.sections.reduce(
    (h: number, b: any) =>
      h +
      b.questions.reduce(
        (x: number, f: any) =>
          x + (f.fatal && !u ? 0 : Number(f.weight) || 0),
        0
      ),
    0
  )

  return (
    <form
      className="cx-panel cx-panel--pad qa-builder"
      onSubmit={(h) => {
        h.preventDefault()
        c(true)
        p('')
        P.saveForm({
          formId: a.formId,
          title: a.title,
          channel: a.everyChannel ? '*' : a.channel,
          placeholder: a.placeholder,
          active: a.active,
          scoring: a.scoring,
          sections: a.sections,
        }).then(
          (b) => {
            c(false)
            toast(
              `Saved as version ${b.version}. New audits use it; earlier audits keep their version.`
            )
            n(true)
          },
          (b) => {
            c(false)
            p(b.message)
          }
        )
      }}
    >
      <div className="qa-grid">
        <div className="cx-field cx-field--wide">
          <label className="cx-label" htmlFor="fb-t">
            Title
          </label>
          <input
            className="cx-input"
            id="fb-t"
            value={a.title}
            onInput={(h) => s({ ...a, title: h.currentTarget.value })}
          />
        </div>
        {a.everyChannel ? null : a.nonTicket ? (
          <ListSelect
            key="type"
            listKey="qa.audit_type"
            label="Audit type"
            value={a.channel}
            onChange={(h) => s({ ...a, channel: h })}
            required
            hint="Not a Freshdesk ticket, e.g. Cash refund. A new type typed into Other appears in the auditors' New non-ticket audit list."
          />
        ) : (
          <ListSelect
            key="channel"
            listKey="qa.channel"
            label="Channel"
            value={a.channel}
            onChange={(h) => s({ ...a, channel: h })}
            required
          />
        )}
        <label className="cx-toggle">
          <input
            type="checkbox"
            checked={a.nonTicket}
            disabled={a.everyChannel}
            onChange={(h) =>
              s({ ...a, nonTicket: h.currentTarget.checked, channel: '' })
            }
          />
          <span>For a non-ticket audit type (e.g. cash refunds)</span>
        </label>
        {a.nonTicket ? null : (
          <label className="cx-toggle">
            <input
              type="checkbox"
              checked={a.everyChannel}
              onChange={(h) =>
                s({ ...a, everyChannel: h.currentTarget.checked })
              }
            />
            <span>Default for channels with no form of their own</span>
          </label>
        )}
        <label className="cx-toggle">
          <input
            type="checkbox"
            checked={a.active}
            onChange={(h) => s({ ...a, active: h.currentTarget.checked })}
          />
          <span>Active</span>
        </label>
        <label className="cx-toggle">
          <input
            type="checkbox"
            checked={a.placeholder}
            onChange={(h) =>
              s({ ...a, placeholder: h.currentTarget.checked })
            }
          />
          <span>Placeholder (shows a warning on the form)</span>
        </label>
        <div className="cx-field">
          <label className="cx-label" htmlFor="fb-sc">
            Scoring
          </label>
          <select
            className="cx-input"
            id="fb-sc"
            value={a.scoring}
            onChange={(h) =>
              s({
                ...a,
                scoring:
                  h.currentTarget.value === 'deduction'
                    ? 'deduction'
                    : 'weighted',
              })
            }
          >
            <option value="weighted">Share of weight passed</option>
            <option value="deduction">
              Deductions (100 minus what failed)
            </option>
          </select>
        </div>
      </div>
      {a.sections.map((h: any, b: number) => (
        <fieldset className="qa-sec" key={h.id}>
          <legend className="qa-sec__title">Section {b + 1}</legend>
          <div className="qa-row">
            <input
              className="cx-input"
              aria-label={`Section ${b + 1} title`}
              placeholder="Section title, e.g. Resolution"
              value={h.title}
              onInput={(x) => m(b, { title: x.currentTarget.value })}
            />
            <button
              type="button"
              className="cx-btn cx-btn--quiet"
              disabled={a.sections.length < 2}
              onClick={() =>
                s({
                  ...a,
                  sections: a.sections.filter(
                    (x: any, f: number) => f !== b
                  ),
                })
              }
            >
              Remove section
            </button>
          </div>
          <label className="cx-toggle">
            <input
              type="checkbox"
              checked={!!h.optional}
              onChange={(x) => m(b, { optional: x.currentTarget.checked })}
            />
            <span>
              Optional: opens skipped (all N/A, no effect on the score)
            </span>
          </label>
          {h.questions.map((x: any, f: number) => (
            <div className="qa-bq" key={x.id}>
              <input
                className="cx-input"
                aria-label="Question"
                placeholder="What the auditor checks"
                value={x.text}
                onInput={(g) => r(b, f, { text: g.currentTarget.value })}
              />
              {u ? (
                <>
                  <input
                    className="cx-input qa-w"
                    type="number"
                    min={0}
                    max={100}
                    aria-label="Deduction when failed, %"
                    value={x.weight}
                    onInput={(g) => {
                      const y = Number(g.currentTarget.value)
                      r(b, f, { weight: y, fatal: y >= 100 })
                    }}
                  />
                  <span className="cx-muted">
                    {x.weight >= 100 ? '% (critical)' : '% if failed'}
                  </span>
                </>
              ) : (
                <>
                  <input
                    className="cx-input qa-w"
                    type="number"
                    min={1}
                    max={100}
                    aria-label="Weight"
                    disabled={x.fatal}
                    value={x.fatal ? '' : x.weight}
                    onInput={(g) =>
                      r(b, f, { weight: Number(g.currentTarget.value) })
                    }
                  />
                  <label className="cx-toggle">
                    <input
                      type="checkbox"
                      checked={!!x.fatal}
                      onChange={(g) =>
                        r(b, f, { fatal: g.currentTarget.checked })
                      }
                    />
                    <span>Critical</span>
                  </label>
                </>
              )}
              <button
                type="button"
                className="cx-btn cx-btn--quiet"
                disabled={h.questions.length < 2}
                onClick={() =>
                  m(b, {
                    questions: h.questions.filter(
                      (g: any, y: number) => y !== f
                    ),
                  })
                }
              >
                Remove
              </button>
              <input
                className="cx-input qa-bq__hint"
                aria-label="Guidance for the auditor"
                placeholder="Guidance for the auditor (optional)"
                value={x.hint ?? ''}
                onInput={(g) => r(b, f, { hint: g.currentTarget.value })}
              />
            </div>
          ))}
          <button
            type="button"
            className="cx-btn"
            onClick={() => m(b, { questions: [...h.questions, sa()] })}
          >
            Add question
          </button>
        </fieldset>
      ))}
      <div className="qa-row">
        <button
          type="button"
          className="cx-btn"
          onClick={() => s({ ...a, sections: [...a.sections, la()] })}
        >
          Add section
        </button>
        {u ? (
          <span className="cx-muted">
            An audit scores 100 minus the deductions of the questions failed,
            never below 0. A 100% deduction is critical.
          </span>
        ) : (
          <span className="cx-muted">
            Scored weight in total:{' '}
            <strong className="cx-num">{d}</strong>. Scores are the share of
            applicable weight passed, so the total need not be 100.
          </span>
        )}
      </div>
      {l ? (
        <p className="cx-error" role="alert">
          {l}
        </p>
      ) : null}
      <div className="qa-form__foot">
        <button
          type="submit"
          className="cx-btn cx-btn--primary"
          disabled={i}
        >
          {i ? 'Saving…' : a.formId ? 'Save as a new version' : 'Create form'}
        </button>
        <button
          type="button"
          className="cx-btn cx-btn--quiet"
          onClick={() => n(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/** yl — the page (verbatim: it uses de/Yn/Pt/zn directly, not the QaPage d). */
export function QaFormsPage({ route }: { route: { title: string } }) {
  const { data: n, error: a, reload: s } = useSe(P.formsPage)
  const [i, c] = useState<any>(null)

  return (
    <section
      className="cxp dq-page"
      aria-labelledby="page-title"
      aria-busy={!n && !a}
    >
      <PageHead
        title={route.title}
        sub="The questions auditors answer, per channel. Critical questions set the audit to 0 when failed. Each save is a new version; past audits keep theirs."
      />
      {a ? <LoadError message={a} onRetry={s} /> : null}
      {n ? (
        i ? (
          <FormBuilder
            draft={i}
            onClose={(l) => {
              c(null)
              if (l) s()
            }}
          />
        ) : (
          <>
            <button
              type="button"
              className="cx-btn cx-btn--primary"
              onClick={() =>
                c({
                  title: '',
                  channel: '',
                  everyChannel: false,
                  nonTicket: false,
                  placeholder: false,
                  active: true,
                  scoring: 'weighted',
                  sections: [la()],
                })
              }
            >
              New form
            </button>
            <div className="cx-panel cx-tablewrap qa-gap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Form</th>
                    <th scope="col">Channel</th>
                    <th scope="col">Questions</th>
                    <th scope="col">Version</th>
                    <th scope="col">State</th>
                    <th scope="col">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {n.forms.map((l: any) => (
                    <tr key={l.formId}>
                      <td>{l.title}</td>
                      <td>
                        {l.channel === '*'
                          ? 'Every channel without its own'
                          : l.channel}
                        {n.auditTypes?.includes(l.channel) ? (
                          <span className="cx-faint qa-sub">
                            Non-ticket audit type
                          </span>
                        ) : null}
                      </td>
                      <td className="cx-num">
                        {l.sections.reduce(
                          (p: number, m: any) => p + m.questions.length,
                          0
                        )}
                      </td>
                      <td className="cx-num">{l.version}</td>
                      <td>
                        {l.placeholder ? (
                          <Chip status="warn">Placeholder</Chip>
                        ) : null}{' '}
                        <Chip status={l.active ? 'ok' : 'neutral'}>
                          {l.active ? 'Active' : 'Off'}
                        </Chip>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cx-btn"
                          onClick={() => c(fl(l, n.auditTypes ?? []))}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : (
        <LinesSkeleton lines={6} />
      )}
    </section>
  )
}
