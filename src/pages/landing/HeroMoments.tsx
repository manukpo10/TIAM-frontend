import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAutoCarousel } from '@/hooks/useAutoCarousel'
import desafioHero from '@/assets/desafio-hero.webp'
import espacioImg from '@/assets/taller/personalizado-espacio.webp'
import domicilioImg from '@/assets/taller/personalizado-domicilio.webp'

/**
 * The home hero's visual: TIAM's three live offers as three moments of the day,
 * told with the site's illustrations — "En casa" (Desafío 30 días), "En el
 * taller" (taller presencial) and "En tu domicilio" (talleres personalizados).
 * The scenes cross-fade on their own while the picture drifts slowly, and each
 * one links to its page. The platform for professionals isn't here: it isn't
 * on sale yet, so the hero doesn't promote it.
 *
 * It moves on its own, so it follows the carousel rules in useAutoCarousel: a
 * pause button, no autoplay under reduced motion, and a hold while hovered or
 * while keyboard focus is inside. Picking a scene stops it there.
 */

// ── data:start ──
interface Scene {
  /** Label of the selector pill. */
  moment: string
  /** What it is, shown on the picture. */
  product: string
  src: string
  alt: string
  /** object-position inside the 4:3 frame. */
  position: string
  to: string
  cta: string
}

const SCENES: Scene[] = [
  {
    moment: 'En casa',
    product: 'Desafío 30 días',
    src: desafioHero,
    alt: 'Ilustración de una hija y su mamá sonriendo ante un celular, en el living de casa',
    // The picture is wider than the frame: keep both faces (54-62% of its width) in view.
    position: '66% 40%',
    to: '/desafio-30-dias',
    cta: 'Conocé el Desafío',
  },
  {
    moment: 'En el taller',
    product: 'Taller presencial',
    src: espacioImg,
    alt: 'Ilustración de un taller con personas mayores que trabajan en cuadernos alrededor de una mesa, acompañadas por una tallerista',
    position: '50% 50%',
    to: '/talleres',
    cta: 'Conocé el taller',
  },
  {
    moment: 'En tu domicilio',
    product: 'Talleres personalizados',
    src: domicilioImg,
    alt: 'Ilustración de una tallerista y tres personas mayores que charlan alrededor de una mesa, en un living',
    position: '50% 50%',
    to: '/talleres#personalizados',
    cta: 'Conocé los talleres personalizados',
  },
]

const ADVANCE_MS = 5000
// ── data:end ──

export function HeroMoments() {
  const { active, paused, togglePaused, select, regionProps } = useAutoCarousel(SCENES.length, ADVANCE_MS)
  const scene = SCENES[active]

  useEffect(() => {
    // The other scenes are lazy-loaded and, on a phone, below the fold: fetch them
    // now so the first cross-fade never shows an empty frame. Not when the scenes
    // won't change on their own.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    SCENES.slice(1).forEach((s) => {
      const img = new Image()
      img.src = s.src
    })
  }, [])

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label="Los tres momentos de TIAM: en casa, en el taller y en tu domicilio"
      className="relative isolate mx-auto w-full max-w-xl"
      {...regionProps}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 shadow-2xl shadow-tiam-blue/15 ring-1 ring-slate-200">
        {SCENES.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt={i === active ? s.alt : ''}
            aria-hidden={i !== active}
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
            decoding="async"
            style={{ objectPosition: s.position }}
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              // The scene that arrives fades in over the one that leaves and settles
              // from a slightly closer view (the drift); the one that leaves stays fully
              // opaque until the new one has covered it, then resets out of sight. So
              // no layer is ever half-transparent over the empty frame.
              // `scale`, not `transform`: Tailwind v4's scale-* utilities set the
              // `scale` property, which a `transform` transition doesn't cover.
              i === active
                ? 'z-10 scale-100 opacity-100 motion-safe:[transition:opacity_900ms_ease,scale_6000ms_ease-out]'
                : 'z-0 scale-[1.06] opacity-0 motion-safe:[transition:opacity_0s_linear_900ms,scale_0s_linear_900ms]',
            )}
          />
        ))}

        {/* What you're looking at: one pill per scene, swapped in step with the
            picture (the old one out first, then the new one in). The pills are for
            the eyes only; the text under them is what assistive tech reads, and it
            announces a change only once the scenes have stopped on their own. */}
        <div aria-hidden="true" className="absolute left-4 top-4 z-20 grid">
          {SCENES.map((s, i) => (
            <div
              key={s.moment}
              className={cn(
                'col-start-1 row-start-1 justify-self-start rounded-2xl bg-white/95 px-4 py-2.5 shadow-sm ring-1 ring-slate-200',
                i === active
                  ? 'opacity-100 motion-safe:transition-opacity motion-safe:delay-300 motion-safe:duration-500'
                  : 'opacity-0 motion-safe:transition-opacity motion-safe:duration-300',
              )}
            >
              <p className="text-sm font-bold leading-tight text-slate-900">{s.moment}</p>
              <p className="text-sm text-slate-600">{s.product}</p>
            </div>
          ))}
        </div>
        <p className="sr-only" aria-live={paused ? 'polite' : 'off'} aria-atomic="true">
          {scene.moment}: {scene.product}
        </p>
      </div>

      {/* Pause comes first (ARIA APG carousel pattern), then one pill per scene. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={togglePaused}
          aria-label={paused ? 'Reanudar las escenas' : 'Pausar las escenas'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
        </button>
        {SCENES.map((s, i) => (
          <button
            key={s.moment}
            type="button"
            onClick={() => select(i)}
            aria-current={i === active ? 'true' : undefined}
            className={cn(
              'min-h-11 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              i === active ? 'bg-tiam-blue text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {s.moment}
          </button>
        ))}
      </div>

      <p className="mt-2 text-center">
        <Link
          to={scene.to}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-semibold text-tiam-blue hover:text-tiam-blue-dark focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {scene.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </p>
    </div>
  )
}
