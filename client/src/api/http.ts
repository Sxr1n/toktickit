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
