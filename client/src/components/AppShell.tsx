import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
      {user.role === 'REQUESTER' && (
        <>
          <Link className="nav-link text-white" to="/tickets" onClick={() => setMenuOpen(false)}>
            My Tickets
          </Link>
          <Link className="nav-link text-white" to="/create-ticket" onClick={() => setMenuOpen(false)}>
            Create Ticket
          </Link>
        </>
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
