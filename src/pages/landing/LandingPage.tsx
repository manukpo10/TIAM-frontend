import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, GraduationCap } from 'lucide-react'
import { SectionEyebrow } from '@/components/ui/SectionEyebrow'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'
import { cn } from '@/lib/utils'
import profNeuro from '@/assets/profesionales/neuropsicologia.webp'
import desafioAbuelo from '@/assets/desafio-abuelo.webp'
import tallerGrupal from '@/assets/taller/taller-grupal.webp'
import materialMesa from '@/assets/material-digital/material-mesa.webp'
import { HeroMoments } from '@/pages/landing/HeroMoments'

// Links styled as buttons rather than <Link><Button/></Link>: a button nested
// inside an anchor is invalid HTML and costs keyboard users two tab stops per CTA.
// outline-hidden, not outline-none: in Tailwind v4 outline-none removes the
// outline entirely, and the box-shadow ring is dropped in Windows high-contrast
// mode — leaving keyboard users there with no focus indicator at all.
const CTA_BASE =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2'
const CTA_VARIANTS = {
  // accent-hover (#CC4516), not tiam-orange: white on #E8531E is 3.69:1 and
  // fails WCAG AA at body size; #CC4516 is 4.74:1.
  orange: 'bg-accent-hover text-white hover:bg-orange-800 focus-visible:ring-tiam-orange',
  blue: 'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary',
  outline: 'border border-slate-200 bg-white text-tiam-blue hover:bg-slate-50 focus-visible:ring-primary',
}

// ─── Paths ───────────────────────────────────────────────────────────────────
// Available products first, coming-soon last. Families lead and are the only
// highlighted card: the Desafío is what's on sale today (the announcement bar
// pushes it too). Every bullet is a claim already made on that product's own
// page — nothing here is new copy.

interface Path {
  eyebrow: string
  eyebrowAccent?: 'blue' | 'orange'
  title: string
  description: string
  bullets: string[]
  image: string
  imagePosition: string
  featured?: boolean
  // Absent on a coming-soon path: there's nothing to send people to yet.
  link?: { cta: string; to: string; variant: keyof typeof CTA_VARIANTS }
}

const PATHS: Path[] = [
  {
    eyebrow: 'Para familias',
    eyebrowAccent: 'orange',
    title: 'Desafío 30 días',
    description: 'Ejercicios cognitivos que le llegan a tu ser querido por WhatsApp, para hacer en casa a su ritmo.',
    bullets: ['7 ejercicios nuevos por semana', 'Sin apps: se abren desde WhatsApp', 'Pago único, sin suscripción'],
    // Not desafio-hero: the hero's first scene already shows it, a screen above.
    image: desafioAbuelo,
    imagePosition: '50% 35%',
    featured: true,
    link: { cta: 'Conocer el Desafío', to: '/desafio-30-dias', variant: 'orange' },
  },
  {
    eyebrow: 'Taller presencial',
    title: 'El taller donde nació TIAM',
    description: 'Encuentros grupales en La Plata, coordinados en persona por una tallerista cognitiva.',
    bullets: ['Encuentros todas las semanas', 'Dos sedes en La Plata', 'Grupos reducidos'],
    // An illustration like the other cards': the real photos of the taller live on /talleres.
    image: tallerGrupal,
    imagePosition: '50% 45%',
    link: { cta: 'Conocer el taller', to: '/talleres', variant: 'blue' },
  },
  {
    eyebrow: 'Material digital',
    title: 'Fichas para imprimir',
    description: 'Material de estimulación cognitiva en PDF, con una guía paso a paso y las respuestas.',
    bullets: ['Pack Básico: 120 fichas en 4 áreas y 3 niveles', 'Letra grande, listas para imprimir', 'Para familias y para profesionales'],
    image: materialMesa,
    imagePosition: '50% 50%',
    link: { cta: 'Ver el material', to: '/material-digital', variant: 'blue' },
  },
  {
    eyebrow: 'Para profesionales',
    title: 'Plataforma para tu consultorio',
    description: 'Las herramientas para planificar y llevar tus sesiones de estimulación cognitiva.',
    bullets: ['Biblioteca de ejercicios por área cognitiva', 'Fichas A4 listas para imprimir', 'Sesiones y seguimiento de pacientes'],
    image: profNeuro,
    imagePosition: '50% 25%',
  },
]

