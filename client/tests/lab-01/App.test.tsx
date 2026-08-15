import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App (UI-01)', () => {
  it('renders the TokTickIT heading', () => {
    render(<App />)
    expect(screen.getByText('TokTickIT IT Service Desk')).toBeInTheDocument()
  })
})

describe('App - category list (UI-02)', () => {
  it('shows a loading state before displaying the fetched categories', async () => {
    let resolveHealth: (value: Response) => void
    let resolveCategories: (value: Response) => void

    const healthPromise = new Promise<Response>((resolve) => {
      resolveHealth = resolve
    })
    const categoriesPromise = new Promise<Response>((resolve) => {
      resolveCategories = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/api/health')) return healthPromise
        if (url.endsWith('/api/categories')) return categoriesPromise
        throw new Error(`Unexpected fetch to ${url}`)
      }),
    )

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(screen.getByText('⏳ Loading...')).toBeInTheDocument()

    resolveHealth!(new Response(JSON.stringify({ status: 'ok', service: 'TokTickIT API' }), { status: 200 }))
    resolveCategories!(
      new Response(
        JSON.stringify([
          { id: 1, name: 'Account and Access' },
          { id: 2, name: 'Hardware' },
          { id: 3, name: 'Software' },
          { id: 4, name: 'Network' },
        ]),
        { status: 200 },
      ),
    )

    expect(await screen.findByText('Account and Access')).toBeInTheDocument()
    expect(screen.getByText('Hardware')).toBeInTheDocument()
    expect(screen.getByText('Software')).toBeInTheDocument()
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(screen.queryByText('⏳ Loading...')).not.toBeInTheDocument()
  })
})

describe('App - Check System failure (UI-03)', () => {
  it('shows a useful error message when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(await screen.findByText('System Status: Offline')).toBeInTheDocument()
    expect(screen.getByText('Unable to connect to TokTickIT API')).toBeInTheDocument()
  })
})
