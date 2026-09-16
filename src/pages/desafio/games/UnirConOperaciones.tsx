import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Unir con operaciones" — día 4 (praxias). The arithmetic variant of
 * connect-the-dots: instead of tapping dots labelled with a plain sequence
 * (numbers or letters — see UniendoPuntos.tsx), every dot here is labelled
 * with a small arithmetic operation (e.g. "6 × 3") whose RESULT is that
 * dot's position in the sequence, 1, 2, 3… The player has to resolve each
 * candidate dot's operation mentally to know whether it's the next one —
 * the spatial scatter gives no order hints, only the arithmetic does.
 *
 * Reuses UniendoPuntos' scattered-dots-plus-SVG-trail approach (an absolute-
 * positioned button per dot, an SVG polyline overlay extended one segment
 * per correct tap, tap-ORDER-only validation, a muted wiggle + gentle hint
 * on a wrong tap, no timer, double-tap safe) but differs from it in every
 * way this brief calls for:
 *  - Dots are hand-authored coordinate lists — 9 silhouettes (a house, a
 *    boat, a fish, a star, a cat's head — 3 per level) — instead of a
 *    procedural star-polygon. An arithmetic result-sequence can't be
 *    "rotated" for freshness the way UniendoPuntos' star can (rotating a
 *    hand-drawn house would just scatter its dots without changing the
 *    operations), so variety instead comes from picking 2 of each level's 3
 *    shapes per attempt and re-rolling every dot's operands each time.
 *  - Dots show a full EXPRESSION ("24 ÷ 8"), not a bare digit/letter, so
 *    they render as small rounded chips sized to fit that text rather than
 *    perfect circles.
 *  - The finished drawing stays ON SCREEN — closed polyline plus a soft
 *    fill — instead of being swapped out for a text-only completion card.
 *    The reveal IS this game's payoff, so hiding it the instant it appears
 *    (as UniendoPuntos does) would undercut the whole point.
 *  - Adds a "rounds per level" tier UniendoPuntos doesn't have: each of the
 *    3 levels is played twice (2 different shapes) before advancing, so one
 *    full attempt draws 6 pictures, not 3.
 *
 * Difficulty ramps by dot count AND operator set: L1 (7 dots) only uses
 * +/−; L2 (10 dots) adds ×; L3 (12 dots) adds ÷. The brief suggested L3
 * could run up to 15 dots — reduced to 12 here and said so in the report:
 * an operation chip has to carry text like "21 − 9" or "24 ÷ 2", which needs
 * a lot more room than a single digit, and 12 was the count that let every
 * authored L3 silhouette keep a comfortable gap between dots on a 375px-wide
 * canvas (see MIN_SEPARATION_HINT below the shape data).
 */

type Op = '+' | '−' | '×' | '÷'

interface Level {
  n: number
  name: string
  dotCount: number
  ops: Op[]
}

const ROUNDS_PER_LEVEL = 2

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', dotCount: 7, ops: ['+', '−'] },
  { n: 2, name: 'Nivel 2', dotCount: 10, ops: ['+', '−', '×'] },
  { n: 3, name: 'Nivel 3', dotCount: 12, ops: ['+', '−', '×', '÷'] },
]

// Fixed across the whole catalog's onComplete contract: mistakes plus every
// dot in the attempt (3 levels × 2 rounds each), never a running tally —
// every shape below has exactly its level's dotCount, so this is a
// compile-time constant, not something that needs to be counted at runtime.
const TOTAL_DOTS = LEVELS.reduce((sum, lvl) => sum + lvl.dotCount, 0) * ROUNDS_PER_LEVEL

interface Point {
  x: number
  y: number
}

// ── Authored silhouettes ─────────────────────────────────────────────────
// Coordinates are normalised 0-100 so they scale to any canvas size. Each
// array is already in TAP ORDER — point[i] is the dot for result i+1 — same
// convention as UniendoPuntos' epochPoints, so connecting them 1→2→3…
// traces the silhouette directly, no separate order-to-position mapping
// needed.
//
// MIN_SEPARATION_HINT: dots render as chips sized ~44-56px tall (see
// DOT_CLASS) and up to ~70px wide to fit text like "21 − 9". Every shape
// below was authored keeping pairwise point distance at or above roughly
// 16-20 normalised units depending on level (tighter chips at L3 allow a
// smaller gap) — verified with a throwaway script against the actual pixel
// footprint, not just eyeballed. If you add or edit a shape, re-verify.

