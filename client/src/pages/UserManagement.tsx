import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiAdminError, createUser, editUser, listUsers, resetPassword } from '../api/admin'
import type { AdminUser, CreateUserInput } from '../api/admin'
import { useAuth } from '../context/AuthContext'

interface Rule {
  label: string
  test: (value: string) => boolean
}

// Mirrors server/src/lib/auth.ts's passwordRuleFailures (BR-08).
const PASSWORD_RULES: Rule[] = [
  { label: 'Be at least 8 characters', test: (v) => v.length >= 8 },
  { label: 'Include an uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'Include a lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'Include a digit', test: (v) => /[0-9]/.test(v) },
  { label: 'Include a special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

const ROLES: AdminUser['role'][] = ['REQUESTER', 'IT_STAFF', 'ADMINISTRATOR']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type ListState = 'loading' | 'loaded' | 'error'
type PanelMode = 'create' | 'edit' | null

function RoleBadge({ role }: { role: AdminUser['role'] }) {
  return (
    <span className="badge" style={{ backgroundColor: '#EAF6EF', color: '#006B3C' }}>
      {role}
    </span>
  )
}

export default function UserManagement() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [listState, setListState] = useState<ListState>('loading')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const [panelMode, setPanelMode] = useState<PanelMode>(null)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminUser['role']>('REQUESTER')
  const [isActive, setIsActive] = useState(true)
  const [initialPassword, setInitialPassword] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [resetOpen, setResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSubmitting, setResetSubmitting] = useState(false)

  // Fetched once, unfiltered -- search/role filtering happens client-side below. This keeps
  // activeAdminCount (used for the last-active-Administrator safety check) accurate regardless of
  // what the list is currently filtered to; computing it from a filtered view could wrongly
  // report "last admin" for someone who isn't.
  const load = useCallback(() => {
    setListState('loading')
    listUsers({})
      .then((data) => {
        setUsers(data)
        setListState('loaded')
      })
      .catch(() => setListState('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((u) => {
      const matchesSearch = term === '' || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      const matchesRole = roleFilter === '' || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const activeAdminCount = useMemo(
    () => users.filter((u) => u.role === 'ADMINISTRATOR' && u.isActive).length,
    [users],
  )

  const isSelf = editingUser !== null && currentUser !== null && editingUser.id === currentUser.id
  const isLastActiveAdmin =
    editingUser !== null && editingUser.role === 'ADMINISTRATOR' && editingUser.isActive && activeAdminCount <= 1
  const activeToggleDisabled = panelMode === 'edit' && isActive && (isSelf || isLastActiveAdmin)

  const closePanel = () => {
    setPanelMode(null)
    setEditingUser(null)
    setResetOpen(false)
  }

  const openCreate = () => {
    setPanelMode('create')
    setEditingUser(null)
    setName('')
    setEmail('')
    setRole('REQUESTER')
    setIsActive(true)
    setInitialPassword('')
    setFieldErrors({})
    setFormError(null)
    setSuccessMessage(null)
    setResetOpen(false)
  }

  const openEdit = (u: AdminUser) => {
    setPanelMode('edit')
    setEditingUser(u)
    setName(u.name)
    setEmail(u.email)
    setRole(u.role)
    setIsActive(u.isActive)
    setInitialPassword('')
    setFieldErrors({})
    setFormError(null)
    setSuccessMessage(null)
    setResetOpen(false)
  }

  const passwordFailures = PASSWORD_RULES.filter((r) => !r.test(initialPassword))
  const nameValid = name.trim().length > 0
  const emailValid = EMAIL_RE.test(email.trim())
  const canSubmit =
    nameValid && emailValid && (panelMode === 'edit' || passwordFailures.length === 0) && !submitting

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})
    try {
      if (panelMode === 'create') {
        const input: CreateUserInput = { name: name.trim(), email: email.trim(), role, isActive, initialPassword }
        await createUser(input)
        setSuccessMessage(`${input.name} was created.`)
      } else if (panelMode === 'edit' && editingUser) {
        await editUser(editingUser.id, { name: name.trim(), email: email.trim(), role, isActive })
        setSuccessMessage(`${name.trim()} was updated.`)
      }
      load()
      closePanel()
    } catch (err) {
      if (err instanceof ApiAdminError) {
        if (err.code === 'EMAIL_TAKEN') {
          setFieldErrors({ email: 'That email address is already in use.' })
        } else if (err.code === 'SELF_DEACTIVATION') {
          setFormError('You cannot deactivate your own account.')
        } else if (err.code === 'LAST_ADMINISTRATOR') {
          setFormError('At least one active Administrator must remain.')
        } else if (err.details?.fields && typeof err.details.fields === 'object') {
          setFieldErrors(err.details.fields as Record<string, string>)
        } else {
          setFormError(err.message)
        }
      } else {
        setFormError('Unable to reach TokTickIT API. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const resetPasswordFailures = PASSWORD_RULES.filter((r) => !r.test(newPassword))
  const resetPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const canConfirmReset = resetPasswordFailures.length === 0 && resetPasswordsMatch && !resetSubmitting

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!canConfirmReset || !editingUser) return

    setResetSubmitting(true)
    setResetError(null)
    try {
      await resetPassword(editingUser.id, newPassword)
      setSuccessMessage(`Password reset for ${editingUser.name}. They must change it at next login.`)
      setResetOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setResetError(err instanceof ApiAdminError ? err.message : 'Unable to reset the password. Please try again.')
    } finally {
      setResetSubmitting(false)
    }
  }

  const hasFilters = search.trim() !== '' || roleFilter !== ''
  const noUsersAtAll = listState === 'loaded' && users.length === 0 && !hasFilters
  const noResults = listState === 'loaded' && users.length > 0 && visibleUsers.length === 0 && hasFilters

  return (
    <div className="container py-4">
      <h1>User Management</h1>

      {successMessage && <p className="text-success">{successMessage}</p>}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="d-flex gap-2 mb-3">
            <input
              type="search"
              className="form-control"
              placeholder="Search by name or email"
              aria-label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="form-select"
              aria-label="Filter by Role"
              style={{ maxWidth: 160 }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="btn btn-primary mb-3" onClick={openCreate}>
            New User
          </button>

          {listState === 'loading' && <p>⏳ Loading users...</p>}

          {listState === 'error' && (
            <div className="text-danger">
              <p>Unable to load users.</p>
              <button type="button" className="btn btn-outline-secondary" onClick={load}>
                Retry
              </button>
            </div>
          )}

          {noUsersAtAll && <p>No users in the system yet.</p>}

          {noResults && (
            <div>
              <p>No users match your search/filters.</p>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => {
                  setSearch('')
                  setRoleFilter('')
                }}
              >
                Clear Filters
              </button>
            </div>
          )}

          {listState === 'loaded' && visibleUsers.length > 0 && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <RoleBadge role={u.role} />
                      </td>
                      <td>
                        <span className={u.isActive ? 'text-success' : 'text-muted'}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => openEdit(u)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="col-12 col-lg-7">
          {panelMode && (
            <div className="p-3" style={{ backgroundColor: '#F8F9F6', borderRadius: 8 }}>
              <h2 className="h5">{panelMode === 'create' ? 'Create User' : 'Edit User'}</h2>

              {formError && (
                <p className="text-danger" role="alert">
                  {formError}
                </p>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="mb-3">
                  <label htmlFor="user-name" className="form-label">
                    Name
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {fieldErrors.name && <p className="text-danger mb-0">{fieldErrors.name}</p>}
                </div>

                <div className="mb-3">
                  <label htmlFor="user-email" className="form-label">
                    Email
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {fieldErrors.email && <p className="text-danger mb-0">{fieldErrors.email}</p>}
                </div>

                <div className="mb-3">
                  <label htmlFor="user-role" className="form-label">
                    Role
                  </label>
                  <select
                    id="user-role"
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as AdminUser['role'])}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.role && <p className="text-danger mb-0">{fieldErrors.role}</p>}
                </div>

                <div className="mb-3 form-check">
                  <input
                    id="user-active"
                    type="checkbox"
                    className="form-check-input"
                    checked={isActive}
                    disabled={activeToggleDisabled}
                    onChange={(e) => setIsActive(e.target.checked)}
                    title={
                      activeToggleDisabled
                        ? isSelf
                          ? 'You cannot deactivate your own account.'
                          : 'At least one active Administrator must remain.'
                        : undefined
                    }
                  />
                  <label htmlFor="user-active" className="form-check-label">
                    Active
                  </label>
                  {activeToggleDisabled && (
                    <p className="text-muted small mb-0">
                      {isSelf
                        ? 'You cannot deactivate your own account.'
                        : 'At least one active Administrator must remain.'}
                    </p>
                  )}
                </div>

                {panelMode === 'create' && (
                  <div className="mb-3">
                    <label htmlFor="initial-password" className="form-label">
                      Initial Password
                    </label>
                    <input
                      id="initial-password"
                      type="password"
                      className="form-control"
                      value={initialPassword}
                      onChange={(e) => setInitialPassword(e.target.value)}
                    />
                    {fieldErrors.initialPassword && <p className="text-danger mb-0">{fieldErrors.initialPassword}</p>}
                    <ul className="list-unstyled mb-0 mt-1" aria-live="polite">
                      {PASSWORD_RULES.map((rule) => {
                        const satisfied = rule.test(initialPassword)
                        return (
                          <li key={rule.label} className={satisfied ? 'text-success' : 'text-muted'}>
                            {satisfied ? '✓' : '○'} {rule.label}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
                    {submitting ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={closePanel}>
                    Cancel
                  </button>
                  {panelMode === 'edit' && (
                    <button
                      type="button"
                      className="btn btn-outline-dark ms-auto"
                      onClick={() => {
                        setResetOpen(true)
                        setNewPassword('')
                        setConfirmPassword('')
                        setResetError(null)
                      }}
                    >
                      Set New Password
                    </button>
                  )}
                </div>
              </form>

              {resetOpen && editingUser && (
                <form onSubmit={handleResetPassword} className="mt-3 p-3 border rounded">
                  <h3 className="h6">Set New Password for {editingUser.name}</h3>

                  <div className="mb-2">
                    <label htmlFor="reset-new-password" className="form-label">
                      New password
                    </label>
                    <input
                      id="reset-new-password"
                      type="password"
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="mb-2">
                    <label htmlFor="reset-confirm-password" className="form-label">
                      Confirm new password
                    </label>
                    <input
                      id="reset-confirm-password"
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {confirmPassword.length > 0 && !resetPasswordsMatch && (
                      <p className="text-danger mb-0">Passwords do not match.</p>
                    )}
                  </div>

                  <ul className="list-unstyled mb-2" aria-live="polite">
                    {PASSWORD_RULES.map((rule) => {
                      const satisfied = rule.test(newPassword)
                      return (
                        <li key={rule.label} className={satisfied ? 'text-success' : 'text-muted'}>
                          {satisfied ? '✓' : '○'} {rule.label}
                        </li>
                      )
                    })}
                  </ul>

                  {resetError && (
                    <p className="text-danger" role="alert">
                      {resetError}
                    </p>
                  )}

                  <div className="d-flex gap-2">
                    <button type="submit" className="btn btn-dark btn-sm" disabled={!canConfirmReset}>
                      {resetSubmitting ? 'Saving...' : 'Confirm New Password'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setResetOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
