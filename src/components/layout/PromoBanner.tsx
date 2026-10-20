import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Pause, Play } from 'lucide-react'
import { useAutoCarousel } from '@/hooks/useAutoCarousel'
import { cn } from '@/lib/utils'

/**
 * The navy strip over the header: what's new at TIAM, one notice at a time. Not sticky on purpose: it scrolls
 * away with the page while the header below takes over the top of the viewport. Site-wide, same on every page
 * that renders PublicHeader.
 *
 * It rotates on its own, so it follows the carousel rules in useAutoCarousel: a pause button (first in the tab
 * order, as in the ARIA carousel pattern), nothing moves for reduced motion, it holds still while hovered or
 * keyboard-focused. Every notice sits in the same grid cell, so the strip is as tall as the longest one and the
 * page never jumps when they swap.
 */

interface Promo {
  id: string
  /** A route of this app (rendered with <Link>), or a page served outside it (a plain <a>). */
  to: string
  external?: boolean
  content: ReactNode
}

// ── data:start ──
const PROMOS: Promo[] = [
  {
    id: 'desafio',
    to: '/desafio-30-dias',
    content: (
      <>
        🎁 Nuevo: <span className="font-bold text-tiam-orange">Desafío 30 días</span> — 7 ejercicios cognitivos por
        semana para tu ser querido, directo por WhatsApp
      </>
    ),
  },
  {
    // Same facts as the Cuadernos card in /material-digital. /cuadernos is a static landing outside this app.
    id: 'cuadernos',
    to: '/cuadernos',
    external: true,
    content: (
      <>
        📚 Nuevo: <span className="font-bold text-tiam-orange">Cuadernos TIAM</span> — 120 ejercicios en 4 cuadernos
        que suben de nivel, para imprimir y hacer solo/a
      </>
    ),
  },
]

/** Long enough to read the notice twice at an unhurried pace. */
const ADVANCE_MS = 7000
// ── data:end ──

export function PromoBanner() {
  const { active, paused, togglePaused, regionProps } = useAutoCarousel(PROMOS.length, ADVANCE_MS)

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Novedades de TIAM"
      className="relative grid bg-tiam-navy text-white"
      {...regionProps}
    >
      <button
        type="button"
        onClick={togglePaused}
        aria-label={paused ? 'Reanudar las novedades' : 'Pausar las novedades'}
        className="absolute right-1.5 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white"
      >
        {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      {PROMOS.map((promo, i) => {
        const isActive = i === active
        // The one leaving fades and drops slightly while the next one comes up; `invisible` keeps a hidden
        // notice out of the tab order and away from screen readers. Tailwind v4: translate-y-* sets the
        // `translate` property, so the transition has to name it.
        const className = cn(
          'col-start-1 row-start-1 block py-2 pl-4 pr-11 text-center text-sm font-medium sm:px-12',
          'hover:bg-white/5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white',
          'motion-safe:transition-[opacity,translate,visibility,background-color] motion-safe:duration-500',
          isActive ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0',
        )
        const body = (
          <>
            {promo.content}
            <ChevronRight className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
          </>
        )
        return promo.external ? (
          <a key={promo.id} href={promo.to} className={className}>
            {body}
          </a>
        ) : (
          <Link key={promo.id} to={promo.to} className={className}>
            {body}
          </Link>
        )
      })}
    </div>
  )
}
