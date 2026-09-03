import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { apiGet } from '../api/http'

export interface DevRequester {
  id: number
  name: string
  email: string
}

type LoadStatus = 'loading' | 'loaded' | 'empty' | 'error'

interface RequesterContextValue {
  requesters: DevRequester[]
  status: LoadStatus
  selectedRequester: DevRequester | null
  selectRequester: (id: number) => void
  changeRequester: () => void
  reload: () => void
}

const STORAGE_KEY = 'toktickit.selectedRequesterId'

const RequesterContext = createContext<RequesterContextValue | undefined>(undefined)

export function RequesterProvider({ children }: { children: ReactNode }) {
  const [requesters, setRequesters] = useState<DevRequester[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : null
  })

  const load = useCallback(() => {
    setStatus('loading')
    apiGet<DevRequester[]>('/api/dev-requesters')
      .then((data) => {
        setRequesters(data)
        setStatus(data.length === 0 ? 'empty' : 'loaded')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const selectRequester = useCallback((id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id))
    setSelectedId(id)
  }, [])

  const changeRequester = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSelectedId(null)
  }, [])

  const selectedRequester = useMemo(
    () => requesters.find((r) => r.id === selectedId) ?? null,
    [requesters, selectedId],
  )

  const value = useMemo(
    () => ({ requesters, status, selectedRequester, selectRequester, changeRequester, reload: load }),
    [requesters, status, selectedRequester, selectRequester, changeRequester, load],
  )

  return <RequesterContext.Provider value={value}>{children}</RequesterContext.Provider>
}

export function useRequester() {
  const ctx = useContext(RequesterContext)
  if (!ctx) {
    throw new Error('useRequester must be used within a RequesterProvider')
  }
  return ctx
}
