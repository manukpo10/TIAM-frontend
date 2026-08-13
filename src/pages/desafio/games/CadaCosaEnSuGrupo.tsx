import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Boxes } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Cada cosa en su grupo" — a semantic-categorization / set-shifting game.
 *
 * One word at a time, tap the category it belongs to. Deliberately NOT a
 * "tap item, then tap destination" two-phase flow — that would introduce
 * an intermediate "selected" state nothing else in this app uses. A single
 * tap is a single, immediately-verifiable judgment (like BuscarLosRojos'
 * or CazadorDeLetras' target taps), so feedback is live, not a delayed
 * reveal: correct advances to the next word, wrong just flashes and tries
 * again — no penalty, no counter, never blocks progress.
 *
 * L3 reuses the exact same animals from L1/L2 but re-partitions them into
 * finer categories — the same words that were just "Animales" now need a
 * genuine set-shift, not new vocabulary.
 *
 * A one-time "¿Listo?" ready screen (same pattern as Encaminada) gates the
 * START of the day, not every round — `phase` flips to 'playing' once and
 * never resets, not on level-advance, not on "Otra ronda". Its job is
 * layout: the old per-round instructional h2 rendered unconditionally on
 * every round, and below the `sm` breakpoint the category grid collapses
 * to a single column, so nivel 3's 4 stacked 64px buttons plus a growing
 * "sorted so far" recap (up to 20 words across 4 lines by round's end)
 * could overflow a 375×812 viewport. That recap is also capped with its
 * own max-height + internal scroll — unlike Encaminada's fixed board, it's
 * an accumulator that only grows over a round, so bounding just that
 * sub-list (not the whole game) keeps the buttons and current word always
 * reachable without scrolling.
 */

interface CategoryItem {
  word: string
  category: string
}
interface GroupLevel {
  n: number
  name: string
  categories: string[]
  items: CategoryItem[]
  hint?: string
}

const LEVELS: GroupLevel[] = [
  {
    n: 1,
    name: 'Nivel 1',
    categories: ['Frutas', 'Animales'],
    items: [
      { word: 'manzana', category: 'Frutas' },
      { word: 'banana', category: 'Frutas' },
      { word: 'pera', category: 'Frutas' },
      { word: 'naranja', category: 'Frutas' },
      { word: 'frutilla', category: 'Frutas' },
      { word: 'perro', category: 'Animales' },
      { word: 'gato', category: 'Animales' },
      { word: 'caballo', category: 'Animales' },
      { word: 'vaca', category: 'Animales' },
      { word: 'pájaro', category: 'Animales' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    categories: ['Frutas', 'Animales', 'Ropa'],
    items: [
      { word: 'manzana', category: 'Frutas' },
      { word: 'banana', category: 'Frutas' },
      { word: 'pera', category: 'Frutas' },
      { word: 'uva', category: 'Frutas' },
      { word: 'perro', category: 'Animales' },
      { word: 'gato', category: 'Animales' },
      { word: 'caballo', category: 'Animales' },
      { word: 'vaca', category: 'Animales' },
      { word: 'camisa', category: 'Ropa' },
      { word: 'pantalón', category: 'Ropa' },
      { word: 'campera', category: 'Ropa' },
      { word: 'medias', category: 'Ropa' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    categories: ['Domésticos', 'De granja', 'Salvajes', 'Del mar'],
    hint: 'Ahora hay cuatro grupos de animales distintos. ¡Fijate bien en cada uno!',
    items: [
      { word: 'gato', category: 'Domésticos' },
      { word: 'perro', category: 'Domésticos' },
      { word: 'hámster', category: 'Domésticos' },
      { word: 'canario', category: 'Domésticos' },
      { word: 'vaca', category: 'De granja' },
      { word: 'oveja', category: 'De granja' },
      { word: 'cerdo', category: 'De granja' },
      { word: 'gallina', category: 'De granja' },
      { word: 'caballo', category: 'De granja' },
      { word: 'conejo', category: 'De granja' },
      { word: 'león', category: 'Salvajes' },
      { word: 'elefante', category: 'Salvajes' },
      { word: 'jirafa', category: 'Salvajes' },
      { word: 'mono', category: 'Salvajes' },
      { word: 'cebra', category: 'Salvajes' },
      { word: 'delfín', category: 'Del mar' },
      { word: 'ballena', category: 'Del mar' },
      { word: 'tiburón', category: 'Del mar' },
      { word: 'pulpo', category: 'Del mar' },
      { word: 'foca', category: 'Del mar' },
    ],
  },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo!']

export function CadaCosaEnSuGrupo({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [sorted, setSorted] = useState<Record<string, string[]>>({})
  const [wrongCategory, setWrongCategory] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulated across levels 1→2→3, only zeroed on a true day restart (see
  // nextLevel's wrap branch below) — same policy as ElVuelto/CuantosHay,
  // adapted to a per-item (not per-level) natural attempt count: a level
  // here is 10-20 items, not one puzzle, so totalAttempts is mistakes plus
  // every item actually resolved, not "1 per level".
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const current = order[currentIndex]
  const done = currentIndex >= order.length

  const handleTapCategory = useCallback(
    (category: string) => {
      if (!current) return
      if (current.category === category) {
        setSorted((prev) => ({
          ...prev,
          [category]: [...(prev[category] ?? []), current.word],
        }))
        setCurrentIndex((i) => i + 1)
        setCorrectCount((c) => c + 1)
        setWrongCategory(null)
      } else {
        setWrongCategory(category)
        setMistakes((m) => m + 1)
        window.setTimeout(() => setWrongCategory((w) => (w === category ? null : w)), 500)
      }
    },
    [current],
  )

  useEffect(() => {
    if (done) {
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)])
    }
  }, [done])

  // Fires once per roundKey when level 3's last item resolves. Guarded the
  // same way as ElVuelto/CuantosHay (Fase 1): a ref keyed on roundKey, not
  // a boolean, so a genuine full-day restart (new roundKey on wrap) reports
  // again while re-renders on an already-done level 3 do not double-fire.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, correctCount])

  // Resets happen HERE, synchronously with the level/round change — NOT in a
  // separate useEffect keyed on [levelIdx, roundKey] like this file used to
  // have. That effect only caught up on the render AFTER levelIdx changed,
  // so `done` (currentIndex vs. the NEW level's order.length, already
  // updated via useMemo) could read a stale currentIndex left over from the
  // previous level on the very render that just arrived — the same
  // stale-flag hazard the Fase 1 review found and fixed in ElVuelto/
  // CuantosHay. Setting currentIndex/sorted in the same handler that sets
  // levelIdx/roundKey means React batches them into one render, so they're
  // never observably out of sync.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setSorted({})
    setWrongCategory(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulators — "Otra ronda" must NOT, even on level 1.
    if (isWrap) {
      setMistakes(0)
      setCorrectCount(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setSorted({})
    setWrongCategory(null)
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          {level.name}
        </span>
        {phase === 'playing' && !done && (
          <>
            {level.hint && <p className="mt-2 text-base font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(currentIndex / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {/* One-time ready screen — the "how to play" line used to live here as
          an h2 rendered on every round; moving it here is what reclaims the
          space nivel 3 needs at mobile width (see file header). */}
      {phase === 'ready' && (
        <div className="mt-6 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-blue/15">
            <Boxes className="h-6 w-6 text-tiam-blue" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">¿Listo?</p>
          <p className="mt-1 text-slate-600">Tocá el grupo correcto para cada palabra que aparezca.</p>
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === 'playing' && !done && current && (
        <>
          {/* Current word */}
          <div className="mt-6 text-center">
            <span className="inline-block rounded-2xl border-2 border-slate-200 bg-white px-8 py-5 text-3xl font-extrabold text-slate-800 sm:text-4xl">
              {current.word}
            </span>
          </div>

          {/* Category buttons — 56px floor (not 64px): still well above the
              44-48px touch-target minimum, but at mobile width the grid
              collapses to one column (see below `sm`), so nivel 3's 4 stacked
              rows need every pixel they can give back (see file header). */}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {level.categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleTapCategory(cat)}
                className={[
                  'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  wrongCategory === cat
                    ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-red-300 text-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                ].join(' ')}
              >
                {cat}
                {(sorted[cat]?.length ?? 0) > 0 && (
                  <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-tiam-green/15 px-1.5 text-sm font-bold text-tiam-green">
                    {sorted[cat]?.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Sorted so far — its own scroll, not open-ended growth: this is
              the one block in the file that accumulates across an entire
              round (up to 20 words / 4 lines by the end), unlike anything
              fixed-size elsewhere in the game, so it gets a height cap
              instead of pushing the buttons above it off-screen (see file
              header). */}
          {level.categories.some((cat) => (sorted[cat]?.length ?? 0) > 0) && (
            <div className="mt-4 flex max-h-32 flex-col gap-2 overflow-y-auto pr-1">
              {level.categories.map(
                (cat) =>
                  (sorted[cat]?.length ?? 0) > 0 && (
                    <p key={cat} className="text-sm text-slate-500">
                      <span className="font-semibold text-slate-700">{cat}:</span> {sorted[cat]?.join(', ')}
                    </p>
                  ),
              )}
            </div>
          )}

          {wrongCategory && (
            <p className="mt-4 text-center text-base font-medium text-slate-500">
              Ese no va ahí, ¡probá con otro grupo! 🙂
            </p>
          )}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            ¡Agrupaste las {order.length} palabras — completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? 'Siguiente nivel' : 'Empezar de nuevo'}
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={replay}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-4 w-4" />
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
