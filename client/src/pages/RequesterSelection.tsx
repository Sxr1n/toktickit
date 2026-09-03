import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRequester } from '../context/RequesterContext'

export default function RequesterSelection() {
  const { requesters, status, selectRequester, reload } = useRequester()
  const [choice, setChoice] = useState<string>('')
  const navigate = useNavigate()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!choice) return
    selectRequester(Number(choice))
    navigate('/')
  }

  return (
    <div className="container py-4" style={{ maxWidth: 480 }}>
      <h1>TokTickIT</h1>
      <p className="text-muted">
        Select a Development Requester to test requester-specific ticket behavior. This is not a login
        screen. Authentication and role-based access will be introduced in Lab 3.
      </p>

      {status === 'loading' && <p>⏳ Loading Development Requesters...</p>}

      {status === 'error' && (
        <div className="text-danger mb-3">
          <p>Unable to load Development Requesters.</p>
          <button type="button" className="btn btn-outline-secondary" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      {status === 'empty' && (
        <p className="mb-3">No active Development Requesters are available.</p>
      )}

      <form onSubmit={handleSubmit}>
        {status === 'loaded' && (
          <div className="mb-3 text-start">
            <label htmlFor="dev-requester-select" className="form-label">
              Development Requester
            </label>
            <select
              id="dev-requester-select"
              className="form-select"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">-- Select a Requester --</option>
              {requesters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.email})
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={status !== 'loaded' || !choice}>
          Continue
        </button>
      </form>
    </div>
  )
}
