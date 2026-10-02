import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La estrella de sumas" — día 30, mes 5, cálculo, el cierre del mes. A star with a
 * TOTAL in the middle and five branches; every branch has two numbers, one near the
 * middle and one out on the tip, and the two of a branch ADD UP to the total. In
 * every branch one of the two is missing: the player works out what it is — what is
 * left to reach the total — and taps it among four numbers that are close to it.
 * Same idea as month 4's Telaraña matemática (a number to work out at every step,
 * four near results to choose from, the next step opens when you get it right), in
 * a star instead of a chain, and with a sum to complete instead of an operation to
 * apply.
 *
 * One branch at a time, clockwise from the top: the branch in focus lights up in
 * blue, with its missing circle, and the others wait with a "?". A right answer fills
 * the circle (green) and the focus moves to the next branch. A wrong one greys out
 * (muted, never red) and costs one mistake; the first miss of a branch says it as a
 * question — "¿Cuánto le falta a 17 para llegar a 50?" — and the next ones just
 * encourage. A quick second tap right after an answer was accepted is ignored for
 * SETTLE_MS: the options have already changed to the next branch's, and a double tap
 * must not be judged against them. After the last circle there is a short pause (the
 * only timer), and then the star gives its room to the result card so the button
 * stays on screen on a short phone.
 *
 * The options are near misses, never a row of random numbers: for each missing number
 * a pool of six neighbours — three under it, three over it (±1, ±2, ±3 with the small
 * numbers, ±1, ±2 and ±10 with the big ones, the slips of a borrow) — never reaching
 * the total itself, and three in a row are taken out of that pool. Where the run
 * starts depends on the number and the branch, so the right answer is sometimes the
 * smallest, sometimes the largest and most times in between. Their positions on
 * screen are shuffled ONCE at mount.
 *
 * Ramp: total 12 / 15 with numbers up to 13 → total 50 / 60 with numbers up to 54 →
 * total 100 / 120 with numbers up to 106. In each star the numbers of its ten circles
 * are all different, and the missing circle of a branch is balanced between the tip and
 * the middle (two branches of one kind, three of the other), though not strictly
 * alternating. The last level's card celebrates reaching the last day of the month, as
 * month 4's last day does, without claiming that every day was done (days unlock week by
 * week, so somebody can land on día 30 first).
 *
 * ONE star per level: each level has two authored stars and one is picked ONCE at
 * mount (`epoch`, together with the order of every missing number's options), so
 * "Repetir" replays exactly the same three. Per-level state lives in <LevelView>, keyed
 * by run + level. A "¿Cómo se juega?" screen opens the day; "Repetir" never brings it
 * back. The star is one SVG (a soft star behind, spokes, hub and ten circles); the
 * circles are not buttons, the options are. A throwaway Node script (not committed)
 * recomputes every branch, checks the options and that no two circles of the drawing
 * touch.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged by
 * the click's own timeStamp) is ignored, so the second tap of a double tap on "Empezar",
 * "Siguiente nivel" or "Repetir" never answers the first branch (the options sit right
 * where that button was); the same window follows every accepted answer, because the
 * options change under the finger, and after the very last number every option is off
 * until the card replaces the star. The solved card is scrolled into view, and so is its
 * button, on a short phone; a new level opens at its top.
 *
 * totalAttempts = mistakes + every missing number of the day (TOTAL_NUMBERS, derived).
 */

// ── data:start ──
interface BranchDef {
  /** The number out on the tip of the branch. */
  tip: number
  /** The number near the middle of the star. */
  middle: number
  /** Which of the two is missing (the other one is given). */
  hide: 'tip' | 'middle'
}
interface StarDef {
  /** What every branch adds up to: the number in the middle. */
  total: number
  /** Five branches, clockwise from the top. */
  branches: BranchDef[]
}
interface LevelDef {
  name: string
  /** Two authored stars; one is picked at mount. */
  stars: StarDef[]
  /** The neighbours of a missing number the options are taken from (ascending, three under, three over). */
  offsets: number[]
}

// Every star has five branches, so TOTAL_NUMBERS never depends on which one is drawn.
// In every branch tip + middle = total, and the ten numbers of a star are all different.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    offsets: [-3, -2, -1, 1, 2, 3],
    stars: [
      {
        total: 12,
        branches: [
          { tip: 3, middle: 9, hide: 'middle' },
          { tip: 10, middle: 2, hide: 'tip' },
          { tip: 4, middle: 8, hide: 'middle' },
          { tip: 7, middle: 5, hide: 'tip' },
          { tip: 1, middle: 11, hide: 'tip' },
        ],
      },
      {
        total: 15,
        branches: [
          { tip: 6, middle: 9, hide: 'tip' },
          { tip: 8, middle: 7, hide: 'middle' },
          { tip: 4, middle: 11, hide: 'tip' },
          { tip: 13, middle: 2, hide: 'middle' },
          { tip: 5, middle: 10, hide: 'middle' },
        ],
      },
    ],
  },
  {
    name: 'Nivel 2',
    offsets: [-10, -2, -1, 1, 2, 10],
    stars: [
      {
        total: 50,
        branches: [
          { tip: 23, middle: 27, hide: 'tip' },
          { tip: 36, middle: 14, hide: 'middle' },
          { tip: 8, middle: 42, hide: 'tip' },
          { tip: 19, middle: 31, hide: 'middle' },
          { tip: 45, middle: 5, hide: 'tip' },
        ],
      },
      {
        total: 60,
        branches: [
          { tip: 28, middle: 32, hide: 'middle' },
          { tip: 47, middle: 13, hide: 'tip' },
          { tip: 15, middle: 45, hide: 'middle' },
          { tip: 39, middle: 21, hide: 'tip' },
          { tip: 54, middle: 6, hide: 'middle' },
        ],
      },
    ],
  },
  {
    name: 'Nivel 3',
    offsets: [-10, -2, -1, 1, 2, 10],
    stars: [
      {
        total: 100,
        branches: [
          { tip: 37, middle: 63, hide: 'middle' },
          { tip: 48, middle: 52, hide: 'tip' },
          { tip: 16, middle: 84, hide: 'middle' },
          { tip: 29, middle: 71, hide: 'tip' },
          { tip: 55, middle: 45, hide: 'tip' },
        ],
      },
      {
        total: 120,
        branches: [
          { tip: 45, middle: 75, hide: 'tip' },
          { tip: 68, middle: 52, hide: 'middle' },
          { tip: 37, middle: 83, hide: 'tip' },
          { tip: 91, middle: 29, hide: 'middle' },
          { tip: 14, middle: 106, hide: 'middle' },
        ],
      },
    ],
  },
]

