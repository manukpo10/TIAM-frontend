import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionEyebrow } from '@/components/ui/SectionEyebrow'
import { TiamLogo } from '@/components/ui/TiamLogo'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import profNeuro from '@/assets/profesionales/neuropsicologia.webp'
import desafioAbuelo from '@/assets/desafio-abuelo.webp'

// ─── Page ────────────────────────────────────────────────────────────────────
// TIAM es una marca con 3 productos: la plataforma para profesionales
// (/plataforma), el Desafío 30 días (/desafio-30-dias) y un curso futuro
// (todavía sin contenido). Esta página es el hub liviano que bifurca a los
// 3 — el pitch completo de cada producto vive en su propia ruta.

export function LandingPage() {
  useEffect(() => {
    document.title = 'TIAM — Estimulación cognitiva para cada momento'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-dvh bg-white overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-tiam-blue focus:shadow-md focus:ring-2 focus:ring-tiam-blue"
      >
        Ir al contenido principal
      </a>

      <PublicHeader />

      <main id="main-content">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden bg-gradient-to-br from-tiam-blue/5 to-slate-50 py-20 md:py-28"
        >
          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <TiamLogo variant="mark" className="h-16 w-auto mx-auto mb-6" />
            <h1
              id="hero-heading"
              className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight tracking-tight"
            >
              Estimulación cognitiva, para cada momento.
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
              TIAM nació en un taller presencial en La Plata y hoy ayuda a profesionales, familias
              y futuros especialistas a cuidar la memoria y la cognición de los adultos mayores.
            </p>
          </div>
        </section>

        {/* ── 3-way fork ───────────────────────────────────────────────────── */}
        <section aria-labelledby="fork-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 id="fork-heading" className="sr-only">Elegí tu camino en TIAM</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Para profesionales */}
              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-[box-shadow] duration-200">
                <img
                  src={profNeuro}
                  alt=""
                  aria-hidden="true"
                  className="h-28 w-28 rounded-2xl object-cover mb-5"
                />
                <SectionEyebrow text="Para profesionales" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  La plataforma para tu consultorio
                </h3>
                <p className="text-slate-600 flex-1">
                  Biblioteca de ejercicios por área cognitiva, fichas A4 imprimibles, armado de
                  sesiones y seguimiento de pacientes.
                </p>
                <Link to="/plataforma" className="mt-6">
                  <Button size="lg" className="w-full min-h-[44px]">
                    Conocer la plataforma
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Para familias — copy y foto verbatim de la tarjeta puente anterior */}
              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-[box-shadow] duration-200">
                <img
                  src={desafioAbuelo}
                  alt=""
                  aria-hidden="true"
                  className="h-28 w-28 rounded-2xl object-cover mb-5"
                />
                <SectionEyebrow text="Para familias" accent="orange" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  ¿Buscás algo para tu familia, no para tu consultorio?
                </h3>
                <p className="text-slate-600 flex-1">
                  Conocé el Desafío 30 días: un ejercicio cognitivo por día que le llega a tu ser
                  querido directo por WhatsApp. Pago único, sin suscripción.
                </p>
                <Link to="/desafio-30-dias" className="mt-6">
                  <Button
                    size="lg"
                    className="w-full min-h-[44px] bg-tiam-orange text-white hover:bg-tiam-orange/90 focus:ring-tiam-orange"
                  >
                    Conocer el desafío
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              {/* Curso — próximamente, sin link (elemento inerte) */}
              <div className="flex flex-col rounded-3xl border border-dashed border-tiam-blue/30 bg-tiam-blue/5 p-6 sm:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-tiam-blue shadow-sm mb-5">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-tiam-blue">
                    Curso
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Próximamente
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Formate en estimulación cognitiva
                </h3>
                <p className="text-slate-600 flex-1">
                  Muy pronto: formación para quienes quieren especializarse en estimulación
                  cognitiva.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Closing — pointer to /nosotros ─────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-slate-50 border-t border-slate-100">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl font-bold text-slate-900">
              ¿Querés conocer la historia detrás de TIAM?
            </h2>
            <p className="mt-3 text-slate-600">
              Conocé nuestro taller real en La Plata, el lugar donde nació todo.
            </p>
            <div className="mt-6">
              <Link
                to="/nosotros"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-tiam-blue hover:underline"
              >
                Conocer nuestra historia
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
