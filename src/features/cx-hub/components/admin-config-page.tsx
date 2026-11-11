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
  const rows = config ?? []

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
    </PageShell>
  )
}
