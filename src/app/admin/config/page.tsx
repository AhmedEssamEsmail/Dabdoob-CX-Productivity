'use client'

import { useEffect, useState } from 'react'

interface ConfigItem {
  key: string
  value: string
  description?: string
  updated_by?: string
  updated_at?: string
}

export default function AdminConfigPage() {
  const [config, setConfig] = useState<ConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        // GET /api/config returns the config rows array verbatim (no envelope).
        setConfig(Array.isArray(data) ? data : data.config || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load config:', err)
        setLoading(false)
      })
  }, [])

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key)
    setEditValue(currentValue)
  }

  const handleSave = async (key: string) => {
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: editValue }),
      })
      setConfig(config.map(c => c.key === key ? { ...c, value: editValue } : c))
      setEditingKey(null)
    } catch (err) {
      console.error('Failed to update config:', err)
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValue('')
  }

  if (loading) {
    return (
      <main className="state-screen">
        <h1>Loading configuration…</h1>
      </main>
    )
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page-head">
        <h1 id="page-title" className="page-title">
          Configuration
        </h1>
        <p className="page-purpose">System settings the productivity engine and pages read.</p>
      </header>

      <section className="cx-section">
        <div className="cx-section__head">
          <h2 className="cx-section__title">System Configuration</h2>
        </div>
        <div className="cx-panel cx-panel--pad">
          <div className="cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {config.map((item) => (
                  <tr key={item.key}>
                    <td>
                      <div className="field">
                        <span className="field-label">{item.key}</span>
                        {item.description && <span className="field-hint">{item.description}</span>}
                      </div>
                    </td>
                    <td>
                      {editingKey === item.key ? (
                        <input
                          className="cx-input"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
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
                          <button
                            type="button"
                            className="cx-btn cx-btn--primary"
                            onClick={() => handleSave(item.key)}
                          >
                            Save
                          </button>{' '}
                          <button type="button" className="cx-btn cx-btn--quiet" onClick={handleCancel}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="cx-btn cx-btn--quiet"
                          onClick={() => handleEdit(item.key, item.value)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  )
}
