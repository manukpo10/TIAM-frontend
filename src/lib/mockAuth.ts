import { useAuthStore } from '@/store/auth'
import { MOCK_ENABLED, MOCK_USER, MOCK_SUBSCRIPTION } from '@/lib/mock'

/**
 * Seeds a mock admin session so the app is browsable without a backend.
 * Only runs when VITE_USE_MOCK is enabled and no session exists yet.
 */
export function seedMockAuth() {
  if (!MOCK_ENABLED) return
  const { user, setAuth } = useAuthStore.getState()
  if (user) return
  setAuth(MOCK_USER, MOCK_SUBSCRIPTION, 'mock-token')
}
