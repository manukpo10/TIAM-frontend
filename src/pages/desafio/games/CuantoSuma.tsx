import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Cuánto suma?" — number-sense matching. The left column shows quantities in
 * three different guises (dice pips, a written sum, a tally); the right column
 * shows plain numbers. Tap one from each side to pair them.
 *
 * Two columns and a two-tap pairing is the engine "Las mismas letras" and "Es
 * lo mismo decir…" already use, so the interaction is familiar. What is new
 * here is that the two sides are in DIFFERENT representations: recognising
 * that ⚅⚂ and "6+3" and 9 are the same quantity is the exercise, and it is a
 * different demand from computing a single result and picking it from four
 * options (which día 8, 11, 17 and 20 already cover between them).
 *
 * Pips are drawn in SVG rather than shipped as images — same call ElReloj and
 * La balanza make: dice faces are pure geometry, so drawing them live is
 * crisper at any size and needs no assets.
 */

type Shape = 'dice' | 'sum' | 'tally'

interface Quantity {
  /** The value both sides of the pair resolve to. */
  value: number
  shape: Shape
  /** For 'dice': the individual faces. For 'sum': the addends. Unused by 'tally'. */
  parts: number[]
}

interface Level {
  n: number
  name: string
  pairs: number
  shapes: Shape[]
  /** Inclusive range the paired values are drawn from. */
  min: number
  max: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', pairs: 4, shapes: ['dice'], min: 2, max: 12 },
  { n: 2, name: 'Nivel 2', pairs: 5, shapes: ['dice', 'sum'], min: 3, max: 18 },
  { n: 3, name: 'Nivel 3', pairs: 6, shapes: ['dice', 'sum', 'tally'], min: 5, max: 24 },
]

const TOTAL_PAIRS = LEVELS.reduce((sum, l) => sum + l.pairs, 0)

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

/** Splits `value` into dice faces (1-6 each), or into two addends for a sum. */
function partsFor(value: number, shape: Shape): number[] {
  if (shape === 'sum') {
    const first = 1 + Math.floor(Math.random() * (value - 1))
    return [first, value - first]
  }
  if (shape === 'tally') return []
  // Use the FEWEST dice that can hold the value. Splitting greedily instead
  // (take a random face, repeat) drifts toward small faces and shows eleven
  // as five dice — technically right, unreadable in a narrow column, and
  // nothing like how anyone would actually lay it out.
  const count = Math.ceil(value / 6)
  const faces: number[] = []
  let left = value
  for (let i = 0; i < count; i++) {
    const stillToFill = count - i - 1
    // Bounds that keep every remaining die inside 1..6 and the sum exact.
    const lo = Math.max(1, left - stillToFill * 6)
    const hi = Math.min(6, left - stillToFill)
    const face = lo + Math.floor(Math.random() * (hi - lo + 1))
    faces.push(face)
    left -= face
  }
  return faces
}

function buildRound(level: Level): Quantity[] {
  // Values must be DISTINCT across the round: two pairs sharing a value would
  // make the right-hand column ambiguous — a player pairing correctly by
  // arithmetic could still be told they are wrong.
  const span = Array.from({ length: level.max - level.min + 1 }, (_, i) => level.min + i)
  // 'sum' needs at least 2 to split into two addends; 'dice' needs ≥1.
  const usable = span.filter((v) => v >= 2)
  return shuffle(usable)
    .slice(0, level.pairs)
    .map((value) => {
      const shape = pickOne(level.shapes)
      return { value, shape, parts: partsFor(value, shape) }
    })
}

/** One die face, pips laid out on the classic 3×3 grid. */
function Die({ face }: { face: number }) {
  const spots: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
  }
  return (
    <svg viewBox="0 0 100 100" className="h-8 w-8 shrink-0 sm:h-10 sm:w-10" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#fff" stroke="#cbd5e1" strokeWidth="5" />
      {spots[face].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#1B6FC4" />
      ))}
    </svg>
  )
}

/** One tally group: up to four uprights, with the fifth struck across them. */
function TallyGroup({ bars }: { bars: number }) {
  const uprights = Math.min(bars, 4)
  return (
    <svg viewBox="0 0 36 32" className="h-7 w-8 shrink-0 sm:h-9 sm:w-10" aria-hidden="true">
      {Array.from({ length: uprights }, (_, i) => (
        <line key={i} x1={6 + i * 7} y1="4" x2={6 + i * 7} y2="28" stroke="#1B6FC4" strokeWidth="3" strokeLinecap="round" />
      ))}
      {bars === 5 && (
        <line x1="2" y1="26" x2="32" y2="6" stroke="#1B6FC4" strokeWidth="3" strokeLinecap="round" />
      )}
    </svg>
  )
}

