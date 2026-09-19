import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { changePassword, ApiAuthError } from '../api/auth'

type SubmitState = 'idle' | 'submitting' | 'error'

interface Rule {
  label: string
  test: (value: string) => boolean
}

// Mirrors server/src/lib/auth.ts's passwordRuleFailures (BR-08) -- client-side checks give
// immediate feedback, the server re-validates independently and is the actual authority.
const RULES: Rule[] = [
  { label: 'Be at least 8 characters', test: (v) => v.length >= 8 },
  { label: 'Include an uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'Include a lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'Include a digit', test: (v) => /[0-9]/.test(v) },
  { label: 'Include a special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

export default function ChangePassword() {
  const { refreshUser } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const failedRules = RULES.filter((rule) => !rule.test(newPassword))
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const canSubmit = currentPassword.length > 0 && failedRules.length === 0 && passwordsMatch

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitState('submitting')
    try {
      await changePassword(currentPassword, newPassword)
      await refreshUser()
      navigate('/', { replace: true })
    } catch (err) {
      setSubmitState('error')
      setErrorMessage(
        err instanceof ApiAuthError && err.code === 'INVALID_CURRENT_PASSWORD'
          ? 'Current password is incorrect.'
          : 'Unable to change your password. Please try again.',
      )
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4">Change Your Password</h1>
      <p className="text-muted">You must set a new password to continue.</p>

      {submitState === 'error' && (
        <p className="text-danger" role="alert">
          {errorMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3 text-start">
          <label htmlFor="current-password" className="form-label">
            Current (temporary) password
          </label>
          <input
            id="current-password"
            type="password"
            className="form-control"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className="mb-3 text-start">
          <label htmlFor="new-password" className="form-label">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            className="form-control"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="mb-3 text-start">
          <label htmlFor="confirm-password" className="form-label">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            className="form-control"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-danger mb-0">Passwords do not match.</p>
          )}
        </div>

        <ul className="list-unstyled mb-3 text-start" aria-live="polite">
          <li>Password must:</li>
          {RULES.map((rule) => {
            const satisfied = rule.test(newPassword)
            return (
              <li key={rule.label} className={satisfied ? 'text-success' : 'text-muted'}>
                {satisfied ? '✓' : '○'} {rule.label}
              </li>
            )
          })}
        </ul>

        <button type="submit" className="btn btn-primary w-100" disabled={!canSubmit || submitState === 'submitting'}>
          {submitState === 'submitting' ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
