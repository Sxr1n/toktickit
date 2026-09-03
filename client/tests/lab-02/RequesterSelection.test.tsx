import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequesterProvider } from '../../src/context/RequesterContext'
import RequesterSelection from '../../src/pages/RequesterSelection'

const REQUESTERS = [
  { id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com' },
  { id: 2, name: 'Michael Brown', email: 'michael.brown@example.com' },
]

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 })
}

function renderSelection() {
  return render(
    <MemoryRouter>
      <RequesterProvider>
        <RequesterSelection />
      </RequesterProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RequesterSelection', () => {
  it('shows an empty state with Continue disabled when no active Requesters exist (AC-22)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([])))

    renderSelection()

    expect(await screen.findByText('No active Development Requesters are available.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('shows a safe error state with a Retry action on failure (AC-23)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    renderSelection()

    expect(await screen.findByText('Unable to load Development Requesters.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('lists active Requesters and enables Continue once one is chosen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(REQUESTERS)))

    renderSelection()

    const select = await screen.findByLabelText('Development Requester')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await userEvent.selectOptions(select, '1')

    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
  })
})
