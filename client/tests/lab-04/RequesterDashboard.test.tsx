import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import RequesterDashboard from '../../src/pages/RequesterDashboard'

const CURRENT_USER = {
  id: 1,
  name: 'Jennifer Anderson',
  email: 'jennifer.anderson@example.com',
  role: 'REQUESTER',
  mustChangePassword: false,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

const DASHBOARD_DATA = {
  counts: { open: 3, inProgress: 2, resolved: 5, closed: 12 },
  waitingForRequester: [
    {
      id: 7,
      ticketNumber: 'TKT-2026-000322',
      summary: 'Request software access',
      currentStatus: 'WAITING_FOR_REQUESTER',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
  ],
  recentTickets: [
    {
      id: 1,
      ticketNumber: 'TKT-2026-000234',
      summary: 'Laptop battery drains quickly',
      currentStatus: 'IN_PROGRESS',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
}

function renderDashboard(fetchImpl: (url: string) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RequesterDashboard />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RequesterDashboard - metrics and recent Tickets (UI-09, AC-08)', () => {
  it('renders the four metric tiles and the Recent Tickets list from the API response', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/requester')) return jsonResponse(DASHBOARD_DATA)
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()

    const ticketLink = screen.getByRole('link', { name: /TKT-2026-000234/ })
    expect(ticketLink).toHaveAttribute('href', '/tickets/1')
  })
})

describe('RequesterDashboard - attention-required callout (UI-10)', () => {
  it('shows the Tickets Waiting for You panel when the list is non-empty', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/requester')) return jsonResponse(DASHBOARD_DATA)
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByRole('heading', { name: 'Tickets Waiting for You' })).toBeInTheDocument()
    expect(screen.getByText(/TKT-2026-000322/)).toBeInTheDocument()
  })

  it('omits the panel entirely (not just hides it) when the list is empty', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/requester'))
        return jsonResponse({ ...DASHBOARD_DATA, waitingForRequester: [] })
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await screen.findByText('TKT-2026-000234')
    expect(screen.queryByRole('heading', { name: 'Tickets Waiting for You' })).not.toBeInTheDocument()
  })
})

describe('RequesterDashboard - empty state (AC-10)', () => {
  it('shows a Create Ticket call to action when the caller has zero Tickets', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/requester'))
        return jsonResponse({ counts: { open: 0, inProgress: 0, resolved: 0, closed: 0 }, waitingForRequester: [], recentTickets: [] })
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText("You haven't created any Tickets yet.")).toBeInTheDocument()
  })
})
