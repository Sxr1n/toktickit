import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import StaffDashboard from '../../src/pages/StaffDashboard'

const CURRENT_USER = {
  id: 10,
  name: 'Carlos Mendez',
  email: 'carlos.mendez@example.com',
  role: 'IT_STAFF',
  mustChangePassword: false,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

const DASHBOARD_DATA = {
  counts: { new: 14, open: 23, inProgress: 18, waitingForRequester: 7, myAssigned: 16 },
  recentTickets: [
    {
      id: 1,
      ticketNumber: 'TKT-2026-000234',
      summary: 'Laptop battery drains quickly',
      currentStatus: 'IN_PROGRESS',
      itPriority: 'MEDIUM',
      ticketOwnerName: 'Carlos Mendez',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
}

function renderDashboard(fetchImpl: (url: string) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <StaffDashboard />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StaffDashboard - metrics (UI-07, AC-09)', () => {
  it('renders each tile with the count from the API response and a drill-down link', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/staff')) return jsonResponse(DASHBOARD_DATA)
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('14')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('16')).toBeInTheDocument()

    const newLink = screen.getByRole('link', { name: /New: 14/ })
    expect(newLink).toHaveAttribute('href', '/staff/tickets?status=NEW')
  })

  it('renders the Recent Tickets list linking to Ticket Detail', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/staff')) return jsonResponse(DASHBOARD_DATA)
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const ticketLink = await screen.findByRole('link', { name: /TKT-2026-000234/ })
    expect(ticketLink).toHaveAttribute('href', '/staff/tickets/1')
  })
})

describe('StaffDashboard - empty and failure states (UI-08)', () => {
  it('shows an explicit empty message when there are no recent Tickets', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/staff'))
        return jsonResponse({ counts: { new: 0, open: 0, inProgress: 0, waitingForRequester: 0, myAssigned: 0 }, recentTickets: [] })
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('No tickets yet.')).toBeInTheDocument()
  })

  it('shows a safe failure message with Retry when the dashboard fails to load', async () => {
    renderDashboard((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/dashboard/staff')) return jsonResponse({ error: { code: 'INTERNAL_ERROR' } }, 500)
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('Unable to load the Dashboard.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
