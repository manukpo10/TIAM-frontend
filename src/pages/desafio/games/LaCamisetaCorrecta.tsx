import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La camiseta correcta" — día 1, mes 6, cálculo. A sum, a subtraction, a product or a division is shown and three
 * shirts carry three results that look a lot alike (they differ in one digit, the usual slip when a carry is
 * forgotten): the player does the sum, on paper if it helps, and taps the shirt with the right result, which is then
 * painted. The mechanic comes from a worksheet where the shirt with the right result is coloured in; nothing else does.
 *
 * ORIGINAL CONTENT. The operations are TIAM's own (a throwaway script, not committed, checks every result, that
 * the three numbers of a shirt row are different, that no result is repeated in the day and that none of the
 * worksheet's ten operations is here). The shirts are drawn in SVG, with no crests, no names of countries or
 * teams: only a colour and a pattern each (violet stripes one way, orange stripes the other, green with sleeves of a lighter green).
 * The pattern belongs to the PLACE of the shirt, not to the answer, so the painted shirt gives nothing away.
 *
 * NO GUESSING GAME, NO CLOCK. A wrong shirt costs ONE mistake, stays unpainted and goes muted gray (never red), and
 * says to do the sum on paper; the right one is painted and its sum is written out ("1.436 + 2.327 = 3.763"). Numbers
 * use the Argentine point for thousands (a thousand is 1.000). Nothing is timed but a short pause so the painted shirt
 * is seen before the next sum.
 *
 * THREE SUMS A LEVEL, as the tallerista likes the days short. The ramp is the operation: level 1 adds and subtracts
 * numbers of up to four digits, level 2 subtracts with a borrow and multiplies by one digit, level 3 multiplies and
 * divides bigger numbers. Each level has a pool of four sums; three are picked ONCE at mount (`epoch`, with the order
 * of the three shirts of each sum), so "Repetir" replays exactly the same nine.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is
 * ignored (the shirts sit where that button was) and a shirt already tapped is a disabled button with a ref guard on
 * top, so a double tap counts ONE mistake.
 *
 * totalAttempts = mistakes + every sum of the day (TOTAL_SUMS, derived).
 */

// ── data:start ──
type Op = '+' | '-' | '×' | '÷'
interface SumDef {
  a: number
  op: Op
  b: number
  /** Two wrong results, each a slip away from the right one. */
  wrong: [number, number]
}
interface LevelDef {
  name: string
  /** Pool of sums; SUMS_PER_LEVEL of them are played. */
  pool: SumDef[]
}

const SUMS_PER_LEVEL = 3

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    pool: [
      { a: 1436, op: '+', b: 2327, wrong: [3663, 3773] },
      { a: 5280, op: '-', b: 1745, wrong: [3545, 3435] },
      { a: 2618, op: '+', b: 3174, wrong: [5782, 5892] },
      { a: 6504, op: '-', b: 2381, wrong: [4133, 4023] },
    ],
  },
  {
    name: 'Nivel 2',
    pool: [
      { a: 8205, op: '-', b: 3968, wrong: [4337, 4247] },
      { a: 315, op: '×', b: 6, wrong: [1790, 1980] },
      { a: 4678, op: '+', b: 2549, wrong: [7217, 7327] },
      { a: 428, op: '×', b: 5, wrong: [2040, 2240] },
    ],
  },
  {
    name: 'Nivel 3',
    pool: [
      { a: 245, op: '×', b: 8, wrong: [1860, 1950] },
      { a: 3640, op: '÷', b: 7, wrong: [530, 510] },
      { a: 936, op: '÷', b: 6, wrong: [166, 146] },
      { a: 134, op: '×', b: 9, wrong: [1216, 1106] },
    ],
  },
]
const TOTAL_SUMS = LEVELS.length * SUMS_PER_LEVEL

/** The sum of the how-to screen: it is not in the game. */
const EXAMPLE = { a: 20, op: '+' as Op, b: 15, result: 35 }

