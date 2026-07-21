import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Lightbulb } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Deducí la palabra" — día 10, ejecutivas. A deduction-by-elimination game
 * (inspired by a competitor worksheet TYPE; content ours): a list of words and
 * a set of clues about ONE of them (letter count, accent, ending, vowel count,
 * first-letter alphabet range, a contained letter). Exactly one word satisfies
 * ALL the clues — the player finds it by ruling the others out. It's deductive
 * reasoning applied to word structure (metalinguistic), a mechanic the
 * challenge didn't have, and it replaces a memory game to ease the
 * memory-heavy area balance the reviewing professional flagged.
 *
 * Every puzzle's answer was verified offline to be the UNIQUE word in its list
 * that meets all clues (scratchpad/deduci.py) — no puzzle can be solved by two
 * words, so a "wrong" tap is always genuinely wrong. Reference material carries
 * such errors; ours is checked, not trusted.
 *
 * House style: a wrong tap eliminates that option (muted grey, never red) and
 * nudges back to the clues — the deductive equivalent of re-reading. No timer.
 * Double-tap safe: the eliminated set is an idempotent Set add, and a resolved
 * round ignores further taps.
 */

interface Puzzle {
  clues: string[]
  answer: string
  options: string[]
}
interface Level {
  n: number
  name: string
  rounds: number
  pool: Puzzle[]
}

// Puzzles verified unique offline (scratchpad/deduci.py). A pool per level,
// drawn at random per play, so reopening the day serves different ones.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    rounds: 2,
    pool: [
      { answer: 'TRAGO', clues: ['Tiene 5 letras', 'Termina en vocal', 'La primera letra está entre la Q y la Z'], options: ['TRAGO', 'NOCHE', 'SALMÓN', 'GIRA', 'BRAZOS'] },
      { answer: 'NUBE', clues: ['Tiene 4 letras', 'Contiene la letra U', 'La primera letra está entre la M y la Z'], options: ['NUBE', 'LUNA', 'ROSA', 'GATO', 'PINO'] },
      { answer: 'PERRO', clues: ['Tiene 5 letras', 'Contiene la letra O', 'La primera letra está entre la M y la R'], options: ['PERRO', 'GANSO', 'ZORRO', 'CABRA', 'TIGRE'] },
      { answer: 'MESA', clues: ['Tiene 4 letras', 'Termina en vocal', 'No lleva acento'], options: ['MESA', 'SILLA', 'SOFÁ', 'BANCO', 'ARMARIO'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    rounds: 3,
    pool: [
      { answer: 'CAMINO', clues: ['Tiene 6 letras', 'Tiene 3 vocales', 'Termina en vocal', 'Contiene la letra I'], options: ['CAMINO', 'SENDA', 'RUTA', 'PUENTE', 'CALLE', 'ATAJO'] },
      { answer: 'VENTANA', clues: ['Tiene 7 letras', 'Tiene 3 vocales', 'Termina en vocal', 'No lleva acento'], options: ['VENTANA', 'PUERTA', 'TECHO', 'PARED', 'PISO', 'BALCÓN'] },
      { answer: 'PÁJARO', clues: ['Tiene 6 letras', 'Lleva acento', 'Termina en vocal', 'La primera letra está entre la M y la Z'], options: ['PÁJARO', 'PALOMA', 'GORRIÓN', 'HORNERO', 'TUCÁN', 'LORO'] },
      { answer: 'CUCHARA', clues: ['Tiene 7 letras', 'Tiene 3 vocales', 'Termina en vocal', 'Contiene la letra H'], options: ['CUCHARA', 'TENEDOR', 'CUCHILLO', 'PLATO', 'VASO', 'JARRA'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    rounds: 3,
    pool: [
      { answer: 'MARIPOSA', clues: ['Tiene 8 letras', 'Tiene 4 vocales', 'Termina en vocal', 'No lleva acento', 'Contiene la letra R'], options: ['MARIPOSA', 'LIBÉLULA', 'HORMIGA', 'ABEJA', 'MOSQUITO', 'GRILLO', 'ARAÑA'] },
      { answer: 'ZANAHORIA', clues: ['Tiene 9 letras', 'Tiene 5 vocales', 'Termina en vocal', 'No lleva acento'], options: ['ZANAHORIA', 'TOMATE', 'LECHUGA', 'ESPINACA', 'CEBOLLA', 'MORRÓN', 'ACELGA'] },
      { answer: 'TELÉFONO', clues: ['Tiene 8 letras', 'Lleva acento', 'Tiene 4 vocales', 'Termina en vocal', 'La primera letra está entre la Q y la Z'], options: ['TELÉFONO', 'CELULAR', 'PANTALLA', 'TECLADO', 'CARGADOR', 'AURICULAR', 'RADIO'] },
      { answer: 'ALMOHADA', clues: ['Tiene 8 letras', 'Tiene 4 vocales', 'Termina en vocal', 'No lleva acento', 'Contiene la letra H'], options: ['ALMOHADA', 'FRAZADA', 'SÁBANA', 'COLCHÓN', 'MANTA', 'EDREDÓN', 'CORTINA'] },
    ],
  },
]
// Every round resolves with one correct tap (no give-up), so totalAttempts is
// derived at report time as mistakes + correctCount.

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
  'Esa no cumple todas las pistas — repasá y descartá.',
  'No es esa. Volvé a las pistas y fijate cuál las cumple todas.',
  'Casi. Revisá las pistas una por una.',
]
const PRAISE = ['¡Muy bien!', '¡Excelente deducción!', '¡Así se razona!', '¡Perfecto!']

export function DeduciLaPalabra({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  // `rounds` puzzles from the level's pool, at random, no repeat within a level.
  const order = useMemo(
    () => shuffle(level.pool).slice(0, level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  const [mistakes, setMistakes] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  const puzzle = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (puzzle ? shuffle(puzzle.options) : []), [puzzle])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(word: string) {
    if (!puzzle || solved || eliminated.has(word)) return
    if (word === puzzle.answer) {
      setSolved(word)
      setHint(null)
      setCorrectCount((c) => c + 1)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(null)
      }, 650)
    } else {
      // Idempotent add → a same-batch double tap can't double-count.
      setEliminated((prev) => (prev.has(word) ? prev : new Set(prev).add(word)))
      setHint(pickOne(HINTS))
      setMistakes((m) => m + 1)
    }
  }

  // Synchronous resets in the handler (never a [levelIdx]-keyed effect).
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(null)
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
    setSolved(null)
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
            <p className="mt-2 text-sm font-medium text-tiam-blue">
              Una sola palabra cumple TODAS las pistas. Descartá y encontrala.
            </p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
          </>
        )}
      </div>

      {!done && puzzle && (
        <>
          {/* Pistas */}
          <div className="mt-4 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Lightbulb className="h-3.5 w-3.5" />
              Pistas
            </p>
            <ul className="mt-2 space-y-1.5">
              {puzzle.clues.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-base leading-snug text-slate-700">
                  <span className="mt-0.5 font-bold text-tiam-blue">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Opciones */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {options.map((word) => {
              const isEliminated = eliminated.has(word)
              const isSolved = solved === word
              return (
                <button
                  key={word}
                  type="button"
                  disabled={solved !== null || isEliminated}
                  onClick={() => guess(word)}
                  className={[
                    'min-h-[52px] rounded-2xl border-2 px-3 py-2 text-lg font-bold tracking-wide transition sm:text-xl',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {word}
                </button>
              )
            })}
          </div>

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
            Dedujiste las {order.length} palabras — completaste el nivel {levelIdx + 1}.
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
