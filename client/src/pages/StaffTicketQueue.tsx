import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api/http'

interface StaffUser {
  id: number
  name: string
  role: 'IT_STAFF' | 'ADMINISTRATOR'
}

interface QueueTicket {
  id: number
  ticketNumber: string
  summary: string
  categoryName: string
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH'
  itPriority: 'LOW' | 'MEDIUM' | 'HIGH'
  currentStatus: string
  ticketOwnerId: number | null
  ticketOwnerName: string | null
  requesterName: string
  createdAt: string
}

interface QueueResponse {
  items: QueueTicket[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

type ListState = 'loading' | 'loaded' | 'error'
type SortField = 'createdAt' | 'itPriority' | 'currentStatus'

const STATUSES = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  LOW: { bg: '#EAF6EF', color: '#0B7A46' },
  MEDIUM: { bg: '#FFF3CD', color: '#7A5B00' },
  HIGH: { bg: '#F8D7DA', color: '#8B0000' },
}

function PriorityBadge({ priority }: { priority: string }) {
  const style = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.LOW
  return (
    <span className="badge" style={{ backgroundColor: style.bg, color: style.color }}>
      {priority}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="badge" style={{ backgroundColor: '#EAF6EF', color: '#006B3C' }}>
      {status}
    </span>
  )
}

export default function StaffTicketQueue() {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [itPriority, setItPriority] = useState('')
  const [ticketOwnerId, setTicketOwnerId] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [listState, setListState] = useState<ListState>('loading')
  const [result, setResult] = useState<QueueResponse | null>(null)

  useEffect(() => {
    apiGet<StaffUser[]>('/api/staff/users')
      .then(setStaffUsers)
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    setListState('loading')

    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (status) params.set('status', status)
    if (itPriority) params.set('itPriority', itPriority)
    if (ticketOwnerId) params.set('ticketOwnerId', ticketOwnerId)
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)
    params.set('page', String(page))

    apiGet<QueueResponse>(`/api/staff/tickets?${params.toString()}`)
      .then((data) => {
        setResult(data)
        setListState('loaded')
      })
      .catch(() => setListState('error'))
  }, [search, status, itPriority, ticketOwnerId, sortBy, sortDir, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search, status, itPriority, ticketOwnerId, sortBy, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  const ariaSort = (field: SortField): 'ascending' | 'descending' | 'none' =>
    sortBy === field ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'

  const hasFilters = search.trim() !== '' || status !== '' || itPriority !== '' || ticketOwnerId !== ''
  const noTicketsAtAll = listState === 'loaded' && result?.totalItems === 0 && !hasFilters
  const noResults = listState === 'loaded' && result?.totalItems === 0 && hasFilters

  return (
    <div className="container py-4">
      <h1>Ticket Queue</h1>
      <p className="text-muted">Every Ticket in the system, across all Requesters.</p>

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-3">
          <input
            type="search"
            className="form-control"
            placeholder="Search by ticket number or summary…"
            aria-label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            aria-label="Filter by Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            aria-label="Filter by IT Priority"
            value={itPriority}
            onChange={(e) => setItPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            aria-label="Filter by Ticket Owner"
            value={ticketOwnerId}
            onChange={(e) => setTicketOwnerId(e.target.value)}
          >
            <option value="">All</option>
            <option value="unassigned">Unassigned</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {listState === 'loading' && <p>⏳ Loading Tickets...</p>}

      {listState === 'error' && (
        <div className="text-danger">
          <p>Unable to load the Ticket Queue.</p>
          <button type="button" className="btn btn-outline-secondary" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {noTicketsAtAll && (
        <div className="text-center py-5">
          <p>No tickets in the system yet.</p>
        </div>
      )}

      {noResults && (
        <div className="text-center py-5">
          <p>No tickets match your search/filters.</p>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              setSearch('')
              setStatus('')
              setItPriority('')
              setTicketOwnerId('')
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {listState === 'loaded' && result && result.items.length > 0 && (
        <>
          <div className="d-none d-md-block">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket No.</th>
                  <th aria-sort={ariaSort('createdAt')}>
                    <button type="button" className="btn btn-link p-0" onClick={() => toggleSort('createdAt')}>
                      Created Date
                    </button>
                  </th>
                  <th>Summary</th>
                  <th>Category</th>
                  <th>Req. Priority</th>
                  <th aria-sort={ariaSort('itPriority')}>
                    <button type="button" className="btn btn-link p-0" onClick={() => toggleSort('itPriority')}>
                      IT Priority
                    </button>
                  </th>
                  <th aria-sort={ariaSort('currentStatus')}>
                    <button type="button" className="btn btn-link p-0" onClick={() => toggleSort('currentStatus')}>
                      Status
                    </button>
                  </th>
                  <th>Ticket Owner</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/staff/tickets/${t.id}`}>{t.ticketNumber}</Link>
                    </td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>{t.summary}</td>
                    <td>{t.categoryName}</td>
                    <td>
                      <PriorityBadge priority={t.requestedPriority} />
                    </td>
                    <td>
                      <PriorityBadge priority={t.itPriority} />
                    </td>
                    <td>
                      <StatusBadge status={t.currentStatus} />
                    </td>
                    <td>{t.ticketOwnerName ?? <span className="text-muted">Unassigned</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-md-none">
            {result.items.map((t) => (
              <Link
                key={t.id}
                to={`/staff/tickets/${t.id}`}
                className="card mb-2 p-3 text-decoration-none text-body"
              >
                <div className="d-flex justify-content-between">
                  <strong>{t.ticketNumber}</strong>
                  <span className="text-muted small">{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                <div>{t.summary}</div>
                <div className="d-flex justify-content-between mt-1">
                  <span>{t.categoryName}</span>
                  <div className="d-flex gap-1">
                    <PriorityBadge priority={t.requestedPriority} />
                    <PriorityBadge priority={t.itPriority} />
                  </div>
                </div>
                <div className="d-flex justify-content-between mt-1">
                  <StatusBadge status={t.currentStatus} />
                  <span className="text-muted">{t.ticketOwnerName ?? 'Unassigned'}</span>
                </div>
              </Link>
            ))}
          </div>

          {result.totalPages > 1 && (
            <nav aria-label="Ticket pagination" className="mt-3">
              <ul className="pagination">
                {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
                  <li key={p} className={`page-item ${p === result.page ? 'active' : ''}`}>
                    <button type="button" className="page-link" onClick={() => setPage(p)}>
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