const HOUSE_L1: Point[] = [
  { x: 15, y: 88 },
  { x: 85, y: 88 },
  { x: 85, y: 55 },
  { x: 78, y: 30 },
  { x: 58, y: 30 },
  { x: 48, y: 12 },
  { x: 15, y: 55 },
]

const BOAT_L1: Point[] = [
  { x: 15, y: 80 },
  { x: 85, y: 80 },
  { x: 68, y: 60 },
  { x: 68, y: 15 },
  { x: 85, y: 25 },
  { x: 66, y: 34 },
  { x: 28, y: 60 },
]

const FISH_L1: Point[] = [
  { x: 12, y: 50 },
  { x: 28, y: 30 },
  { x: 55, y: 25 },
  { x: 82, y: 15 },
  { x: 65, y: 50 },
  { x: 82, y: 85 },
  { x: 45, y: 72 },
]

const STAR_L2: Point[] = [
  { x: 50, y: 12 },
  { x: 60.0, y: 36.3 },
  { x: 86.1, y: 38.3 },
  { x: 66.2, y: 55.3 },
  { x: 72.3, y: 80.7 },
  { x: 50, y: 67 },
  { x: 27.7, y: 80.7 },
  { x: 33.8, y: 55.3 },
  { x: 13.9, y: 38.3 },
  { x: 40.0, y: 36.3 },
]

const CAT_L2: Point[] = [
  { x: 22, y: 14 },
  { x: 50, y: 32 },
  { x: 78, y: 14 },
  { x: 70, y: 36 },
  { x: 86, y: 58 },
  { x: 68, y: 82 },
  { x: 50, y: 90 },
  { x: 32, y: 82 },
  { x: 14, y: 58 },
  { x: 30, y: 36 },
]

const BOAT_L2: Point[] = [
  { x: 10, y: 80 },
  { x: 50, y: 88 },
  { x: 90, y: 80 },
  { x: 76, y: 62 },
  { x: 56, y: 62 },
  { x: 56, y: 12 },
  { x: 75, y: 22 },
  { x: 56, y: 31 },
  { x: 38, y: 50 },
  { x: 20, y: 62 },
]

const FISH_L3: Point[] = [
  { x: 10, y: 50 },
  { x: 22, y: 30 },
  { x: 40, y: 28 },
  { x: 48, y: 8 },
  { x: 58, y: 30 },
  { x: 72, y: 12 },
  { x: 90, y: 8 },
  { x: 70, y: 50 },
  { x: 88, y: 88 },
  { x: 60, y: 74 },
  { x: 40, y: 84 },
  { x: 26, y: 68 },
]

const CAT_L3: Point[] = [
  { x: 22, y: 12 },
  { x: 28, y: 32 },
  { x: 40, y: 18 },
  { x: 60, y: 18 },
  { x: 72, y: 32 },
  { x: 78, y: 12 },
  { x: 90, y: 52 },
  { x: 72, y: 82 },
  { x: 50, y: 92 },
  { x: 28, y: 82 },
  { x: 10, y: 52 },
  { x: 10, y: 34 },
]

const HOUSE_L3: Point[] = [
  { x: 10, y: 90 },
  { x: 32, y: 90 },
  { x: 32, y: 66 },
  { x: 50, y: 66 },
  { x: 50, y: 90 },
  { x: 90, y: 90 },
  { x: 90, y: 58 },
  { x: 76, y: 40 },
  { x: 76, y: 16 },
  { x: 58, y: 16 },
  { x: 44, y: 4 },
  { x: 14, y: 58 },
]

// 3 shapes per level (keyed by Level.n), each exactly that level's dotCount.
const SHAPES: Record<number, Point[][]> = {
  1: [HOUSE_L1, BOAT_L1, FISH_L1],
  2: [STAR_L2, CAT_L2, BOAT_L2],
  3: [FISH_L3, CAT_L3, HOUSE_L3],
}

// ── Generic helpers ──────────────────────────────────────────────────────

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
function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

// ── Operation generation ─────────────────────────────────────────────────
// Every builder returns an expression whose result is EXACTLY k, using only
// positive operands (no negative intermediate values anywhere) and, for
// division, an exact quotient by construction (the dividend is built AS
// k * divisor, never the other way around). k=1 is special-cased out of
// ×/÷ (both null below) because the only options there are trivial
// (1×1, or b÷b) — subtraction covers k=1 comfortably instead (e.g. "5 − 4").

