'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent, Table, TableHeader, TableRow, TableHead, TableCell, StatusBadge, Button, Loading, Input } from '@/components/ui'

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

export default function AdminRosterPage() {
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
        setRoster(data.roster || [])
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

  const getRoleBadgeType = (role: string) => {
    switch (role) {
      case 'admin': return 'error'
      case 'tl': return 'warning'
      case 'specialist': return 'info'
      default: return 'neutral'
    }
  }

  if (loading) return <Loading text="Loading roster..." />

  return (
    <div className="p-(--cx-space-4) md:p-(--cx-space-6) max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-(--cx-space-4) md:mb-(--cx-space-6)">
        <h1 className="text-(length:--cx-text-2xl) md:text-(length:--cx-text-3xl) font-semibold text-foreground">
          Roster Management
        </h1>
        <Button variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : 'Add User'}
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-(--cx-space-6)">
          <CardHeader>
            <h2 className="text-(length:--cx-text-lg) font-semibold text-foreground">
              Add New User
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
              <Input
                label="Name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                required
              />
              <div>
                <label className="text-sm font-medium text-foreground">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-(--cx-radius-control) border border-gray-300 mt-1"
                >
                  <option value="agent">Agent</option>
                  <option value="tl">TL</option>
                  <option value="specialist">Specialist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Input
                label="TL Email"
                type="email"
                value={newUser.tl_email}
                onChange={(e) => setNewUser({ ...newUser, tl_email: e.target.value })}
              />
              <Input
                label="Country"
                value={newUser.country}
                onChange={(e) => setNewUser({ ...newUser, country: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={newUser.active}
                  onChange={(e) => setNewUser({ ...newUser, active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="active" className="text-sm font-medium text-foreground">
                  Active
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="primary" onClick={handleAdd}>
                Add User
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-(length:--cx-text-lg) md:text-(length:--cx-text-xl) font-semibold text-foreground">
            Users
          </h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-(--cx-space-4) md:mx-0">
            <div className="min-w-200 px-(--cx-space-4) md:px-0">
              <Table caption="User roster">
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>TL Email</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <tbody>
                  {roster.map((user) => (
                    <TableRow key={user.email}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>
                        <StatusBadge type={getRoleBadgeType(user.role)}>
                          {user.role}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{user.tl_email || '-'}</TableCell>
                      <TableCell>{user.country || '-'}</TableCell>
                      <TableCell>
                        <StatusBadge type={user.active ? 'success' : 'error'}>
                          {user.active ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {editingEmail === user.email ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="primary" onClick={() => handleSave(user.email)}>
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancel}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleEdit(user)}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
