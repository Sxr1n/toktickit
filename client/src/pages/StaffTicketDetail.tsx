import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { apiDownload, apiGet, apiPatch, apiPost } from '../api/http'

interface Attachment {
  id: number
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  isRemoved: boolean
  removedReason: string | null
}

interface StaffUser {
  id: number
  name: string
  role: 'IT_STAFF' | 'ADMINISTRATOR'
}

type TicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED'
  | 'CANCELLED'

interface TicketDetailResponse {
  id: number
  ticketNumber: string
  summary: string
  description: string
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH'
  itPriority: 'LOW' | 'MEDIUM' | 'HIGH'
  currentStatus: TicketStatus
  requesterConfirmedResolved: boolean
  createdAt: string
  updatedAt: string
  requester: { id: number; name: string; email: string }
  category: { id: number; name: string }
  relatedSystem: { id: number; name: string }
  ticketOwnerId: number | null
  ticketOwnerName: string | null
  attachments: Attachment[]
}

interface PublicComment {
  id: number
  authorId: number
  authorName: string
  authorRole: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  body: string
  createdAt: string
}

interface InternalNote {
  id: number
  authorId: number
  authorName: string
  body: string
  createdAt: string
}

interface ActionTaken {
  id: number
  performedById: number
  performedByName: string
  description: string
  result: string
  followUpRequired: boolean
  followUpNote: string | null
  attachmentNotes: string | null
  createdAt: string
  updatedAt: string
}

interface ActionDraft {
  description: string
  result: string
  followUpRequired: boolean
  followUpNote: string
  attachmentNotes: string
}

const EMPTY_ACTION_DRAFT: ActionDraft = {
  description: '',
  result: '',
  followUpRequired: false,
  followUpNote: '',
  attachmentNotes: '',
}

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error'

// Mirrors server/src/routes/staff.ts's TRANSITIONS -- the server is the authority (BR-21); this
// only narrows the client's Status select as a UX courtesy, not a security control.
const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['OPEN', 'CANCELLED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
}

