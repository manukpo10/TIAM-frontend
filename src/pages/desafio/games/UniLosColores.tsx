import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Uní los colores" — día 4, mes 6, funciones ejecutivas. A key says which number goes with which colour (1 azul, 2 rojo…)
 * and a series of numbers is given (3 → 5 → 1): the player turns each number into its colour, finds that dot on the
 * board and taps the dots in that order, and a line joins each dot to the one before. The mechanic comes from a
 * worksheet with a colour-number key and series to follow with arrows; here the line is drawn by the taps.
 *
 * ORIGINAL CONTENT. Only the idea (a colour-number key and a series to follow) is borrowed. The numbering of the key
 * is TIAM's own and differs from the worksheet's, the series are written for this game and the boards are laid out
 * here (a throwaway script, not committed, checks that every series uses each number once, that its numbers exist in
 * the key of the level, that no two series of the day are the same and that none is one of the worksheet's).
 *
 * THE COLOUR IS NEVER THE ONLY SIGNAL. Every entry of the key is a dot, its number AND the name of the colour ("2 Rojo"),
 * and every colour also has its own SHAPE (azul círculo, rojo cuadrado, verde triángulo, amarillo rombo, violeta estrella,
 * naranja hexágono, rosa corazón, marrón cruz), drawn in white with a dark outline inside its dot in the key AND on the
 * board, so red and green, blue and violet or orange and brown can be told apart without seeing the shade. Every dot of
 * the board also has the name of its colour as its accessible label. The numbers are not on the dots: turning a number
 * into a colour is the exercise.
 *
 * A wrong dot costs ONE mistake (a double tap counts one: the first tap is judged and the wrong dot is only marked, in
 * muted gray, never red, until the next tap) and says which colour it was and which number comes now; a second miss on
 * the same step says the colour that is next, so nobody is left stuck. Nothing is timed but a short pause so the whole
 * line is seen before the next board.
 *
 * THREE BOARDS A LEVEL, as the tallerista likes the days short. The ramp is the key and the series: level 1 has a key
 * of five colours and series of three, level 2 six colours and series of four, level 3 the eight colours and series
 * of six. Each level has a pool of four series and three are picked ONCE at mount (`epoch`, together with the place of
 * each colour on each board), so "Repetir" replays exactly the same nine boards.
 *
 * A short "¿Cómo se juega?" screen opens the day; "Repetir" never brings it back. Per-level state lives in
 * <LevelView>, keyed by run + level. Double taps: every tap within SETTLE_MS of the tap that brought the level is
 * ignored (the dots sit where that button was) and a dot already joined is a disabled button.
 *
 * totalAttempts = mistakes + every dot of every series (TOTAL_TAPS, derived).
 */

// ── data:start ──
type Shape = 'circulo' | 'cuadrado' | 'triangulo' | 'rombo' | 'estrella' | 'hexagono' | 'corazon' | 'cruz'
interface ColorDef {
  num: number
  name: string
  hex: string
  /** The second signal of the colour: its shape, in the key and on the dot, so the colour is never the only cue. */
  shape: Shape
}
/** The key of the day: the numbers 1 to 8. A level uses the first `colors` of them. */
const COLORS: ColorDef[] = [
  { num: 1, name: 'Azul', hex: '#2563EB', shape: 'circulo' },
  { num: 2, name: 'Rojo', hex: '#DC2626', shape: 'cuadrado' },
  { num: 3, name: 'Verde', hex: '#16A34A', shape: 'triangulo' },
  { num: 4, name: 'Amarillo', hex: '#FACC15', shape: 'rombo' },
  { num: 5, name: 'Violeta', hex: '#9333EA', shape: 'estrella' },
  { num: 6, name: 'Naranja', hex: '#F97316', shape: 'hexagono' },
  { num: 7, name: 'Rosa', hex: '#F472B6', shape: 'corazon' },
  { num: 8, name: 'Marrón', hex: '#92400E', shape: 'cruz' },
]
interface LevelDef {
  name: string
  /** How many colours the key and the board have (the first ones of COLORS). */
  colors: number
  /** Pool of series (numbers of the key, none twice); BOARDS_PER_LEVEL of them are played. */
  series: number[][]
}

const BOARDS_PER_LEVEL = 3

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    colors: 5,
    series: [
      [2, 5, 1],
      [4, 1, 3],
      [3, 5, 2],
      [1, 4, 5],
    ],
  },
  {
    name: 'Nivel 2',
    colors: 6,
    series: [
      [5, 2, 6, 1],
      [3, 6, 4, 2],
      [1, 5, 3, 6],
      [6, 4, 1, 3],
    ],
  },
  {
    name: 'Nivel 3',
    colors: 8,
    series: [
      [7, 3, 8, 1, 5, 2],
      [4, 8, 2, 6, 1, 7],
      [2, 6, 3, 7, 5, 8],
      [8, 1, 6, 4, 3, 5],
    ],
  },
]

/** Where the dots can sit, as a percentage of the board (4:3), for the key of 5, 6 and 8 colours. Far enough apart
 * that two 52px dots never touch on a 320px board. */
