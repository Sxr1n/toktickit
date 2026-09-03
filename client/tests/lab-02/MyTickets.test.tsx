import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequesterProvider, useRequester } from '../../src/context/RequesterContext'
import MyTickets from '../../src/pages/MyTickets'

function SwitchToRequesterTwoButton() {
  const { selectRequester } = useRequester()
  return (
    <button type="button" onClick={() => selectRequester(2)}>
      test-switch-to-requester-2
    </button>
  )
}

const REQUESTERS = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com' },
  { id: 2, name: 'Michael Brown', email: 'michael.brown@example.com' },
]
const CATEGORIES = [{ id: 1, name: 'Hardware' }]
const RELATED_SYSTEMS = [{ id: 1, name: 'Corporate Laptop' }]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function emptyList() {
  return { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 1 }
}

function ticketListFor(requesterId: number) {
  if (requesterId === 1) {
    return {
      items: [
        {
          id: 1,
          ticketNumber: 'TKT-2026-000001',
          summary: 'Requester A laptop issue',
          categoryId: 1,
          relatedSystemId: 1,
          requestedPriority: 'MEDIUM',
          currentStatus: 'NEW',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    }
  }
  return emptyList()
}

function mockFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/dev-requesters')) return Promise.resolve(jsonResponse(REQUESTERS))
    if (url.endsWith('/api/categories')) return Promise.resolve(jsonResponse(CATEGORIES))
    if (url.endsWith('/api/related-systems')) return Promise.resolve(jsonResponse(RELATED_SYSTEMS))
    if (url.includes('/api/tickets')) {
      const requesterId = Number((init?.headers as Record<string, string>)?.['X-Dev-Requester-Id'])
      return Promise.resolve(jsonResponse(ticketListFor(requesterId)))
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MyTickets (UI-06)', () => {
  it('shows an empty state when the Requester has no Tickets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/api/dev-requesters')) return Promise.resolve(jsonResponse(REQUESTERS))
        if (url.endsWith('/api/categories')) return Promise.resolve(jsonResponse(CATEGORIES))
        if (url.endsWith('/api/related-systems')) return Promise.resolve(jsonResponse(RELATED_SYSTEMS))
        if (url.includes('/api/tickets')) return Promise.resolve(jsonResponse(emptyList()))
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )
    localStorage.setItem('toktickit.selectedRequesterId', '1')

    render(
      <MemoryRouter>
        <RequesterProvider>
          <MyTickets />
        </RequesterProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText("You haven't created any tickets yet.")).toBeInTheDocument()
  })
})

describe('MyTickets (UI-07)', () => {
  it('shows a no-results state, distinct from empty, when a search matches nothing', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/api/dev-requesters')) return Promise.resolve(jsonResponse(REQUESTERS))
      if (url.endsWith('/api/categories')) return Promise.resolve(jsonResponse(CATEGORIES))
      if (url.endsWith('/api/related-systems')) return Promise.resolve(jsonResponse(RELATED_SYSTEMS))
      if (url.includes('/api/tickets') && url.includes('search=nomatch')) {
        return Promise.resolve(jsonResponse(emptyList()))
      }
      if (url.includes('/api/tickets')) return Promise.resolve(jsonResponse(ticketListFor(1)))
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem('toktickit.selectedRequesterId', '1')

    render(
      <MemoryRouter>
        <RequesterProvider>
          <MyTickets />
        </RequesterProvider>
      </MemoryRouter>,
    )
    await screen.findAllByText('TKT-2026-000001')

    await userEvent.type(screen.getByLabelText('Search'), 'nomatch')

    expect(await screen.findByText('No tickets match your search/filters.')).toBeInTheDocument()
    expect(screen.queryByText("You haven't created any tickets yet.")).not.toBeInTheDocument()
  })
})

describe('MyTickets (UI-08)', () => {
  it('reloads the list to the newly selected Requester after switching', async () => {
    vi.stubGlobal('fetch', mockFetch())
    localStorage.setItem('toktickit.selectedRequesterId', '1')

    render(
      <MemoryRouter>
        <RequesterProvider>
          <SwitchToRequesterTwoButton />
          <MyTickets />
        </RequesterProvider>
      </MemoryRouter>,
    )

    expect(await screen.findAllByText('TKT-2026-000001')).not.toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: 'test-switch-to-requester-2' }))

    expect(await screen.findByText("You haven't created any tickets yet.")).toBeInTheDocument()
    expect(screen.queryAllByText('TKT-2026-000001')).toHaveLength(0)
  })
})