export default function StaffTicketDetail() {
  const { id } = useParams()

  const [state, setState] = useState<LoadState>('loading')
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])
  const [ownerError, setOwnerError] = useState<string | null>(null)
  const [priorityError, setPriorityError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [comments, setComments] = useState<PublicComment[]>([])
  const [commentsLoadFailed, setCommentsLoadFailed] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)

  const [notes, setNotes] = useState<InternalNote[]>([])
  const [notesLoadFailed, setNotesLoadFailed] = useState(false)
  const [noteBody, setNoteBody] = useState('')
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)

  const [actions, setActions] = useState<ActionTaken[]>([])
  const [actionsLoadFailed, setActionsLoadFailed] = useState(false)
  const [actionDraft, setActionDraft] = useState<ActionDraft>(EMPTY_ACTION_DRAFT)
  const [actionSubmitting, setActionSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingActionId, setEditingActionId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<ActionDraft>(EMPTY_ACTION_DRAFT)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setState('loading')
    apiGet<TicketDetailResponse>(`/api/staff/tickets/${id}`)
      .then((data) => {
        setTicket(data)
        setState('loaded')
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('status 404')) {
          setState('not-found')
        } else {
          setState('error')
        }
      })
  }, [id])

  const loadComments = useCallback(() => {
    if (!id) return
    setCommentsLoadFailed(false)
    apiGet<PublicComment[]>(`/api/tickets/${id}/public-comments`)
      .then(setComments)
      .catch(() => setCommentsLoadFailed(true))
  }, [id])

  const loadNotes = useCallback(() => {
    if (!id) return
    setNotesLoadFailed(false)
    apiGet<InternalNote[]>(`/api/staff/tickets/${id}/internal-notes`)
      .then(setNotes)
      .catch(() => setNotesLoadFailed(true))
  }, [id])

  const loadActions = useCallback(() => {
    if (!id) return
    setActionsLoadFailed(false)
    apiGet<ActionTaken[]>(`/api/staff/tickets/${id}/actions-taken`)
      .then(setActions)
      .catch(() => setActionsLoadFailed(true))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    loadActions()
  }, [loadActions])

  useEffect(() => {
    apiGet<StaffUser[]>('/api/staff/users')
      .then(setStaffUsers)
      .catch(() => {})
  }, [])

  const handleOwnerChange = async (value: string) => {
    if (!ticket) return
    const nextOwnerId = value === '' ? null : Number(value)
    const nextOwnerName = value === '' ? null : (staffUsers.find((u) => u.id === nextOwnerId)?.name ?? null)

    setOwnerError(null)
    const previous = ticket
    setTicket({ ...ticket, ticketOwnerId: nextOwnerId, ticketOwnerName: nextOwnerName })

    try {
      await apiPatch(`/api/staff/tickets/${ticket.id}/owner`, { ticketOwnerId: nextOwnerId })
    } catch {
      setTicket(previous)
      setOwnerError('Unable to update the Ticket Owner. Please try again.')
    }
  }

  const handlePriorityChange = async (value: string) => {
    if (!ticket) return
    setPriorityError(null)
    try {
      await apiPatch(`/api/staff/tickets/${ticket.id}/it-priority`, { itPriority: value })
      load()
    } catch {
      setPriorityError('Unable to update the IT Priority. Please try again.')
    }
  }

  const handleStatusChange = async (value: string) => {
    if (!ticket) return
    setStatusError(null)
    try {
      await apiPatch(`/api/staff/tickets/${ticket.id}/status`, { status: value })
      load()
    } catch {
      setStatusError('Unable to update the Status. Please try again.')
    }
  }

  const handleDownload = async (attachment: Attachment) => {
    if (!ticket) return
    const blob = await apiDownload(`/api/tickets/${ticket.id}/attachments/${attachment.id}/download`)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.originalName
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePostComment = async (e: FormEvent) => {
    e.preventDefault()
    if (!ticket) return
    const body = commentBody.trim()
    if (body.length < 3 || body.length > 2000) {
      setCommentError('Comment must be 3-2000 characters.')
      return
    }

    setCommentSubmitting(true)
    setCommentError(null)
    try {
      await apiPost(`/api/tickets/${ticket.id}/public-comments`, { body })
      setCommentBody('')
      loadComments()
    } catch {
      setCommentError('Unable to post your comment. Please try again.')
    } finally {
      setCommentSubmitting(false)
    }
  }

  const handlePostNote = async (e: FormEvent) => {
    e.preventDefault()
    if (!ticket) return
    const body = noteBody.trim()
    if (body.length < 3 || body.length > 2000) {
      setNoteError('Internal Note must be 3-2000 characters.')
      return
    }

    setNoteSubmitting(true)
    setNoteError(null)
    try {
      await apiPost(`/api/staff/tickets/${ticket.id}/internal-notes`, { body })
      setNoteBody('')
      loadNotes()
    } catch {
      setNoteError('Unable to post the Internal Note. Please try again.')
    } finally {
      setNoteSubmitting(false)
    }
  }

  const handlePostAction = async (e: FormEvent) => {
    e.preventDefault()
    if (!ticket) return

    setActionSubmitting(true)
    setActionError(null)
    try {
      await apiPost(`/api/staff/tickets/${ticket.id}/actions-taken`, {
        description: actionDraft.description,
        result: actionDraft.result,
        followUpRequired: actionDraft.followUpRequired,
        followUpNote: actionDraft.followUpRequired ? actionDraft.followUpNote : undefined,
        attachmentNotes: actionDraft.attachmentNotes || undefined,
      })
      setActionDraft(EMPTY_ACTION_DRAFT)
      loadActions()
    } catch {
      setActionError('Unable to save the Action Taken. Please check the fields and try again.')
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleStartEditAction = (a: ActionTaken) => {
    setEditingActionId(a.id)
    setEditError(null)
    setEditDraft({
      description: a.description,
      result: a.result,
      followUpRequired: a.followUpRequired,
      followUpNote: a.followUpNote ?? '',
      attachmentNotes: a.attachmentNotes ?? '',
    })
  }

  const handleCancelEditAction = () => {
    setEditingActionId(null)
    setEditError(null)
  }

  const handleSaveEditAction = async (e: FormEvent, a: ActionTaken) => {
    e.preventDefault()
    if (!ticket) return

    setEditSubmitting(true)
    setEditError(null)
    try {
      await apiPatch(`/api/staff/tickets/${ticket.id}/actions-taken/${a.id}`, {
        description: editDraft.description,
        result: editDraft.result,
        followUpRequired: editDraft.followUpRequired,
        followUpNote: editDraft.followUpRequired ? editDraft.followUpNote : undefined,
        attachmentNotes: editDraft.attachmentNotes || undefined,
        updatedAt: a.updatedAt,
      })
      setEditingActionId(null)
      loadActions()
    } catch (err) {
      if (err instanceof Error && err.message.includes('status 409')) {
        setEditError('This Action Taken was changed by someone else. Reloading the latest version.')
        loadActions()
      } else {
        setEditError('Unable to save this Action Taken. Please check the fields and try again.')
      }
    } finally {
      setEditSubmitting(false)
    }
  }

  if (state === 'loading') return <p className="container py-4">⏳ Loading...</p>
  if (state === 'not-found') return <p className="container py-4">Ticket not found.</p>
  if (state === 'error') return <p className="container py-4 text-danger">Unable to load this Ticket.</p>
  if (!ticket) return null

  const activeAttachments = ticket.attachments.filter((a) => !a.isRemoved)
  const removedAttachments = ticket.attachments.filter((a) => a.isRemoved)
  const permittedNextStatuses = TRANSITIONS[ticket.currentStatus]

  return (
    <div className="container py-4" style={{ maxWidth: 780 }}>
      <h1>{ticket.ticketNumber}</h1>

      <div className="p-3 mb-4" style={{ backgroundColor: '#F8F9F6', borderRadius: 8 }}>
        <div className="row mb-2">
          <div className="col-6">
            <div className="text-muted small">Requester</div>
            <div>
              {ticket.requester.name} ({ticket.requester.email})
            </div>
          </div>
          <div className="col-6">
            <div className="text-muted small">Ticket Date</div>
            <div>{new Date(ticket.createdAt).toLocaleString('en-US')}</div>
          </div>
        </div>
        <div className="row mb-2">
          <div className="col-6">
            <div className="text-muted small">Category</div>
            <div>{ticket.category.name}</div>
          </div>
          <div className="col-6">
            <div className="text-muted small">Related System</div>
            <div>{ticket.relatedSystem.name}</div>
          </div>
        </div>
        <div className="mb-2">
          <div className="text-muted small">Summary</div>
          <div>{ticket.summary}</div>
        </div>
        <div className="mb-3">
          <div className="text-muted small">Description</div>
          <div>{ticket.description}</div>
        </div>

        <div className="row g-2">
          <div className="col-6 col-md-3">
            <div className="text-muted small">Requested Priority</div>
            <div>{ticket.requestedPriority}</div>
          </div>
          <div className="col-6 col-md-3">
            <label htmlFor="it-priority" className="text-muted small d-block">
              IT Priority
            </label>
            <select
              id="it-priority"
              className="form-select form-select-sm bg-white"
              value={ticket.itPriority}
              onChange={(e) => handlePriorityChange(e.target.value)}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label htmlFor="ticket-owner" className="text-muted small d-block">
              Ticket Owner
            </label>
            <select
              id="ticket-owner"
              className="form-select form-select-sm bg-white"
              value={ticket.ticketOwnerId ?? ''}
              onChange={(e) => handleOwnerChange(e.target.value)}
            >
              <option value="">Unassigned</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label htmlFor="current-status" className="text-muted small d-block">
              Current Status
            </label>
            <select
              id="current-status"
              className="form-select form-select-sm bg-white"
              value={ticket.currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value={ticket.currentStatus}>{ticket.currentStatus}</option>
              {permittedNextStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {ticket.requesterConfirmedResolved && (
          <div
            className="mt-2 px-3 py-2"
            style={{ backgroundColor: '#EAF6EF', color: '#006B3C', borderRadius: 6, fontSize: '0.9rem' }}
            role="status"
          >
            ✓ Requester indicated this problem appears resolved. IT Staff remains responsible for
            formally setting the Ticket to Resolved or Closed.
          </div>
        )}

        {ownerError && (
          <p className="text-danger mt-2 mb-0" role="alert">
            {ownerError}
          </p>
        )}
        {priorityError && (
          <p className="text-danger mt-2 mb-0" role="alert">
            {priorityError}
          </p>
        )}
        {statusError && (
          <p className="text-danger mt-2 mb-0" role="alert">
            {statusError}
          </p>
        )}
      </div>

      <h2>Attachments</h2>

      {activeAttachments.length === 0 && removedAttachments.length === 0 && <p>No attachments.</p>}

      {activeAttachments.length > 0 && (
        <ul className="list-group mb-3">
          {activeAttachments.map((a) => (
            <li key={a.id} className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                {a.originalName} ({Math.round(a.sizeBytes / 1024)} KB)
              </span>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleDownload(a)}>
                Download
              </button>
            </li>
          ))}
        </ul>
      )}

      {removedAttachments.length > 0 && (
        <ul className="list-group mb-4">
          {removedAttachments.map((a) => (
            <li key={a.id} className="list-group-item text-muted" style={{ textDecoration: 'line-through' }}>
              {a.originalName} — Removed{a.removedReason ? ` (${a.removedReason})` : ''}
            </li>
          ))}
        </ul>
      )}

      <div className="row g-3 mt-1">
        <div className="col-12 col-lg-6">
          <div className="p-3 h-100" style={{ backgroundColor: '#EAF6EF', borderRadius: 8 }}>
            <h2 className="h5">Public Comments</h2>

            {commentsLoadFailed && (
              <p className="text-danger" role="alert">
                Unable to load Public Comments.{' '}
                <button type="button" className="btn btn-link p-0" onClick={loadComments}>
                  Retry
                </button>
              </p>
            )}
            {!commentsLoadFailed && comments.length === 0 && <p>No comments yet.</p>}

            {comments.length > 0 && (
              <ul className="list-group mb-3">
                {comments.map((c) => (
                  <li key={c.id} className="list-group-item">
                    <div className="d-flex justify-content-between align-items-baseline">
                      <div>
                        <strong>{c.authorName}</strong>{' '}
                        <span className="badge" style={{ backgroundColor: '#EAF6EF', color: '#006B3C' }}>
                          {c.authorRole}
                        </span>
                      </div>
                      <span className="text-muted small">{new Date(c.createdAt).toLocaleString('en-US')}</span>
                    </div>
                    <div className="mt-1">{c.body}</div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handlePostComment}>
              <label htmlFor="new-comment" className="form-label">
                Add a comment
              </label>
              <textarea
                id="new-comment"
                className="form-control mb-2"
                rows={3}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              {commentError && (
                <p className="text-danger" role="alert">
                  {commentError}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={commentSubmitting}>
                {commentSubmitting ? 'Posting...' : 'Post Comment'}
              </button>
            </form>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="p-3 h-100" style={{ backgroundColor: '#F5EFE4', borderRadius: 8 }}>
            <h2 className="h5">Internal Notes</h2>
            <p className="small text-muted mb-2">Internal — not visible to Requester</p>

            {notesLoadFailed && (
              <p className="text-danger" role="alert">
                Unable to load Internal Notes.{' '}
                <button type="button" className="btn btn-link p-0" onClick={loadNotes}>
                  Retry
                </button>
              </p>
            )}
            {!notesLoadFailed && notes.length === 0 && <p>No internal notes yet.</p>}

            {notes.length > 0 && (
              <ul className="list-group mb-3">
                {notes.map((n) => (
                  <li key={n.id} className="list-group-item" style={{ backgroundColor: '#FBF7EF' }}>
                    <div className="d-flex justify-content-between align-items-baseline">
                      <strong>{n.authorName}</strong>
                      <span className="text-muted small">{new Date(n.createdAt).toLocaleString('en-US')}</span>
                    </div>
                    <div className="mt-1">{n.body}</div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handlePostNote}>
              <label htmlFor="new-note" className="form-label">
                Add an Internal Note — not visible to Requester
              </label>
              <textarea
                id="new-note"
                className="form-control mb-2"
                rows={3}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
              />
              {noteError && (
                <p className="text-danger" role="alert">
                  {noteError}
                </p>
              )}
              <button type="submit" className="btn btn-outline-dark" disabled={noteSubmitting}>
                {noteSubmitting ? 'Posting...' : 'Post Internal Note'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12">
          <div className="p-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #e5e4e7', borderRadius: 8 }}>
            <h2 className="h5">Actions Taken</h2>

            {actionsLoadFailed && (
              <p className="text-danger" role="alert">
                Unable to load Actions Taken.{' '}
                <button type="button" className="btn btn-link p-0" onClick={loadActions}>
                  Retry
                </button>
              </p>
            )}
            {!actionsLoadFailed && actions.length === 0 && <p>No actions taken yet.</p>}

            {actions.length > 0 && (
              <ul className="list-group mb-3">
                {actions.map((a) =>
                  editingActionId === a.id ? (
                    <li key={a.id} className="list-group-item">
                      <form onSubmit={(e) => handleSaveEditAction(e, a)}>
                        <div className="mb-2">
                          <label htmlFor={`edit-description-${a.id}`} className="form-label small text-muted">
                            Description
                          </label>
                          <textarea
                            id={`edit-description-${a.id}`}
                            className="form-control"
                            rows={2}
                            value={editDraft.description}
                            onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                          />
                        </div>
                        <div className="mb-2">
                          <label htmlFor={`edit-result-${a.id}`} className="form-label small text-muted">
                            Result
                          </label>
                          <textarea
                            id={`edit-result-${a.id}`}
                            className="form-control"
                            rows={2}
                            value={editDraft.result}
                            onChange={(e) => setEditDraft({ ...editDraft, result: e.target.value })}
                          />
                        </div>
                        <div className="form-check mb-2">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`edit-followup-${a.id}`}
                            checked={editDraft.followUpRequired}
                            onChange={(e) => setEditDraft({ ...editDraft, followUpRequired: e.target.checked })}
                          />
                          <label className="form-check-label" htmlFor={`edit-followup-${a.id}`}>
                            Follow-Up Required
                          </label>
                        </div>
                        {editDraft.followUpRequired && (
                          <div className="mb-2">
                            <label htmlFor={`edit-followup-note-${a.id}`} className="form-label small text-muted">
                              Follow-up Note <span className="text-danger">*</span>
                            </label>
                            <textarea
                              id={`edit-followup-note-${a.id}`}
                              className="form-control"
                              rows={2}
                              value={editDraft.followUpNote}
                              onChange={(e) => setEditDraft({ ...editDraft, followUpNote: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="mb-2">
                          <label htmlFor={`edit-attachment-notes-${a.id}`} className="form-label small text-muted">
                            Attachment Notes
                          </label>
                          <input
                            id={`edit-attachment-notes-${a.id}`}
                            type="text"
                            className="form-control"
                            value={editDraft.attachmentNotes}
                            onChange={(e) => setEditDraft({ ...editDraft, attachmentNotes: e.target.value })}
                          />
                        </div>
                        {editError && (
                          <p className="text-danger" role="alert">
                            {editError}
                          </p>
                        )}
                        <button type="submit" className="btn btn-primary btn-sm me-2" disabled={editSubmitting}>
                          {editSubmitting ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={handleCancelEditAction}
                        >
                          Cancel
                        </button>
                      </form>
                    </li>
                  ) : (
                    <li key={a.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-baseline">
                        <strong>{a.performedByName}</strong>
                        <span className="text-muted small">{new Date(a.createdAt).toLocaleString('en-US')}</span>
                      </div>
                      <div className="mt-1">
                        <div className="text-muted small">Description</div>
                        <div>{a.description}</div>
                      </div>
                      <div className="mt-1">
                        <div className="text-muted small">Result</div>
                        <div>{a.result}</div>
                      </div>
                      {a.followUpRequired && (
                        <div className="mt-1">
                          <span className="badge" style={{ backgroundColor: '#FBF2E0', color: '#9A6400' }}>
                            Follow-Up Required
                          </span>
                          <div className="mt-1">{a.followUpNote}</div>
                        </div>
                      )}
                      {a.attachmentNotes && (
                        <div className="mt-1">
                          <div className="text-muted small">Attachment Notes</div>
                          <div>{a.attachmentNotes}</div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm mt-2"
                        onClick={() => handleStartEditAction(a)}
                      >
                        Edit
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}

            <form onSubmit={handlePostAction}>
              <div className="mb-2">
                <label htmlFor="new-action-description" className="form-label">
                  Description
                </label>
                <textarea
                  id="new-action-description"
                  className="form-control"
                  rows={2}
                  value={actionDraft.description}
                  onChange={(e) => setActionDraft({ ...actionDraft, description: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label htmlFor="new-action-result" className="form-label">
                  Result
                </label>
                <textarea
                  id="new-action-result"
                  className="form-control"
                  rows={2}
                  value={actionDraft.result}
                  onChange={(e) => setActionDraft({ ...actionDraft, result: e.target.value })}
                />
              </div>
              <div className="form-check mb-2">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="new-action-followup"
                  checked={actionDraft.followUpRequired}
                  onChange={(e) => setActionDraft({ ...actionDraft, followUpRequired: e.target.checked })}
                />
                <label className="form-check-label" htmlFor="new-action-followup">
                  Follow-Up Required
                </label>
              </div>
              {actionDraft.followUpRequired && (
                <div className="mb-2">
                  <label htmlFor="new-action-followup-note" className="form-label">
                    Follow-up Note <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="new-action-followup-note"
                    className="form-control"
                    rows={2}
                    value={actionDraft.followUpNote}
                    onChange={(e) => setActionDraft({ ...actionDraft, followUpNote: e.target.value })}
                  />
                </div>
              )}
              <div className="mb-2">
                <label htmlFor="new-action-attachment-notes" className="form-label">
                  Attachment Notes
                </label>
                <input
                  id="new-action-attachment-notes"
                  type="text"
                  className="form-control"
                  value={actionDraft.attachmentNotes}
                  onChange={(e) => setActionDraft({ ...actionDraft, attachmentNotes: e.target.value })}
                />
              </div>
              {actionError && (
                <p className="text-danger" role="alert">
                  {actionError}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={actionSubmitting}>
                {actionSubmitting ? 'Saving...' : 'Add Action Taken'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