function QuantityFace({ q }: { q: Quantity }) {
  if (q.shape === 'sum') {
    return <span className="text-xl font-extrabold text-slate-700 sm:text-2xl">{q.parts.join(' + ')}</span>
  }
  if (q.shape === 'tally') {
    // Drawn, not typed: the obvious character for a five-bar gate is a CJK
    // glyph the app's font stack does not carry, and a fallback box here
    // would make the quantity unreadable.
    const groups = Math.floor(q.value / 5)
    const rest = q.value % 5
    return (
      <span className="flex flex-wrap items-center justify-center gap-1.5">
        {Array.from({ length: groups }, (_, g) => (
          <TallyGroup key={g} bars={5} />
        ))}
        {rest > 0 && <TallyGroup bars={rest} />}
      </span>
    )
  }
  return (
    <span className="flex flex-wrap items-center justify-center gap-1">
      {q.parts.map((face, i) => (
        <Die key={i} face={face} />
      ))}
    </span>
  )
}

/**
 * Describes what is DRAWN, never the total — naming the total would hand a
 * screen-reader user the answer, which is the one thing this game asks for.
 */
function describe(q: Quantity): string {
  if (q.shape === 'sum') return q.parts.join(' más ')
  if (q.shape === 'tally') {
    const groups = Math.floor(q.value / 5)
    const rest = q.value % 5
    const parts = [
      groups > 0 ? `${groups} ${groups === 1 ? 'grupo' : 'grupos'} de cinco marcas` : '',
      rest > 0 ? `${rest} ${rest === 1 ? 'marca suelta' : 'marcas sueltas'}` : '',
    ]
    return parts.filter(Boolean).join(' y ')
  }
  return `dados con ${q.parts.join(', ')}`
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esos dos no son la misma cantidad — probá con otro.',
  'Casi. Contá de nuevo y fijate cuál le corresponde.',
  'No es ese número. Volvé a mirar la cantidad de la izquierda.',
]

export function CuantoSuma({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const round = useMemo(
    () => buildRound(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const numbers = useMemo(() => shuffle(round.map((q) => q.value)), [round])

  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [pickedFace, setPickedFace] = useState<number | null>(null)
  const [pickedNumber, setPickedNumber] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3 and only zeroes on a genuine day restart
  // (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)

  const done = matched.size === round.length

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function resolve(face: number | null, num: number | null) {
    if (face === null || num === null) return
    if (face === num) {
      setMatched((prev) => new Set(prev).add(face))
      setHint(null)
    } else {
      setMistakes((m) => m + 1)
      setHint(pickOne(HINTS))
    }
    setPickedFace(null)
    setPickedNumber(null)
  }

  function tapFace(value: number) {
    if (matched.has(value) || done) return
    if (pickedFace === value) {
      setPickedFace(null)
      return
    }
    setPickedFace(value)
    if (pickedNumber !== null) resolve(value, pickedNumber)
  }
  function tapNumber(value: number) {
    if (matched.has(value) || done) return
    if (pickedNumber === value) {
      setPickedNumber(null)
      return
    }
    setPickedNumber(value)
    if (pickedFace !== null) resolve(pickedFace, value)
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render, so `done` (derived straight
  // from `matched`) would read the previous level's stale-true value on the
  // very render that arrives at the new level and fire onComplete with
  // garbage. Same reasoning as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setMatched(new Set())
    setPickedFace(null)
    setPickedNumber(null)
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (the wrap back to level 1) gets a new roundKey so it can report
  // again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_PAIRS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          Uní cada cantidad con su número
        </h2>
        <p className="mt-2 text-base text-slate-500">Tocá uno de la izquierda y después su número.</p>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Llevás {matched.size} de {round.length}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${round.length ? (matched.size / round.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5">
        <div className="flex flex-col gap-2 sm:gap-3">
          {round.map((q) => {
            const isMatched = matched.has(q.value)
            const isPicked = pickedFace === q.value
            return (
              <button
                key={q.value}
                type="button"
                disabled={isMatched}
                onClick={() => tapFace(q.value)}
                aria-label={describe(q)}
                aria-pressed={isPicked || isMatched}
                className={[
                  'flex min-h-[60px] items-center justify-center rounded-2xl border-2 bg-white px-2 py-2 transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  isMatched ? 'border-tiam-green bg-tiam-green/5 opacity-60' : '',
                  isPicked ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                  !isMatched && !isPicked
                    ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                    : '',
                ].join(' ')}
              >
                <QuantityFace q={q} />
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2 sm:gap-3">
          {numbers.map((value) => {
            const isMatched = matched.has(value)
            const isPicked = pickedNumber === value
            return (
              <button
                key={value}
                type="button"
                disabled={isMatched}
                onClick={() => tapNumber(value)}
                aria-label={`número ${value}`}
                aria-pressed={isPicked || isMatched}
                className={[
                  'relative flex min-h-[60px] items-center justify-center rounded-2xl border-2 bg-white px-2 py-2 transition',
                  'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                  isMatched ? 'border-tiam-green bg-tiam-green/5 opacity-60' : '',
                  isPicked ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                  !isMatched && !isPicked
                    ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                    : '',
                ].join(' ')}
              >
                <span className="text-2xl font-extrabold text-slate-700 sm:text-3xl">{value}</span>
                {isMatched && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {hint && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{hint}</p>}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Uniste las {round.length} cantidades — ¡completaste el {level.name.toLowerCase()}!
          </p>
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={nextLevel}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
            >
              {levelIdx < LEVELS.length - 1 ? (
                <>
                  Siguiente nivel
                  <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
