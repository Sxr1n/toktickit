import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  const navLinks = user ? (
    <>
      <NavLink end className="nav-link text-white" to="/" onClick={() => setMenuOpen(false)}>
        Dashboard
      </NavLink>
      {user.role === 'REQUESTER' && (
        <>
          <NavLink className="nav-link text-white" to="/tickets" onClick={() => setMenuOpen(false)}>
            My Tickets
          </NavLink>
          <NavLink className="nav-link text-white" to="/create-ticket" onClick={() => setMenuOpen(false)}>
            Create Ticket
          </NavLink>
        </>
      )}
      {(user.role === 'IT_STAFF' || user.role === 'ADMINISTRATOR') && (
        <NavLink className="nav-link text-white" to="/staff/tickets" onClick={() => setMenuOpen(false)}>
          My Queue
        </NavLink>
      )}
      {user.role === 'ADMINISTRATOR' && (
        <NavLink className="nav-link text-white" to="/admin/users" onClick={() => setMenuOpen(false)}>
          Users
        </NavLink>
      )}
      <span className="text-white">
        {user.name} ({user.role})
      </span>
      <button type="button" className="btn btn-outline-light btn-sm" onClick={handleLogout}>
        Log out
      </button>
    </>
  ) : (
    <Link className="btn btn-outline-light btn-sm" to="/login" onClick={() => setMenuOpen(false)}>
      Log in
    </Link>
  )

  return (
    <div>
      <nav style={{ backgroundColor: '#006B3C' }}>
        <div className="container d-flex align-items-center justify-content-between py-2">
          <Link className="navbar-brand text-white fw-bold" to="/">
            TokTickIT
          </Link>

          <div className="d-none d-md-flex align-items-center gap-3">{navLinks}</div>

          <button
            type="button"
            className="btn btn-outline-light btn-sm d-md-none"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            Menu
          </button>
        </div>

        {menuOpen && (
          <div className="d-md-none container d-flex flex-column align-items-start gap-2 pb-3">{navLinks}</div>
        )}
      </nav>
      <main>{children}</main>
    </div>
  )
}
