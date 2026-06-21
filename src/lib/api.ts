import type { ApiError } from '@/types'
import { MOCK_ENABLED, mockRequest } from '@/lib/mock'
import { useAuthStore } from '@/store/auth'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

function getToken(): string | null {
  return localStorage.getItem('tiam_token')
}

// When an authenticated request comes back 401/403 the stored token is missing,
// expired or invalid. Clear it and bounce to /login instead of leaving the user stuck
// on a generic error screen whose "Reintentar" can never succeed with the same bad token.
// /auth/* is excluded so a bad-credentials login shows its own error (no redirect loop),
// and requests with no token are ignored (e.g. the public /play patient page).
function handleAuthFailure(status: number, path: string): void {
  if (status !== 401 && status !== 403) return
  if (path.startsWith('/auth/')) return
  if (!getToken()) return
  useAuthStore.getState().clearAuth()
  if (window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
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
    handleAuthFailure(res.status, path)
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

// Binary download (e.g. PDF fichas). Bypasses the JSON envelope unwrapping and the mock
// layer — file generation always needs the real backend.
async function requestBlob(path: string, body: unknown): Promise<Blob> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    handleAuthFailure(res.status, path)
    const error: ApiError = await res.json().catch(() => ({
      message: 'Error de conexión',
      status: res.status,
    }))
    throw error
  }
  return res.blob()
}

// Multipart file upload (e.g. exercise images). Lets the browser set the multipart
// Content-Type/boundary; only the auth header is added.
async function uploadFile<T>(path: string, file: File): Promise<T> {
  const token = getToken()
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  })
  if (!res.ok) {
    handleAuthFailure(res.status, path)
    const error: ApiError = await res.json().catch(() => ({
      message: 'Error de conexión',
      status: res.status,
    }))
    throw error
  }
  const json = await res.json()
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return (json as { data: T }).data
  }
  return json as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postBlob: (path: string, body: unknown) => requestBlob(path, body),
  upload: <T>(path: string, file: File) => uploadFile<T>(path, file),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
