import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../src/context/AuthContext'
import ChangePassword from '../../src/pages/ChangePassword'

const CURRENT_USER = { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com', role: 'REQUESTER', mustChangePassword: true }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function mockFetch(changePasswordHandler: () => Response) {
  return vi.fn((url: string) => {
    if (url.endsWith('/api/auth/me')) {
      return Promise.resolve(jsonResponse(CURRENT_USER))
    }
    if (url.endsWith('/api/auth/change-password')) {
      return Promise.resolve(changePasswordHandler())
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
}

function renderChangePassword(changePasswordHandler: () => Response = () => jsonResponse({ ok: true })) {
  vi.stubGlobal('fetch', mockFetch(changePasswordHandler))
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ChangePassword />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChangePassword (UI-02)', () => {
  it('keeps Continue disabled until every rule is met and the confirmation matches', async () => {
    renderChangePassword()

    await screen.findByLabelText('Current (temporary) password')
    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Current (temporary) password'), 'DevPass123!')
    await userEvent.type(screen.getByLabelText('New password'), 'weak')
    expect(continueButton).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('New password'))
    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass9!')
    expect(continueButton).toBeDisabled() // confirmation not typed yet

    await userEvent.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass9!')
    expect(continueButton).toBeEnabled()
  })

  it('live-updates the rule checklist as the password is typed', async () => {
    renderChangePassword()

    await screen.findByLabelText('New password')
    expect(screen.getByText(/Be at least 8 characters/)).toHaveClass('text-muted')

    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass9!')

    expect(screen.getByText(/Be at least 8 characters/)).toHaveClass('text-success')
    expect(screen.getByText(/Include an uppercase letter/)).toHaveClass('text-success')
    expect(screen.getByText(/Include a digit/)).toHaveClass('text-success')
    expect(screen.getByText(/Include a special character/)).toHaveClass('text-success')
  })

  it('shows a safe error when the current password is wrong', async () => {
    renderChangePassword(() =>
      jsonResponse({ error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect.' } }, 401),
    )

    await screen.findByLabelText('Current (temporary) password')
    await userEvent.type(screen.getByLabelText('Current (temporary) password'), 'WrongOne1!')
    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass9!')
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass9!')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
  })
})
