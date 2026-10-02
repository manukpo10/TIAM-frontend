import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Diagramas que suman" — día 13, mes 5, ejecutivas. A diagram of circles
 * joined by lines, some circles already filled; below it, a bank with the
 * numbers that are missing. Tap a number (it lights up), then tap an empty
 * circle to put it there; tap a number you already placed to take it back. The
 * goal: EVERY line of the diagram adds up to the same total. Planning where a
 * number goes when it counts for two lines at once (the circle where two lines
 * cross) is the executive part.
 *
 * Validated by the SUMS, never against a stored answer: a diagram is solved when
 * every circle is full and every line adds up to the total, so any valid
 * arrangement is accepted (in the triangle, the two numbers of a side can swap
 * places and both are right). Under the diagram, one chip per line shows what
 * that line adds up to right now ("12/15") and turns green with a check when
 * it is right. A line that is full but wrong shows muted gray (never red), the
 * hint says by how much it is off, and that placement costs ONE mistake — and
 * only one: a single wrong number in a circle that several lines share (the
 * centre of the star) breaks every one of them, but it is the same wrong
 * placement, so while a wrong line is standing the lines it drags down with it
 * are not charged again (`chargesMistake`); changing a number that was already
 * placed and still getting a line wrong is a new try and is charged. Taking a
 * number back costs nothing, and nothing is timed.
 *
 * Double taps are judged by the click's own timeStamp. A quick second tap on the circle
 * that was JUST filled (or emptied) is not a request to take the number back (it used to
 * empty the circle again): that circle is ignored for SETTLE_MS. So is a second tap on the
 * bank number that was JUST picked (it used to put it straight back down), and so is every
 * tap within SETTLE_MS of the tap that brought the level ("Empezar", "Siguiente nivel",
 * "Repetir"), whose second tap would otherwise pick a number or poke a circle of the new
 * diagram. Once the diagram is solved the bank and the line chips have nothing left to
 * say, so the result card takes their room and is also scrolled into view if the phone
 * is short.
 *
 * Lines are told apart by a letter in a coloured tag at one end of the line
 * (A, B, C) and by the same letter and colour in its chip, so colour is never
 * the only cue. The three inks (azul, verde, violeta) are far apart in the
 * catalog's palette. Targets: the numbered circles are real buttons over the
 * drawing, 46 units of a 240-unit box (≥ 44px even on a 320px phone), and no
 * two circles are closer than 52 units.
 *
 * The diagram is an SVG for the lines and tags, with the circles as buttons
 * placed on the same 240×240 coordinates (percentages, so they follow the drawing
 * at any width). Ramp: a CROSS (2 lines sharing the centre, 3 numbers to place)
 * → a STAR (3 lines through the centre, 4 numbers) → a TRIANGLE with two
 * circles per side (3 lines of 4 circles, corners counting for two lines, 5
 * numbers). Both triangles leave a corner empty (one has two empty corners), so
 * the circle two sides share has to be planned for, like the centre before it. A
 * throwaway Node script (not committed) solved every puzzle by brute force over
 * all the ways to place its bank: each has at least one valid arrangement (one
 * for most, two for the second cross and the second triangle, whose side numbers
 * can swap), the bank has exactly one number per empty circle, and all the
 * numbers of a diagram are different.
 *
 * ONE diagram per level: each level has two authored puzzles and one is picked
 * ONCE at mount (`epoch`, together with the order of the bank), so "Repetir"
 * replays exactly the same three. Per-level state lives in <LevelView>, keyed by
 * run + level. A "¿Cómo se juega?" screen opens the day; "Repetir" never brings
 * it back.
 *
 * totalAttempts = mistakes + every number to place (TOTAL_NUMBERS, derived).
 */

// ── data:start ──
type Point = [number, number]

