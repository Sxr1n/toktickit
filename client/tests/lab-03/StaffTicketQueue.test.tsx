import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import StaffTicketQueue from '../../src/pages/StaffTicketQueue'

const CURRENT_USER = {
  id: 10,
  name: 'Carlos Mendez',
  email: 'carlos.mendez@example.com',
  role: 'IT_STAFF',
  mustChangePassword: false,
}
const STAFF_USERS = [
  { id: 10, name: 'Carlos Mendez', role: 'IT_STAFF' },
  { id: 11, name: 'Priya Nakamura', role: 'IT_STAFF' },
]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function emptyQueue() {
  return { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 }
}

function multiRequesterQueue() {
  return {
    items: [
      {
        id: 1,
        ticketNumber: 'TKT-2026-000001',
        summary: 'Laptop battery drains quickly',
        categoryName: 'Hardware',
        requestedPriority: 'MEDIUM',
        itPriority: 'MEDIUM',
        currentStatus: 'NEW',
        ticketOwnerId: null,
        ticketOwnerName: null,
        requesterName: 'Jennifer Anderson',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 2,
        ticketNumber: 'TKT-2026-000002',
        summary: 'Cannot access shared drive',
        categoryName: 'Account and Access',
        requestedPriority: 'HIGH',
        itPriority: 'HIGH',
        currentStatus: 'OPEN',
        ticketOwnerId: 10,
        ticketOwnerName: 'Carlos Mendez',
        requesterName: 'Michael Brown',
        createdAt: '2026-09-02T00:00:00.000Z',
      },
    ],
    page: 1,
    pageSize: 10,
    totalItems: 2,
    totalPages: 1,
  }
}

function renderQueue(fetchImpl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <StaffTicketQueue />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StaffTicketQueue (UI-04)', () => {
  it('renders rows from multiple Requesters, not just one', async () => {
    renderQueue((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.includes('/api/staff/tickets')) return jsonResponse(multiRequesterQueue())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findAllByText('TKT-2026-000001')).not.toHaveLength(0)
    expect(screen.getAllByText('TKT-2026-000002').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carlos Mendez').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0)
  })

  it('shows the empty state when no Tickets exist at all', async () => {
    renderQueue((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.includes('/api/staff/tickets')) return jsonResponse(emptyQueue())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('No tickets in the system yet.')).toBeInTheDocument()
  })

  it('shows a no-results state, distinct from empty, when a search matches nothing', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/auth/me')) return Promise.resolve(jsonResponse(CURRENT_USER))
      if (url.endsWith('/api/staff/users')) return Promise.resolve(jsonResponse(STAFF_USERS))
      if (url.includes('/api/staff/tickets') && url.includes('search=nomatch')) {
        return Promise.resolve(jsonResponse(emptyQueue()))
      }
      if (url.includes('/api/staff/tickets')) return Promise.resolve(jsonResponse(multiRequesterQueue()))
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <StaffTicketQueue />
        </AuthProvider>
      </MemoryRouter>,
    )
    await screen.findAllByText('TKT-2026-000001')

    await userEvent.type(screen.getByLabelText('Search'), 'nomatch')

    expect(await screen.findByText('No tickets match your search/filters.')).toBeInTheDocument()
    expect(screen.queryByText('No tickets in the system yet.')).not.toBeInTheDocument()
  })

  it('shows a safe failure state with a Retry action', async () => {
    renderQueue((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.includes('/api/staff/tickets')) return jsonResponse({ error: 'boom' }, 500)
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('Unable to load the Ticket Queue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
