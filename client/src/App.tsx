import { useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

type CheckState = 'idle' | 'loading' | 'online' | 'offline'

function App() {
  const [state, setState] = useState<CheckState>('idle')

  const checkSystem = async () => {
    setState('loading')
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`)
      if (!res.ok) throw new Error('Health check failed')
      const data = await res.json()
      if (data.status !== 'ok') throw new Error('Unexpected health response')
      setState('online')
    } catch {
      setState('offline')
    }
  }

  return (
    <div className="container py-4">
      <h1>TokTickIT IT Service Desk</h1>

      <button className="btn btn-primary mb-3" onClick={checkSystem} disabled={state === 'loading'}>
        Check System
      </button>

      {state === 'loading' && <p>⏳ Loading...</p>}

      {state === 'online' && (
        <div>
          <p>System Status: Online</p>
        </div>
      )}

      {state === 'offline' && (
        <div className="text-danger">
          <p>System Status: Offline</p>
          <p>Unable to connect to TokTickIT API</p>
        </div>
      )}
    </div>
  )
}

export default App