function tryAdd(k: number): string | null {
  if (k < 2) return null // two positive single-digit addends can't sum to 1
  const lo = Math.max(1, k - 9)
  const hi = Math.min(9, k - 1)
  if (lo > hi) return null
  const a = randInt(lo, hi)
  const b = k - a
  return `${a} + ${b}`
}

// Always feasible for any k >= 1 — also used as the guaranteed fallback.
function trySub(k: number): string {
  const b = randInt(1, 6)
  const a = k + b
  return `${a} − ${b}`
}

function tryMul(k: number): string | null {
  if (k < 2 || k > 81) return null
  const pairs: [number, number][] = []
  for (let a = 1; a <= 9; a++) {
    if (k % a === 0) {
      const b = k / a
      if (b >= 1 && b <= 9) pairs.push([a, b])
    }
  }
  if (pairs.length === 0) return null
  const nonTrivial = pairs.filter(([a, b]) => a > 1 && b > 1)
  const [a, b] = pickOne(nonTrivial.length > 0 ? nonTrivial : pairs)
  return `${a} × ${b}`
}

function tryDiv(k: number): string | null {
  if (k < 2) return null
  const b = randInt(2, 6) // divisor — never 1, keeps it a real division fact
  const a = k * b // dividend built from k, so a ÷ b === k exactly
  return `${a} ÷ ${b}`
}

const BUILDERS: Record<Op, (k: number) => string | null> = {
  '+': tryAdd,
  '−': (k) => trySub(k),
  '×': tryMul,
  '÷': tryDiv,
}

function exprFor(k: number, allowedOps: Op[]): string {
  for (const op of shuffle(allowedOps)) {
    const result = BUILDERS[op](k)
    if (result) return result
  }
  return trySub(k) // guaranteed fallback, feasible for every k >= 1
}

// ── Round / epoch construction ───────────────────────────────────────────

interface Dot extends Point {
  expression: string
}
interface Stage {
  dots: Dot[]
}

function buildDots(level: Level, shape: Point[]): Dot[] {
  return shape.map((p, i) => ({ x: p.x, y: p.y, expression: exprFor(i + 1, level.ops) }))
}

// One full attempt: for every level, pick 2 of its 3 shapes (so a replay's
// two rounds never repeat a drawing) and generate fresh operations for each.
function buildEpoch(): Stage[][] {
  return LEVELS.map((level) => {
    const shapeIndices = shuffle([0, 1, 2]).slice(0, ROUNDS_PER_LEVEL)
    return shapeIndices.map((idx) => ({ dots: buildDots(level, SHAPES[level.n][idx]) }))
  })
}

const DOT_CLASS: Record<number, string> = {
  1: 'min-h-14 px-2.5 text-sm sm:text-base',
  2: 'min-h-12 px-2 text-sm',
  3: 'min-h-11 px-1.5 text-xs',
}

const PRAISE = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen cálculo!', '¡Perfecto dibujo!']

