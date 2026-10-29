import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import StaffTicketDetail from '../../src/pages/StaffTicketDetail'
import RequesterTicketDetail from '../../src/pages/RequesterTicketDetail'

const STAFF_USER = {
  id: 10,
  name: 'Carlos Mendez',
  email: 'carlos.mendez@example.com',
  role: 'IT_STAFF',
  mustChangePassword: false,
}
const REQUESTER_USER = {
  id: 1,
  name: 'Jennifer Anderson',
  email: 'jennifer.anderson@example.com',
  role: 'REQUESTER',
  mustChangePassword: false,
}
const STAFF_USERS = [{ id: 10, name: 'Carlos Mendez', role: 'IT_STAFF' }]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function baseStaffTicket(overrides: Record<string, unknown> = {}) {
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

function baseRequesterTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ticketNumber: 'TKT-2026-000001',
    categoryId: 1,
    relatedSystemId: 1,
    summary: 'Laptop battery drains quickly',
    description: 'Battery drains fast even when idle.',
    requestedPriority: 'MEDIUM',
    currentStatus: 'NEW',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    requesterConfirmedResolved: false,
    attachments: [],
    ...overrides,
  }
}

const ACTION = {
  id: 1,
  performedById: 10,
  performedByName: 'Carlos Mendez',
  description: 'Checked the device logs.',
  result: 'Found a relevant error.',
  followUpRequired: false,
  followUpNote: null,
  attachmentNotes: null,
  createdAt: '2026-09-02T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
}

function renderStaff(fetchImpl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
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

function renderRequester(fetchImpl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  return render(
    <MemoryRouter initialEntries={['/tickets/1']}>
      <AuthProvider>
        <Routes>
          <Route path="/tickets/:id" element={<RequesterTicketDetail />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('StaffTicketDetail - Actions Taken create (UI-01, UI-02)', () => {
  it('creates an Action Taken and the new item appears in the list', async () => {
    let posted = false

    renderStaff((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(STAFF_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/actions-taken') && init?.method === 'POST') {
        posted = true
        return jsonResponse(ACTION, 201)
      }
      if (url.endsWith('/api/staff/tickets/1/actions-taken')) return jsonResponse(posted ? [ACTION] : [])
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseStaffTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('No actions taken yet.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Description'), 'Checked the device logs.')
    await userEvent.type(screen.getByLabelText('Result'), 'Found a relevant error.')
    await userEvent.click(screen.getByRole('button', { name: 'Add Action Taken' }))

    expect(await screen.findByText('Checked the device logs.')).toBeInTheDocument()
    expect(screen.queryByText('No actions taken yet.')).not.toBeInTheDocument()
  })

  it('shows the Follow-up Note field only when Follow-Up Required is checked', async () => {
    renderStaff((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(STAFF_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/actions-taken')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseStaffTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await screen.findByText('No actions taken yet.')
    expect(screen.queryByLabelText(/Follow-up Note/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Follow-Up Required' }))
    expect(screen.getByLabelText(/Follow-up Note/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Follow-Up Required' }))
    expect(screen.queryByLabelText(/Follow-up Note/)).not.toBeInTheDocument()
  })
})

describe('StaffTicketDetail - Actions Taken edit (UI-03)', () => {
  it('pre-fills the edit form and Save persists the change', async () => {
    let patched: unknown = null
    const updated = { ...ACTION, description: 'Edited description.', updatedAt: '2026-09-03T00:00:00.000Z' }

    renderStaff((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(STAFF_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/actions-taken/1') && init?.method === 'PATCH') {
        patched = JSON.parse(init.body as string)
        return jsonResponse(updated)
      }
      if (url.endsWith('/api/staff/tickets/1/actions-taken')) return jsonResponse([patched ? updated : ACTION])
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseStaffTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await screen.findByText('Checked the device logs.')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const editItem = screen.getByRole('button', { name: 'Save' }).closest('li')!
    const descriptionField = within(editItem).getByLabelText('Description') as HTMLTextAreaElement
    expect(descriptionField.value).toBe('Checked the device logs.')

    await userEvent.clear(descriptionField)
    await userEvent.type(descriptionField, 'Edited description.')
    await userEvent.click(within(editItem).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Edited description.')).toBeInTheDocument()
    expect(patched).toMatchObject({ description: 'Edited description.', updatedAt: ACTION.updatedAt })
  })
})

describe('StaffTicketDetail - Actions Taken stale-edit conflict (UI-04)', () => {
  it('shows a safe message and reloads the item on a 409 response', async () => {
    renderStaff((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(STAFF_USER)
      if (url.endsWith('/api/staff/users')) return jsonResponse(STAFF_USERS)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/internal-notes')) return jsonResponse([])
      if (url.endsWith('/api/staff/tickets/1/actions-taken/1') && init?.method === 'PATCH') {
        return jsonResponse({ error: { code: 'CONFLICT', message: 'Changed by someone else.' } }, 409)
      }
      if (url.endsWith('/api/staff/tickets/1/actions-taken')) return jsonResponse([ACTION])
      if (url.endsWith('/api/staff/tickets/1')) return jsonResponse(baseStaffTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await screen.findByText('Checked the device logs.')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/changed by someone else/i)).toBeInTheDocument()
  })
})

describe('RequesterTicketDetail - Actions Taken read-only (UI-05)', () => {
  it('renders the list with no Edit button and no form', async () => {
    renderRequester((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(REQUESTER_USER)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/tickets/1/actions-taken')) return jsonResponse([ACTION])
      if (url.endsWith('/api/tickets/1')) return jsonResponse(baseRequesterTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await screen.findByRole('heading', { name: 'Actions Taken' })
    const list = screen.getByRole('list')
    expect(within(list).getByText('Checked the device logs.')).toBeInTheDocument()
    // No Edit action anywhere on the Requester's page -- Actions Taken is read-only for this role.
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(within(list).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no Actions Taken', async () => {
    renderRequester((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(REQUESTER_USER)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/tickets/1/actions-taken')) return jsonResponse([])
      if (url.endsWith('/api/tickets/1')) return jsonResponse(baseRequesterTicket())
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('No actions taken yet.')).toBeInTheDocument()
  })
})
