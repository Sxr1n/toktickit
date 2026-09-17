import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Gates every authenticated screen behind Login (AC-08), and behind the mandatory
 * Change Password screen whenever the current user still has a temporary password (AC-02, BR-02).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p className="container py-4">⏳ Loading...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}
