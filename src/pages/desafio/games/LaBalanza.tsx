import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La balanza" — a deductive weight-logic game (transitive reasoning),
 * inspired by the classic balance-scale exercise. All content original.
 *
 * One or more balance scales (drawn in SVG) establish weight relations
 * between illustrated objects; a deductive question asks which is
 * heaviest/lightest. Difficulty ramps by chaining, not arithmetic: L1 = one
 * scale (direct read), L2 = two scales / 3-object transitive chain, L3 =
 * three scales / 4-object chain, mostly shown out of chain order so the
 * player must actively reconstruct it. Objects render at a uniform icon size
 * regardless of real weight, so the tilt is the only evidence — you can't
 * shortcut by eyeballing size. A wrong tap eliminates that option (grey,
 * never red); 2-option rounds resolve on the first tap (VerdaderoOFalso rule).
 */

type Pool = 'fruit' | 'animal' | 'object'
interface Obj {
  id: string
  pool: Pool
}
interface ScaleFact {
  heavy: Obj
  light: Obj
}
interface Round {
  scales: ScaleFact[] // authored in DISPLAY order
  question: string
  answer: Obj
  options: Obj[]
}
interface Level {
  n: number
  name: string
  hint?: string
  rounds: Round[]
}

const f = (id: string): Obj => ({ id, pool: 'fruit' })
const a = (id: string): Obj => ({ id, pool: 'animal' })
const o = (id: string): Obj => ({ id, pool: 'object' })

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    hint: 'La balanza se inclina hacia el objeto que pesa más. Fijate hacia qué lado baja.',
    rounds: [
      { scales: [{ heavy: f('sandia'), light: f('frutilla') }], question: '¿Cuál de estos dos pesa más?', answer: f('sandia'), options: [f('sandia'), f('frutilla')] },
      { scales: [{ heavy: a('elefante'), light: a('gato') }], question: '¿Cuál de estos dos pesa menos?', answer: a('gato'), options: [a('gato'), a('elefante')] },
      { scales: [{ heavy: o('libro'), light: o('lapicera') }], question: '¿Cuál de estos dos es el más pesado?', answer: o('libro'), options: [o('libro'), o('lapicera')] },
      { scales: [{ heavy: f('naranja'), light: f('uva') }], question: '¿Cuál de estos dos pesa menos?', answer: f('uva'), options: [f('uva'), f('naranja')] },
      { scales: [{ heavy: a('vaca'), light: a('pato') }], question: '¿Cuál de estos dos es el más pesado?', answer: a('vaca'), options: [a('vaca'), a('pato')] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    hint: 'Ahora hay dos balanzas. Cada una te da una pista — juntá las dos para responder.',
    rounds: [
      { scales: [{ heavy: f('pera'), light: f('banana') }, { heavy: f('banana'), light: f('uva') }], question: '¿Cuál de estos tres pesa más?', answer: f('pera'), options: [f('pera'), f('banana'), f('uva')] },
      { scales: [{ heavy: a('mono'), light: a('rana') }, { heavy: a('oso'), light: a('mono') }], question: '¿Cuál de estos tres pesa menos?', answer: a('rana'), options: [a('rana'), a('mono'), a('oso')] },
      { scales: [{ heavy: o('termo'), light: o('mate') }, { heavy: o('mate'), light: o('lapicera') }], question: '¿Cuál de estos tres pesa más?', answer: o('termo'), options: [o('termo'), o('mate'), o('lapicera')] },
      { scales: [{ heavy: f('naranja'), light: f('manzana-roja') }, { heavy: f('manzana-roja'), light: f('cereza') }], question: 'Si la manzana queda sola en un plato y el otro está vacío, ¿cuál de estos dos haría bajar ese lado?', answer: f('naranja'), options: [f('naranja'), f('cereza')] },
      { scales: [{ heavy: o('llaves'), light: o('boton') }, { heavy: o('paraguas'), light: o('llaves') }], question: '¿Cuál de estos tres pesa menos?', answer: o('boton'), options: [o('boton'), o('llaves'), o('paraguas')] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    hint: 'Tres balanzas esta vez, y no están en orden. Fijate bien en cada una antes de responder.',
    rounds: [
      { scales: [{ heavy: f('sandia'), light: f('naranja') }, { heavy: f('naranja'), light: f('banana') }, { heavy: f('banana'), light: f('uva') }], question: '¿Cuál de estos cuatro pesa más?', answer: f('sandia'), options: [f('sandia'), f('naranja'), f('banana'), f('uva')] },
      { scales: [{ heavy: a('vaca'), light: a('chancho') }, { heavy: a('chancho'), light: a('gato') }, { heavy: a('elefante'), light: a('vaca') }], question: '¿Cuál de estos cuatro pesa menos?', answer: a('gato'), options: [a('gato'), a('chancho'), a('vaca'), a('elefante')] },
      { scales: [{ heavy: o('termo'), light: o('mate') }, { heavy: o('mate'), light: o('tijera') }, { heavy: o('libro'), light: o('termo') }], question: '¿Cuál es el más pesado de los cuatro?', answer: o('libro'), options: [o('libro'), o('termo'), o('mate'), o('tijera')] },
      { scales: [{ heavy: f('granada'), light: f('mandarina') }, { heavy: f('mandarina'), light: f('cereza') }, { heavy: f('cereza'), light: f('arandanos') }], question: 'Si la mandarina queda sola en un plato y el otro está vacío, ¿cuál de estos tres haría bajar ese lado?', answer: f('granada'), options: [f('granada'), f('cereza'), f('arandanos')] },
      { scales: [{ heavy: o('billetera'), light: o('llaves') }, { heavy: o('llaves'), light: o('boton') }, { heavy: o('paraguas'), light: o('billetera') }], question: '¿Cuál de estos cuatro es el más liviano?', answer: o('boton'), options: [o('boton'), o('llaves'), o('billetera'), o('paraguas')] },
    ],
  },
]

// Total weight-logic round count across all 3 levels — every round resolves
// after its correct tap, so totalAttempts = mistakes + this.
const TOTAL_ROUNDS = LEVELS.reduce((sum, lvl) => sum + lvl.rounds.length, 0)

// Per-folder-scoped globs — filenames collide across folders with different art.
const FRUIT_IMAGES = import.meta.glob('../../../assets/desafio/games/buscar-rojos/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const ANIMAL_IMAGES = import.meta.glob('../../../assets/desafio/games/animal-por-letra/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const OBJECT_IMAGES = import.meta.glob('../../../assets/desafio/games/que-hay-en-la-mesa/*.webp', { eager: true, import: 'default' }) as Record<string, string>
function imgFor(obj: Obj): string | undefined {
  const map = obj.pool === 'fruit' ? FRUIT_IMAGES : obj.pool === 'animal' ? ANIMAL_IMAGES : OBJECT_IMAGES
  const match = Object.entries(map).find(([path]) => path.endsWith(`/${obj.id}.webp`))
  return match?.[1]
}

const LABELS: Record<string, string> = {
  'manzana-roja': 'manzana', arandanos: 'arándanos', lapicera: 'lapicera',
}
const labelFor = (id: string) => LABELS[id] ?? id

function shuffle<T>(arr: T[]): T[] {
  const arr2 = [...arr]
  for (let i = arr2.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr2[i], arr2[j]] = [arr2[j], arr2[i]]
  }
  return arr2
}
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** One balance scale, tilted toward the heavier pan (which side is random). */
function BalanceScale({ scale, heavyOnLeft, index }: { scale: ScaleFact; heavyOnLeft: boolean; index?: number }) {
  const left = heavyOnLeft ? scale.heavy : scale.light
  const right = heavyOnLeft ? scale.light : scale.heavy
  const tilt = heavyOnLeft ? -11 : 11
  const leftImg = imgFor(left)
  const rightImg = imgFor(right)
  const ariaLabel = `La balanza se inclina hacia ${labelFor(scale.heavy.id)}: pesa más que ${labelFor(scale.light.id)}.`
  return (
    <div className="relative rounded-2xl border-2 border-slate-100 bg-slate-50/60 p-2">
      {index != null && (
        <span className="absolute left-2 top-1 text-xs font-bold text-slate-400">{index}</span>
      )}
      <svg viewBox="0 0 300 170" className="h-28 w-full sm:h-32" role="img" aria-label={ariaLabel}>
        <rect x="110" y="150" width="80" height="8" rx="4" fill="#94a3b8" />
        <rect x="146" y="58" width="8" height="94" rx="3" fill="#94a3b8" />
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '150px 58px', transition: 'transform 500ms ease' }}>
          <rect x="70" y="55" width="160" height="6" rx="3" fill="#64748b" />
          <line x1="80" y1="58" x2="80" y2="108" stroke="#64748b" strokeWidth="2" />
          <line x1="220" y1="58" x2="220" y2="108" stroke="#64748b" strokeWidth="2" />
          <ellipse cx="80" cy="112" rx="36" ry="9" fill="none" stroke="#64748b" strokeWidth="3" />
          <ellipse cx="220" cy="112" rx="36" ry="9" fill="none" stroke="#64748b" strokeWidth="3" />
          {leftImg && <image href={leftImg} x="61" y="78" width="38" height="38" />}
          {rightImg && <image href={rightImg} x="201" y="78" width="38" height="38" />}
        </g>
        <circle cx="150" cy="58" r="6" fill="#4F46E5" />
      </svg>
    </div>
  )
}

