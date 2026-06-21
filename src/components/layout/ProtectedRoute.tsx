import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

interface ProtectedRouteProps {
  requireAdmin?: boolean
  requireAccess?: boolean
}

export function ProtectedRoute({ requireAdmin = false, requireAccess = false }: ProtectedRouteProps) {
  const { isAuthenticated, hasActiveAccess, user } = useAuthStore()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && user?.role !== 'ADMIN') {
    return <Navigate to="/library" replace />
  }

  if (requireAccess && !hasActiveAccess()) {
    return <Navigate to="/subscription" replace />
  }

  return <Outlet />
}
