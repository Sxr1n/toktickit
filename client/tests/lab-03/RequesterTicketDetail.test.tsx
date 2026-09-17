import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

function renderDetail(fetchImpl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
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

describe('Public Comments thread (UI-07)', () => {
  it('shows an empty state, then the newly-posted comment after submitting', async () => {
    let posted = false

    renderDetail((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/tickets/1')) return jsonResponse(baseTicket())
      if (url.endsWith('/api/tickets/1/public-comments') && init?.method === 'POST') {
        posted = true
        return jsonResponse(
          {
            id: 1,
            ticketId: 1,
            authorId: 1,
            authorName: 'Jennifer Anderson',
            authorRole: 'REQUESTER',
            body: 'Any update on this?',
            createdAt: '2026-09-02T00:00:00.000Z',
          },
          201,
        )
      }
      if (url.endsWith('/api/tickets/1/public-comments')) {
        return jsonResponse(
          posted
            ? [
                {
                  id: 1,
                  authorId: 1,
                  authorName: 'Jennifer Anderson',
                  authorRole: 'REQUESTER',
                  body: 'Any update on this?',
                  createdAt: '2026-09-02T00:00:00.000Z',
                },
              ]
            : [],
        )
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    expect(await screen.findByText('No comments yet.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Add a comment'), 'Any update on this?')
    await userEvent.click(screen.getByRole('button', { name: 'Post Comment' }))

    expect(await screen.findByText('Any update on this?')).toBeInTheDocument()
    expect(screen.queryByText('No comments yet.')).not.toBeInTheDocument()
  })
})

describe('Problem Appears Resolved (UI-07)', () => {
  it('becomes a confirmation chip after being clicked, without changing the Current Status badge', async () => {
    let confirmed = false

    renderDetail((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_USER)
      if (url.endsWith('/api/tickets/1/public-comments')) return jsonResponse([])
      if (url.endsWith('/api/tickets/1/confirm-resolved') && init?.method === 'PATCH') {
        confirmed = true
        return jsonResponse(baseTicket({ requesterConfirmedResolved: true, updatedAt: '2026-09-03T00:00:00.000Z' }))
      }
      if (url.endsWith('/api/tickets/1')) {
        return jsonResponse(baseTicket(confirmed ? { requesterConfirmedResolved: true, updatedAt: '2026-09-03T00:00:00.000Z' } : {}))
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const resolveButton = await screen.findByRole('button', { name: 'Problem Appears Resolved' })
    await userEvent.click(resolveButton)

    expect(await screen.findByText(/You indicated this looks resolved on/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Problem Appears Resolved' })).not.toBeInTheDocument()
    expect(screen.getByText('NEW')).toBeInTheDocument()
  })
})
