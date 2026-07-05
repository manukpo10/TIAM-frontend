import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/Button'
import logoImg from '@/assets/logogrande-sinfondo.png'

/**
 * Shared navigation header for the public-facing pages (landing, blog,
 * screening test). Section links point at landing anchors so they work from
 * any route; page links use the router.
 */

interface NavLink {
  label: string
  /** Anchor on the landing page (e.g. "/#planes") or a route ("/blog"). */
  href: string
  /** True when it targets a different route (uses <Link>, not a hash anchor). */
  route?: boolean
}

const NAV_LINKS: NavLink[] = [
  { label: 'Cómo funciona', href: '/demo', route: true },
  { label: 'Autoevaluación', href: '/autoevaluacion', route: true },
  { label: 'Desafío 30 días', href: '/desafio-30-dias', route: true },
  { label: 'Recursos', href: '/recursos', route: true },
  { label: 'Preguntas', href: '/preguntas-frecuentes', route: true },
  { label: 'Blog', href: '/blog', route: true },
  { label: 'Nosotros', href: '/nosotros', route: true },
]

export function PublicHeader() {
  const user = useAuthStore((s) => s.user)
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      {/* Thin brand accent */}
      <div className="h-[3px] w-full bg-tiam-blue" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="TIAM Digital — inicio">
          <img src={logoImg} alt="TIAM Digital" className="h-10 w-auto object-contain" />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Navegación principal">
          {NAV_LINKS.map((link) =>
            link.route ? (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-slate-600 hover:text-tiam-blue transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 hover:text-tiam-blue transition-colors"
              >
                {link.label}
              </a>
            ),
          )}
        </nav>

        {/* Right: auth CTAs + mobile toggle */}
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/library">
              <Button size="md">Ir a la biblioteca</Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex">
                <Button variant="ghost" size="md">Iniciar sesión</Button>
              </Link>
              <Link to="/register" className="hidden sm:inline-flex">
                <Button size="md">Probá gratis</Button>
              </Link>
            </>
          )}

          <button
            type="button"
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <nav
          className="lg:hidden border-t border-slate-100 bg-white px-4 sm:px-6 py-4"
          aria-label="Navegación móvil"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                {link.route ? (
                  <Link
                    to={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}

            {!user && (
              <li className="pt-2 mt-1 border-t border-slate-100 sm:hidden">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Iniciar sesión
                </Link>
                <Link to="/register" onClick={() => setOpen(false)} className="block mt-1">
                  <Button size="md" className="w-full">Probá gratis</Button>
                </Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  )
}
