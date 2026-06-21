import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import logoImg from '@/assets/logo-sinfondo.png'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegalSection {
  number: number
  title: string
  content: React.ReactNode
}

interface LegalPageProps {
  title: string
  lastUpdated: string
  sections: LegalSection[]
  crossLinkTo: string
  crossLinkLabel: string
}

// ─── Shared layout ────────────────────────────────────────────────────────────

export function LegalPage({ title, lastUpdated, sections, crossLinkTo, crossLinkLabel }: LegalPageProps) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="h-[3px] w-full bg-tiam-blue" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <Link
            to="/"
            className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/30 rounded"
            aria-label="TIAM Digital — inicio"
          >
            <img src={logoImg} alt="TIAM" className="h-9 w-9 object-contain" />
            <span className="font-bold text-slate-900 text-base leading-none hidden sm:block">
              TIAM Digital
            </span>
          </Link>

          <Link
            to="/"
            className="text-sm text-tiam-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-tiam-blue/30 rounded"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          {/* Disclaimer */}
          <div
            role="note"
            className="mb-10 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
            <p className="text-sm text-amber-800 leading-relaxed">
              <strong className="font-semibold">Aviso importante:</strong>{' '}
              Este es un documento base y debe ser revisado por un asesor legal antes de su uso definitivo.
              No constituye asesoramiento jurídico.
            </p>
          </div>

          {/* Page title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Última actualización: {lastUpdated}
          </p>

          {/* Divider */}
          <hr className="my-8 border-slate-100" />

          {/* Sections */}
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.number} aria-labelledby={`section-${section.number}`}>
                <h2
                  id={`section-${section.number}`}
                  className="text-lg font-semibold text-slate-900 mb-3"
                >
                  {section.number}. {section.title}
                </h2>
                <div className="text-slate-700 leading-relaxed text-sm sm:text-base space-y-3">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          {/* Divider */}
          <hr className="my-10 border-slate-100" />

          {/* Cross-links */}
          <nav aria-label="Documentos legales relacionados" className="flex flex-col sm:flex-row gap-4 text-sm">
            <Link to={crossLinkTo} className="text-tiam-blue hover:underline">
              {crossLinkLabel}
            </Link>
            <Link to="/" className="text-tiam-blue hover:underline">
              Volver al inicio
            </Link>
          </nav>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        © 2026 TIAM Digital. Todos los derechos reservados.
      </footer>
    </div>
  )
}
