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

describe('App - Check System failure (UI-03)', () => {
  it('shows a useful error message when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Check System' }))

    expect(await screen.findByText('System Status: Offline')).toBeInTheDocument()
    expect(screen.getByText('Unable to connect to TokTickIT API')).toBeInTheDocument()
  })
})
