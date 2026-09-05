import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useRequester } from '../context/RequesterContext'

/**
 * Gates Requester-scoped screens (My Tickets, Create Ticket, Ticket Detail) behind
 * the Development Requester Selection screen (AC-02, BR-07).
 */
export default function RequireRequester({ children }: { children: ReactNode }) {
  const { selectedRequester, status } = useRequester()

  if (status === 'loading') {
    return <p className="container py-4">⏳ Loading...</p>
  }

  if (!selectedRequester) {
    return <Navigate to="/select-requester" replace />
  }

  return <>{children}</>
}