function solve(a: number, op: Op, b: number): number {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '×') return a * b
  return a / b
}
// ── data:end ──

/** 1234 → "1.234": the Argentine point for thousands (4-digit numbers included, which Intl's es locale leaves bare). */
function fmt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
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

interface PreparedSum {
  text: string
  result: number
  /** The three numbers in the order of the shirts (the right one lands anywhere). */
  options: number[]
}
function buildEpoch(): PreparedSum[][] {
  return LEVELS.map((lvl) =>
    shuffle(lvl.pool)
      .slice(0, SUMS_PER_LEVEL)
      .map((s) => {
        const result = solve(s.a, s.op, s.b)
        return { text: `${fmt(s.a)} ${s.op} ${fmt(s.b)}`, result, options: shuffle([result, ...s.wrong]) }
      }),
  )
}

/** One look per PLACE of the shirt, never per answer. */
const LOOKS = [
  { base: '#7C3AED', alt: '#DDD0FA', kind: 'vertical' },
  { base: '#E8531E', alt: '#F7BFA6', kind: 'horizontal' },
  { base: '#3E8F27', alt: '#B7DFA7', kind: 'sleeves' },
] as const

const SHIRT_PATH = 'M32 6 L10 17 L2 38 L19 45 L25 36 L25 84 L75 84 L75 36 L81 45 L98 38 L90 17 L68 6 Q50 22 32 6 Z'
const SLEEVES_PATH = 'M32 6 L10 17 L2 38 L19 45 L25 36 L25 14 Z M68 6 L90 17 L98 38 L81 45 L75 36 L75 14 Z'

