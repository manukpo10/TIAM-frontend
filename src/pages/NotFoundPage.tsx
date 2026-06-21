import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-4xl font-bold text-slate-300">404</h1>
      <p className="text-slate-500">Página no encontrada</p>
      <Link to="/library" className="text-sm text-tiam-blue hover:underline">
        Ir a la biblioteca
      </Link>
    </div>
  )
}
