import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Palabras y colores" — día 18. The Stroop task: nine colour WORDS, each
 * printed in an INK colour that names a different colour (the word "amarillo"
 * written in red). You first read the words aloud, then go back and name the
 * ink colours — and the mismatch makes the second pass genuinely effortful.
 * That interference is the point: the professional asked us to focus above all
 * on making the person THINK, and Stroop is the cleanest "simple to state, hard
 * to do" exercise there is.
 *
 * This is deliberately NOT an interactive tap-game. There is nothing to score
 * on the phone: the person responds out loud, at their own pace, looking at the
 * card. So the day opens with an explicit "hoy es día de papel y lápiz" screen
 * that sets the expectation — today you play OUT LOUD, off the phone's controls
 * — and closes with a single "Ya lo hice" that reports a trivial completion so
 * the day still counts toward the streak and the progress panel. `computeStars`
 * treats totalAttempts === 0 as full accuracy, so participation earns the day
 * without any division-by-zero or fake scoring.
 *
 * Colours are a fixed set of five that all read clearly as BOLD text on white
 * for low-vision readers — red, blue, green, orange, violet. Yellow is
 * deliberately excluded as an ink: it's illegible on white, which for this
 * audience would break the exercise. Every (word, ink) pair is mismatched by
 * construction — see CARD below.
 */

interface Swatch {
  id: string
  label: string
  hex: string
}

// Five inks, each verified to read as bold text on white for older eyes.
const COLORS: Swatch[] = [
  { id: 'rojo', label: 'ROJO', hex: '#DC2626' },
  { id: 'azul', label: 'AZUL', hex: '#2563EB' },
  { id: 'verde', label: 'VERDE', hex: '#15803D' },
  { id: 'naranja', label: 'NARANJA', hex: '#C2410C' },
  { id: 'violeta', label: 'VIOLETA', hex: '#7C3AED' },
]

// Nine (word, ink) pairs. Hand-picked so that: every word's ink names a
// DIFFERENT colour (never "rojo" in red), the five inks are spread evenly, and
// no two adjacent cells share an ink — kept fixed rather than random so the
// grid was eyeballed once and can't hand someone a same-colour pair.
const CARD: { word: string; ink: string }[] = [
  { word: 'rojo', ink: 'azul' },
  { word: 'verde', ink: 'naranja' },
  { word: 'azul', ink: 'violeta' },
  { word: 'naranja', ink: 'verde' },
  { word: 'violeta', ink: 'rojo' },
  { word: 'verde', ink: 'azul' },
  { word: 'rojo', ink: 'naranja' },
  { word: 'azul', ink: 'verde' },
  { word: 'naranja', ink: 'rojo' },
]

const hexOf = (id: string) => COLORS.find((c) => c.id === id)?.hex ?? '#1e293b'
const labelOf = (id: string) => COLORS.find((c) => c.id === id)?.label ?? id.toUpperCase()

type Phase = 'intro' | 'card' | 'done'

export function PalabrasYColores({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('intro')

  // Reports exactly once, when the person taps "Ya lo hice". There's no score
  // to compute — this is an off-phone spoken exercise — so it reports a trivial
  // completion; computeStars treats totalAttempts === 0 as full accuracy, so
  // the day counts (3 estrellas por participar) without dividing by zero.
  const reportedRef = useRef(false)
  useEffect(() => {
    if (phase === 'done' && !reportedRef.current) {
      reportedRef.current = true
      onComplete({ mistakes: 0, totalAttempts: 0 })
    }
  }, [phase, onComplete])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {phase === 'intro' && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
            Hoy es día de papel y lápiz
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">
            Hoy no se toca la pantalla: se juega en voz alta.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-base text-slate-600">
            En la tarjeta vas a ver nueve palabras. Cada una es el nombre de un color, pero está escrita con un color
            distinto. Es un ejercicio simple que hace pensar de verdad.
          </p>
          <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-400">Cómo se juega</p>
            <ol className="mt-2 space-y-2 text-base text-slate-700">
              <li>
                <span className="font-bold text-tiam-blue">1.</span> Primero leé en voz alta las{' '}
                <span className="font-bold">palabras</span>, una por una.
              </li>
              <li>
                <span className="font-bold text-tiam-blue">2.</span> Después volvé a empezar y ahora decí el{' '}
                <span className="font-bold">color</span> con el que está escrita cada una — no lo que dice la palabra.
              </li>
            </ol>
          </div>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setPhase('card')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Ver la tarjeta
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {phase === 'card' && (
        <div className="text-center">
          {/* Recordatorio corto arriba, para quien pasó rápido la intro. */}
          <p className="text-sm font-semibold text-slate-500">
            Primero las <span className="font-bold text-slate-700">palabras</span>. Después, de nuevo, los{' '}
            <span className="font-bold text-slate-700">colores</span>.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 rounded-3xl border-2 border-slate-100 bg-white px-2 py-6 sm:gap-y-7 sm:py-8">
            {CARD.map((cell, i) => (
              <span
                key={i}
                className="select-none text-lg font-extrabold leading-none tracking-tight sm:text-2xl"
                style={{ color: hexOf(cell.ink) }}
              >
                {labelOf(cell.word)}
              </span>
            ))}
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setPhase('done')}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              Ya lo hice
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="mt-2 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-8 w-8 text-tiam-green" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">¡Muy bien!</p>
          <p className="mt-2 text-base text-slate-600">
            Nombrar el color en vez de leer la palabra cuesta más de lo que parece — tu cabeza tuvo que frenar lo
            automático y pensar. Ese esfuerzo es justamente el ejercicio.
          </p>
        </div>
      )}
    </div>
  )
}
