import { API_BASE_URL } from './http'

export interface AdminUser {
  id: number
  name: string
  email: string
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  isActive: boolean
}

export class ApiAdminError extends Error {
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
  throw new ApiAdminError(err.code ?? 'UNKNOWN_ERROR', err.message ?? 'Something went wrong.', err.details)
}

export async function listUsers(params: { search?: string; role?: string }): Promise<AdminUser[]> {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.role) query.set('role', params.role)

  const res = await fetch(`${API_BASE_URL}/api/admin/users?${query.toString()}`, { credentials: 'include' })
  if (!res.ok) return parseErrorAndThrow(res)
  return res.json() as Promise<AdminUser[]>
}

export interface CreateUserInput {
  name: string
  email: string
  role: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  isActive: boolean
  initialPassword: string
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) return parseErrorAndThrow(res)
  return res.json() as Promise<AdminUser>
}

export interface EditUserInput {
  name?: string
  email?: string
  role?: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
  isActive?: boolean
}

export async function editUser(id: number, input: EditUserInput): Promise<AdminUser> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) return parseErrorAndThrow(res)
  return res.json() as Promise<AdminUser>
}

export async function resetPassword(id: number, newPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ newPassword }),
  })
  if (!res.ok) return parseErrorAndThrow(res)
}
