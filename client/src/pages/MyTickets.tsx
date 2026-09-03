import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api/http'
import { useRequester } from '../context/RequesterContext'

interface Category {
  id: number
  name: string
}
interface RelatedSystem {
  id: number
  name: string
}
interface TicketListItem {
  id: number
  ticketNumber: string
  summary: string
  categoryId: number
  relatedSystemId: number
  requestedPriority: 'LOW' | 'MEDIUM' | 'HIGH'
  currentStatus: 'NEW'
  createdAt: string
}
interface TicketListResponse {
  items: TicketListItem[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

type ListState = 'loading' | 'loaded' | 'error'

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

export default function MyTickets() {
  const { selectedRequester } = useRequester()

  const [categories, setCategories] = useState<Category[]>([])
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([])

  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [relatedSystemId, setRelatedSystemId] = useState('')
  const [priority, setPriority] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'currentStatus'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const [listState, setListState] = useState<ListState>('loading')
  const [result, setResult] = useState<TicketListResponse | null>(null)

  useEffect(() => {
    Promise.all([apiGet<Category[]>('/api/categories'), apiGet<RelatedSystem[]>('/api/related-systems')])
      .then(([cats, systems]) => {
        setCategories(cats)
        setRelatedSystems(systems)
      })
      .catch(() => {})
  }, [])

  const load = useCallback(() => {
    if (!selectedRequester) return
    setListState('loading')

    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (categoryId) params.set('categoryId', categoryId)
    if (relatedSystemId) params.set('relatedSystemId', relatedSystemId)
    if (priority) params.set('requestedPriority', priority)
    params.set('sortBy', sortBy)
    params.set('sortDir', sortDir)
    params.set('page', String(page))

    apiGet<TicketListResponse>(`/api/tickets?${params.toString()}`, selectedRequester.id)
      .then((data) => {
        setResult(data)
        setListState('loaded')
      })
      .catch(() => setListState('error'))
  }, [selectedRequester, search, categoryId, relatedSystemId, priority, sortBy, sortDir, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [search, categoryId, relatedSystemId, priority, sortBy, sortDir, selectedRequester?.id])

  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name ?? '-'

  const hasFilters = search.trim() !== '' || categoryId !== '' || relatedSystemId !== '' || priority !== ''
  const noTicketsAtAll = listState === 'loaded' && result?.totalItems === 0 && !hasFilters
  const noResults = listState === 'loaded' && result?.totalItems === 0 && hasFilters

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>My Tickets</h1>
        <Link to="/create-ticket" className="btn btn-primary">
          Create Ticket
        </Link>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-12 col-md-3">
          <input
            type="search"
            className="form-control"
            placeholder="Search"
            aria-label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            aria-label="Filter by Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            aria-label="Filter by Related System"
            value={relatedSystemId}
            onChange={(e) => setRelatedSystemId(e.target.value)}
          >
            <option value="">All Related Systems</option>
            {relatedSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select
            className="form-select"
            aria-label="Filter by Requested Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
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
            aria-label="Sort by"
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [by, dir] = e.target.value.split(':')
              setSortBy(by as 'createdAt' | 'currentStatus')
              setSortDir(dir as 'asc' | 'desc')
            }}
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="currentStatus:asc">Status</option>
          </select>
        </div>
      </div>

      {listState === 'loading' && <p>⏳ Loading tickets...</p>}

      {listState === 'error' && (
        <div className="text-danger">
          <p>Unable to load your Tickets.</p>
          <button type="button" className="btn btn-outline-secondary" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {noTicketsAtAll && (
        <div className="text-center py-5">
          <p>You haven't created any tickets yet.</p>
          <Link to="/create-ticket" className="btn btn-primary">
            Create Ticket
          </Link>
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
              setCategoryId('')
              setRelatedSystemId('')
              setPriority('')
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {listState === 'loaded' && result && result.items.length > 0 && (
        <>
          <div className="d-none d-md-block">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket Number</th>
                  <th>Summary</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Ticket Date</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/tickets/${t.id}`}>{t.ticketNumber}</Link>
                    </td>
                    <td>{t.summary}</td>
                    <td>{categoryName(t.categoryId)}</td>
                    <td>
                      <PriorityBadge priority={t.requestedPriority} />
                    </td>
                    <td>
                      <StatusBadge status={t.currentStatus} />
                    </td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-md-none">
            {result.items.map((t) => (
              <Link
                key={t.id}
                to={`/tickets/${t.id}`}
                className="card mb-2 p-3 text-decoration-none text-body"
              >
                <div className="d-flex justify-content-between">
                  <strong>{t.ticketNumber}</strong>
                  <StatusBadge status={t.currentStatus} />
                </div>
                <div>{t.summary}</div>
                <div className="d-flex justify-content-between mt-1">
                  <span>{categoryName(t.categoryId)}</span>
                  <PriorityBadge priority={t.requestedPriority} />
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
