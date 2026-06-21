import type { ApiError } from '@/types'
import { MOCK_ENABLED, mockRequest } from '@/lib/mock'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

function getToken(): string | null {
  return localStorage.getItem('tiam_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (MOCK_ENABLED) {
    const body = options.body ? JSON.parse(options.body as string) : undefined
    const mocked = mockRequest<T>(options.method ?? 'GET', path, body)
    if (mocked) return mocked
  }

  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const error: ApiError = await res.json().catch(() => ({
      message: 'Error de conexión',
      status: res.status,
    }))
    throw error
  }

  if (res.status === 204) return undefined as T

  const json = await res.json()
  // The real backend wraps every response in an ApiResponse envelope: { success, data, message }.
  // Unwrap it so callers receive the same shape the mock returns (the raw payload).
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return (json as { data: T }).data
  }
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
