import { useState, useEffect } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { BookOpen, CreditCard, LogOut, Menu, Settings, Users, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import logoImg from '@/assets/logo-sinfondo.png'

const NAV_ITEMS = [
  { to: '/library', icon: BookOpen, label: 'Biblioteca' },
  { to: '/patients', icon: Users, label: 'Pacientes' },
  { to: '/subscription', icon: CreditCard, label: 'Suscripción' },
]

const ADMIN_NAV_ITEMS = [
  { to: '/admin/exercises', icon: Settings, label: 'Ejercicios' },
]

export function AppLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  const isAdmin = user?.role === 'ADMIN'
  const initials = user?.fullName
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '??'

  const navLinks = (
    <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-4">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
        const active = location.pathname.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-tiam-blue/10 text-tiam-blue-dark'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
            )}
          >
            <Icon className={cn('h-4 w-4', active ? 'text-tiam-blue' : 'text-slate-400')} />
            {label}
          </Link>
        )
      })}

      {isAdmin && (
        <>
          <div className="my-3 mx-1">
            <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-300">
              Administración
            </p>
          </div>
          {ADMIN_NAV_ITEMS.map(({ to, icon: Icon, label }) => {
            const active = location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-tiam-blue/10 text-tiam-blue-dark'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                )}
              >
                <Icon className={cn('h-4 w-4', active ? 'text-tiam-blue' : 'text-slate-400')} />
                {label}
              </Link>
            )
          })}
        </>
      )}
    </nav>
  )

  const userFooter = (
    <div className="p-3">
      <div className="rounded-xl bg-slate-50 p-3">
        <Link
          to="/profile"
          className="mb-2 flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-slate-100"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-xs font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{user?.fullName}</p>
            <p className="truncate text-xs text-slate-400">{user?.specialty ?? user?.email}</p>
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {/* ── Mobile top bar (hidden on lg+) ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 flex h-14 items-center gap-3 border-b border-slate-100 bg-white px-4">
        <button
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Abrir menú de navegación"
          aria-expanded={drawerOpen}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        >
          {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2">
          <img src={logoImg} alt="TIAM" className="h-8 w-8 shrink-0 object-contain" />
          <span className="text-sm font-bold text-slate-900">TIAM Digital</span>
        </div>
      </header>

      {/* ── Mobile backdrop ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          // Shared base
          'flex w-60 shrink-0 flex-col bg-white border-r border-slate-100',
          // Mobile: fixed drawer, slides in/out
          'fixed z-50 inset-y-0 left-0 transition-transform duration-200 ease-in-out lg:transition-none',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: static, always visible
          'lg:static lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4">
          <img src={logoImg} alt="TIAM" className="h-10 w-10 shrink-0 object-contain" />
          <div>
            <span className="block text-sm font-bold text-slate-900">TIAM Digital</span>
            <span className="block text-xs text-slate-400">Estimulación cognitiva</span>
          </div>
        </div>

        <div className="mx-4 h-px bg-slate-100" />

        {navLinks}
        {userFooter}
      </aside>

      {/* ── Main content ── */}
      <main className="flex flex-1 flex-col overflow-auto pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
