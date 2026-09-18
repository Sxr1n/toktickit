import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import StaffTicketDetail from '../../src/pages/StaffTicketDetail'

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

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    summary: 'Laptop battery drains quickly',
    description: 'Battery drains fast even when idle.',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    currentStatus: 'NEW',
    requesterConfirmedResolved: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    requester: { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com' },
    category: { id: 1, name: 'Hardware' },
    relatedSystem: { id: 1, name: 'Corporate Laptop' },
    ticketOwnerId: null,
    ticketOwnerName: null,
    attachments: [],
    ...overrides,
  }
}

function renderDetail(fetchImpl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StaffTicketDetail - claim action (UI-05)', () => {
  it('claiming an unassigned Ticket calls the owner endpoint and reflects the new owner', async () => {
    let patchedBody: unknown = null

    renderDetail((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/owner') && init?.method === 'PATCH') {
        patchedBody = JSON.parse(String(init.body))
        return jsonResponse(baseTicket({ ticketOwnerId: 10, ticketOwnerName: 'Carlos Mendez' }))
      }
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const ownerSelect = await screen.findByLabelText('Ticket Owner')
    await userEvent.selectOptions(ownerSelect, '10')

    expect(patchedBody).toEqual({ ticketOwnerId: 10 })
    expect((ownerSelect as HTMLSelectElement).value).toBe('10')
  })

  it('rolls back the optimistic update if the owner PATCH fails', async () => {
    renderDetail((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/owner') && init?.method === 'PATCH') {
        return jsonResponse({ error: { code: 'VALIDATION_FAILED' } }, 400)
      }
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const ownerSelect = await screen.findByLabelText('Ticket Owner')
    await userEvent.selectOptions(ownerSelect, '10')

    expect(await screen.findByText('Unable to update the Ticket Owner. Please try again.')).toBeInTheDocument()
    expect((ownerSelect as HTMLSelectElement).value).toBe('')
  })
})

describe('StaffTicketDetail - status select narrowed to permitted transitions (UI-05)', () => {
  it('offers only the current status plus its permitted next statuses for a New Ticket', async () => {
    renderDetail((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseTicket({ currentStatus: 'NEW' }))
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const statusSelect = await screen.findByLabelText('Current Status')
    const optionValues = within(statusSelect).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)

    expect(optionValues).toEqual(['NEW', 'OPEN', 'CANCELLED'])
    expect(optionValues).not.toContain('RESOLVED')
    expect(optionValues).not.toContain('CLOSED')
  })

  it('offers no next statuses for a terminal Cancelled Ticket', async () => {
    renderDetail((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseTicket({ currentStatus: 'CANCELLED' }))
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const statusSelect = await screen.findByLabelText('Current Status')
    const optionValues = within(statusSelect).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)

    expect(optionValues).toEqual(['CANCELLED'])
  })
})

describe('StaffTicketDetail - Public Comments vs. Internal Notes (UI-05)', () => {
  it('renders Comments and Notes as two visually distinct sections', async () => {
    renderDetail((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const commentsHeading = await screen.findByRole('heading', { name: 'Public Comments' })
    const notesHeading = screen.getByRole('heading', { name: 'Internal Notes' })

    expect(screen.getByText('Internal — not visible to Requester')).toBeInTheDocument()

    // Two separate containers, not one combined section: each heading owns its own post button.
    const commentsSection = commentsHeading.closest('div')!
    const notesSection = notesHeading.closest('div')!
    expect(commentsSection).not.toBe(notesSection)
    expect(within(commentsSection).getByRole('button', { name: 'Post Comment' })).toBeInTheDocument()
    expect(within(notesSection).getByRole('button', { name: 'Post Internal Note' })).toBeInTheDocument()
  })

  it('posts an Internal Note and it appears in the thread', async () => {
    let posted = false

    renderDetail((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes') && init?.method === 'POST') {
        posted = true
        return jsonResponse(
          { id: 1, ticketId: 1, authorId: 10, authorName: 'Carlos Mendez', body: 'Triage notes', createdAt: '2026-09-02T00:00:00.000Z' },
          201,
        )
      }
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) {
        return jsonResponse(
          posted
            ? [{ id: 1, authorId: 10, authorName: 'Carlos Mendez', body: 'Triage notes', createdAt: '2026-09-02T00:00:00.000Z' }]
            : [],
        )
      }
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('No internal notes yet.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Add an Internal Note/), 'Triage notes')
    await userEvent.click(screen.getByRole('button', { name: 'Post Internal Note' }))

    expect(await screen.findByText('Triage notes')).toBeInTheDocument()
    expect(screen.queryByText('No internal notes yet.')).not.toBeInTheDocument()
  })
})
