import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../api/http'
import { useAuth } from '../context/AuthContext'

interface RecentTicket {
  id: number
  ticketNumber: string
  summary: string
  currentStatus: string
  itPriority: string
  ticketOwnerName: string | null
  updatedAt: string
}

interface StaffDashboardResponse {
  counts: { new: number; open: number; inProgress: number; waitingForRequester: number; myAssigned: number }
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

function MetricTile({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <div className="col-6 col-md">
      <Link
        to={to}
        className="d-block text-decoration-none text-body p-3 h-100"
        style={{ backgroundColor: '#F8F9F6', borderRadius: 8 }}
        aria-label={`${label}: ${value} Tickets, view filtered queue`}
      >
        <div className="text-muted small">{label}</div>
        <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>{value}</div>
      </Link>
    </div>
  )
}

export default function StaffDashboard() {
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<StaffDashboardResponse | null>(null)

  useEffect(() => {
    setState('loading')
    apiGet<StaffDashboardResponse>('/api/dashboard/staff')
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

  return (
    <div className="container py-4" style={{ maxWidth: 960 }}>
      <h1>Welcome back, {user?.name}!</h1>
      <p className="text-muted">Here's what's happening with your queue today.</p>

      <div className="row g-3 mb-4">
        <MetricTile label="New" value={data.counts.new} to="/staff/tickets?status=NEW" />
        <MetricTile label="Open" value={data.counts.open} to="/staff/tickets?status=OPEN" />
        <MetricTile label="In Progress" value={data.counts.inProgress} to="/staff/tickets?status=IN_PROGRESS" />
        <MetricTile
          label="Waiting for Requester"
          value={data.counts.waitingForRequester}
          to="/staff/tickets?status=WAITING_FOR_REQUESTER"
        />
        <MetricTile label="My Assigned" value={data.counts.myAssigned} to={`/staff/tickets?ticketOwnerId=${user?.id}`} />
      </div>

      <div className="d-flex justify-content-between align-items-baseline mb-2">
        <h2 className="h5 mb-0">Recent Tickets</h2>
        <Link to="/staff/tickets">View all</Link>
      </div>

      {data.recentTickets.length === 0 && <p>No tickets yet.</p>}

      {data.recentTickets.length > 0 && (
        <ul className="list-group mb-4">
          {data.recentTickets.map((t) => (
            <li key={t.id} className="list-group-item p-0">
              <Link
                to={`/staff/tickets/${t.id}`}
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
          ))}
        </ul>
      )}

      <div className="d-flex gap-2">
        <Link to="/staff/tickets" className="btn btn-primary">
          Search Tickets
        </Link>
      </div>
    </div>
  )
}
