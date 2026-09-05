import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { apiDownload, apiGet, apiPatch, apiUploadFile, ApiUploadError } from '../api/http'
import { ALLOWED_TYPES, MAX_FILES, MAX_SIZE_BYTES } from '../components/AttachmentPicker'
import { useRequester } from '../context/RequesterContext'

interface Attachment {
  id: number
  originalName: string
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  isRemoved: boolean
  removedReason: string | null
}

interface TicketDetailResponse {
  id: number
  ticketNumber: string
  categoryId: number
  relatedSystemId: number
  summary: string
  description: string
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH'
  currentStatus: string
  createdAt: string
  attachments: Attachment[]
}

type LoadState = 'loading' | 'loaded' | 'not-found' | 'error'

export default function RequesterTicketDetail() {
  const { id } = useParams()
  const { selectedRequester } = useRequester()

  const [state, setState] = useState<LoadState>('loading')
  const [ticket, setTicket] = useState<TicketDetailResponse | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    if (!selectedRequester || !id) return
    setState('loading')
    apiGet<TicketDetailResponse>(`/api/tickets/${id}`, selectedRequester.id)
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
  }, [selectedRequester, id])

  useEffect(() => {
    load()
  }, [load])

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!file || !selectedRequester || !ticket) return

    setUploadError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError(`"${file.name}" is not an allowed file type. Use JPG, PNG, WEBP, or PDF.`)
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`"${file.name}" is larger than 5 MB.`)
      return
    }
    const activeCount = ticket.attachments.filter((a) => !a.isRemoved).length
    if (activeCount >= MAX_FILES) {
      setUploadError('A Ticket can have at most 5 attachments.')
      return
    }

    try {
      await apiUploadFile(`/api/tickets/${ticket.id}/attachments`, file, selectedRequester.id)
      load()
    } catch (err) {
      if (err instanceof ApiUploadError) {
        setUploadError(err.message)
      } else {
        setUploadError('Unable to upload the attachment.')
      }
    }
  }

  const handleDownload = async (attachment: Attachment) => {
    if (!selectedRequester || !ticket) return
    const blob = await apiDownload(
      `/api/tickets/${ticket.id}/attachments/${attachment.id}/download`,
      selectedRequester.id,
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.originalName
    a.click()
    URL.revokeObjectURL(url)
  }

  const confirmRemove = async () => {
    if (!selectedRequester || !ticket || removingId === null) return
    if (removeReason.trim().length < 3) return

    await apiPatch(
      `/api/tickets/${ticket.id}/attachments/${removingId}/remove`,
      { reason: removeReason.trim() },
      selectedRequester.id,
    )
    setRemovingId(null)
    setRemoveReason('')
    load()
  }

  if (state === 'loading') return <p className="container py-4">⏳ Loading...</p>
  if (state === 'not-found') return <p className="container py-4">Ticket not found.</p>
  if (state === 'error') return <p className="container py-4 text-danger">Unable to load this Ticket.</p>
  if (!ticket) return null

  const activeAttachments = ticket.attachments.filter((a) => !a.isRemoved)
  const removedAttachments = ticket.attachments.filter((a) => a.isRemoved)

  return (
    <div className="container py-4" style={{ maxWidth: 720 }}>
      <h1>{ticket.ticketNumber}</h1>

      <div className="p-3 mb-4" style={{ backgroundColor: '#F8F9F6', borderRadius: 8 }}>
        <div className="row mb-2">
          <div className="col-6">
            <div className="text-muted small">Requester</div>
            <div>{selectedRequester?.name}</div>
          </div>
          <div className="col-6">
            <div className="text-muted small">Ticket Date</div>
            <div>{new Date(ticket.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <div className="row mb-2">
          <div className="col-6">
            <div className="text-muted small">Requested Priority</div>
            <div>{ticket.requestedPriority}</div>
          </div>
          <div className="col-6">
            <div className="text-muted small">Current Status</div>
            <div>{ticket.currentStatus}</div>
          </div>
        </div>
        <div className="mb-2">
          <div className="text-muted small">Summary</div>
          <div>{ticket.summary}</div>
        </div>
        <div>
          <div className="text-muted small">Description</div>
          <div>{ticket.description}</div>
        </div>
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
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => handleDownload(a)}>
                  Download
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => {
                    setRemovingId(a.id)
                    setRemoveReason('')
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {removingId !== null && (
        <div className="p-3 mb-3 border rounded">
          <label htmlFor="remove-reason" className="form-label">
            Reason for removal
          </label>
          <input
            id="remove-reason"
            type="text"
            className="form-control mb-2"
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
          />
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={removeReason.trim().length < 3}
              onClick={confirmRemove}
            >
              Confirm Removal
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRemovingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {removedAttachments.length > 0 && (
        <ul className="list-group mb-3">
          {removedAttachments.map((a) => (
            <li key={a.id} className="list-group-item text-muted" style={{ textDecoration: 'line-through' }}>
              {a.originalName} — Removed{a.removedReason ? ` (${a.removedReason})` : ''}
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="add-attachment" className="form-label">
          Add attachment
        </label>
        <input
          id="add-attachment"
          ref={inputRef}
          type="file"
          className="form-control"
          onChange={handleFileSelect}
          disabled={activeAttachments.length >= MAX_FILES}
        />
        {uploadError && (
          <p className="text-danger mt-1" role="alert">
            {uploadError}
          </p>
        )}
      </div>
    </div>
  )
}
