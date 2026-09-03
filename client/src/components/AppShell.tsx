import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useRequester } from '../context/RequesterContext'

export default function AppShell({ children }: { children: ReactNode }) {
  const { selectedRequester, changeRequester } = useRequester()

  return (
    <div>
      <nav className="navbar navbar-expand" style={{ backgroundColor: '#006B3C' }}>
        <div className="container">
          <Link className="navbar-brand text-white fw-bold" to="/">
            TokTickIT
          </Link>
          <div className="d-flex align-items-center gap-3 ms-auto">
            {selectedRequester ? (
              <>
                <span className="text-white">{selectedRequester.name}</span>
                <button type="button" className="btn btn-outline-light btn-sm" onClick={changeRequester}>
                  Change Requester
                </button>
              </>
            ) : (
              <Link className="btn btn-outline-light btn-sm" to="/select-requester">
                Select Development Requester
              </Link>
            )}
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
