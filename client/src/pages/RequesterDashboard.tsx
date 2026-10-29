import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api/http'
import { useAuth } from '../context/AuthContext'

interface RecentTicket {
  id: number
  ticketNumber: string
  summary: string
  currentStatus: string
  updatedAt: string
}

interface RequesterDashboardResponse {
  counts: { open: number; inProgress: number; resolved: number; closed: number }
  waitingForRequester: RecentTicket[]
  recentTickets: RecentTicket[]
}

type LoadState = 'loading' | 'loaded' | 'error'

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="badge" style={{ backgroundColor: '#EAF6EF', color: '#006B3C' }}>
      {status}
    </span>
  )
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="col-6 col-md">
      <Link
        to="/tickets"
        className="d-block text-decoration-none text-body p-3 h-100"
        style={{ backgroundColor: '#F8F9F6', borderRadius: 8 }}
        aria-label={`${label}: ${value} Tickets, view My Tickets`}
      >
        <div className="text-muted small">{label}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>{value}</div>
      </Link>
    </div>
  )
}

function TicketRow({ t }: { t: RecentTicket }) {
  return (
    <li className="list-group-item p-0">
      <Link
        to={`/tickets/${t.id}`}
        className="list-group-item-action d-flex justify-content-between align-items-center p-2 text-decoration-none text-body"
      >
        <span>
          <strong>{t.ticketNumber}</strong> — {t.summary}
        </span>
        <span className="d-flex align-items-center gap-2">
          <StatusBadge status={t.currentStatus} />
          <span className="text-muted small">{new Date(t.updatedAt).toLocaleDateString('en-US')}</span>
        </span>
      </Link>
    </li>
  )
}

export default function RequesterDashboard() {
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<RequesterDashboardResponse | null>(null)

  useEffect(() => {
    setState('loading')
    apiGet<RequesterDashboardResponse>('/api/dashboard/requester')
      .then((res) => {
        setData(res)
        setState('loaded')
      })
      .catch(() => setState('error'))
  }, [])

  if (state === 'loading') return <p className="container py-4">⏳ Loading...</p>
  if (state === 'error' || !data) {
    return (
      <div className="container py-4">
        <p className="text-danger">Unable to load the Dashboard.</p>
        <button type="button" className="btn btn-outline-secondary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  const hasAnyTickets =
    data.counts.open + data.counts.inProgress + data.counts.resolved + data.counts.closed > 0

  return (
    <div className="container py-4" style={{ maxWidth: 960 }}>
      <h1>Welcome, {user?.name}!</h1>
      <p className="text-muted">Here's the latest on your requests.</p>

      {!hasAnyTickets && (
        <div className="p-3 mb-4" style={{ backgroundColor: '#F8F9F6', borderRadius: 8 }}>
          <p className="mb-2">You haven't created any Tickets yet.</p>
          <Link to="/create-ticket" className="btn btn-primary">
            Create Ticket
          </Link>
        </div>
      )}

      {hasAnyTickets && (
        <>
          <div className="row g-3 mb-4">
            <MetricTile label="My Open Tickets" value={data.counts.open} />
            <MetricTile label="In Progress" value={data.counts.inProgress} />
            <MetricTile label="Resolved" value={data.counts.resolved} />
            <MetricTile label="Closed" value={data.counts.closed} />
          </div>

          {data.waitingForRequester.length > 0 && (
            <div className="p-3 mb-4" style={{ backgroundColor: '#EAF6EF', borderRadius: 8 }}>
              <h2 className="h5">Tickets Waiting for You</h2>
              <ul className="list-group">
                {data.waitingForRequester.map((t) => (
                  <TicketRow key={t.id} t={t} />
                ))}
              </ul>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-baseline mb-2">
            <h2 className="h5 mb-0">Recent Tickets</h2>
            <Link to="/tickets">View all</Link>
          </div>

          <ul className="list-group mb-4">
            {data.recentTickets.map((t) => (
              <TicketRow key={t.id} t={t} />
            ))}
          </ul>
        </>
      )}

      {hasAnyTickets && (
        <div className="d-flex gap-2">
          <Link to="/create-ticket" className="btn btn-primary">
            Create Ticket
          </Link>
          <Link to="/tickets" className="btn btn-outline-secondary">
            View My Tickets
          </Link>
        </div>
      )}
    </div>
  )
}