const SLOTS: Record<number, [number, number][]> = {
  5: [[18, 24], [50, 16], [82, 28], [30, 74], [72, 76]],
  6: [[16, 22], [50, 16], [84, 24], [16, 78], [50, 84], [84, 74]],
  8: [[12, 20], [37, 13], [63, 24], [88, 16], [12, 80], [37, 86], [63, 72], [88, 82]],
}
const TOTAL_TAPS = LEVELS.reduce((sum, lvl) => sum + BOARDS_PER_LEVEL * lvl.series[0].length, 0)

/** The key of the how-to screen: it is not in the game. */
const EXAMPLE_KEY = [COLORS[0], COLORS[1], COLORS[2]]
const EXAMPLE_SERIES = [3, 1]
// ── data:end ──

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

interface Board {
  series: number[]
  /** Where each colour of the key sits, by colour number. */
  place: Record<number, [number, number]>
}
function buildEpoch(): Board[][] {
  return LEVELS.map((lvl) =>
    shuffle(lvl.series)
      .slice(0, BOARDS_PER_LEVEL)
      .map((series) => {
        const slots = shuffle(SLOTS[lvl.colors])
        const place: Record<number, [number, number]> = {}
        COLORS.slice(0, lvl.colors).forEach((c, i) => {
          place[c.num] = slots[i]
        })
        return { series, place }
      }),
  )
}
function colorOf(num: number): ColorDef {
  return COLORS[num - 1]
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buena atención!', '¡Perfecto!']
/** The pause after the last dot of a board, with the whole line on screen, before the next board. */
const ADVANCE_MS = 1500
/** A tap this soon after the tap that brought the level ("Empezar", "Siguiente nivel", "Repetir") is the second tap of a
 * double tap, and it must not choose a dot: the board sits where that button was. */
const SETTLE_MS = 400

const SHAPE_PATH: Record<Shape, string> = {
  circulo: 'M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14z',
  cuadrado: 'M5.5 5.5h13v13h-13z',
  triangulo: 'M12 4.5 20.5 19.5h-17z',
  rombo: 'M12 3 21 12 12 21 3 12z',
  estrella: 'M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4-5.8-3.3-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z',
  hexagono: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z',
  corazon: 'M12 20.5C4.5 14.5 3.5 9.8 6.3 6.8 8.7 4.4 11 5.8 12 7.8c1-2 3.3-3.4 5.7-1 2.8 3 1.8 7.7-5.7 13.7z',
  cruz: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
}
/** The shape of a colour, white with a dark outline so it reads on any of the eight colours. */
function Glyph({ shape, className }: { shape: Shape; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={SHAPE_PATH[shape]} fill="#fff" stroke="#1e293b" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
/** A colour as it shows in the key: its dot with its shape inside. */
function Dot({ hex, shape, size = 28 }: { hex: string; shape: Shape; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full border border-black/10" style={{ background: hex, width: size, height: size }} aria-hidden="true">
      <Glyph shape={shape} className="h-[68%] w-[68%]" />
    </span>
  )
}

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = ['Mirá la serie de números y buscá en la clave qué color es cada uno.', 'Tocá los puntos de la tabla en ese orden: se dibuja una línea.']
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
      <div className="mt-3 rounded-2xl bg-white p-3">
        <p className="text-center text-base font-semibold text-slate-500">Por ejemplo, con esta clave:</p>
        <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
          {EXAMPLE_KEY.map((c) => (
            <li key={c.num} className="flex items-center gap-1.5 text-base font-semibold text-slate-800">
              <Dot hex={c.hex} shape={c.shape} />
              {c.num} {c.name}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-center text-base leading-snug text-slate-700">
          La serie <span className="font-bold">{EXAMPLE_SERIES.join(' → ')}</span> quiere decir: primero el{' '}
          <span className="font-bold">{colorOf(EXAMPLE_SERIES[0]).name.toLowerCase()}</span> y después el{' '}
          <span className="font-bold">{colorOf(EXAMPLE_SERIES[1]).name.toLowerCase()}</span>.
        </p>
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
  boards: Board[]
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, boards, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const total = boards.length
  const key = COLORS.slice(0, level.colors)

  const [bIdx, setBIdx] = useState(0)
  // How many dots of the series are joined, the dot tapped wrong last (until the next tap) and the misses of this step.
  const [step, setStep] = useState(0)
  const [wrongNum, setWrongNum] = useState<number | null>(null)
  const [stepMisses, setStepMisses] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // The same step, but readable at once: a double tap lands before React has repainted the board.
  const stepRef = useRef(0)
  const lastWrongRef = useRef({ num: 0, at: -Infinity })
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

  const board = boards[bIdx]
  const { series, place } = board
  const joined = series.slice(0, step)

  function tapDot(num: number, at: number) {
    if (advancing || done || at - since < SETTLE_MS) return
    const s = stepRef.current
    if (joined.includes(num)) return
    const expected = series[s]
    if (num === expected) {
      const next = s + 1
      stepRef.current = next
      setStep(next)
      setWrongNum(null)
      setStepMisses(0)
      if (next === series.length) {
        setAdvancing(true)
        setHint({ text: `¡Lo uniste! ${series.map((n) => colorOf(n).name.toLowerCase()).join(', ')}.`, ok: true })
        advanceTimerRef.current = window.setTimeout(() => {
          if (bIdx < total - 1) {
            stepRef.current = 0
            setBIdx((i) => i + 1)
            setStep(0)
            setHint(null)
            setAdvancing(false)
          } else {
            setPraise(pickOne(PRAISE))
            setDone(true)
            onSolved()
          }
        }, ADVANCE_MS)
      } else {
        setHint(null)
      }
      return
    }
    // The second tap of a double tap on a wrong dot is not a second mistake.
    const lw = lastWrongRef.current
    if (lw.num === num && at - lw.at < SETTLE_MS) return
    lastWrongRef.current = { num, at }
    const n = stepMisses + 1
    setStepMisses(n)
    setWrongNum(num)
    setHint({
      text:
        n === 1
          ? `Ese punto es el ${colorOf(num).name.toLowerCase()}. Ahora te toca el número ${expected}: buscalo en la clave.`
          : `Ahora va el ${colorOf(expected).name.toLowerCase()} (el número ${expected}). Buscá ese punto.`,
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
            Serie {bIdx + 1} de {total}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The series: the number to join now is ringed */}
          <ol aria-label="Serie" className="mx-auto mt-2 flex max-w-md flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
            {series.map((n, i) => (
              <li key={i} className="flex items-center gap-1">
                <span
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-xl font-extrabold',
                    i < step
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-500'
                      : i === step
                        ? 'border-tiam-blue bg-tiam-blue text-white shadow-md'
                        : 'border-slate-300 bg-white text-slate-800',
                  ].join(' ')}
                >
                  {n}
                </span>
                {/* the arrows only when they fit: six numbers need the whole width of a 320px phone */}
                {i < series.length - 1 && series.length <= 4 && <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />}
              </li>
            ))}
          </ol>

          {/* The key */}
          <ul aria-label="Clave de colores" className="mx-auto mt-2 grid max-w-xs grid-cols-2 gap-x-2 gap-y-0.5 rounded-2xl bg-slate-50 px-3 py-1.5">
            {key.map((c) => (
              <li key={c.num} className="flex items-center gap-1.5 whitespace-nowrap text-base font-semibold text-slate-800">
                <Dot hex={c.hex} shape={c.shape} size={26} />
                <span>
                  {c.num} <span className="font-medium text-slate-600">{c.name}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* The board: the line grows with every dot joined */}
          <div className="relative mx-auto mt-2 aspect-[4/3] w-full max-w-[340px] rounded-2xl border-2 border-slate-100 bg-white">
            <svg viewBox="0 0 100 75" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {joined.slice(1).map((n, i) => {
                const [x1, y1] = place[joined[i]]
                const [x2, y2] = place[n]
                return (
                  <line
                    key={n}
                    x1={x1}
                    y1={y1 * 0.75}
                    x2={x2}
                    y2={y2 * 0.75}
                    stroke="#475569"
                    strokeWidth="3"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
            </svg>
            {key.map((c) => {
              const [x, y] = place[c.num]
              const isJoined = joined.includes(c.num)
              const isWrong = wrongNum === c.num
              return (
                <button
                  key={c.num}
                  type="button"
                  disabled={isJoined || advancing}
                  aria-label={isJoined ? `Punto ${c.name.toLowerCase()}, unido` : `Punto ${c.name.toLowerCase()}`}
                  onClick={(e) => tapDot(c.num, e.timeStamp)}
                  style={{ left: `${x}%`, top: `${y}%`, background: c.hex }}
                  className={[
                    'absolute flex h-[52px] w-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition',
                    'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-tiam-blue/60 focus-visible:ring-offset-2',
                    isJoined ? 'border-slate-700 ring-2 ring-slate-700/30' : isWrong ? 'border-slate-400 opacity-60 ring-4 ring-slate-300' : 'border-black/10 hover:scale-105',
                  ].join(' ')}
                >
                  {isJoined ? <Check className="h-5 w-5 text-white drop-shadow" strokeWidth={3.5} aria-hidden="true" /> : <Glyph shape={c.shape} className="h-7 w-7" />}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mx-auto mt-1 min-h-[2.75rem] max-w-md text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
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
          <p className="mt-1 text-slate-600">Uniste las {total} series. ¡Completaste el {level.name.toLowerCase()}!</p>
          <ul className="mt-3 space-y-1.5 text-left text-base text-slate-700">
            {boards.map((b, i) => (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-tiam-green" strokeWidth={3} aria-hidden="true" />
                <span>
                  <span className="font-bold text-slate-900">{b.series.join(' → ')}</span>
                  <span className="text-slate-500"> — {b.series.map((n) => colorOf(n).name.toLowerCase()).join(', ')}</span>
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

export function UniLosColores({ onComplete }: GameProps) {
  // Which series each level plays and where the colours sit on each board — decided once, at mount, so "Repetir"
  // replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_TAPS })
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
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Colores y números</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      boards={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
