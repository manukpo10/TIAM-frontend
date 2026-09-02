import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionEyebrow } from '@/components/ui/SectionEyebrow'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import tiamLogoFull from '@/assets/logo.png'
import profNeuro from '@/assets/profesionales/neuropsicologia.webp'
import desafioAbuelo from '@/assets/desafio-abuelo.webp'
import tallerFoto from '@/assets/taller/taller-1.jpg'
import tallerHeroFoto from '@/assets/taller/taller-5.jpg'

// ─── Page ────────────────────────────────────────────────────────────────────
// TIAM es una marca con 4 patas: la plataforma para profesionales
// (/plataforma), el Desafío 30 días (/desafio-30-dias), los talleres
// presenciales (/talleres, el origen de TIAM) y un curso futuro (todavía sin
// contenido). Esta página es el hub liviano que bifurca a las 4 — el pitch
// completo de cada producto vive en su propia ruta cuando la tiene.

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
          className="relative overflow-hidden bg-gradient-to-br from-tiam-blue/5 to-slate-50 py-16 md:py-24"
        >
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div className="text-center lg:text-left">
              <img
                src={tiamLogoFull}
                alt="TIAM — taller interactivo adultos mayores"
                className="h-24 w-auto mx-auto lg:mx-0 mb-6"
              />
              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight tracking-tight"
              >
                Estimulación cognitiva, para cada momento.
              </h1>
              <p className="mt-5 text-lg sm:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0">
                TIAM significa Taller Interactivo Adultos Mayores. Nació en un taller presencial en
                La Plata y hoy ayuda a profesionales, familias y futuros especialistas a cuidar la
                memoria y la cognición de los adultos mayores.
              </p>
            </div>

            <div className="aspect-[4/3] overflow-hidden rounded-3xl shadow-xl shadow-tiam-blue/10 ring-1 ring-slate-100">
              <img
                src={tallerHeroFoto}
                alt="Grupo de participantes del taller de TIAM en La Plata, trabajando juntos alrededor de una mesa"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* ── 3-way fork ───────────────────────────────────────────────────── */}
        <section aria-labelledby="fork-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h2 id="fork-heading" className="sr-only">Elegí tu camino en TIAM</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
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

              {/* Talleres personalizados — el origen de TIAM, formato presencial en La Plata */}
              <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm hover:shadow-md transition-[box-shadow] duration-200">
                <img
                  src={tallerFoto}
                  alt=""
                  aria-hidden="true"
                  className="h-28 w-28 rounded-2xl object-cover mb-5"
                />
                <SectionEyebrow text="Talleres personalizados" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  El taller presencial, donde nació TIAM
                </h3>
                <p className="text-slate-600 flex-1">
                  Encuentros grupales en La Plata, guiados en persona y adaptados a cada grupo —
                  el formato original con el que arrancamos, antes de la app y el Desafío.
                </p>
                <Link to="/talleres" className="mt-6">
                  <Button size="lg" className="w-full min-h-[44px]">
                    Conocer los talleres
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

        {/* ── Closing — pointer to /talleres ───────────────────────────────── */}
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
                to="/talleres"
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
