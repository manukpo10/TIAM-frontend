import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Cuál no va?" — día 11, atención/razonamiento. An odd-one-out game
 * (concept-formation / abstraction): a set of object photos where all but one
 * belong to a shared category — tap the intruder. It replaces the recognition-
 * memory game that día 11 previously ran, which was mechanically identical to
 * día 2 (same study→recall engine, different item set) — a genuine duplicate
 * the reviewing user caught. Odd-one-out is a distinct cognitive task (find the
 * common thread and the exception, not memorize) and it re-uses the photoreal
 * object library built for the other days.
 *
 * Difficulty ramps by how NEAR the intruder's category is: L1 a far domain (a
 * hammer among fruit), L2 an adjacent one (a vegetable among fruit; a food
 * among vessels), L3 a shared abstract property (the one animal that doesn't
 * fly; the one thing that isn't round). On a correct tap the shared category is
 * named ("Las demás son frutas") so the reasoning is reinforced, not just
 * scored.
 *
 * House style: a wrong tap eliminates that photo (muted grey, never red) and
 * nudges; no timer. Double-tap safe (the eliminated set is an idempotent Set
 * add; a resolved round ignores further taps). Content re-rolls per play (pools
 * per level, drawn at random).
 */

interface Puzzle {
  members: string[]
  intruder: string
  categoria: string // named on solve: "Las demás son {categoria}"
}
interface Level {
  n: number
  name: string
  rounds: number
  pool: Puzzle[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    pool: [
      { members: ['manzana', 'banana', 'pera'], intruder: 'martillo', categoria: 'frutas' },
      { members: ['pato', 'tortuga', 'rana'], intruder: 'taza', categoria: 'animales' },
      { members: ['martillo', 'serrucho', 'tijera'], intruder: 'banana', categoria: 'herramientas' },
      { members: ['lapiz', 'cuaderno', 'libro'], intruder: 'gato', categoria: 'cosas de escritorio' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 3,
    pool: [
      { members: ['manzana', 'banana', 'pera', 'uvas'], intruder: 'zanahoria', categoria: 'frutas' },
      { members: ['taza', 'vaso', 'olla', 'mate'], intruder: 'pan', categoria: 'recipientes' },
      { members: ['detergente', 'lavandina', 'esponja', 'jabon'], intruder: 'yogur', categoria: 'cosas de limpieza' },
      { members: ['martillo', 'serrucho', 'destornillador', 'llave-inglesa'], intruder: 'aguja-hilo', categoria: 'herramientas de taller' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 3,
    pool: [
      { members: ['mariposa', 'pato', 'flamenco'], intruder: 'tortuga', categoria: 'animales que vuelan' },
      { members: ['taza', 'vaso', 'mate', 'termo'], intruder: 'florero', categoria: 'cosas para tomar' },
      { members: ['manzana', 'pelota', 'tomate'], intruder: 'libro', categoria: 'cosas redondas' },
      { members: ['martillo', 'destornillador', 'llave-inglesa'], intruder: 'regadera', categoria: 'herramientas de taller' },
    ],
  },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/cual-no-va/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const HINTS = [
  'Ese va con los demás. Buscá el que es de otra clase.',
  'No es ese — fijate qué tienen en común casi todos, y cuál sobra.',
  'Casi. Mirá bien: hay uno que no es del mismo grupo.',
]
const PRAISE = ['¡Muy bien!', '¡Exacto!', '¡Así se razona!', '¡Perfecto!']

export function CualNoVa({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.pool).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const puzzle = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (puzzle ? shuffle([...puzzle.members, puzzle.intruder]) : []), [puzzle])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(id: string) {
    if (!puzzle || solved || eliminated.has(id)) return
    if (id === puzzle.intruder) {
      setSolved(true)
      setHint(null)
      setCorrectCount((c) => c + 1)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
      }, 1100)
    } else {
      setEliminated((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    if (isWrap) {
      setMistakes(0)
      setCorrectCount(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes, correctCount])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <p className="mt-2 text-base font-semibold text-slate-700">Tocá el que NO va con los demás.</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
          </>
        )}
      </div>

      {!done && puzzle && (
        <>
          {/* Opciones (fotos) */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {options.map((id) => {
              const isEliminated = eliminated.has(id)
              const isIntruder = solved && id === puzzle.intruder
              const img = imgFor(id)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(id)}
                  className={[
                    'relative flex h-28 items-center justify-center rounded-2xl border-2 bg-white p-2 transition sm:h-32',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isIntruder ? 'border-tiam-green ring-2 ring-tiam-green/30' : '',
                    isEliminated ? 'border-slate-200 opacity-40 grayscale' : '',
                    !isIntruder && !isEliminated
                      ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                      : '',
                  ].join(' ')}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                </button>
              )
            })}
          </div>

          {solved && (
            <p className="mt-4 text-center text-sm font-semibold text-tiam-green">
              ¡Ese es! Las demás son {puzzle.categoria}.
            </p>
          )}
          {hint && !solved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste los {order.length} intrusos — completaste el nivel {levelIdx + 1}.
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
