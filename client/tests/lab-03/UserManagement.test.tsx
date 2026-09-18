import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import UserManagement from '../../src/pages/UserManagement'

const CURRENT_ADMIN = {
  id: 1,
  name: 'Taylor Admin',
  email: 'taylor.admin@example.com',
  role: 'ADMINISTRATOR',
  mustChangePassword: false,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function renderPage(fetchImpl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <UserManagement />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('UserManagement - create form validation (UI-06)', () => {
  it('keeps Save disabled until Name, Email, and a valid Initial Password are provided', async () => {
    renderPage((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_ADMIN)
      if (url.includes('/api/admin/users')) return jsonResponse([{ id: 1, name: 'Taylor Admin', email: 'taylor.admin@example.com', role: 'ADMINISTRATOR', isActive: true }])
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await userEvent.click(await screen.findByRole('button', { name: 'New User' }))

    const saveButton = screen.getByRole('button', { name: 'Save' })
    expect(saveButton).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Name'), 'New Person')
    await userEvent.type(screen.getByLabelText('Email'), 'new.person@example.com')
    expect(saveButton).toBeDisabled() // password still weak

    await userEvent.type(screen.getByLabelText('Initial Password'), 'BrandNewPass9!')
    expect(saveButton).toBeEnabled()
  })

  it('shows a success message after creating a user, and it stays visible once the panel closes', async () => {
    renderPage((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_ADMIN)
      if (url.includes('/api/admin/users') && init?.method === 'POST') {
        return jsonResponse({ id: 5, name: 'New Person', email: 'new.person@example.com', role: 'REQUESTER', isActive: true }, 201)
      }
      if (url.includes('/api/admin/users')) return jsonResponse([{ id: 1, name: 'Taylor Admin', email: 'taylor.admin@example.com', role: 'ADMINISTRATOR', isActive: true }])
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await userEvent.click(await screen.findByRole('button', { name: 'New User' }))
    await userEvent.type(screen.getByLabelText('Name'), 'New Person')
    await userEvent.type(screen.getByLabelText('Email'), 'new.person@example.com')
    await userEvent.type(screen.getByLabelText('Initial Password'), 'BrandNewPass9!')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('New Person was created.')).toBeInTheDocument()
    // The create panel closes on success (back to the list view) -- the message must not have
    // been unmounted along with it.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('shows a duplicate-email server error inline on the Email field', async () => {
    renderPage((url, init) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_ADMIN)
      if (url.includes('/api/admin/users') && init?.method === 'POST') {
        return jsonResponse({ error: { code: 'EMAIL_TAKEN', message: 'That email address is already in use.' } }, 409)
      }
      if (url.includes('/api/admin/users')) return jsonResponse([{ id: 1, name: 'Taylor Admin', email: 'taylor.admin@example.com', role: 'ADMINISTRATOR', isActive: true }])
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await userEvent.click(await screen.findByRole('button', { name: 'New User' }))
    await userEvent.type(screen.getByLabelText('Name'), 'Dup Person')
    await userEvent.type(screen.getByLabelText('Email'), 'taylor.admin@example.com')
    await userEvent.type(screen.getByLabelText('Initial Password'), 'BrandNewPass9!')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('That email address is already in use.')).toBeInTheDocument()
  })
})

describe('UserManagement - self-deactivation disabled with a visible reason (UI-06)', () => {
  it('disables the Active checkbox when editing the signed-in Administrator', async () => {
    renderPage((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_ADMIN)
      if (url.includes('/api/admin/users')) {
        return jsonResponse([{ id: 1, name: 'Taylor Admin', email: 'taylor.admin@example.com', role: 'ADMINISTRATOR', isActive: true }])
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))

    const activeCheckbox = screen.getByLabelText('Active')
    expect(activeCheckbox).toBeDisabled()
    expect(screen.getByText('You cannot deactivate your own account.')).toBeInTheDocument()
  })
})

describe('UserManagement - last active Administrator disabled with a visible reason (UI-06)', () => {
  it('disables editing a different sole active Administrator, with the last-admin reason (not the self reason)', async () => {
    renderPage((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_ADMIN)
      if (url.includes('/api/admin/users')) {
        return jsonResponse([
          { id: 2, name: 'Sole Admin', email: 'sole.admin@example.com', role: 'ADMINISTRATOR', isActive: true },
          { id: 3, name: 'A Requester', email: 'a.requester@example.com', role: 'REQUESTER', isActive: true },
        ])
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await userEvent.click(editButtons[0])

    const activeCheckbox = screen.getByLabelText('Active')
    expect(activeCheckbox).toBeDisabled()
    expect(screen.getByText('At least one active Administrator must remain.')).toBeInTheDocument()
  })

  it('is not fooled by a search filter that narrows the visible list to one admin row', async () => {
    // Regression: the last-active-Administrator count must come from the full user list, not
    // whatever the search/role filter currently happens to display.
    renderPage((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_ADMIN)
      if (url.includes('/api/admin/users')) {
        return jsonResponse([
          { id: 1, name: 'Taylor Admin', email: 'taylor.admin@example.com', role: 'ADMINISTRATOR', isActive: true },
          { id: 2, name: 'Filtered Admin', email: 'filtered.admin@example.com', role: 'ADMINISTRATOR', isActive: true },
        ])
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    await userEvent.type(await screen.findByLabelText('Search'), 'Filtered')
    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    expect(editButtons).toHaveLength(1) // the search narrowed the visible list to just this row
    await userEvent.click(editButtons[0])

    const activeCheckbox = screen.getByLabelText('Active')
    expect(activeCheckbox).toBeEnabled()
  })

  it('leaves the Active checkbox enabled when another active Administrator remains', async () => {
    renderPage((url) => {
      if (url.endsWith('/api/auth/me')) return jsonResponse(CURRENT_ADMIN)
      if (url.includes('/api/admin/users')) {
        return jsonResponse([
          { id: 1, name: 'Taylor Admin', email: 'taylor.admin@example.com', role: 'ADMINISTRATOR', isActive: true },
          { id: 2, name: 'Other Admin', email: 'other.admin@example.com', role: 'ADMINISTRATOR', isActive: true },
        ])
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' })
    await userEvent.click(editButtons[1]) // "Other Admin" -- not self, and not the last active admin

    const activeCheckbox = screen.getByLabelText('Active')
    expect(activeCheckbox).toBeEnabled()
  })
})
