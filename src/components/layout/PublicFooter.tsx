import { Link } from 'react-router-dom'
import logoImg from '@/assets/logo-sinfondo.png'

/** Shared footer for the public-facing pages (landing, blog, screening test). */
export function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      {/* Single tiam-blue thin line */}
      <div className="h-[3px] w-full bg-tiam-blue" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800">
          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <img src={logoImg} alt="TIAM" className="h-10 w-10 object-contain" />
              <span className="font-bold text-white">TIAM Digital</span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Estimulación cognitiva profesional para adultos mayores. Todo el material que necesitás, en un solo lugar.
            </p>
          </div>

          {/* Producto */}
          <nav aria-label="Producto">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">Producto</p>
            <ul className="flex flex-col gap-3 text-sm">
              <li><a href="/#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a></li>
              <li><a href="/#planes" className="hover:text-white transition-colors">Planes</a></li>
              <li><Link to="/autoevaluacion" className="hover:text-white transition-colors">Autoevaluación</Link></li>
            </ul>
          </nav>

          {/* Recursos */}
          <nav aria-label="Recursos">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">Recursos</p>
            <ul className="flex flex-col gap-3 text-sm">
              <li><Link to="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Iniciar sesión</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Crear cuenta</Link></li>
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-4">Legal</p>
            <ul className="flex flex-col gap-3 text-sm">
              <li><Link to="/terms" className="hover:text-white transition-colors">Términos y Condiciones</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
            </ul>
          </nav>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <p>© 2026 TIAM Digital. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-slate-400 transition-colors">Términos</Link>
            <Link to="/privacy" className="hover:text-slate-400 transition-colors">Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
