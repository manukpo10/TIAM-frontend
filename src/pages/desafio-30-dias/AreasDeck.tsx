import { useEffect, useState } from 'react'
import { CalendarCheck, Pause, Play, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAutoCarousel } from '@/hooks/useAutoCarousel'
import { DECK_CARDS } from '@/pages/desafio-30-dias/deckCards'

/**
 * A deck of the Desafío's illustrated cards that flips through the cognitive
 * areas the Desafío works, one at a time. It sits in the Desafío page's hero (a
 * navy band, which is why the disc, the dots and the focus ring are white): to
 * the right of the headline on a wide screen, below it on a phone. What each card
 * may and may not say is in deckCards.ts.
 *
 * It moves on its own, so it follows the carousel rules in useAutoCarousel: a
 * pause button, no autoplay under reduced motion, and a hold while hovered or
 * while keyboard focus is inside.
 */

const ADVANCE_MS = 3500

// Where a card stands, relative to the front one. `exit` is the card that has
// just left: it slides away to the left while it fades, then waits at the back.
const POSITIONS = {
  front: 'z-30 opacity-100',
  next: 'z-20 translate-x-[6%] -translate-y-[8%] rotate-[3deg] scale-[.95] opacity-95',
  next2: 'z-10 translate-x-[12%] -translate-y-[16%] rotate-[6deg] scale-[.9] opacity-75',
  // Before the first render has settled the cards sit hidden behind the front
  // one, so they fan out on load instead of just appearing.
  stacked: 'z-10 opacity-0',
  hidden: 'z-0 translate-x-[12%] -translate-y-[16%] rotate-[6deg] scale-[.88] opacity-0',
  exit: 'z-40 -translate-x-[12%] -rotate-[7deg] scale-[.96] opacity-0',
} as const

function positionFor(i: number, active: number, fanned: boolean): keyof typeof POSITIONS {
  const n = DECK_CARDS.length
  const pos = (i - active + n) % n
  if (pos === 0) return 'front'
  if (pos === n - 1) return 'exit'
  if (pos === 1) return fanned ? 'next' : 'stacked'
  if (pos === 2) return fanned ? 'next2' : 'stacked'
  return 'hidden'
}

export function AreasDeck() {
  const { active, paused, togglePaused, regionProps } = useAutoCarousel(DECK_CARDS.length, ADVANCE_MS)
  const [fanned, setFanned] = useState(false)

  useEffect(() => {
    // Just after the first paint, so the back cards animate from behind the
    // front one. A timer, not requestAnimationFrame: rAF never fires in a
    // background tab (or a hidden webview), which would leave the deck as one
    // lonely card until the tab is shown. Not a direct setState in the effect body either.
    const id = setTimeout(() => setFanned(true), 80)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    // The cards are lazy-loaded below the front one: fetch them now so the
    // first flip never shows an empty card. Not when the deck won't flip on its own.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    DECK_CARDS.slice(1).forEach((card) => {
      const img = new Image()
      img.src = card.src
    })
  }, [])

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Ejercicios del Desafío 30 días, por área cognitiva"
      // isolate: the floating notes use z-50, the same layer as the sticky header — keep
      // them inside this stacking context so they can never paint over it.
      className="relative isolate mx-auto w-full max-w-md"
      {...regionProps}
    >
      {/* Room for the back cards, which are offset up and to the right. */}
      <div className="relative pr-[14%] pt-[10%]">
        {/* Soft light disc behind the deck, to lift it off the navy. */}
        <div aria-hidden="true" className="absolute -right-[4%] top-[2%] h-[78%] w-[78%] rounded-full bg-white/10 blur-2xl" />

        <div className="relative aspect-[900/616] w-full">
          {DECK_CARDS.map((card, i) => {
            const state = positionFor(i, active, fanned)
            return (
              <figure
                key={card.src}
                aria-hidden={i !== active}
                className={cn(
                  // pointer-events-none: the cards aren't interactive, and the invisible
                  // `exit` card sits above the visible one (z-40 over z-30).
                  'pointer-events-none absolute inset-0 overflow-hidden rounded-3xl bg-white shadow-xl shadow-tiam-blue/15 ring-1 ring-slate-200',
                  'motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out',
                  POSITIONS[state],
                )}
              >
                <img
                  src={card.src}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  // The first card is the biggest thing in the Desafío hero on a wide
                  // screen: it is the LCP candidate.
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {/* Top-left, not bottom-left: the "7 ejercicios nuevos" note overhangs the
                    deck's bottom-left corner and would cover every label. */}
                <figcaption className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-1.5 text-sm font-bold text-slate-800 shadow-sm ring-1 ring-slate-200">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: card.color }}
                  />
                  {card.label}
                </figcaption>
              </figure>
            )
          })}
        </div>

        {/* Floating notes over the deck: what you get, at a glance. */}
        <div className="absolute right-0 top-0 z-50 hidden items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-lg ring-1 ring-slate-100 sm:flex">
          <span className="flex" aria-hidden="true">
            {[0, 1, 2].map((s) => (
              <Star key={s} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </span>
          Ganás estrellas jugando
        </div>
        <div className="absolute -bottom-4 left-3 z-50 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-100 sm:-left-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-tiam-orange/10 text-accent-hover">
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-left text-sm font-bold leading-tight text-slate-900">
            7 ejercicios nuevos
            <span className="block font-medium text-slate-600">cada semana</span>
          </span>
        </div>
      </div>

      {/* Pause comes first and is the only interactive control (ARIA APG
          carousel pattern); the dots only show where the deck is. */}
      <div className="mt-9 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={togglePaused}
          aria-label={paused ? 'Reanudar las tarjetas' : 'Pausar las tarjetas'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-tiam-navy"
        >
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
        <div aria-hidden="true" className="flex items-center gap-1.5">
          {DECK_CARDS.map((card, i) => (
            <span
              key={card.src}
              className={cn(
                'block rounded-full bg-white motion-safe:transition-all',
                i === active ? 'h-2.5 w-6' : 'h-2 w-2 opacity-30',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