interface Shape {
  /** Centre of every circle, in a 240×240 box. */
  nodes: Point[]
  /** The circles each line passes through, in order. */
  lines: number[][]
  /** Where the lettered tag of each line sits: just outside the circles. */
  tags: Point[]
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Two lines crossing in the middle: a plus sign. */
function buildCross(): Shape {
  const c = 120
  const arm = 66
  return {
    nodes: [
      [c, c - arm], // 0 arriba
      [c - arm, c], // 1 izquierda
      [c, c], // 2 centro
      [c + arm, c], // 3 derecha
      [c, c + arm], // 4 abajo
    ],
    lines: [
      [1, 2, 3],
      [0, 2, 4],
    ],
    tags: [
      [c + arm + 36, c],
      [c, c - arm - 36],
    ],
  }
}

/** Three lines through the centre: six circles around one in the middle. */
function buildStar(): Shape {
  const c = 120
  const r = 70
  const at = (radius: number, degrees: number): Point => [
    round1(c + radius * Math.sin((degrees * Math.PI) / 180)),
    round1(c - radius * Math.cos((degrees * Math.PI) / 180)),
  ]
  return {
    nodes: [0, 60, 120, 180, 240, 300].map((deg) => at(r, deg)).concat([[c, c]]),
    lines: [
      [0, 6, 3],
      [1, 6, 4],
      [2, 6, 5],
    ],
    tags: [at(r + 36, 0), at(r + 36, 60), at(r + 36, 120)],
  }
}

/** A triangle with two circles on every side: its corners count for two lines. */
function buildTriangle(): Shape {
  const top: Point = [120, 30]
  const left: Point = [round1(120 - 84.9), 177]
  const right: Point = [round1(120 + 84.9), 177]
  const lerp = (a: Point, b: Point, t: number): Point => [
    round1(a[0] + (b[0] - a[0]) * t),
    round1(a[1] + (b[1] - a[1]) * t),
  ]
  return {
    nodes: [
      top, // 0
      lerp(top, left, 1 / 3), // 1
      lerp(top, left, 2 / 3), // 2
      left, // 3
      lerp(left, right, 1 / 3), // 4
      lerp(left, right, 2 / 3), // 5
      right, // 6
      lerp(right, top, 1 / 3), // 7
      lerp(right, top, 2 / 3), // 8
    ],
    lines: [
      [0, 1, 2, 3],
      [3, 4, 5, 6],
      [6, 7, 8, 0],
    ],
    tags: [
      [43, 83.5],
      [120, 217],
      [197, 83.5],
    ],
  }
}

interface PuzzleDef {
  /** What every line must add up to. */
  total: number
  /** Circles that come filled and locked: circle → number. */
  givens: Record<number, number>
  /** The numbers to place: exactly one per empty circle. */
  bank: number[]
}
interface LevelDef {
  name: string
  shape: Shape
  puzzles: PuzzleDef[]
}

// Every puzzle of a level has the same number of numbers to place, so
// TOTAL_NUMBERS never depends on which one is drawn.
const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    shape: buildCross(),
    puzzles: [
      { total: 15, givens: { 0: 4, 1: 5 }, bank: [3, 7, 8] },
      { total: 12, givens: { 0: 2, 4: 3 }, bank: [1, 4, 7] },
    ],
  },
  {
    name: 'Nivel 2',
    shape: buildStar(),
    puzzles: [
      { total: 15, givens: { 0: 2, 4: 7, 2: 4 }, bank: [3, 5, 6, 8] },
      { total: 14, givens: { 3: 9, 1: 4, 5: 6 }, bank: [2, 3, 5, 7] },
    ],
  },
  {
    name: 'Nivel 3',
    shape: buildTriangle(),
    puzzles: [
      { total: 17, givens: { 0: 1, 1: 4, 4: 5, 7: 6 }, bank: [2, 3, 7, 8, 9] },
      { total: 20, givens: { 0: 1, 1: 3, 4: 2, 6: 5 }, bank: [4, 6, 7, 8, 9] },
    ],
  },
]

const TOTAL_NUMBERS = LEVELS.reduce((sum, lvl) => sum + lvl.puzzles[0].bank.length, 0)

/** What a line adds up to with the circles that are filled so far. */
function lineSum(line: number[], values: (number | null)[]): { sum: number; full: boolean } {
  let sum = 0
  let full = true
  for (const node of line) {
    const v = values[node]
    if (v === null) full = false
    else sum += v
  }
  return { sum, full }
}

/** Solved when every line is full and adds up to the total — any arrangement that does. */
function isSolved(shape: Shape, total: number, values: (number | null)[]): boolean {
  return shape.lines.every((line) => {
    const { sum, full } = lineSum(line, values)
    return full && sum === total
  })
}

/**
 * Does a placement that leaves a full line wrong cost a mistake? Yes when it is a new
 * try (the circle already held a number of the player's), or when no wrong line was
 * standing before. No when it only fills an empty circle and completes a line next to
 * a wrong line that is already standing and shares a circle the player placed: the
 * same wrong number is breaking both, and it was already charged once.
 */
