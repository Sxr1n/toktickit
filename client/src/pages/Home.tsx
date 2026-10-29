import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RequesterDashboard from './RequesterDashboard'
import StaffDashboard from './StaffDashboard'

// Role-routed homepage (FR-12), replacing the unrelated Lab 1 "Check System" scaffold that
// previously sat here, reachable by anyone including logged-out visitors.
export default function Home() {
  const { user, status } = useAuth()

  if (status === 'loading') {
    return <p className="container py-4">⏳ Loading...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  if (user.role === 'REQUESTER') {
    return <RequesterDashboard />
  }

  return <StaffDashboard />
}
