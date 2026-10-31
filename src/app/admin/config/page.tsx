'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent, Input, Button, Loading } from '@/components/ui'

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
        setConfig(data.config || [])
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

  if (loading) return <Loading text="Loading configuration..." />

  return (
    <div className="p-(--cx-space-4) md:p-(--cx-space-6) max-w-7xl mx-auto">
      <h1 className="text-(--cx-text-2xl) md:text-(--cx-text-3xl) font-semibold text-foreground mb-(--cx-space-4) md:mb-(--cx-space-6)">
        Configuration
      </h1>

      <Card>
        <CardHeader>
          <h2 className="text-(--cx-text-lg) md:text-(--cx-text-xl) font-semibold text-foreground">
            System Configuration
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.map((item) => (
              <div key={item.key} className="border-b border-gray-200 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-foreground">{item.key}</h3>
                    {item.description && (
                      <p className="text-sm text-foreground opacity-70 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {item.updated_at && (
                    <span className="text-xs text-foreground opacity-50">
                      Updated: {new Date(item.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {editingKey === item.key ? (
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" variant="primary" onClick={() => handleSave(item.key)}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center mt-2">
                    <code className="text-sm bg-gray-50 px-2 py-1 rounded text-foreground">
                      {item.value}
                    </code>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(item.key, item.value)}>
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
