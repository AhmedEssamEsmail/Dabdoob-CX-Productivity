'use client'

import { useState } from 'react'
import { Button, Chip, Empty, Input, Select } from '@/features/shared/components/ui'
import type { ChipStatus } from '@/features/shared/components/ui/Chip'
import { toUserText } from '@/features/shared/lib/error-copy'
import { getBoot, useBootSelector } from '@/features/shared/shell/context'
import { Eo, fetchJson, jl, postJson, sh, Ti } from './hub-shared'

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

const ROLE_STATUS: Record<string, ChipStatus> = {
  admin: 'bad',
  tl: 'warn',
  specialist: 'info',
  agent: 'neutral',
}

function loadRoster(): Promise<RosterUser[]> {
  // GET /api/roster returns the roster array verbatim (no envelope).
  return fetchJson<RosterUser[] | { roster?: RosterUser[] }>('/api/roster').then((data) =>
    Array.isArray(data) ? data : data.roster || [],
  )
}

const EMPTY_USER: Partial<RosterUser> = {
  email: '',
  name: '',
  role: 'agent',
  tl_email: '',
  country: '',
  active: true,
}

export function AdminRosterPage() {
  const { data: roster, error, reload, setData } = Eo(loadRoster)
  const isAdmin = useBootSelector(() => getBoot()?.user.role === 'admin', [])
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<RosterUser>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUser, setNewUser] = useState<Partial<RosterUser>>(EMPTY_USER)
  const users = roster ?? []

  const handleEdit = (user: RosterUser) => {
    setEditingEmail(user.email)
    setEditData(user)
  }

  const handleSave = async (email: string) => {
    try {
      await fetchJson('/api/roster', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, ...editData }),
      })
      setData((prev) => (prev ?? []).map((u) => (u.email === email ? { ...u, ...editData } : u)))
      setEditingEmail(null)
      setEditData({})
    } catch (err) {
      Ti((err as Error).message, 'error')
    }
  }

  const handleCancel = () => {
    setEditingEmail(null)
    setEditData({})
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await postJson('/api/roster', newUser)
      setData((prev) => [...(prev ?? []), newUser as RosterUser])
      setShowAddForm(false)
      setNewUser(EMPTY_USER)
    } catch (err) {
      Ti((err as Error).message, 'error')
    }
  }

  return (
    <section className="page" aria-labelledby="page-title" aria-busy={!roster && !error}>
      <header className="page-head">
        <div>
          <h1 id="page-title" className="page-title">
            Roster
          </h1>
          <p className="page-purpose">
            Roles, team leads and active status for the CX roster.
          </p>
        </div>
        <div className="page-actions">
          <Button
            variant={showAddForm ? 'quiet' : 'primary'}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add user'}
          </Button>
        </div>
      </header>

      {error ? sh({ message: toUserText(error, { isAdmin, feature: 'Roster' }), onRetry: reload }) : null}

      {showAddForm ? (
          <section className="cx-panel">
            <div className="cx-section__head">
              <div>
                <h2 className="cx-section__title">Add user</h2>
                <div className="cx-section__hint">New roster member</div>
              </div>
            </div>
            <div className="cx-panel--pad">
            <form onSubmit={handleAdd}>
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
              <Button variant="primary" type="submit">
                Add user
              </Button>{' '}
              <Button variant="quiet" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </p>
            </form>
            </div>
          </section>
        ) : null}

        <section className="cx-panel">
          <div className="cx-section__head">
            <div>
              <h2 className="cx-section__title">Users</h2>
              <div className="cx-section__hint">{roster ? `${users.length} people` : '…'}</div>
            </div>
          </div>
          {error ? null : !roster ? (
            jl({ lines: 10, tall: true })
          ) : users.length === 0 ? (
            <Empty
              icon={
                <svg className="cx-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
              }
              title="No users yet"
              body="Add the first roster member."
            />
          ) : (
          <div className="cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">TL email</th>
                  <th scope="col">Country</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="cx-sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.email}>
                    <td>{user.email}</td>
                    <td>
                      {editingEmail === user.email ? (
                        <Input
                          value={editData.name ?? ''}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          aria-label={`Name for ${user.email}`}
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td>
                      <Chip status={ROLE_STATUS[user.role] || 'neutral'}>
                        {user.role}
                      </Chip>
                    </td>
                    <td>
                      {editingEmail === user.email ? (
                        <Input
                          value={editData.tl_email ?? ''}
                          onChange={(e) => setEditData({ ...editData, tl_email: e.target.value })}
                          aria-label={`Team lead for ${user.email}`}
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
                          aria-label={`Country for ${user.email}`}
                        />
                      ) : (
                        user.country || '-'
                      )}
                    </td>
                    <td>
                      <Chip status={user.active ? 'ok' : 'bad'}>
                        {user.active ? 'Active' : 'Inactive'}
                      </Chip>
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
          )}
        </section>
    </section>
  )
}
