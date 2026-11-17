'use client'

import { useState } from 'react'
import { Button, Empty, Input, PageShell, TableScroll } from '@/features/shared/components/ui'
import { toUserText } from '@/features/shared/lib/error-copy'
import { getBoot, useBootSelector } from '@/features/shared/shell/context'
import { Eo, fetchJson, jl, sh, Ti } from './hub-shared'

interface ConfigItem {
  key: string
  value: string
  description?: string
  updated_by?: string
  updated_at?: string
}

interface ProdAssumptionsDraft {
  mq: string
  text: string
  wa: string
}

const PROD_ASSUMPTIONS_KEY = 'prod_assumptions'

function prodAssumptionsDraft(value: unknown): ProdAssumptionsDraft {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      parsed = null
    }
  }
  const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  return { mq: String(obj.mq ?? ''), text: String(obj.text ?? ''), wa: String(obj.wa ?? '') }
}

function loadConfig(): Promise<ConfigItem[]> {
  // GET /api/config returns the config rows array verbatim (no envelope).
  return fetchJson<ConfigItem[] | { config?: ConfigItem[] }>('/api/config').then((data) =>
    Array.isArray(data) ? data : data.config || [],
  )
}

export function AdminConfigPage() {
  const { data: config, error, reload, setData } = Eo(loadConfig)
  const isAdmin = useBootSelector(() => getBoot()?.user.role === 'admin', [])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [prodDraft, setProdDraft] = useState<{ source: string; values: ProdAssumptionsDraft } | null>(null)
  const rows = config ?? []
  const prodRow = rows.find((item) => item.key === PROD_ASSUMPTIONS_KEY)
  const prodSource = prodRow ? String(prodRow.value) : ''
  const prodValues = prodDraft?.source === prodSource ? prodDraft.values : prodAssumptionsDraft(prodRow?.value)

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key)
    setEditValue(currentValue)
  }

  const handleSave = async (key: string) => {
    try {
      await fetchJson('/api/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      })
      setData((prev) => (prev ?? []).map((c) => (c.key === key ? { ...c, value: editValue } : c)))
      setEditingKey(null)
    } catch (err) {
      Ti((err as Error).message, 'error')
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValue('')
  }

  const updateProdDraft = (field: keyof ProdAssumptionsDraft, value: string) => {
    setProdDraft({ source: prodSource, values: { ...prodValues, [field]: value } })
  }

  const handleSaveProdAssumptions = async () => {
    const value = {
      mq: Number(prodValues.mq),
      text: Number(prodValues.text),
      wa: Number(prodValues.wa),
    }
    if (!Object.values(value).every(Number.isFinite)) {
      Ti('Enter numeric minute targets.', 'error')
      return
    }
    try {
      await fetchJson('/api/config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: PROD_ASSUMPTIONS_KEY, value }),
      })
      const stored = JSON.stringify(value)
      setData((prev) => (prev ?? []).map((c) => (c.key === PROD_ASSUMPTIONS_KEY ? { ...c, value: stored } : c)))
      setProdDraft(null)
    } catch (err) {
      Ti((err as Error).message, 'error')
    }
  }

  const handleInitProdAssumptions = async () => {
    try {
      await fetchJson('/api/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: PROD_ASSUMPTIONS_KEY, value: '{"mq":0,"text":0,"wa":0}' }),
      })
      await reload()
    } catch (err) {
      Ti((err as Error).message, 'error')
    }
  }

  return (
    <PageShell
      title="Configuration"
      purpose="System settings the productivity engine and pages read."
      id="page-title"
    >

      {error ? sh({ message: toUserText(error, { isAdmin, feature: 'Configuration' }), onRetry: reload }) : null}

      <section className="cx-panel">
        <div className="cx-section__head">
          <div>
            <h2 className="cx-section__title">System Configuration</h2>
            <div className="cx-section__hint">{config ? `${rows.length} settings` : '…'}</div>
          </div>
        </div>
        {error ? null : !config ? (
          jl({ lines: 8, tall: true })
        ) : rows.length === 0 ? (
          <Empty
            icon={
              <svg className="cx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
            }
            title="No configuration yet"
            body="Settings will appear here once they load."
          />
        ) : (
        <TableScroll label="System configuration" className="cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Key</th>
                  <th scope="col">Value</th>
                  <th scope="col">Updated</th>
                  <th scope="col">
                    <span className="cx-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.key}>
                    <td>
                      <div className="field">
                        <span className="field-label">{item.key}</span>
                        {item.description && <span className="field-hint">{item.description}</span>}
                      </div>
                    </td>
                    <td>
                      {editingKey === item.key ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          aria-label={`Value for ${item.key}`}
                        />
                      ) : (
                        <code>{item.value}</code>
                      )}
                    </td>
                    <td className="cx-muted">
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : ''}
                    </td>
                    <td>
                      {editingKey === item.key ? (
                        <>
                          <Button variant="primary" onClick={() => handleSave(item.key)}>
                            Save
                          </Button>{' '}
                          <Button variant="quiet" onClick={handleCancel}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button variant="quiet" onClick={() => handleEdit(item.key, item.value)}>
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      <section className="cx-panel">
        <div className="cx-section__head">
          <div>
            <h2 className="cx-section__title">Productivity assumptions</h2>
            <div className="cx-section__hint">Minute targets read by the productivity engine.</div>
          </div>
        </div>
        {error ? null : !config ? (
          jl({ lines: 3 })
        ) : prodRow ? (
          <div className="cx-panel--pad">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSaveProdAssumptions()
              }}
            >
              <div className="cx-grid-2">
                <div className="field">
                  <label className="field-label" htmlFor="prod-assumptions-mq">MQ target (minutes)</label>
                  <Input
                    id="prod-assumptions-mq"
                    type="number"
                    min={0}
                    value={prodValues.mq}
                    onChange={(e) => updateProdDraft('mq', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="prod-assumptions-text">Text target (minutes)</label>
                  <Input
                    id="prod-assumptions-text"
                    type="number"
                    min={0}
                    value={prodValues.text}
                    onChange={(e) => updateProdDraft('text', e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="prod-assumptions-wa">WhatsApp target (minutes)</label>
                  <Input
                    id="prod-assumptions-wa"
                    type="number"
                    min={0}
                    value={prodValues.wa}
                    onChange={(e) => updateProdDraft('wa', e.target.value)}
                  />
                </div>
              </div>
              <p>
                <Button variant="primary" type="submit">
                  Save assumptions
                </Button>
              </p>
            </form>
          </div>
        ) : (
          <div className="cx-panel--pad">
            <p className="cx-muted">prod_assumptions is not in config yet.</p>
            <Button variant="primary" onClick={() => void handleInitProdAssumptions()}>
              Initialize prod_assumptions
            </Button>
          </div>
        )}
      </section>
    </PageShell>
  )
}
