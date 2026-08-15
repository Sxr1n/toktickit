import { useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

type CheckState = 'idle' | 'loading' | 'online' | 'offline'

interface Category {
  id: number
  name: string
}

function App() {
  const [state, setState] = useState<CheckState>('idle')
  const [categories, setCategories] = useState<Category[]>([])

  const checkSystem = async () => {
    setState('loading')
    try {
      const [healthRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/health`),
        fetch(`${API_BASE_URL}/api/categories`),
      ])
      if (!healthRes.ok || !categoriesRes.ok) throw new Error('Request failed')

      const health = await healthRes.json()
      if (health.status !== 'ok') throw new Error('Unexpected health response')

      const categoriesData: Category[] = await categoriesRes.json()
      setCategories(categoriesData)
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
          <p>Supported Request Categories:</p>
          <ul>
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
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
