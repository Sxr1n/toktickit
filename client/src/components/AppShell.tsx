import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useRequester } from '../context/RequesterContext'

export default function AppShell({ children }: { children: ReactNode }) {
  const { selectedRequester, changeRequester } = useRequester()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = selectedRequester ? (
    <>
      <Link className="nav-link text-white" to="/tickets" onClick={() => setMenuOpen(false)}>
        My Tickets
      </Link>
      <Link className="nav-link text-white" to="/create-ticket" onClick={() => setMenuOpen(false)}>
        Create Ticket
      </Link>
      <span className="text-white">{selectedRequester.name}</span>
      <button
        type="button"
        className="btn btn-outline-light btn-sm"
        onClick={() => {
          setMenuOpen(false)
          changeRequester()
        }}
      >
        Change Requester
      </button>
    </>
  ) : (
    <Link className="btn btn-outline-light btn-sm" to="/select-requester" onClick={() => setMenuOpen(false)}>
      Select Development Requester
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
