import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import StaffTicketDetail from '../../src/pages/StaffTicketDetail'
import RequesterTicketDetail from '../../src/pages/RequesterTicketDetail'

const STAFF_USER = { id: 10, name: 'Carlos Mendez', email: 'carlos.mendez@example.com', role: 'IT_STAFF', mustChangePassword: false }
const REQUESTER_USER = { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com', role: 'REQUESTER', mustChangePassword: false }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function staffTicket(currentStatus: string) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    summary: 'Laptop battery drains quickly',
    description: 'Battery drains fast even when idle.',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    currentStatus,
    requesterConfirmedResolved: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    requester: { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com' },
    category: { id: 1, name: 'Hardware' },
    relatedSystem: { id: 1, name: 'Corporate Laptop' },
    ticketOwnerId: 10,
    ticketOwnerName: 'Carlos Mendez',
    attachments: [],
  }
}

function renderStaff(getStatus: () => string, onPatch?: (body: unknown) => void) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(STAFF_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse([{ id: 10, name: 'Carlos Mendez', role: 'IT_STAFF' }])
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/actions-taken')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/status') && init?.method === 'PATCH') {
        onPatch?.(JSON.parse(String(init.body)))
        return jsonResponse({ ok: true })
      }
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(staffTicket(getStatus()))
      throw new Error(`Unexpected fetch to ${url}`)
    }),
  )
  return render(
    <MemoryRouter initialEntries={['/staff/tickets/1']}>
      <AuthProvider>
        <Routes>
          <Route path="/staff/tickets/:id" element={<StaffTicketDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function statusOptions() {
  const select = await screen.findByLabelText('Current Status')
  return within(select).getAllByRole('option').map((o) => o.getAttribute('value'))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// Expected sets mirror the BR-21 matrix in docs/lab-04/specification.md (current status listed first).
const MATRIX: Record<string, string[]> = {
  NEW: ['NEW', 'OPEN', 'CANCELLED'],
  IN_PROGRESS: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['RESOLVED', 'CLOSED', 'REOPENED'],
  CLOSED: ['CLOSED', 'REOPENED'],
  CANCELLED: ['CANCELLED'],
}

describe('TicketWorkflow - Staff status control offers only permitted transitions (UI-06, AC-07)', () => {
  for (const [status, expected] of Object.entries(MATRIX)) {
    it(`${status} offers exactly ${expected.slice(1).join(', ') || 'no further transitions'}`, async () => {
      renderStaff(() => status)
      expect(await statusOptions()).toEqual(expected)
    })
  }

  it('selecting a permitted status PATCHes it and refreshes the summary status', async () => {
    let status = 'NEW'
    const patched: unknown[] = []
    renderStaff(
      () => status,
      (body) => {
        patched.push(body)
        status = 'OPEN'
      },
    )

    await userEvent.selectOptions(await screen.findByLabelText('Current Status'), 'OPEN')

    expect(patched).toEqual([{ status: 'OPEN' }])
    expect(await screen.findByDisplayValue('OPEN')).toBeInTheDocument()
    expect(await statusOptions()).toEqual(['OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED'])
  })
})

describe('TicketWorkflow - Requester has no status control (UI-06, FR-08)', () => {
  it('Requester Ticket Detail renders the status read-only, with no status select', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/api/auth/me')) return jsonResponse(REQUESTER_USER)
        if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
        if (url.endsWith('/api/tickets/1/actions-taken')) return jsonResponse([])
        if (url.endsWith('/api/tickets/1'))
          return jsonResponse({
            id: 1,
            ticketNumber: 'TKT-2026-000001',
            categoryId: 1,
            relatedSystemId: 1,
            summary: 'Laptop battery drains quickly',
            description: 'Battery drains fast even when idle.',
            requestedPriority: 'MEDIUM',
            currentStatus: 'IN_PROGRESS',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
            requesterConfirmedResolved: false,
            attachments: [],
          })
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )
    render(
      <MemoryRouter initialEntries={['/tickets/1']}>
        <AuthProvider>
          <Routes>
            <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'TKT-2026-000001' })
    expect(screen.queryByLabelText('Current Status')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: /status/i })).not.toBeInTheDocument()
  })
})
