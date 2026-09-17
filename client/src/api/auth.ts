import { API_BASE_URL } from './http'

export interface AuthUser {
  id: number
  name: string
  email: string
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  mustChangePassword: boolean
}

export class ApiAuthError extends Error {
  code: string
  details?: Record<string, unknown>

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }
}

async function parseErrorAndThrow(res: Response): Promise<never> {
  const data = await res.json().catch(() => ({}))
  const err = data?.error ?? {}
  throw new ApiAuthError(err.code ?? 'UNKNOWN_ERROR', err.message ?? 'Something went wrong.', err.details)
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return parseErrorAndThrow(res)
  return res.json() as Promise<AuthUser>
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) return parseErrorAndThrow(res)
  return res.json() as Promise<AuthUser>
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) return parseErrorAndThrow(res)
}
