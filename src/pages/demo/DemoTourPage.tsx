import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ImageOff, ZoomIn, X } from 'lucide-react'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { Button } from '@/components/ui/Button'

// ─── Guided product tour with real (annotated) dashboard screenshots. ─────────
// Screenshots live in src/assets/demo/<slug>.(png|webp) and are resolved by slug.
// Until a screenshot is added, the step shows a "captura pendiente" placeholder.
// IMPORTANT: screenshots must use DEMO data — never real patient information.

const screenshots = import.meta.glob('../../assets/demo/*.{png,webp,jpg}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

function shotFor(slug: string): string | undefined {
  const entry = Object.entries(screenshots).find(([path]) =>
    /([^/]+)\.(png|webp|jpg)$/.exec(path)?.[1] === slug,
  )
  return entry?.[1]
}

interface Step {
  slug: string
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    slug: 'biblioteca',
    title: 'Una biblioteca curada por área y nivel',
    description:
      'Filtrá ejercicios por área cognitiva, nivel de dificultad y tipo de material. Encontrás en segundos lo que antes llevaba horas de búsqueda entre PDFs sueltos.',
  },
  {
    slug: 'ficha',
    title: 'Fichas listas para imprimir',
    description:
      'Cada ejercicio se genera en formato A4 listo para imprimir y trabajar en la sesión. Sin armar nada a mano ni perder tiempo con el formato.',
  },
  {
    slug: 'pacientes',
    title: 'Todos tus pacientes en un solo lugar',
    description:
      'Gestioná tu registro de pacientes con su información y el historial completo de sesiones, ordenado y siempre a mano.',
  },
  {
    slug: 'progreso',
    title: 'Seguimiento del progreso clínico',
    description:
      'Visualizá la adherencia —con qué frecuencia viene cada paciente— y la cobertura cognitiva —qué áreas trabajaste y cuáles faltan— a lo largo del tiempo.',
  },
  {
    slug: 'sesion',
    title: 'Armá la sesión en minutos',
    description:
      'Seleccioná ejercicios, ordenálos y dejá la sesión lista. Registrás lo trabajado en cada encuentro para ver la evolución del paciente.',
  },
]

function ScreenFrame({ step, onZoom }: { step: Step; onZoom: (src: string, alt: string) => void }) {
  const src = shotFor(step.slug)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
      {/* Fake browser top bar */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
      </div>
      {src ? (
        <button
          type="button"
          onClick={() => onZoom(src, step.title)}
          className="group relative block w-full cursor-zoom-in"
          aria-label={`Ampliar captura: ${step.title}`}
        >
          <img src={src} alt={step.title} className="block w-full" />
          {/* Hover hint */}
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-900/70 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            Ampliar
          </span>
        </button>
      ) : (
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-3 bg-slate-50 text-slate-400">
          <ImageOff className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm font-medium">Captura pendiente</p>
          <p className="text-xs">
            src/assets/demo/<span className="font-mono">{step.slug}</span>.png
          </p>
        </div>
      )}
    </div>
  )
}

export function DemoTourPage() {
  const [current, setCurrent] = useState(0)
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'Demo guiada — TIAM Digital'
  }, [])

  // Close the lightbox on Escape and lock body scroll while open.
  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(null)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [zoom])

  const step = STEPS[current]
  const isFirst = current === 0
  const isLast = current === STEPS.length - 1

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Intro */}
        <section className="border-b border-slate-100 bg-gradient-to-b from-tiam-blue/5 to-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 md:py-16 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Demo guiada</p>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              Mirá cómo funciona TIAM por dentro
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-slate-600 leading-relaxed">
              Un recorrido por las pantallas del tablero del profesional, paso a paso. Sin registro.
            </p>
          </div>
        </section>

        {/* Stepper */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            {/* Screenshot */}
            <ScreenFrame step={step} onZoom={(src, alt) => setZoom({ src, alt })} />

            {/* Step copy + nav */}
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <span>Paso {current + 1}</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-400">{STEPS.length}</span>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 leading-snug">{step.title}</h2>
              <p className="mt-3 text-[17px] leading-relaxed text-slate-600">{step.description}</p>

              {/* Prev / Next */}
              <div className="mt-8 flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={isFirst}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Anterior
                </Button>
                {isLast ? (
                  <Link to="/register">
                    <Button size="md">Probá TIAM gratis</Button>
                  </Link>
                ) : (
                  <Button size="md" onClick={() => setCurrent((c) => Math.min(STEPS.length - 1, c + 1))}>
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Step dots */}
              <div className="mt-6 flex gap-2" role="tablist" aria-label="Pasos de la demo">
                {STEPS.map((s, i) => (
                  <button
                    key={s.slug}
                    type="button"
                    role="tab"
                    aria-selected={i === current}
                    aria-label={`Paso ${i + 1}: ${s.title}`}
                    onClick={() => setCurrent(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === current ? 'w-8 bg-primary' : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-14 rounded-2xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
            <p className="font-semibold text-slate-900">¿Te gustó lo que viste?</p>
            <p className="mt-1 text-slate-600">Empezá a usar TIAM con tus pacientes hoy mismo.</p>
            <div className="mt-4 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/register">
                <Button size="md">Probá gratis 7 días</Button>
              </Link>
              <Link to="/preguntas-frecuentes">
                <Button variant="secondary" size="md">Ver preguntas frecuentes</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Lightbox */}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Captura ampliada: ${zoom.alt}`}
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/85 p-4 sm:p-8"
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={zoom.src}
            alt={zoom.alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-lg shadow-2xl object-contain cursor-default"
          />
        </div>
      )}

      <PublicFooter />
    </div>
  )
}
