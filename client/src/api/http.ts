export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export async function apiGet<T>(path: string, requesterId?: number): Promise<T> {
  const headers: Record<string, string> = {}
  if (requesterId !== undefined) {
    headers['X-Dev-Requester-Id'] = String(requesterId)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' })
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
    credentials: 'include',
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

export class ApiUploadError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export async function apiUploadFile<T>(path: string, file: File, requesterId: number): Promise<T> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'X-Dev-Requester-Id': String(requesterId) },
    credentials: 'include',
    body: formData,
  })

  if (res.status === 400) {
    const data = await res.json()
    throw new ApiUploadError(data.error ?? 'UPLOAD_ERROR', data.message ?? 'Upload failed.')
  }
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body: unknown, requesterId: number): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Requester-Id': String(requesterId),
    },
    credentials: 'include',
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

export async function apiDownload(path: string, requesterId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'X-Dev-Requester-Id': String(requesterId) },
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Download from ${path} failed with status ${res.status}`)
  }
  return res.blob()
}
