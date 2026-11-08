'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Select } from '@/features/shared/components/ui'

interface RosterUser {
  email: string
  name: string
  role: 'admin' | 'tl' | 'agent' | 'specialist'
  tl_email?: string
  country?: string
  active: boolean
  submitted_by?: string
  submitted_at?: string
}

const ROLE_STATUS: Record<string, string> = {
  admin: 'bad',
  tl: 'warn',
  specialist: 'info',
  agent: 'neutral',
}

export function AdminRosterPage() {
  const [roster, setRoster] = useState<RosterUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<RosterUser>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState<Partial<RosterUser>>({
    email: '',
    name: '',
    role: 'agent',
    tl_email: '',
    country: '',
    active: true,
  })

  useEffect(() => {
    fetch('/api/roster')
      .then(res => res.json())
      .then(data => {
        // GET /api/roster returns the roster array verbatim (no envelope).
        setRoster(Array.isArray(data) ? data : data.roster || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load roster:', err)
        setLoading(false)
      })
  }, [])

  const handleEdit = (user: RosterUser) => {
    setEditingEmail(user.email)
    setEditData(user)
  }

  const handleSave = async (email: string) => {
    try {
      await fetch('/api/roster', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...editData }),
      })
      setRoster(roster.map(u => u.email === email ? { ...u, ...editData } : u))
      setEditingEmail(null)
      setEditData({})
    } catch (err) {
      console.error('Failed to update user:', err)
    }
  }

  const handleCancel = () => {
    setEditingEmail(null)
    setEditData({})
  }

  const handleAdd = async () => {
    try {
      await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      setRoster([...roster, newUser as RosterUser])
      setShowAddForm(false)
      setNewUser({ email: '', name: '', role: 'agent', tl_email: '', country: '', active: true })
    } catch (err) {
      console.error('Failed to add user:', err)
    }
  }

  if (loading) {
    return (
      <main className="state-screen">
        <h1>Loading roster…</h1>
      </main>
    )
  }

  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page-head">
        <h1 id="page-title" className="page-title">
          Roster
        </h1>
        <p className="page-purpose">
          Who is on the CX roster, their role, team lead and whether they are active.
        </p>
      </header>

      <section className="cx-section">
        <div className="cx-section__head">
          <h2 className="cx-section__title">Users</h2>
          <Button
            variant={showAddForm ? 'quiet' : 'primary'}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add user'}
          </Button>
        </div>

        {showAddForm && (
          <div className="cx-panel cx-panel--pad">
            <div className="cx-grid-2">
              <div className="field">
                <label className="field-label" htmlFor="nu-email">Email</label>
                <Input
                  id="nu-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="nu-name">Name</label>
                <Input
                  id="nu-name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="nu-role">Role</label>
                <Select
                  id="nu-role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as RosterUser['role'] })}
                >
                  <option value="agent">Agent</option>
                  <option value="tl">TL</option>
                  <option value="specialist">Specialist</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="nu-tl">TL email</label>
                <Input
                  id="nu-tl"
                  type="email"
                  value={newUser.tl_email}
                  onChange={(e) => setNewUser({ ...newUser, tl_email: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="nu-country">Country</label>
                <Input
                  id="nu-country"
                  value={newUser.country}
                  onChange={(e) => setNewUser({ ...newUser, country: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="nu-active">Active</label>
                <span>
                  {/* kept raw: id="nu-active" pairs with the field-label htmlFor; Toggle can't carry id */}
                  <input
                    id="nu-active"
                    type="checkbox"
                    checked={newUser.active}
                    onChange={(e) => setNewUser({ ...newUser, active: e.target.checked })}
                  />{' '}
                  <span className="cx-muted">Counts toward access and staffing</span>
                </span>
              </div>
            </div>
            <p>
              <Button variant="primary" onClick={handleAdd}>
                Add user
              </Button>{' '}
              <Button variant="quiet" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </p>
          </div>
        )}

        <div className="cx-panel cx-panel--pad">
          <div className="cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>TL email</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {roster.map((user) => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>
                      {editingEmail === user.email ? (
                        <Input
                          value={editData.name ?? ''}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td>
                      <span className="cx-chip" data-status={ROLE_STATUS[user.role] || 'neutral'}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      {editingEmail === user.email ? (
                        <Input
                          value={editData.tl_email ?? ''}
                          onChange={(e) => setEditData({ ...editData, tl_email: e.target.value })}
                        />
                      ) : (
                        user.tl_email || '-'
                      )}
                    </td>
                    <td>
                      {editingEmail === user.email ? (
                        <Input
                          value={editData.country ?? ''}
                          onChange={(e) => setEditData({ ...editData, country: e.target.value })}
                        />
                      ) : (
                        user.country || '-'
                      )}
                    </td>
                    <td>
                      <span className="cx-chip" data-status={user.active ? 'ok' : 'bad'}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {editingEmail === user.email ? (
                        <>
                          <Button variant="primary" onClick={() => handleSave(user.email)}>
                            Save
                          </Button>{' '}
                          <Button variant="quiet" onClick={handleCancel}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button variant="quiet" onClick={() => handleEdit(user)}>
                          Edit
                        </Button>
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
