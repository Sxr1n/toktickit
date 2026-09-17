import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type SubmitState = 'idle' | 'submitting' | 'error'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!email.trim()) errors.email = 'Email is required.'
    if (!password) errors.password = 'Password is required.'
    return errors
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitState('submitting')
    try {
      const user = await login(email.trim(), password)
      navigate(user.mustChangePassword ? '/change-password' : '/', { replace: true })
    } catch {
      // AC-06/BR-07: identical safe message whether the email is unknown, the password is
      // wrong, or the account is inactive -- the server already collapses all three into one
      // response, so there is nothing more specific to show here.
      setSubmitState('error')
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 420 }}>
      <h1>TokTickIT</h1>
      <h2 className="h5 text-muted mb-4">Sign in to your account</h2>

      {submitState === 'error' && (
        <p className="text-danger" role="alert">
          Invalid email or password.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3 text-start">
          <label htmlFor="email" className="form-label">
            Email address
          </label>
          <input
            id="email"
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldErrors.email ? 'true' : undefined}
          />
          {fieldErrors.email && <p className="text-danger mb-0">{fieldErrors.email}</p>}
        </div>

        <div className="mb-3 text-start">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={fieldErrors.password ? 'true' : undefined}
          />
          {fieldErrors.password && <p className="text-danger mb-0">{fieldErrors.password}</p>}
        </div>

        <button type="submit" className="btn btn-primary w-100" disabled={submitState === 'submitting'}>
          {submitState === 'submitting' ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
