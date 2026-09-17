import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import Login from '../../src/pages/Login'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

// AuthProvider itself calls GET /api/auth/me on mount to hydrate; every test must account for
// that first call in addition to whatever the test interacts with.
function mockFetch(loginHandler: (init?: RequestInit) => Response) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse(null, 401))
    }
    if (url.endsWith('/api/auth/login')) {
      return Promise.resolve(loginHandler(init))
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
}

function renderLogin(loginHandler: (init?: RequestInit) => Response) {
  vi.stubGlobal('fetch', mockFetch(loginHandler))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Login (UI-01)', () => {
  it('shows field-level validation and does not call login when submitted empty (AC-05)', async () => {
    const loginHandler = vi.fn()
    renderLogin(loginHandler)

    await screen.findByLabelText('Email address')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(loginHandler).not.toHaveBeenCalled()
  })

  it('shows a busy state while the request is in flight (AC-01)', async () => {
    let resolveLogin: (() => void) | undefined
    const pending = new Promise<Response>((resolve) => {
      resolveLogin = () => resolve(jsonResponse({ id: 1, name: 'Jennifer', email: 'j@example.com', role: 'REQUESTER', mustChangePassword: false }))
    })
    renderLogin(() => pending as unknown as Response)

    await screen.findByLabelText('Email address')
    await userEvent.type(screen.getByLabelText('Email address'), 'jennifer.anderson@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'DevPass123!')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByRole('button', { name: 'Signing In...' })).toBeDisabled()
    resolveLogin?.()
  })

  it('shows a generic safe error on invalid credentials (AC-05, AC-06)', async () => {
    renderLogin(() =>
      jsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }, 401),
    )

    await screen.findByLabelText('Email address')
    await userEvent.type(screen.getByLabelText('Email address'), 'jennifer.anderson@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })
})