const TOTAL_NUMBERS = LEVELS.reduce((sum, lvl) => sum + lvl.stars[0].branches.length, 0)

/** The number that is missing in a branch, and the one that is given. */
function missingOf(b: BranchDef): number {
  return b.hide === 'tip' ? b.tip : b.middle
}
function givenOf(b: BranchDef): number {
  return b.hide === 'tip' ? b.middle : b.tip
}

/** The four options for a missing number, unsorted: the right one and three neighbours of it. */
function optionsFor(missing: number, total: number, offsets: number[], branchIdx: number): number[] {
  const pool = offsets
    .map((d) => missing + d)
    .filter((v, i, all) => v >= 1 && v < total && v !== missing && all.indexOf(v) === i)
  // Three neighbours in a row out of the pool: the number and the branch decide where
  // the run starts, so now all three are under the answer, now all over it, now mixed.
  const start = (missing + branchIdx) % pool.length
  return [missing, ...[0, 1, 2].map((k) => pool[(start + k) % pool.length])]
}

// The drawing, in a 240×240 box: a soft star behind, a hub, a ring of five middle
// circles and a ring of five tip circles.
const BOX = 240
const CENTER = 120
const HUB_R = 30
const NODE_R = 19
const MID_RING = 56
const TIP_RING = 99
const STAR_OUTER = 119
const STAR_INNER = 72

type Point = [number, number]
const round1 = (n: number) => Math.round(n * 10) / 10

/** A point `radius` away from the centre at `degrees` clockwise from straight up. */
function polar(radius: number, degrees: number): Point {
  const a = (degrees * Math.PI) / 180
  return [round1(CENTER + radius * Math.sin(a)), round1(CENTER - radius * Math.cos(a))]
}

interface Layout {
  middles: Point[]
  tips: Point[]
  /** The points of the star behind, as an SVG polygon. */
  star: string
}
function layoutOf(branches: number): Layout {
  const step = 360 / branches
  const middles: Point[] = []
  const tips: Point[] = []
  const star: Point[] = []
  for (let i = 0; i < branches; i++) {
    middles.push(polar(MID_RING, step * i))
    tips.push(polar(TIP_RING, step * i))
    star.push(polar(STAR_OUTER, step * i), polar(STAR_INNER, step * i + step / 2))
  }
  return { middles, tips, star: star.map((p) => p.join(',')).join(' ') }
}
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

interface LevelContent {
  star: StarDef
  /** The options of every branch's missing number, in their (frozen) display order. */
  options: number[][]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const star = pickOne(lvl.stars)
    return {
      star,
      options: star.branches.map((b, i) => shuffle(optionsFor(missingOf(b), star.total, lvl.offsets, i))),
    }
  })
}

