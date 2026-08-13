import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La que no encaja" — a category/semantic-field game: 4 words, 3 share a
 * category, 1 doesn't belong — tap the odd one out. Purely semantic (no text
 * grid, no visual scanning) so it doesn't overlap with LaIntrusa, which tests
 * visual search over a dense grid of repeated words instead.
 *
 * The shared category is never named on screen — inferring it IS the
 * cognitive task. A wrong tap only eliminates that option (muted grey, never
 * red), same convention as LosOpuestos. Difficulty ramps via how close the
 * outlier sits to the category: L1 wildly different domain (animal vs toy),
 * L2 same broad domain/adjacent subcategory (fruit vs vegetable, motorized
 * vs not), L3 abstract categories (professions by function, emotional
 * valence).
 *
 * Content is fixed (2 curated rounds per level, no larger pool to sample
 * from), so "Repetir"/"Hacer otro" only differ in shuffle order — same
 * epochRounds/restart architecture as LaIntrusa, kept so both buttons are
 * always present and meaningfully different on the final completion card.
 */

interface Round {
  members: string[]
  odd: string
}
interface Level {
  n: number
  name: string
  instruction: string
  rounds: Round[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    instruction: '¿Cuál palabra no pertenece al grupo?',
    rounds: [
      { members: ['PERRO', 'GATO', 'VACA'], odd: 'PELOTA' },
      { members: ['CAMISA', 'PANTALÓN', 'MEDIAS'], odd: 'GUITARRA' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    instruction: '¿Cuál palabra no pertenece al grupo? (fijate bien, se parecen)',
    rounds: [
      { members: ['MANZANA', 'BANANA', 'NARANJA'], odd: 'ZANAHORIA' },
      { members: ['AUTO', 'MOTO', 'CAMIÓN'], odd: 'BICICLETA' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    instruction: '¿Cuál palabra no pertenece al grupo? (pensalo un poco más)',
    rounds: [
      { members: ['MÉDICO', 'ENFERMERA', 'KINESIÓLOGO'], odd: 'ABOGADO' },
      { members: ['ALEGRÍA', 'ORGULLO', 'GRATITUD'], odd: 'ANSIEDAD' },
    ],
  },
]

const TOTAL_ROUNDS = LEVELS.reduce((sum, lvl) => sum + lvl.rounds.length, 0)

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

const HINTS = ['Esa pertenece al grupo — fijate cuál es la diferente.', 'Pensá qué tienen en común las otras tres.', 'Casi, probá con otra palabra.']
const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena observación!']

export function LaQueNoEncaja({ day: _day, onComplete }: GameProps) {
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const [epochRounds, setEpochRounds] = useState(() => LEVELS.map((lvl) => shuffle(lvl.rounds)))
  const level = LEVELS[levelIdx]
  const order = epochRounds[levelIdx]
  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [solved, setSolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see restartEpoch below).
  const [mistakes, setMistakes] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length
  const options = useMemo(() => (round ? shuffle([...round.members, round.odd]) : []), [round])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(word: string) {
    if (!round || solved || eliminated.has(word)) return
    if (word === round.odd) {
      setSolved(true)
      setHint(null)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
      }, 500)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(word))
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level/round change — an
  // effect keyed on [levelIdx, roundKey] lags one render behind and would
  // let `done` read the previous level's stale true right as levelIdx
  // reaches the last level, firing onComplete with garbage (see LaIntrusa).
  function advanceLevel() {
    setLevelIdx((i) => i + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
  }
  function restartEpoch() {
    setLevelIdx(0)
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setSolved(false)
    setHint(null)
    setMistakes(0)
  }
  function restartSame() {
    restartEpoch()
  }
  function restartDifferent() {
    restartEpoch()
    setEpochRounds(LEVELS.map((lvl) => shuffle(lvl.rounds)))
  }

  // Fires once per roundKey when level 3's last round resolves. A full day
  // restart (wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire
  // twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 text-center sm:p-7">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          Desafío de lenguaje
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">La que no encaja</h2>
        <p className="mt-3 text-base text-slate-600">
          Vas a ver 4 palabras. Tres tienen algo en común y una no pertenece al grupo — tocá la que sobra.
        </p>
        <p className="mt-2 text-base text-slate-500">3 niveles, cada uno un poco más difícil.</p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setPhase('playing')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white hover:bg-tiam-blue-dark"
          >
            Empezar
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{level.instruction}</h2>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {currentIndex} de {order.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(currentIndex / order.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6">
            {options.map((word) => {
              const isEliminated = eliminated.has(word)
              const isSolved = solved && word === round.odd
              return (
                <button
                  key={word}
                  type="button"
                  disabled={solved || isEliminated}
                  onClick={() => guess(word)}
                  aria-label={`palabra ${word}`}
                  className={[
                    'min-h-[64px] rounded-2xl border-2 px-3 py-3 text-base font-bold uppercase tracking-wide transition focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 sm:text-lg',
                    isSolved
                      ? 'border-tiam-green bg-tiam-green/5 text-slate-900 ring-2 ring-tiam-green/30'
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

          {hint && !solved && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">¡Encontraste todas las que no encajaban — completaste el {level.name.toLowerCase()}!</p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={restartSame}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-tiam-blue bg-white px-5 font-semibold text-tiam-blue hover:bg-tiam-blue/5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={restartDifferent}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Hacer otro
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
