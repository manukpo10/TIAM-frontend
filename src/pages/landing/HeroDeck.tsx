import { useEffect, useState } from 'react'
import { CalendarCheck, Pause, Play, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import dia1 from '@/assets/desafio/dia1.webp'
import dia3 from '@/assets/desafio/dia3.webp'
import dia4 from '@/assets/desafio/dia4.webp'
import dia5 from '@/assets/desafio/dia5.webp'
import dia7 from '@/assets/desafio/dia7.webp'
import dia8 from '@/assets/desafio/dia8.webp'
import dia9 from '@/assets/desafio/dia9.webp'
import dia10 from '@/assets/desafio/dia10.webp'
import dia30 from '@/assets/desafio/dia30.webp'

/**
 * The home hero's visual: a deck of the Desafío's illustrated cards that flips
 * through the cognitive areas the Desafío works, one at a time.
 *
 * Each card shows ONLY the area it stands for (the labels and colors are the
 * ones the Desafío's own day grid uses). It never carries a day number or an
 * exercise title: these illustrations were drawn per day before the games were
 * written, so they don't match today's titles, and a caption would promise a
 * game that doesn't exist. The last card is the "you made it" trophy.
 *
 * It moves on its own, so it follows the carousel rules the old photo carousel
 * already followed: a pause button (WCAG 2.2.2), no autoplay for anyone whose
 * OS asks for reduced motion, and pause while hovered on devices with a real
 * pointer or while keyboard focus is inside it.
 */

// ── data:start ──
interface DeckCard {
  src: string
  /** Same label and color as AREA_META in DesafioPlayPage. */
  label: string
  color: string
}

const CARDS: DeckCard[] = [
  { src: dia1, label: 'Orientación', color: '#D97706' },
  { src: dia10, label: 'Memoria', color: '#1B6FC4' },
  { src: dia4, label: 'Lenguaje', color: '#4CA52E' },
  { src: dia5, label: 'Cálculo', color: '#0891B2' },
  { src: dia3, label: 'Reconocimiento', color: '#DB2777' },
  { src: dia8, label: 'Visuoespacial', color: '#7C3AED' },
  { src: dia9, label: 'Razonamiento', color: '#4F46E5' },
  { src: dia7, label: 'Atención', color: '#E8531E' },
  { src: dia30, label: '¡Lo lograste!', color: '#C98A00' },
]

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
  const n = CARDS.length
  const pos = (i - active + n) % n
  if (pos === 0) return 'front'
  if (pos === n - 1) return 'exit'
  if (pos === 1) return fanned ? 'next' : 'stacked'
  if (pos === 2) return fanned ? 'next2' : 'stacked'
  return 'hidden'
}
// ── data:end ──

/** True when the element got focus from the keyboard (not from a tap or a click). */
function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    // Browsers without :focus-visible: treat any focus as keyboard focus.
    return true
  }
}

export function HeroDeck() {
  const [active, setActive] = useState(0)
  const [fanned, setFanned] = useState(false)
  // The only state the pause button's label reflects.
  const [paused, setPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  // Desktop only: on touch screens a tap leaves an emulated mouseenter stuck
  // "on", which froze the deck right after tapping "Reanudar".
  const [canHover] = useState(() => window.matchMedia('(hover: hover)').matches)
  const [hovered, setHovered] = useState(false)
  // Keyboard focus inside the deck also holds it still (ARIA APG): someone tabbing
  // through the page shouldn't have the cards change under them. Only :focus-visible
  // counts, so tapping the pause button on a phone doesn't freeze the deck.
  const [focused, setFocused] = useState(false)

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
    CARDS.slice(1).forEach((card) => {
      const img = new Image()
      img.src = card.src
    })
  }, [])

  useEffect(() => {
    if (paused || hovered || focused) return
    const id = setInterval(() => {
      setActive((i) => (i + 1) % CARDS.length)
    }, ADVANCE_MS)
    return () => clearInterval(id)
  }, [paused, hovered, focused])

  function togglePaused() {
    // An explicit resume moves on right away instead of waiting for the pointer
    // to leave or the focus to move — both still on the deck after the click.
    if (paused) {
      setHovered(false)
      setFocused(false)
    }
    setPaused((p) => !p)
  }

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Ejercicios del Desafío 30 días, por área cognitiva"
      // isolate: the floating notes use z-50, the same layer as the sticky header — keep
      // them inside this stacking context so they can never paint over it.
      className="relative isolate mx-auto w-full max-w-md"
      onMouseEnter={() => {
        if (canHover) setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        if (isKeyboardFocus(e.target)) setFocused(true)
      }}
      onBlur={() => setFocused(false)}
    >
      {/* Room for the back cards, which are offset up and to the right. */}
      <div className="relative pr-[14%] pt-[10%]">
        {/* Soft disc behind the deck, in the logo's blue. */}
        <div
          aria-hidden="true"
          className="absolute -right-[4%] top-[2%] h-[78%] w-[78%] rounded-full bg-tiam-blue/10 blur-2xl"
        />

        <div className="relative aspect-[900/616] w-full">
          {CARDS.map((card, i) => {
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
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {/* Top-left, not bottom-left: the "7 ejercicios nuevos" note overhangs the
                    deck's bottom-left corner and used to cover every label. */}
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
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
        <div aria-hidden="true" className="flex items-center gap-1.5">
          {CARDS.map((card, i) => (
            <span
              key={card.src}
              className={cn(
                'block rounded-full bg-tiam-blue motion-safe:transition-all',
                i === active ? 'h-2.5 w-6' : 'h-2 w-2 opacity-30',
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