/** A shirt: an empty outline until it is painted. */
function Shirt({ look, painted, muted }: { look: (typeof LOOKS)[number]; painted: boolean; muted: boolean }) {
  const clipId = useId()
  return (
    <svg viewBox="0 0 100 90" className="h-auto w-full" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={SHIRT_PATH} />
        </clipPath>
      </defs>
      <path
        d={SHIRT_PATH}
        fill={painted ? look.base : '#F8FAFC'}
        stroke={muted ? '#CBD5E1' : painted ? look.base : '#94A3B8'}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {painted && look.kind === 'vertical' && (
        <g clipPath={`url(#${clipId})`} fill={look.alt}>
          {[33, 47, 61, 75].map((x) => (
            <rect key={x} x={x - 3.5} y="0" width="7" height="90" />
          ))}
        </g>
      )}
      {painted && look.kind === 'horizontal' && (
        <g clipPath={`url(#${clipId})`} fill={look.alt}>
          {[24, 40, 56, 72].map((y) => (
            <rect key={y} x="0" y={y - 3.5} width="100" height="7" />
          ))}
        </g>
      )}
      {painted && look.kind === 'sleeves' && <path d={SLEEVES_PATH} fill={look.alt} />}
      {painted && <path d="M32 6 Q50 22 68 6" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />}
    </svg>
  )
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena cuenta!', '¡Perfecto!']
/** The pause after the right shirt, with it painted, before the next sum. */
const ADVANCE_MS = 1700
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a shirt: the shirts sit where that button was. */
const SETTLE_MS = 400

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = ['Hacé la cuenta. Podés usar papel y lápiz.', 'Tocá la camiseta que tiene el resultado correcto: se pinta.']
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-base font-semibold text-slate-500">Por ejemplo:</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">
          {EXAMPLE.a} {EXAMPLE.op} {EXAMPLE.b} =
        </p>
        <div className="mx-auto mt-2 w-24" aria-hidden="true">
          <Shirt look={LOOKS[0]} painted muted={false} />
        </div>
        <p className="text-xl font-extrabold text-slate-900">{EXAMPLE.result}</p>
      </div>
      <div className="sticky bottom-3 z-10 mt-4 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-2"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface LevelViewProps {
  levelIdx: number
  sums: PreparedSum[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, sums, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = sums.length

  const [qIdx, setQIdx] = useState(0)
  // Shirts (by position) already tapped wrong in the current sum, and the one painted when it is right.
  const [wrong, setWrong] = useState<number[]>([])
  const [painted, setPainted] = useState<number | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same shirts, but readable at once: a double tap lands before React has repainted the button as disabled.
  const tappedRef = useRef<Set<string>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone.
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  const current = sums[qIdx]

  function tapShirt(pos: number, at: number) {
    if (advancing || done || at - since < SETTLE_MS) return
    const key = `${qIdx}-${pos}`
    if (tappedRef.current.has(key)) return
    tappedRef.current.add(key)
    if (current.options[pos] === current.result) {
      setPainted(pos)
      setAdvancing(true)
      setHint({ text: `¡Eso es! ${current.text} = ${fmt(current.result)}`, ok: true })
      advanceTimerRef.current = window.setTimeout(() => {
        if (qIdx < total - 1) {
          setQIdx((i) => i + 1)
          setWrong([])
          setPainted(null)
          setHint(null)
          setAdvancing(false)
        } else {
          setPraise(pickOne(PRAISE))
          setDone(true)
          onSolved()
        }
      }, ADVANCE_MS)
      return
    }
    setWrong((w) => [...w, pos])
    setHint({
      text: wrong.length === 0 ? 'Ese no es. Hacé la cuenta con papel y lápiz y probá con otra camiseta.' : 'Ese tampoco. Revisá la cuenta con calma: los resultados se parecen mucho.',
      ok: false,
    })
    onMistake()
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Cuenta {qIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          <h2 className="mt-3 text-balance text-center text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            Tocá la camiseta con el resultado correcto
          </h2>
          <div className="mx-auto mt-3 max-w-md rounded-2xl border-2 border-tiam-blue/30 bg-tiam-blue/5 px-4 py-3 text-center">
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{current.text} =</p>
          </div>

          <div role="group" aria-label="Camisetas" className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-2">
            {current.options.map((value, pos) => {
              const isPainted = painted === pos
              const isWrong = wrong.includes(pos)
              return (
                <button
                  key={pos}
                  type="button"
                  disabled={advancing || isWrong}
                  aria-label={isPainted ? `Camiseta con ${fmt(value)}, correcta` : `Camiseta con ${fmt(value)}`}
                  onClick={(e) => tapShirt(pos, e.timeStamp)}
                  className={[
                    'flex min-h-[44px] flex-col items-center rounded-2xl border-2 px-1 pb-2 pt-2 transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isPainted
                      ? 'border-tiam-green bg-tiam-green/10'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100'
                        : 'border-slate-200 bg-white hover:border-tiam-blue/40 hover:shadow-md active:bg-tiam-blue/5',
                  ].join(' ')}
                >
                  <span className="w-full max-w-[96px]">
                    <Shirt look={LOOKS[pos]} painted={isPainted} muted={isWrong} />
                  </span>
                  <span className={`mt-1 text-xl font-extrabold ${isWrong ? 'text-slate-400' : 'text-slate-900'}`}>{fmt(value)}</span>
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mx-auto mt-3 min-h-[3.5rem] max-w-md text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">Resolviste las {total} cuentas. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {sums.map((s) => (
              <li key={s.text} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span className="font-bold text-slate-900">
                  {s.text} = {fmt(s.result)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] scroll-mb-5 items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LaCamisetaCorrecta({ onComplete }: GameProps) {
  // Which sums each level plays and the order of their shirts — decided once, at mount, so "Repetir" replays exactly
  // the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never brings it back.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_SUMS })
  }
  function handleStart(at: number) {
    setSince(at)
    setPhase('playing')
  }
  function handleNext(at: number) {
    setSince(at)
    setLevelIdx((i) => i + 1)
  }
  function handleRepeat(at: number) {
    setSince(at)
    setLevelIdx(0)
    setMistakes(0)
    setRunKey((k) => k + 1)
  }

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuál es el resultado?</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      sums={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