/** A tap this soon after the tap that brought the screen here ("Empezar", "Siguiente nivel", "Repetir"), or
 * after an accepted answer, is the second tap of a double tap: the options sit right where that button was
 * (or are about to be replaced by the next branch's) and it must not be judged against them. Long enough to
 * swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400
/** The pause after the very last number, so the finished star can be seen. */
const CLOSE_MS = 900

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena cabeza para los números!']
const PRAISE_LAST = ['¡Qué cierre!', '¡Lo lograste!', '¡Excelente final!']
const HINTS = ['Casi. Contá cuánto le falta para llegar al total.', 'Todavía no. Probá con otro de los que quedan.', 'No es ese. Probá con otro.']
// Never says the 30 days were all done: a day can be opened without the ones before it.
const CLOSING_MESSAGE = '¡Llegaste al último día de este mes! Completar esta estrella es un logro para celebrar.'

// The inks of the drawing (amber for the star, slate for the numbers, blue for the branch in focus).
const AMBER_SOFT = '#FEF3C7'
const AMBER_SPOKE = '#FCD34D'
const AMBER_RING = '#D97706'
const SLATE_RING = '#334155'
const SLATE_DASH = '#94A3B8'
const SLATE_TEXT = '#64748B'
const BLUE = '#1B6FC4'
const GREEN = '#4CA52E'
const INK = '#0F172A'

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  // Two short steps and a one-line example keep "Empezar" on screen on a 740px-tall phone.
  const steps = [
    'En el centro de la estrella está el total. Los dos números de cada rama lo suman.',
    'En cada rama falta uno: tocá el que la completa.',
  ]
  const circle = 'flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg font-bold'
  return (
    <div className="mt-4 rounded-3xl border border-cyan-600/20 bg-cyan-600/5 p-4 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-3 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-2xl bg-white p-3 text-center">
        <p className="text-sm font-semibold text-slate-500">Si el total es 10 y una rama tiene el 4…</p>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-lg font-bold text-slate-700" aria-hidden="true">
          <span className={`${circle} border-slate-700 bg-white text-slate-900`}>4</span>+
          <span className={`${circle} border-dashed border-cyan-600 bg-cyan-50 text-cyan-800`}>?</span>=
          <span className={`${circle} border-amber-600 bg-amber-300 text-slate-900`}>10</span>
        </div>
        <p className="mt-2 text-base text-slate-700">
          …falta el <span className="font-bold text-cyan-800">6</span>, porque 4 + 6 = 10.
        </p>
      </div>
      {/* Pinned to the bottom edge when the screen is too short to show it in place (320x640). */}
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
  content: LevelContent
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, content, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { star, options } = content
  const { branches, total } = star
  const layout = layoutOf(branches.length)

  // How many branches are completed: the branch in focus is `filled`, clockwise from the top.
  const [filled, setFilled] = useState(0)
  const [wrongOptions, setWrongOptions] = useState<number[]>([])
  const [closing, setClosing] = useState(false)
  const [done, setDone] = useState(false)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Options already tapped for this branch: a second tap is ONE tap, even when both land
  // before React has repainted it as disabled.
  const tappedRef = useRef<Set<number>>(new Set())
  // When the last answer was accepted (the click's own timeStamp): the options have already
  // changed to the next branch's, so a double tap on that spot must not be judged against them.
  const acceptedAtRef = useRef(Number.NEGATIVE_INFINITY)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(closeTimerRef.current), [])

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!done || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [done])

  // The branch in focus (once the last one is filled it stays the last one, with its options greyed out).
  const focus = Math.min(filled, branches.length - 1)
  const branch = branches[focus]
  const showingBranch = !done && !closing
  const answer = missingOf(branch)

  function handlePick(value: number, at: number) {
    if (!showingBranch || tappedRef.current.has(value)) return
    // The second tap of a double tap on the button that brought the level, or on the answer that was just accepted.
    if (at - since < SETTLE_MS || at - acceptedAtRef.current < SETTLE_MS) return
    tappedRef.current.add(value)
    if (value === answer) {
      acceptedAtRef.current = at
      tappedRef.current = new Set()
      setWrongOptions([])
      setFilled(filled + 1)
      if (filled + 1 >= branches.length) {
        setHint({ text: `¡Eso es! Las ${branches.length} ramas suman ${total}.`, ok: true })
        setClosing(true)
        closeTimerRef.current = window.setTimeout(() => {
          setPraise(pickOne(isLast ? PRAISE_LAST : PRAISE))
          setDone(true)
          onSolved()
        }, CLOSE_MS)
      } else {
        setHint(null)
      }
    } else {
      setWrongOptions((w) => [...w, value])
      const given = givenOf(branch)
      // The first miss of a branch turns it into a question; the next ones just encourage.
      setHint({
        text:
          wrongOptions.length === 0
            ? `¿Cuánto le falta a ${given} para llegar a ${total}?`
            : HINTS[(wrongOptions.length - 1) % HINTS.length],
        ok: false,
      })
      onMistake()
    }
  }

  /** What a circle shows: its number, or "?" while it is missing. */
  function valueOf(b: BranchDef, which: 'tip' | 'middle', branchIdx: number): number | null {
    return b.hide === which && branchIdx >= filled ? null : b[which]
  }

  const prompt = 'Elegí el número que falta en la rama resaltada.'
  const label = `Estrella: el total del centro es ${total}. ${branches
    .map((b, i) => {
      const t = valueOf(b, 'tip', i)
      const m = valueOf(b, 'middle', i)
      return `Rama ${i + 1}: punta ${t ?? 'falta'}, medio ${m ?? 'falta'}.`
    })
    .join(' ')}`

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {showingBranch && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Número {filled + 1} de {branches.length}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              Cada rama suma {total}
            </h2>
          </>
        )}
      </div>

      {/* The star */}
      {!done && (
        <div role="img" aria-label={label} className="mx-auto mt-2 aspect-square w-full max-w-[280px]">
          <svg viewBox={`0 0 ${BOX} ${BOX}`} className="h-full w-full" aria-hidden="true" focusable="false">
            <polygon points={layout.star} fill={AMBER_SOFT} />
            {branches.map((_, i) => (
              <line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={layout.tips[i][0]}
                y2={layout.tips[i][1]}
                stroke={showingBranch && i === focus ? BLUE : AMBER_SPOKE}
                strokeWidth={showingBranch && i === focus ? 7 : 5}
                strokeLinecap="round"
              />
            ))}
            {/* The total */}
            <circle cx={CENTER} cy={CENTER} r={HUB_R} fill="#FCD34D" stroke={AMBER_RING} strokeWidth="3" />
            <text
              x={CENTER}
              y={CENTER}
              textAnchor="middle"
              dominantBaseline="central"
              fill={INK}
              fontSize={total >= 100 ? 24 : 28}
              fontWeight="700"
            >
              {total}
            </text>
            {branches.map((b, i) =>
              (['middle', 'tip'] as const).map((which) => {
                const [x, y] = which === 'middle' ? layout.middles[i] : layout.tips[i]
                const value = valueOf(b, which, i)
                const isFocus = showingBranch && i === focus && value === null
                const justFilled = b.hide === which && i < filled
                const stroke = isFocus ? BLUE : justFilled ? GREEN : value === null ? SLATE_DASH : SLATE_RING
                const fill = isFocus ? '#DBEAFE' : justFilled ? '#E1F2DB' : '#FFFFFF'
                return (
                  <g key={`${i}-${which}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={NODE_R}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isFocus ? 4 : 3}
                      strokeDasharray={value === null && !isFocus ? '5 4' : undefined}
                    />
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill={value === null ? (isFocus ? BLUE : SLATE_TEXT) : INK}
                      fontSize={value !== null && value >= 100 ? 15 : 19}
                      fontWeight="700"
                    >
                      {value === null ? '?' : value}
                    </text>
                  </g>
                )
              }),
            )}
          </svg>
        </div>
      )}

      {/* Options for the missing number in focus */}
      {!done && (
        <>
          <div className="mx-auto mt-2 grid max-w-sm grid-cols-4 gap-2" role="group" aria-label="Opciones">
            {options[focus].map((value) => {
              const isWrong = showingBranch && wrongOptions.includes(value)
              const isRightShown = closing && value === answer
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isWrong || closing}
                  onClick={(e) => handlePick(value, e.timeStamp)}
                  className={[
                    'relative flex min-h-[56px] items-center justify-center rounded-2xl border-2 text-2xl font-bold tabular-nums transition',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isRightShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : closing
                        ? 'border-slate-200 bg-slate-50 text-slate-300'
                        : isWrong
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                          : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {value}
                  {isRightShown && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-2 min-h-[3rem] text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text ?? (showingBranch ? prompt : '')}
          </p>
        </>
      )}

      {/* Level complete: the star gives its room to the card */}
      {done && (
        <div ref={resultRef} className="mt-5 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            {isLast
              ? CLOSING_MESSAGE
              : `Las ${branches.length} ramas suman ${total}. ¡Completaste el ${level.name.toLowerCase()}!`}
          </p>
          <div className="mt-5 flex justify-center">
            {isLast ? (
              <button
                type="button"
                onClick={(e) => onRepeat(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => onNext(e.timeStamp)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark scroll-mb-5"
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

export function LaEstrellaDeSumas({ onComplete }: GameProps) {
  // Which star each level plays, and the order of every missing number's options —
  // decided once, at mount, so "Repetir" replays exactly the same content.
  const [epoch] = useState(buildEpoch)
  // The how-to screen shows once per opening of the day; "Repetir" never
  // brings it back.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_NUMBERS })
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Completá la estrella</h2>
        </div>
        <HowToPlay onStart={handleStart} />
      </div>
    )
  }

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      content={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
