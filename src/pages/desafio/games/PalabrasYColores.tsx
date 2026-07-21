import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Palabras y colores" — día 18. The Stroop task: colour WORDS each printed in
 * an INK colour that names a different colour (the word "amarillo" written in
 * red). You first read the words aloud, then go back and name the ink colours —
 * and the mismatch makes the second pass genuinely effortful. That interference
 * is the point: the professional asked us to focus above all on making the
 * person THINK, and Stroop is the cleanest "simple to state, hard to do"
 * exercise there is.
 *
 * Three levels, one card each, escalating the way Stroop naturally does — more
 * words and more distinct ink colours per card (6 words / 3 colours → 9 / 4 →
 * 12 / 5). More response options and more items is harder to hold and to name.
 *
 * This is deliberately NOT an interactive tap-game. There is nothing to score
 * on the phone: the person responds out loud, at their own pace, looking at the
 * card. So the day opens with an explicit "hoy es día de papel y lápiz" screen
 * and closes, after the third card, with a single "Ya lo hice" that reports a
 * trivial completion so the day still counts toward the streak. `computeStars`
 * treats totalAttempts === 0 as full accuracy, so participation earns the day
 * without any division-by-zero or fake scoring.
 *
 * Colours are five that all read clearly as BOLD text on white for low-vision
 * readers — red, blue, green, orange, violet. Yellow is deliberately excluded
 * as an ink: it's illegible on white, which for this audience would break the
 * exercise. Every (word, ink) pair is mismatched by construction.
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

interface Level {
  n: number
  name: string
  cellCount: number
  colorCount: number
}

// The ramp is word count and colour count: 6/3 → 9/4 → 12/5. Cards are
// GENERATED per open (see buildCells) instead of hand-fixed: incongruence is
// guaranteed by construction (the ink is drawn from the palette MINUS the
// word's own colour, so a same-colour freebie is impossible — the original
// reason for hand-fixing), and a fresh card every open means replaying the
// day never shows the same grid twice.
const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', cellCount: 6, colorCount: 3 }, // rojo, azul, verde
  { n: 2, name: 'Nivel 2', cellCount: 9, colorCount: 4 }, // + naranja
  { n: 3, name: 'Nivel 3', cellCount: 12, colorCount: 5 }, // + violeta
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Builds one all-incongruent Stroop card. Words are dealt from shuffled cycles
 * of the palette (so every colour word appears evenly, same property the
 * hand-fixed cards had); each ink is drawn from the palette excluding the
 * word's own colour (incongruence by construction) and the previous cell's
 * ink (no same-ink runs, which would let the reader coast). With ≥3 colours,
 * excluding at most 2 always leaves an option — this can't deadlock.
 */
function buildCells(cellCount: number, colorCount: number): { word: string; ink: string }[] {
  const palette = COLORS.slice(0, colorCount).map((c) => c.id)
  const words: string[] = []
  while (words.length < cellCount) words.push(...shuffle(palette))
  words.length = cellCount
  const cells: { word: string; ink: string }[] = []
  for (let i = 0; i < cellCount; i++) {
    const word = words[i]
    const options = palette.filter((p) => p !== word && p !== cells[i - 1]?.ink)
    cells.push({ word, ink: options[Math.floor(Math.random() * options.length)] })
  }
  return cells
}

const hexOf = (id: string) => COLORS.find((c) => c.id === id)?.hex ?? '#1e293b'
const labelOf = (id: string) => COLORS.find((c) => c.id === id)?.label ?? id.toUpperCase()

type Phase = 'intro' | 'card' | 'done'

export function PalabrasYColores({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [levelIdx, setLevelIdx] = useState(0)
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1

  // Fresh card per level per open — reopening the day generates new grids.
  const cells = useMemo(
    () => buildCells(level.cellCount, level.colorCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx],
  )

  // Reports exactly once, when the person finishes the third card. There's no
  // score to compute — this is an off-phone spoken exercise — so it reports a
  // trivial completion; computeStars treats totalAttempts === 0 as full accuracy,
  // so the day counts (3 estrellas por participar) without dividing by zero.
  const reportedRef = useRef(false)
  useEffect(() => {
    if (phase === 'done' && !reportedRef.current) {
      reportedRef.current = true
      onComplete({ mistakes: 0, totalAttempts: 0 })
    }
  }, [phase, onComplete])

  function nextCard() {
    if (isLast) setPhase('done')
    else setLevelIdx((i) => i + 1)
  }

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
            Vas a ver tarjetas con palabras. Cada palabra es el nombre de un color, pero está escrita con un color
            distinto. Son tres tarjetas, cada una un poco más difícil.
          </p>
          <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-400">En cada tarjeta</p>
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
              Ver la primera tarjeta
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {phase === 'card' && (
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
            {level.name} · Tarjeta {levelIdx + 1} de {LEVELS.length}
          </span>
          {/* Recordatorio corto, para quien pasó rápido la intro. */}
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Primero las <span className="font-bold text-slate-700">palabras</span>. Después, de nuevo, los{' '}
            <span className="font-bold text-slate-700">colores</span>.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 rounded-3xl border-2 border-slate-100 bg-white px-2 py-5 sm:gap-y-6 sm:py-6">
            {cells.map((cell, i) => (
              <span
                key={i}
                className="select-none text-lg font-extrabold leading-none tracking-tight sm:text-2xl"
                style={{ color: hexOf(cell.ink) }}
              >
                {labelOf(cell.word)}
              </span>
            ))}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={nextCard}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
            >
              {isLast ? 'Ya lo hice' : 'Siguiente tarjeta'}
              {!isLast && <ArrowRight className="h-4 w-4" />}
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
