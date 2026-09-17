import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import RequireAuth from './RequireAuth'
import type { AuthUser } from '../api/auth'

interface RequireRoleProps {
  roles: AuthUser['role'][]
  children: ReactNode
}

/**
 * Wraps RequireAuth with a role check. A signed-in user whose role isn't permitted sees a safe
 * "not authorized" screen rather than a redirect loop or a blank page -- this is a UX courtesy,
 * not the security boundary; every matching API route enforces the same role server-side.
 */
export default function RequireRole({ roles, children }: RequireRoleProps) {
  return (
    <RequireAuth>
      <RoleGate roles={roles}>{children}</RoleGate>
    </RequireAuth>
  )
}

function RoleGate({ roles, children }: RequireRoleProps) {
  const { user } = useAuth()

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="container py-4">
        <h1>Not authorized</h1>
        <p>Your account does not have access to this page.</p>
      </div>
    )
  }

  return <>{children}</>
}