function PathCard({ path }: { path: Path }) {
  const comingSoon = !path.link
  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm',
        comingSoon
          ? 'border border-dashed border-slate-300'
          : 'transition-shadow duration-200 hover:shadow-xl',
        !comingSoon && (path.featured ? 'ring-2 ring-tiam-orange/60' : 'ring-1 ring-slate-200'),
      )}
    >
      <div className="relative h-52 overflow-hidden lg:h-64">
        <img
          src={path.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={cn(
            'h-full w-full object-cover',
            !comingSoon && 'motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105',
          )}
          style={{ objectPosition: path.imagePosition }}
        />
        {path.featured && (
          <span className="absolute left-4 top-4 rounded-full bg-accent-hover px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
            Nuevo
          </span>
        )}
        {comingSoon && (
          <span className="absolute left-4 top-4 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 shadow">
            Próximamente
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div>
          <SectionEyebrow text={path.eyebrow} accent={path.eyebrowAccent} />
        </div>
        <h3 className="text-2xl font-bold text-slate-900">{path.title}</h3>
        <p className="mt-2 leading-relaxed text-slate-600">{path.description}</p>
        <ul className="mb-7 mt-5 space-y-2.5">
          {path.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5 text-slate-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-tiam-green" aria-hidden="true" />
              {bullet}
            </li>
          ))}
        </ul>
        {path.link ? (
          // The ::after overlay stretches this link across the whole card, so
          // the entire card is one big tap target with a single tab stop.
          <Link
            to={path.link.to}
            className={cn(
              CTA_BASE,
              CTA_VARIANTS[path.link.variant],
              'mt-auto w-full after:absolute after:inset-0',
            )}
          >
            {path.link.cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          // Plain text, not a disabled button: nothing here is interactive.
          <p className="mt-auto flex min-h-[48px] w-full items-center justify-center rounded-xl bg-slate-50 px-6 py-3 text-base font-semibold text-slate-600">
            Próximamente
          </p>
        )}
      </div>
    </article>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
// TIAM es una marca con 5 patas: el Desafío 30 días (/desafio-30-dias), los
// talleres presenciales (/talleres, el origen de TIAM), el material digital
// (/material-digital: la biblioteca de productos para imprimir; cada producto
// tiene su propia landing, fuera de esta app), la plataforma para
// profesionales (/plataforma — próximamente, por eso su tarjeta no tiene link
// y no hay botón "Soy profesional" en el hero) y un curso futuro (sin
// contenido todavía, por eso va como una línea y no como una tarjeta). El
// pitch completo de cada producto vive en su propia ruta.

export function LandingPage() {
  useEffect(() => {
    document.title = 'TIAM — Estimulación cognitiva para cada momento'
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="min-h-dvh bg-white overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-tiam-blue focus:shadow-md focus:ring-2 focus:ring-tiam-blue"
      >
        Ir al contenido principal
      </a>

      <PublicHeader />

      <main id="main-content">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        {/* overflow-clip, not overflow-hidden: the background blobs overhang
            the section, and overflow-hidden still makes it a (scrollbar-less)
            scroll container — scrollIntoView or a drag-select could nudge the
            whole hero sideways with no way back. clip never scrolls. */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-clip bg-gradient-to-br from-tiam-blue/[0.07] via-slate-50 to-white pt-12 pb-24 md:pt-20 md:pb-32"
        >
          {/* The three colors of the logo's figures, blurred into the background. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-tiam-orange/15 blur-3xl" />
            <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-tiam-blue/10 blur-3xl" />
            <div className="absolute bottom-0 right-1/3 h-64 w-64 rounded-full bg-tiam-green/10 blur-3xl" />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-12 lg:items-center">
            <div className="text-center lg:text-left">
              <SectionEyebrow text="Estimulación cognitiva · La Plata" />
              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl font-bold text-slate-900 leading-[1.1] tracking-tight text-balance"
              >
                {/* Inline, not block: forcing the second half onto its own line left a
                    4-line headline in the narrow lg column; text-balance evens it out. */}
                Mantené la mente activa, <span className="text-tiam-blue">a tu manera.</span>
              </h1>
              {/* slate-700, not 600: over the blue background blob, 600 measured
                  4.48:1 on mobile — just under AA's 4.5. */}
              <p className="mt-6 text-lg sm:text-xl leading-relaxed text-slate-700 max-w-xl mx-auto lg:mx-0 text-pretty">
                Ejercicios por WhatsApp para hacer en casa, un taller presencial en La Plata y talleres
                personalizados, en nuestro espacio o en tu domicilio.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link to="/desafio-30-dias" className={cn(CTA_BASE, CTA_VARIANTS.orange)}>
                  Conocé el Desafío 30 días
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/talleres" className={cn(CTA_BASE, CTA_VARIANTS.outline)}>
                  Conocé los talleres
                </Link>
              </div>
              {/* Every line is a claim the site already makes on the page of that product. */}
              <ul className="mt-8 flex flex-col items-center gap-x-6 gap-y-2 text-base text-slate-700 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                {[
                  'Nació en un taller real de La Plata',
                  'Talleres coordinados por una tallerista cognitiva',
                  'Desafío sin suscripción: pago único',
                ].map((proof) => (
                  <li key={proof} className="flex items-center gap-2">
                    <Check className="h-5 w-5 shrink-0 text-tiam-green" aria-hidden="true" />
                    {proof}
                  </li>
                ))}
              </ul>
            </div>

            <HeroMoments />
          </div>

          {/* A soft curve into the next section: the hero doesn't end on a hard edge. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 64"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 block h-8 w-full fill-white sm:h-12 md:h-16"
          >
            <path d="M0 40 C240 72 480 8 720 32 C960 56 1200 12 1440 40 L1440 64 L0 64 Z" />
          </svg>
        </section>

        {/* ── Paths ────────────────────────────────────────────────────────── */}
        <section aria-labelledby="paths-heading" className="py-16 md:py-24 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <SectionEyebrow text="Para cada momento" />
              <h2 id="paths-heading" className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                Elegí por dónde empezar
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                Un mismo objetivo, mantener la mente activa, en el formato que mejor te quede.
              </p>
            </div>

            <div className="mx-auto grid max-w-xl gap-6 md:max-w-none md:grid-cols-2">
              {PATHS.map((path) => (
                <PathCard key={path.title} path={path} />
              ))}
            </div>

            <p className="mt-10 flex items-center justify-center gap-2 text-center text-slate-600">
              <GraduationCap className="h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
              <span>
                <span className="font-semibold text-slate-800">Próximamente:</span> un curso de formación
                en estimulación cognitiva.
              </span>
            </p>
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