function chargesMistake(
  shape: Shape,
  total: number,
  givens: Record<number, number>,
  before: (number | null)[],
  after: (number | null)[],
  node: number,
  replaced: boolean,
): boolean {
  const isWrong = (values: (number | null)[], line: number[]) => {
    const { sum, full } = lineSum(line, values)
    return full && sum !== total
  }
  const brokenNow = shape.lines.filter((line) => line.includes(node) && isWrong(after, line))
  if (brokenNow.length === 0) return false
  if (replaced) return true
  const standing = shape.lines.filter((line) => isWrong(before, line))
  return !brokenNow.every((line) =>
    standing.some((other) => other.some((c) => c !== node && line.includes(c) && !(c in givens))),
  )
}
// ── data:end ──

/** How long a double tap is swallowed: a circle that was just filled or emptied, a bank number that was
 * just picked, and everything right after the button that brought the level. Long enough to swallow a
 * double tap, short enough that nobody who really wants to take the number back, put it down or start
 * playing notices. */
const SETTLE_MS = 400

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
  puzzle: PuzzleDef
  /** The bank in its (frozen) display order: slot i always holds the same number. */
  bank: number[]
}

function buildEpoch(): LevelContent[] {
  return LEVELS.map((lvl) => {
    const puzzle = pickOne(lvl.puzzles)
    return { puzzle, bank: shuffle(puzzle.bank) }
  })
}

const PRAISE = ['¡Muy bien!', '¡Excelente razonamiento!', '¡Así se hace!', '¡Perfecto!', '¡Qué buena cabeza para los números!']
const LINE_LETTERS = ['A', 'B', 'C']
// Azul, verde y violeta of the catalog: far apart from each other.
const LINE_COLORS = ['#1678D4', '#05741C', '#7E0197']

const BOX = 240
/** Circle diameter in box units: 46 of 240 is ≥ 44px down to a 230px-wide diagram. */
const CIRCLE = 46
const pct = (n: number) => `${(n / BOX) * 100}%`