export function UnirConOperaciones({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundInLevel, setRoundInLevel] = useState(0)
  const [roundKey, setRoundKey] = useState(0)

  // Regenerated only on a genuine restart (roundKey bump) — moving between
  // rounds/levels within the same attempt reuses this same plan, same
  // reasoning as UniendoPuntos' epochPoints.
  const epoch = useMemo(() => buildEpoch(), [roundKey])
  const level = LEVELS[levelIdx]
  const dots = epoch[levelIdx][roundInLevel].dots

  const [foundCount, setFoundCount] = useState(0)
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [wrongHint, setWrongHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across every round of every level, zeroed only on a genuine
  // restart (restartEpoch) — never just by advancing to the next drawing.
  const [mistakes, setMistakes] = useState(0)

  const done = foundCount >= dots.length
  const isFinalStage = levelIdx === LEVELS.length - 1 && roundInLevel === ROUNDS_PER_LEVEL - 1

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function handleTap(i: number) {
    if (done) return
    if (i < foundCount) return // already found, silent no-op

    if (i === foundCount) {
      setFoundCount((c) => c + 1)
      setWrongIdx(null)
      setWrongHint(null)
      return
    }

    setWrongIdx(i)
    setWrongHint(`Todavía no — buscá la cuenta que dé ${foundCount + 1}.`)
    setMistakes((m) => m + 1)
    window.setTimeout(() => {
      setWrongIdx((v) => (v === i ? null : v))
      setWrongHint(null)
    }, 1500)
  }

  // Resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundInLevel/roundKey — never in a useEffect keyed on them. An
  // effect lags one render behind, so `done` (derived straight from
  // foundCount) would read the previous stage's stale-true value on the very
  // render that arrives at the new stage and fire onComplete with garbage —
  // same hazard already fixed this way across every other game here.
  function advanceStage() {
    if (roundInLevel < ROUNDS_PER_LEVEL - 1) {
      setRoundInLevel((r) => r + 1)
    } else {
      setLevelIdx((i) => i + 1)
      setRoundInLevel(0)
    }
    setFoundCount(0)
    setWrongIdx(null)
    setWrongHint(null)
  }
  // "Repetir" — the only true restart: back to level 1 round 1, mistakes
  // cleared, and a fresh shape pick + fresh operations for the whole attempt.
  function restartEpoch() {
    setLevelIdx(0)
    setRoundInLevel(0)
    setFoundCount(0)
    setWrongIdx(null)
    setWrongHint(null)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey, only once the very last round of the very last
  // level is solved.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && isFinalStage && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_DOTS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundInLevel, roundKey])

  const nextLabel = roundInLevel < ROUNDS_PER_LEVEL - 1 ? 'Siguiente dibujo' : 'Siguiente nivel'

  const trail = dots.slice(0, foundCount)
  const trailStr = trail.map((p) => `${p.x},${p.y}`).join(' ')
  const closedTrailStr = done && dots.length > 0 ? `${trailStr} ${dots[0].x},${dots[0].y}` : trailStr

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Uní los puntos según el resultado</h2>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          Dibujo {roundInLevel + 1} de {ROUNDS_PER_LEVEL}
        </p>
      </div>

      {!done && (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-2xl font-black text-slate-800">
            {foundCount + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">Buscá el resultado</p>
            <p className="text-base font-semibold text-slate-500">
              Llevás {foundCount} de {dots.length}
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(foundCount / dots.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Scatter canvas — stays visible after completion so the finished
          drawing (the whole payoff) doesn't vanish the instant it appears. */}
      <div className="relative mx-auto mt-5 aspect-square w-full max-w-[380px] rounded-3xl border-2 border-slate-100 bg-slate-50/60">
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          {done && (
            <polygon points={dots.map((p) => `${p.x},${p.y}`).join(' ')} fill="#4CA52E" fillOpacity="0.14" />
          )}
          <polyline
            points={closedTrailStr}
            fill="none"
            stroke="#4CA52E"
            strokeWidth="1.2"
            strokeOpacity="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {dots.map((dot, i) => {
          const isFound = i < foundCount
          const isWrongFlash = wrongIdx === i
          return (
            <button
              key={i}
              type="button"
              disabled={isFound || done}
              onClick={() => handleTap(i)}
              aria-label={`Operación ${dot.expression}`}
              style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
              className={[
                'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center whitespace-nowrap',
                'rounded-2xl border-2 font-bold leading-none transition-all duration-500',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                // Once the drawing closes the chips collapse to small dots.
                // They are opaque boxes sitting exactly on the outline, so at
                // full size they hide the very silhouette the round was for —
                // and by then the operations have already done their job.
                done ? 'h-3 w-3 border-tiam-green bg-tiam-green p-0 text-[0px]' : DOT_CLASS[level.n],
                !done && isFound
                  ? 'border-tiam-green bg-white text-slate-700 ring-2 ring-tiam-green/30'
                  : '',
                !done && !isFound && isWrongFlash
                  ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-400 bg-white text-slate-700'
                  : '',
                !done && !isFound && !isWrongFlash
                  ? 'border-slate-200 bg-white text-slate-700 hover:border-tiam-blue/40 hover:shadow-md active:scale-95'
                  : '',
              ].join(' ')}
            >
              {!done && dot.expression}
              {isFound && !done && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {wrongHint && !done && <p className="mt-4 text-center text-base font-medium text-slate-500">{wrongHint}</p>}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">¡Uniste los {dots.length} puntos y descubriste el dibujo!</p>
          {!isFinalStage ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={advanceStage}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                {nextLabel}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={restartEpoch}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                <RotateCcw className="h-4 w-4" />
                Repetir
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
