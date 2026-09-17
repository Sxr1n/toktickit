import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import RequesterTicketDetail from '../../src/pages/RequesterTicketDetail'

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

function baseTicket(overrides: Record<string, unknown> = {}) {
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

function renderDetail(fetchImpl: (url: string, init?: RequestInit) => Promise<Response>) {
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

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RequesterTicketDetail (UI-09)', () => {
  it('renders the Ticket header fields as read-only text, not inputs', async () => {
    renderDetail(async (url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/tickets/1')) return jsonResponse(baseTicket())
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('TKT-2026-000001')).toBeInTheDocument()
    expect(screen.getByText('Laptop battery drains quickly')).toBeInTheDocument()
    // No attachments yet, so the only possible inputs would be the header fields -
    // and those are rendered as plain read-only text, not form controls.
    expect(screen.queryAllByRole('textbox')).toHaveLength(1) // the new-comment textarea
  })
})

describe('RequesterTicketDetail (UI-10)', () => {
  it('shows a removed attachment muted with its reason and no download control', async () => {
    renderDetail(async (url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/tickets/1')) {
        return jsonResponse(
          baseTicket({
            attachments: [
              {
                id: 9,
                originalName: 'old-screenshot.png',
                mimeType: 'image/png',
                sizeBytes: 1024,
                uploadedAt: '2026-09-01T00:00:00.000Z',
                isRemoved: true,
                removedReason: 'Wrong file',
              },
            ],
          }),
        )
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText(/old-screenshot.png/)).toBeInTheDocument()
    expect(screen.getByText(/Wrong file/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download' })).not.toBeInTheDocument()
  })
})

describe('AttachmentSection remove flow (UI-11)', () => {
  it('keeps Confirm Removal disabled until a reason is entered', async () => {
    renderDetail(async (url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/tickets/1')) {
        return jsonResponse(
          baseTicket({
            attachments: [
              {
                id: 5,
                originalName: 'photo.png',
                mimeType: 'image/png',
                sizeBytes: 2048,
                uploadedAt: '2026-09-01T00:00:00.000Z',
                isRemoved: false,
                removedReason: null,
              },
            ],
          }),
        )
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    const confirmButton = screen.getByRole('button', { name: 'Confirm Removal' })
    expect(confirmButton).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Reason for removal'), 'No longer needed')
    expect(confirmButton).toBeEnabled()
  })
})
