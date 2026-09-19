import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppShell from '../../src/components/AppShell'
import { AuthProvider } from '../../src/context/AuthContext'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function renderShellAs(user: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.endsWith('/api/auth/me')) {
        return Promise.resolve(user ? jsonResponse(user) : new Response(null, { status: 401 }))
      }
      throw new Error(`Unexpected fetch to ${url}`)
    }),
  )

  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppShell>
          <div>page content</div>
        </AppShell>
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppShell - role-conditional navigation (UI-03, FR-06)', () => {
  it('shows only Requester links for a REQUESTER', async () => {
    renderShellAs({
      id: 1,
      name: 'Jennifer Anderson',
      email: 'jennifer.anderson@example.com',
      role: 'REQUESTER',
      mustChangePassword: false,
    })

    expect(await screen.findByRole('link', { name: 'My Tickets' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create Ticket' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('shows only the Queue link for IT_STAFF, not Requester or Administrator links', async () => {
    renderShellAs({
      id: 2,
      name: 'Carlos Mendez',
      email: 'carlos.mendez@example.com',
      role: 'IT_STAFF',
      mustChangePassword: false,
    })

    expect(await screen.findByRole('link', { name: 'My Queue' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Create Ticket' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('shows both the Queue and Users links for ADMINISTRATOR, not Requester links', async () => {
    renderShellAs({
      id: 3,
      name: 'Taylor Admin',
      email: 'taylor.admin@example.com',
      role: 'ADMINISTRATOR',
      mustChangePassword: false,
    })

    expect(await screen.findByRole('link', { name: 'My Queue' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Create Ticket' })).not.toBeInTheDocument()
  })

  it('shows only a Log in link when unauthenticated, no role links and no Log out', async () => {
    renderShellAs(null)

    expect(await screen.findByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Tickets' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'My Queue' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })
})
