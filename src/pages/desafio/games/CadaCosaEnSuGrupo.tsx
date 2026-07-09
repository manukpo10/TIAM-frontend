import { useCallback, useEffect, useMemo, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

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
    categories: ['Domésticos', 'De granja', 'Salvajes'],
    hint: 'Ahora los tres grupos son animales, pero de tipos distintos. ¡Fijate bien!',
    items: [
      { word: 'gato', category: 'Domésticos' },
      { word: 'perro', category: 'Domésticos' },
      { word: 'hámster', category: 'Domésticos' },
      { word: 'canario', category: 'Domésticos' },
      { word: 'pez dorado', category: 'Domésticos' },
      { word: 'vaca', category: 'De granja' },
      { word: 'oveja', category: 'De granja' },
      { word: 'cerdo', category: 'De granja' },
      { word: 'gallina', category: 'De granja' },
      { word: 'caballo', category: 'De granja' },
      { word: 'león', category: 'Salvajes' },
      { word: 'elefante', category: 'Salvajes' },
      { word: 'jirafa', category: 'Salvajes' },
      { word: 'mono', category: 'Salvajes' },
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

export function CadaCosaEnSuGrupo() {
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

  // Fresh round state whenever the level or round changes.
  useEffect(() => {
    setCurrentIndex(0)
    setSorted({})
    setWrongCategory(null)
  }, [levelIdx, roundKey])

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
        setWrongCategory(null)
      } else {
        setWrongCategory(category)
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

  function nextLevel() {
    if (levelIdx < LEVELS.length - 1) {
      setLevelIdx((i) => i + 1)
    } else {
      setLevelIdx(0)
    }
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setRoundKey((k) => k + 1)
  }

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          Razonamiento · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá el grupo correcto para cada palabra</h2>
        {level.hint && !done && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
        <p className="mt-2 text-base font-semibold text-slate-500">
          Llevás {currentIndex} de {order.length}
        </p>
        <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
            style={{ width: `${(currentIndex / order.length) * 100}%` }}
          />
        </div>
      </div>

      {!done && current && (
        <>
          {/* Current word */}
          <div className="mt-8 text-center">
            <span className="inline-block rounded-2xl border-2 border-slate-200 bg-white px-8 py-5 text-3xl font-extrabold text-slate-800 sm:text-4xl">
              {current.word}
            </span>
          </div>

          {/* Category buttons */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {level.categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleTapCategory(cat)}
                className={[
                  'min-h-[64px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition',
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

          {/* Sorted so far */}
          {level.categories.some((cat) => (sorted[cat]?.length ?? 0) > 0) && (
            <div className="mt-6 flex flex-col gap-2">
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
            <p className="mt-4 text-center text-sm font-medium text-slate-500">
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
