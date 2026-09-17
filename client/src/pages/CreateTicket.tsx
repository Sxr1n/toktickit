import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiPost, ApiValidationError } from '../api/http'
import AttachmentPicker from '../components/AttachmentPicker'
import { useAuth } from '../context/AuthContext'

interface Category {
  id: number
  name: string
}

interface RelatedSystem {
  id: number
  name: string
}

interface Ticket {
  id: number
  ticketNumber: string
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export default function CreateTicket() {
  const { user } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([])
  const [refDataError, setRefDataError] = useState(false)

  const [categoryId, setCategoryId] = useState('')
  const [relatedSystemId, setRelatedSystemId] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [requestedPriority, setRequestedPriority] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Category[]>('/api/categories'), apiGet<RelatedSystem[]>('/api/related-systems')])
      .then(([cats, systems]) => {
        setCategories(cats)
        setRelatedSystems(systems)
      })
      .catch(() => setRefDataError(true))
  }, [])

  const validate = () => {
    const errors: Record<string, string> = {}
    if (summary.trim().length < 5 || summary.trim().length > 150) {
      errors.summary = 'Summary is required and must be 5-150 characters.'
    }
    if (description.trim().length < 10 || description.trim().length > 2000) {
      errors.description = 'Description is required and must be 10-2000 characters.'
    }
    if (!requestedPriority) {
      errors.requestedPriority = 'Requested Priority is required.'
    }
    if (!categoryId) {
      errors.categoryId = 'Category is required.'
    }
    if (!relatedSystemId) {
      errors.relatedSystemId = 'Related System is required.'
    }
    return errors
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitState('submitting')
    try {
      const ticket = await apiPost<Ticket>('/api/tickets', {
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
      })
      setCreatedTicket(ticket)
      setSubmitState('success')
    } catch (err) {
      if (err instanceof ApiValidationError) {
        setFieldErrors(err.fields)
        setSubmitState('idle')
      } else {
        setSubmitState('error')
      }
    }
  }

  const resetForm = () => {
    setCategoryId('')
    setRelatedSystemId('')
    setSummary('')
    setDescription('')
    setRequestedPriority('')
    setAttachments([])
    setFieldErrors({})
    setCreatedTicket(null)
    setSubmitState('idle')
  }

  if (submitState === 'success' && createdTicket) {
    return (
      <div className="container py-4" style={{ maxWidth: 640 }}>
        <div className="p-4" style={{ backgroundColor: '#EAF6EF', borderRadius: 8 }}>
          <h2>Ticket created</h2>
          <p>
            Ticket Number: <strong>{createdTicket.ticketNumber}</strong>
          </p>
          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn btn-primary" onClick={resetForm}>
              Create Another Ticket
            </button>
            <Link to="/tickets" className="btn btn-outline-secondary">
              View My Tickets
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-4" style={{ maxWidth: 640 }}>
      <h1>Create Ticket</h1>

      {refDataError && (
        <p className="text-danger">Unable to load Categories/Related Systems. Please try again later.</p>
      )}

      {submitState === 'error' && (
        <p className="text-danger" role="alert">
          Unable to reach TokTickIT API. Your entries have been kept — please try again.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="category" className="form-label">
            Category
          </label>
          <select
            id="category"
            className="form-select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">-- Select a Category --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && <p className="text-danger mb-0">{fieldErrors.categoryId}</p>}
        </div>

        <div className="mb-3">
          <label htmlFor="related-system" className="form-label">
            Related System
          </label>
          <select
            id="related-system"
            className="form-select"
            value={relatedSystemId}
            onChange={(e) => setRelatedSystemId(e.target.value)}
          >
            <option value="">-- Select a Related System --</option>
            {relatedSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {fieldErrors.relatedSystemId && <p className="text-danger mb-0">{fieldErrors.relatedSystemId}</p>}
        </div>

        <div className="mb-3">
          <label htmlFor="requested-priority" className="form-label">
            Requested Priority
          </label>
          <select
            id="requested-priority"
            className="form-select"
            value={requestedPriority}
            onChange={(e) => setRequestedPriority(e.target.value)}
          >
            <option value="">-- Select a Priority --</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
          {fieldErrors.requestedPriority && <p className="text-danger mb-0">{fieldErrors.requestedPriority}</p>}
        </div>

        <div className="mb-3">
          <label htmlFor="summary" className="form-label">
            Summary <span className="text-danger">*</span>
          </label>
          <input
            id="summary"
            type="text"
            className="form-control"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          {fieldErrors.summary && <p className="text-danger mb-0">{fieldErrors.summary}</p>}
        </div>

        <div className="mb-3">
          <label htmlFor="description" className="form-label">
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="description"
            className="form-control"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {fieldErrors.description && <p className="text-danger mb-0">{fieldErrors.description}</p>}
        </div>

        <div className="mb-3">
          <AttachmentPicker files={attachments} onChange={setAttachments} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitState === 'submitting'}>
          {submitState === 'submitting' ? 'Submitting...' : 'Submit Ticket'}
        </button>
      </form>
    </div>
  )
}
