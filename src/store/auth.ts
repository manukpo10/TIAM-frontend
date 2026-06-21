import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Subscription } from '@/types'

interface AuthStore {
  user: User | null
  subscription: Subscription | null
  token: string | null
  setAuth: (user: User, subscription: Subscription, token: string) => void
  setUser: (user: User) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  hasActiveAccess: () => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      subscription: null,
      token: null,

      setAuth: (user, subscription, token) => {
        localStorage.setItem('tiam_token', token)
        set({ user, subscription, token })
      },

      setUser: (user) => set({ user }),

      clearAuth: () => {
        localStorage.removeItem('tiam_token')
        set({ user: null, subscription: null, token: null })
      },

      isAuthenticated: () => get().user !== null,

      hasActiveAccess: () => {
        const sub = get().subscription
        if (!sub) return false
        if (sub.status === 'ACTIVE') return true
        if (sub.status === 'TRIAL') {
          const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null
          return trialEnd ? trialEnd > new Date() : false
        }
        return false
      },
    }),
    { name: 'tiam_auth' }
  )
)
