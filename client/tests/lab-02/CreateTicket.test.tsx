import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RequesterProvider } from '../../src/context/RequesterContext'
import CreateTicket from '../../src/pages/CreateTicket'

const REQUESTERS = [{ id: 1, name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com' }]
const CATEGORIES = [{ id: 1, name: 'Hardware' }]
const RELATED_SYSTEMS = [{ id: 1, name: 'Corporate Laptop' }]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function mockFetch(overrides: { ticketPost?: () => Response | Promise<Response> } = {}) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/dev-requesters')) return Promise.resolve(jsonResponse(REQUESTERS))
    if (url.endsWith('/api/categories')) return Promise.resolve(jsonResponse(CATEGORIES))
    if (url.endsWith('/api/related-systems')) return Promise.resolve(jsonResponse(RELATED_SYSTEMS))
    if (url.endsWith('/api/tickets') && init?.method === 'POST') {
      return Promise.resolve(overrides.ticketPost ? overrides.ticketPost() : jsonResponse({ id: 1, ticketNumber: 'TKT-2026-000001' }, 201))
    }
    throw new Error(`Unexpected fetch to ${url}`)
  })
}

async function renderWithSelectedRequester(fetchMock: ReturnType<typeof mockFetch>) {
  vi.stubGlobal('fetch', fetchMock)
  localStorage.setItem('toktickit.selectedRequesterId', '1')

  render(
    <MemoryRouter>
      <RequesterProvider>
        <CreateTicket />
      </RequesterProvider>
    </MemoryRouter>,
  )

  await screen.findByLabelText('Category')
}

async function fillValidForm() {
  await userEvent.selectOptions(screen.getByLabelText('Category'), '1')
  await userEvent.selectOptions(screen.getByLabelText('Related System'), '1')
  await userEvent.selectOptions(screen.getByLabelText('Requested Priority'), 'MEDIUM')
  await userEvent.type(screen.getByLabelText(/Summary/), 'Laptop battery drains quickly')
  await userEvent.type(
    screen.getByLabelText(/Description/),
    'Battery drains fast even when idle, started after last update.',
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CreateTicket (UI-02)', () => {
  it('shows a field error and does not call the API when Summary is missing', async () => {
    const fetchMock = mockFetch()
    await renderWithSelectedRequester(fetchMock)

    await userEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }))

    expect(await screen.findByText(/Summary is required/)).toBeInTheDocument()
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith('/api/tickets'))).toBe(false)
  })
})

describe('CreateTicket (UI-03)', () => {
  it('shows a busy, disabled Submit button while the request is in flight', async () => {
    let resolvePost: (value: Response) => void
    const postPromise = new Promise<Response>((resolve) => {
      resolvePost = resolve
    })
    const fetchMock = mockFetch({ ticketPost: () => postPromise })
    await renderWithSelectedRequester(fetchMock)
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }))

    const submitButton = await screen.findByRole('button', { name: 'Submitting...' })
    expect(submitButton).toBeDisabled()

    resolvePost!(jsonResponse({ id: 1, ticketNumber: 'TKT-2026-000001' }, 201))
    expect(await screen.findByText('TKT-2026-000001')).toBeInTheDocument()
  })
})

describe('CreateTicket (UI-04)', () => {
  it('shows a safe error and preserves entered values when the backend is unavailable', async () => {
    const fetchMock = mockFetch({
      ticketPost: () => {
        throw new Error('network error')
      },
    })
    await renderWithSelectedRequester(fetchMock)
    await fillValidForm()

    await userEvent.click(screen.getByRole('button', { name: 'Submit Ticket' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your entries have been kept')
    expect(screen.getByLabelText(/Summary/)).toHaveValue('Laptop battery drains quickly')
  })
})

describe('AttachmentPicker (UI-05)', () => {
  it('rejects an oversized file with a clear message', async () => {
    await renderWithSelectedRequester(mockFetch())

    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    const input = screen.getByLabelText('Attachments') as HTMLInputElement

    await userEvent.upload(input, bigFile)

    expect(await screen.findByRole('alert')).toHaveTextContent('larger than 5 MB')
    expect(screen.queryByText('big.png (6144 KB)')).not.toBeInTheDocument()
  })

  it('rejects an unsupported file type with a clear message', async () => {
    await renderWithSelectedRequester(mockFetch())

    const badFile = new File(['data'], 'virus.exe', { type: 'application/x-msdownload' })
    const input = screen.getByLabelText('Attachments') as HTMLInputElement

    await userEvent.upload(input, badFile)

    expect(await screen.findByRole('alert')).toHaveTextContent('not an allowed file type')
  })
})