const HINTS = ['Fijate de nuevo qué mostraba cada balanza.', 'Repasá las balanzas y probá otra vez.']
const PRAISE = ['¡Exacto, la balanza no miente!', '¡Muy bien, buena deducción!', '¡Perfecto, encontraste la pista!', '¡Así se hace!']

export function LaBalanza({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const order = useMemo(
    () => shuffle(level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])
  // Wrong-tap count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  const round = order[currentIndex]
  const done = currentIndex >= order.length

  // Per-round: shuffle option order + randomize which pan is heavy on each scale.
  const view = useMemo(() => {
    if (!round) return null
    return {
      options: shuffle(round.options),
      sides: round.scales.map(() => Math.random() < 0.5),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, currentIndex, roundKey, levelIdx])

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  function guess(id: string) {
    if (!round || resolved || eliminated.has(id)) return
    if (id === round.answer.id) {
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 550)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
      setHint(pickOne(HINTS))
    }
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey] — see ElVuelto.tsx for
  // why: an effect-based reset lags one render behind, letting `done` read
  // stale-true right as levelIdx reaches the last level and firing
  // onComplete with garbage data.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otras balanzas" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setCurrentIndex(0)
    setEliminated(new Set())
    setResolved(false)
    setHint(null)
    // NOT setMistakes(0) — a same-level replay must not wipe accumulated mistakes.
  }

  // Fires once per roundKey when level 3's last scale round resolves. A full
  // day restart (the wrap to level 1) gets a new roundKey, so a genuine
  // replay reports again; re-rendering while already done on level 3 does
  // not fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

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
        {!done && (
          <>
            {level.hint && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
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

      {!done && round && view && (
        <>
          {/* Scales */}
          <div className="mt-6 flex flex-col gap-3">
            {round.scales.map((scale, i) => (
              <BalanceScale
                key={i}
                scale={scale}
                heavyOnLeft={view.sides[i]}
                index={round.scales.length > 1 ? i + 1 : undefined}
              />
            ))}
          </div>

          {/* Question */}
          <p className="mt-5 text-center text-lg font-bold text-slate-900">{round.question}</p>

          {/* Options */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {view.options.map((opt) => {
              const img = imgFor(opt)
              const isEliminated = eliminated.has(opt.id)
              const isCorrectShown = resolved && opt.id === round.answer.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt.id)}
                  aria-label={labelFor(opt.id)}
                  className={[
                    'relative flex aspect-square items-center justify-center rounded-2xl border-2 p-4 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 opacity-40 grayscale'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Descifraste las {order.length} balanzas — completaste el {level.name.toLowerCase()}!
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
              Otras balanzas
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
