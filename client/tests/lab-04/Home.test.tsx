import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import Home from '../../src/pages/Home'

const EMPTY_STAFF = {
  counts: { new: 0, open: 0, inProgress: 0, waitingForRequester: 0, myAssigned: 0 },
  recentTickets: [],
  myRecentActions: [],
}
const EMPTY_REQUESTER = {
  counts: { open: 0, inProgress: 0, resolved: 0, closed: 0 },
  waitingForRequester: [],
  recentTickets: [],
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function renderHome(me: unknown) {
  const fetchMock = vi.fn((url: string) => {
    if (url.endsWith('/api/auth/me')) return me ? jsonResponse(me) : jsonResponse({ error: { code: 'UNAUTHENTICATED' } }, 401)
    if (url.endsWith('/api/dashboard/staff')) return jsonResponse(EMPTY_STAFF)
    if (url.endsWith('/api/dashboard/requester')) return jsonResponse(EMPTY_REQUESTER)
    throw new Error(`Unexpected fetch to ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<p>Login page</p>} />
          <Route path="/change-password" element={<p>Change password page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  return fetchMock
}

const user = (role: string, mustChangePassword = false) => ({
  id: 7,
  name: 'Test User',
  email: 'test.user@example.com',
  role,
  mustChangePassword,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Home role routing (UI-11, AC-11)', () => {
  it('a Requester gets the Requester Dashboard', async () => {
    const fetchMock = renderHome(user('REQUESTER'))
    expect(await screen.findByRole('heading', { name: /Welcome, Test User/ })).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([u]) => u).some((u) => String(u).endsWith('/api/dashboard/requester'))).toBe(true)
    expect(fetchMock.mock.calls.map(([u]) => u).some((u) => String(u).endsWith('/api/dashboard/staff'))).toBe(false)
  })

  it.each(['IT_STAFF', 'ADMINISTRATOR'])('%s gets the Staff Dashboard', async (role) => {
    const fetchMock = renderHome(user(role))
    expect(await screen.findByRole('heading', { name: /Welcome back, Test User/ })).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([u]) => u).some((u) => String(u).endsWith('/api/dashboard/staff'))).toBe(true)
  })

  it('no session redirects to Login', async () => {
    renderHome(null)
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('a temporary-password user is sent to Change Password', async () => {
    renderHome(user('REQUESTER', true))
    expect(await screen.findByText('Change password page')).toBeInTheDocument()
  })
})