function HowToPlay({ onStart }: { onStart: (at: number) => void }) {
  const steps = [
    'Tocá un número de abajo: queda marcado.',
    'Después tocá un círculo vacío para ponerlo. Si te equivocás, tocá el número puesto y ese número vuelve abajo.',
    'Cada línea tiene que sumar el mismo total.',
  ]
  const circle = 'flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg font-bold'
  return (
    <div className="mt-4 rounded-3xl border border-indigo-600/20 bg-indigo-600/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-2xl bg-white p-3 text-center">
        <p className="text-sm font-semibold text-slate-500">Esta línea tiene que sumar 12</p>
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className={`${circle} border-slate-700 bg-slate-700 text-white`}>5</span>
          <span className="h-1 w-5 rounded-full bg-slate-300" />
          <span className={`${circle} border-dashed border-indigo-600 bg-indigo-50 text-indigo-700`}>?</span>
          <span className="h-1 w-5 rounded-full bg-slate-300" />
          <span className={`${circle} border-slate-700 bg-slate-700 text-white`}>4</span>
        </div>
        <p className="mt-2 text-base text-slate-700">
          5 + <span className="font-bold text-indigo-700">3</span> + 4 = 12: va el 3.
        </p>
      </div>
      <div className="sticky bottom-3 z-10 mt-5 text-center">
        <button
          type="button"
          onClick={(e) => onStart(e.timeStamp)}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
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
  const { shape } = level
  const { puzzle, bank } = content
  const { total } = puzzle

  // Which bank slot sits in each circle (only circles the player filled).
  const [placed, setPlaced] = useState<Record<number, number>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [flashNode, setFlashNode] = useState<number | null>(null)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])
  // The circle filled (or emptied) last and when (the click's own timeStamp): a second tap on it
  // right after is a double tap.
  const placedAtRef = useRef<{ node: number; at: number } | null>(null)
  // When the bank number that is selected now was selected: a second tap on it right after is a double tap.
  const pickedAtRef = useRef(-Infinity)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const valuesOf = (assign: Record<number, number>): (number | null)[] =>
    shape.nodes.map((_, i) => puzzle.givens[i] ?? (i in assign ? bank[assign[i]] : null))
  const values = valuesOf(placed)
  const usedSlots = new Set(Object.values(placed))
  const solved = isSolved(shape, total, values)
  const filledCount = Object.keys(placed).length

  // A new level opens at its top, not wherever the previous result card left the scroll (a short phone).
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' })
  }, [])

  // A solved level shows its result card and its button even on a short phone: the card first and,
  // when the card is taller than the screen, the button (the part that must not stay below the fold).
  useEffect(() => {
    const card = resultRef.current
    if (!solved || !card) return
    card.scrollIntoView({ block: 'nearest' })
    card.querySelector('button')?.scrollIntoView({ block: 'nearest' })
  }, [solved])

  function place(node: number, slot: number, at: number) {
    const replaced = node in placed
    const next = { ...placed, [node]: slot }
    setPlaced(next)
    setSelected(null)
    placedAtRef.current = { node, at }
    const nextValues = valuesOf(next)

    if (isSolved(shape, total, nextValues)) {
      setHint(null)
      setPraise(pickOne(PRAISE))
      onSolved()
      return
    }
    // Which lines through this circle are now full but wrong?
    const wrong = shape.lines
      .map((line, i) => ({ line, i, ...lineSum(line, nextValues) }))
      .filter((l) => l.line.includes(node) && l.full && l.sum !== total)
    if (wrong.length > 0) {
      const w = wrong[0]
      setFlashNode(node)
      setHint({
        text:
          w.sum > total
            ? `La línea ${LINE_LETTERS[w.i]} suma ${w.sum}: se pasa por ${w.sum - total}. Probá con otros números.`
            : `La línea ${LINE_LETTERS[w.i]} suma ${w.sum}: le faltan ${total - w.sum}. Probá con otros números.`,
        ok: false,
      })
      // The hint and the flash always show; the mistake is charged once per wrong placement.
      if (chargesMistake(shape, total, puzzle.givens, values, nextValues, node, replaced)) onMistake()
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setFlashNode(null), 600)
      return
    }
    const done = shape.lines
      .map((line, i) => ({ i, line, ...lineSum(line, nextValues) }))
      .find((l) => l.line.includes(node) && l.full && l.sum === total)
    setHint(done ? { text: `¡La línea ${LINE_LETTERS[done.i]} suma ${total}!`, ok: true } : null)
  }

  function handleBankTap(slot: number, at: number) {
    // One this soon after the button that brought the level ("Empezar", "Siguiente nivel", "Repetir")
    // is its double tap: the bank sits right where that button was.
    if (solved || usedSlots.has(slot) || at - since < SETTLE_MS) return
    if (selected === slot) {
      // The second tap of a double tap on the number just picked would put it straight back down.
      if (at - pickedAtRef.current < SETTLE_MS) return
      setSelected(null)
      setHint(null)
      return
    }
    pickedAtRef.current = at
    setSelected(slot)
    setHint({ text: 'Ahora tocá un círculo vacío.', ok: false })
  }

  function handleNodeTap(node: number, at: number) {
    // A tap on the circle that is still flashing as wrong, or that was filled (or emptied) a moment
    // ago, is a double tap, not a second move: it must not take the number straight back out. Nor
    // may one this soon after the button that brought the level poke a circle of the new diagram.
    if (solved || flashNode === node || at - since < SETTLE_MS) return
    const last = placedAtRef.current
    if (last !== null && last.node === node && at - last.at < SETTLE_MS) return
    if (node in puzzle.givens) {
      setHint({ text: 'Ese número ya viene fijo. Probá con un círculo vacío.', ok: false })
      return
    }
    if (node in placed) {
      if (selected !== null) {
        // Swap: the number picked from the bank takes the circle, the old one goes back down.
        place(node, selected, at)
        return
      }
      const next = { ...placed }
      delete next[node]
      setPlaced(next)
      setHint(null)
      placedAtRef.current = { node, at }
      return
    }
    if (selected === null) {
      setHint({ text: 'Primero tocá un número de abajo.', ok: false })
      return
    }
    place(node, selected, at)
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <span className="ml-3 align-middle text-base font-semibold text-slate-500">
              Puestos: {filledCount} de {bank.length}
            </span>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
              Cada línea tiene que sumar {total}
            </h2>
          </>
        )}
      </div>

      {/* The diagram: lines and tags in SVG, circles as buttons on the same coordinates */}
      <div role="group" aria-label="Diagrama" className="relative mx-auto mt-2 aspect-square w-full max-w-[280px]">
        <svg viewBox={`0 0 ${BOX} ${BOX}`} className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
          {shape.lines.map((line, i) => (
            <polyline
              key={i}
              points={line.map((n) => shape.nodes[n].join(',')).join(' ')}
              fill="none"
              stroke={LINE_COLORS[i]}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {shape.tags.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="11" fill={LINE_COLORS[i]} stroke="#ffffff" strokeWidth="2" />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize="13"
                fontWeight="700"
              >
                {LINE_LETTERS[i]}
              </text>
            </g>
          ))}
        </svg>

        {shape.nodes.map(([x, y], node) => {
          const given = node in puzzle.givens
          const value = values[node]
          const isFlash = flashNode === node
          const canDrop = selected !== null && value === null
          return (
            <button
              key={node}
              type="button"
              disabled={solved}
              aria-disabled={given}
              onClick={(e) => handleNodeTap(node, e.timeStamp)}
              aria-label={
                given
                  ? `Círculo fijo con el ${value}`
                  : value === null
                    ? 'Círculo vacío'
                    : `Círculo con el ${value}: tocá para sacarlo`
              }
              className={[
                'absolute flex items-center justify-center rounded-full border-2 text-xl font-bold transition',
                'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                given
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : solved
                    ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                    : isFlash
                      ? 'border-slate-300 bg-slate-100 text-slate-500 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                      : value !== null
                        ? 'border-indigo-600 bg-indigo-50 text-slate-900 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                        : canDrop
                          ? 'border-dashed border-indigo-600 bg-indigo-50 text-transparent ring-2 ring-indigo-600/30'
                          : 'border-dashed border-slate-400 bg-white text-transparent',
              ].join(' ')}
              style={{
                left: pct(x),
                top: pct(y),
                width: pct(CIRCLE),
                height: pct(CIRCLE),
                transform: 'translate(-50%, -50%)',
              }}
            >
              {value}
            </button>
          )
        })}
      </div>

      {/* What each line adds up to right now: the tag, the sum so far over the total,
          and a check on the tag once the line is right. Three of them fit one row.
          Once the diagram is solved they all say the same and give way to the card. */}
      {!solved && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {shape.lines.map((line, i) => {
            const { sum, full } = lineSum(line, values)
            const ok = full && sum === total
            const off = full && !ok
            return (
              <span
                key={i}
                className={[
                  'flex min-h-[40px] items-center gap-1 rounded-xl border-2 px-1.5 text-base font-bold',
                  ok
                    ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                    : off
                      ? 'border-slate-300 bg-slate-100 text-slate-500'
                      : 'border-slate-200 bg-white text-slate-700',
                ].join(' ')}
              >
                <span
                  className="relative flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: LINE_COLORS[i] }}
                  aria-hidden="true"
                >
                  {LINE_LETTERS[i]}
                  {ok && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-tiam-green text-white ring-2 ring-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={4} />
                    </span>
                  )}
                </span>
                <span className="sr-only">
                  Línea {LINE_LETTERS[i]}: {sum} de {total}
                  {ok ? ', bien' : ''}
                </span>
                <span className="tabular-nums" aria-hidden="true">
                  {sum}/{total}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {!solved && (
        <>
          {/* The bank: every number keeps its own slot, so nothing shifts when one is placed */}
          <div className="mt-2 flex justify-center gap-2 max-[350px]:gap-1.5" aria-label="Números para poner" role="group">
            {bank.map((n, slot) => {
              const used = usedSlots.has(slot)
              const isSelected = selected === slot
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={used}
                  onClick={(e) => handleBankTap(slot, e.timeStamp)}
                  aria-pressed={isSelected}
                  aria-label={used ? `El ${n} ya está puesto` : `Número ${n}`}
                  className={[
                    'flex h-12 w-12 items-center justify-center rounded-xl border-2 text-xl font-bold transition max-[350px]:h-11 max-[350px]:w-11',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    used
                      ? 'border-dashed border-slate-200 text-transparent'
                      : isSelected
                        ? '-translate-y-0.5 border-indigo-600 bg-indigo-50 text-slate-900 ring-2 ring-indigo-600/30'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-indigo-600/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <p
            role="status"
            className={`mt-2 min-h-[2.5rem] text-center text-base font-medium ${hint?.ok ? 'text-green-700' : 'text-slate-500'}`}
          >
            {hint?.text}
          </p>
        </>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Las {shape.lines.length} líneas suman {total}. ¡Completaste el {level.name.toLowerCase()}!
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

export function DiagramasQueSuman({ onComplete }: GameProps) {
  // Which puzzle each level plays, and the order of the bank — decided once, at
  // mount, so "Repetir" replays exactly the same content.
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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
            {LEVELS[0].name}
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Completá el diagrama</h2>
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
