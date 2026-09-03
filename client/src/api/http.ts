export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export async function apiGet<T>(path: string, requesterId?: number): Promise<T> {
  const headers: Record<string, string> = {}
  if (requesterId !== undefined) {
    headers['X-Dev-Requester-Id'] = String(requesterId)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { headers })
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export class ApiValidationError extends Error {
  fields: Record<string, string>

  constructor(fields: Record<string, string>) {
    super('Validation failed')
    this.fields = fields
  }
}

export async function apiPost<T>(path: string, body: unknown, requesterId: number): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Requester-Id': String(requesterId),
    },
    body: JSON.stringify(body),
  })

  if (res.status === 400) {
    const data = await res.json()
    throw new ApiValidationError(data.fields ?? {})
  }
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}
