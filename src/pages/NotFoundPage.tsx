import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import notFoundIllustration from '@/assets/404.webp'

export function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-6 py-12 text-center">
      <img
        src={notFoundIllustration}
        alt=""
        className="w-full max-w-[300px]"
      />
      <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">
        Te perdiste en el camino
      </h1>
      <p className="mt-3 max-w-md text-slate-600 leading-relaxed">
        La página que buscás no existe o fue movida. No te preocupes, te ayudamos a volver.
      </p>
      <div className="mt-7 flex flex-col sm:flex-row gap-3">
        <Link to="/">
          <Button size="lg">Volver al inicio</Button>
        </Link>
        <Link to="/blog">
          <Button variant="secondary" size="lg">Ir al blog</Button>
        </Link>
      </div>
      <p className="mt-8 text-xs text-slate-400">Error 404 — página no encontrada</p>
    </div>
  )
}
