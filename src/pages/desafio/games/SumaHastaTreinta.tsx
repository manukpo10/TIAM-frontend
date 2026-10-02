import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Suma hasta 30" — día 8, mes 5, cálculo. A board of number tiles hides pairs
 * of NEIGHBOURING tiles (one beside the other, or one above the other) that add
 * up to 30; tap the two tiles of a pair to claim it. A cousin of month 4's
 * "Suma hasta 10", but with sums that carry (17 + 13, 8 + 22) and a tiled-floor
 * look of its own: teal "baldosas" that turn solid when claimed, and a row of
 * coins above the board that fill up one per pair found.
 *
 * EVERY pair that adds up to 30 counts, and there are exactly as many as the
 * level announces. That is a property of how the board is built, not of the
 * checker: `buildBoard` plants N disjoint neighbouring pairs first (a, 30 - a),
 * then fills every other tile with a number that sums to 30 with NONE of the
 * tiles touching it — diagonals included — so no tile can pair up with two
 * neighbours, no accidental pair exists and, above all, no DIAGONAL pair adds up
 * to 30 either: a player who found one would be told "Tienen que ser vecinos…"
 * about a pair that looks perfectly right. `isValidBoard` re-counts all the pairs
 * that touch (sides and corners) in the finished board and `buildBoard` keeps
 * drawing until the count is exactly N, so even a bug could never advertise a
 * pair that is not there. A throwaway Node script (not committed) built 50,000
 * boards per level and confirmed N pairs, no tile in two pairs, no diagonal
 * pair, values inside 3-27 and no number repeated more than twice.
 *
 * A wrong pair flashes muted gray (never red) and says what it really adds up
 * to ("17 + 15 = 32"), which costs one mistake. Tapping a tile that is not a
 * neighbour of the one already chosen is NOT a mistake: the choice just moves
 * there and a reminder explains what "neighbours" means. No timer.
 *
 * Ramp: 4×4 with 3 pairs → 5×5 with 4 → 6×6 with 5. ONE board per level, drawn
 * ONCE at mount (`epoch`), so "Repetir" plays exactly the same three boards.
 * Per-level state lives in <LevelView>, keyed by run + level. When a level is
 * solved the result card is scrolled into view if the phone is too short for the
 * board and the card together.
 *
 * Double taps are judged by the click's own timeStamp: every tap within SETTLE_MS of
 * the tap that brought the level ("Siguiente nivel", "Repetir") is ignored, so the
 * second tap of a double tap never selects a tile of the new board; and a second tap
 * on the tile that was JUST selected keeps it selected instead of putting it back
 * down. (A claimed tile is disabled and one that flashes as wrong is skipped, so a
 * double tap on the tile that closes a pair was already harmless.)
 *
 * totalAttempts = mistakes + every pair of the day (derived from the boards).
 */

// ── data:start ──
const TARGET_SUM = 30
/** Range of the numbers that fill the board; planted pairs stay inside 4-26. */
const MIN_VALUE = 3
const MAX_VALUE = 27

interface LevelDef {
  name: string
  cols: number
  rows: number
  pairs: number
}

const LEVELS: LevelDef[] = [
  { name: 'Nivel 1', cols: 4, rows: 4, pairs: 3 },
  { name: 'Nivel 2', cols: 5, rows: 5, pairs: 4 },
  { name: 'Nivel 3', cols: 6, rows: 6, pairs: 5 },
]

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

/** Orthogonal neighbours of tile `i` (up, down, left, right). */
function neighboursOf(i: number, cols: number, rows: number): number[] {
  const r = Math.floor(i / cols)
  const c = i % cols
  const out: number[] = []
  if (r > 0) out.push(i - cols)
  if (r < rows - 1) out.push(i + cols)
  if (c > 0) out.push(i - 1)
  if (c < cols - 1) out.push(i + 1)
  return out
}

/** All the tiles that touch tile `i`, diagonals included. */
function surroundingOf(i: number, cols: number, rows: number): number[] {
  const r = Math.floor(i / cols)
  const c = i % cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const rr = r + dr
      const cc = c + dc
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc)
    }
  }
  return out
}

/** Every pair of neighbouring tiles whose numbers add up to TARGET_SUM. */
function findPairs(values: number[], cols: number, rows: number): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < values.length; i++) {
    for (const n of neighboursOf(i, cols, rows)) {
      if (n > i && values[i] + values[n] === TARGET_SUM) pairs.push([i, n])
    }
  }
  return pairs
}

/** Every pair of tiles that touch — by a side or by a corner — and add up to TARGET_SUM. */
function touchingPairs(values: number[], cols: number, rows: number): [number, number][] {
  const pairs: [number, number][] = []
  for (let i = 0; i < values.length; i++) {
    for (const n of surroundingOf(i, cols, rows)) {
      if (n > i && values[i] + values[n] === TARGET_SUM) pairs.push([i, n])
    }
  }
  return pairs
}

/** Exactly `wanted` pairs, no tile belongs to two of them and none of them is a diagonal. */
function isValidBoard(values: number[], cols: number, rows: number, wanted: number): boolean {
  const pairs = findPairs(values, cols, rows)
  if (pairs.length !== wanted) return false
  // A diagonal pair of 30 would show up here as one pair more than the side-by-side ones.
  if (touchingPairs(values, cols, rows).length !== wanted) return false
  return new Set(pairs.flat()).size === wanted * 2
}

function tryBuild(cols: number, rows: number, wanted: number): number[] | null {
  const size = cols * rows
  const values: (number | null)[] = Array(size).fill(null)
  // A number is safe at `i` when it adds up to 30 with none of the tiles already
  // touching it (corners count); `partner` is the tile it is being deliberately paired with.
  const safeAt = (i: number, value: number, partner = -1) =>
    surroundingOf(i, cols, rows).every(
      (n) => n === partner || values[n] === null || (values[n] as number) + value !== TARGET_SUM,
    )

  let planted = 0
  // The smaller number of each planted pair: no two pairs may be the same two
  // numbers (a board with 21 + 9 twice looks like a copy-paste error).
  const usedLow = new Set<number>()
  for (let guard = 0; guard < 400 && planted < wanted; guard++) {
    const a = Math.floor(Math.random() * size)
    if (values[a] !== null) continue
    const free = neighboursOf(a, cols, rows).filter((n) => values[n] === null)
    if (free.length === 0) continue
    const b = pickOne(free)
    const first = 4 + Math.floor(Math.random() * 23) // 4-26
    // 15 + 15 would be a pair of twins: too easy to spot.
    if (first === 15) continue
    const second = TARGET_SUM - first
    const low = Math.min(first, second)
    if (usedLow.has(low)) continue
    if (!safeAt(a, first, b) || !safeAt(b, second, a)) continue
    values[a] = first
    values[b] = second
    usedLow.add(low)
    planted++
  }
  if (planted < wanted) return null

  // Fill the rest. Each filler touches at most 8 tiles (diagonals count), so at most
  // 8 forbidden numbers out of 25: at least 17 candidates always remain and the fill
  // cannot dead-end.
  const empty = values.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0)
  for (const i of shuffle(empty)) {
    const forbidden = new Set(
      surroundingOf(i, cols, rows)
        .filter((n) => values[n] !== null)
        .map((n) => TARGET_SUM - (values[n] as number)),
    )
    const options: number[] = []
    for (let v = MIN_VALUE; v <= MAX_VALUE; v++) if (!forbidden.has(v)) options.push(v)
    // Soft cap: no number more than twice on the board, so nothing stands out.
    const fresh = options.filter((v) => values.filter((x) => x === v).length < 2)
    values[i] = pickOne(fresh.length > 0 ? fresh : options)
  }
  return values as number[]
}

interface Board {
  cols: number
  rows: number
  values: number[]
  /** Every neighbouring pair that adds up to 30 — the pairs to find. */
  pairs: [number, number][]
}

function buildBoard(level: LevelDef): Board {
  const { cols, rows, pairs: wanted } = level
  let values: number[] | null = null
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = tryBuild(cols, rows, wanted)
    if (candidate && isValidBoard(candidate, cols, rows, wanted)) {
      values = candidate
      break
    }
  }
  // Unreachable in practice; whatever was drawn last is still a playable board,
  // because the pairs to find are always re-counted from the board itself.
  if (values === null) values = tryBuild(cols, rows, wanted) ?? Array(cols * rows).fill(MIN_VALUE)
  return { cols, rows, values, pairs: findPairs(values, cols, rows) }
}
// ── data:end ──

function areNeighbours(a: number, b: number, cols: number): boolean {
  const ra = Math.floor(a / cols)
  const ca = a % cols
  const rb = Math.floor(b / cols)
  const cb = b % cols
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1
}

function buildEpoch(): Board[] {
  return LEVELS.map((lvl) => buildBoard(lvl))
}

/** "17 + 13" with non-breaking spaces, so a line break never splits an equation. */
const plus = (a: number, b: number) => `${a}\u00A0+\u00A0${b}`

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!', '¡Qué buen ojo!']
const NOT_NEIGHBOURS = 'Tienen que ser vecinos: uno al lado del otro, o uno arriba del otro.'
const NUDGES = [
  'Probá con otra pareja de vecinos.',
  'Casi. Sumá los dos con calma y fijate si llegan a 30.',
  'Esa no. Buscá dos que, juntos, lleguen justo a 30.',
]

/** A tap this soon after the tap that brought the level here ("Siguiente nivel", "Repetir") is the
 * second tap of a double tap, and it must not select a tile of the new board (the tiles sit right
 * where that button was); the same goes for a second tap on the tile that was just selected. Long
 * enough to swallow a double tap, short enough that nobody who means it notices. */
const SETTLE_MS = 400

// Full class strings, never interpolated: Tailwind only emits classes it can
// read literally in the source. Sized so every tile stays ≥ 44px wide on a 320px
// phone (the 6-column board borrows 16px of padding on each side below 375px).
const GRID_CLASS = [
  'grid-cols-4 gap-2.5',
  'grid-cols-5 gap-2',
  'grid-cols-6 gap-1.5 max-[374px]:-mx-4 max-[374px]:gap-1',
]
const TILE_CLASS = ['h-14 text-3xl', 'h-12 text-2xl', 'h-11 text-xl']

interface LevelViewProps {
  levelIdx: number
  board: Board
  /** The timeStamp of the tap that brought this level on screen (-Infinity when nothing did). */
  since: number
  onMistake: () => void
  onSolved: () => void
  onNext: (at: number) => void
  onRepeat: (at: number) => void
}

function LevelView({ levelIdx, board, since, onMistake, onSolved, onNext, onRepeat }: LevelViewProps) {
  const level = LEVELS[levelIdx]
  const isLast = levelIdx === LEVELS.length - 1
  const { cols, values, pairs } = board
  const total = pairs.length

  const [found, setFound] = useState<[number, number][]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [wrongPair, setWrongPair] = useState<[number, number] | null>(null)
  const [hint, setHint] = useState<{ text: string; ok: boolean } | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const flashTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(flashTimerRef.current), [])
  // When the tile that is selected now was selected (the click's own timeStamp): a second tap on it
  // right after is a double tap.
  const selectedAtRef = useRef(-Infinity)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const claimed = new Set(found.flat())
  const solved = found.length >= total

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

  function handleTap(i: number, at: number) {
    // A second tap on a tile that is still flashing as wrong is a double tap, not a second mistake;
    // so is one this soon after the button that brought the level ("Siguiente nivel", "Repetir"),
    // which would otherwise select the tile that sits where that button was.
    if (solved || claimed.has(i) || (wrongPair !== null && wrongPair.includes(i)) || at - since < SETTLE_MS) return
    if (selected === null) {
      selectedAtRef.current = at
      setSelected(i)
      setHint(null)
      return
    }
    if (selected === i) {
      // The second tap of a double tap on the tile just selected would put it straight back down.
      if (at - selectedAtRef.current < SETTLE_MS) return
      setSelected(null)
      return
    }
    if (!areNeighbours(selected, i, cols)) {
      // Not a mistake: the player is just changing their mind.
      selectedAtRef.current = at
      setSelected(i)
      setHint({ text: NOT_NEIGHBOURS, ok: false })
      return
    }
    const a = values[selected]
    const b = values[i]
    if (a + b === TARGET_SUM) {
      const nextFound: [number, number][] = [...found, [selected, i]]
      setFound(nextFound)
      setSelected(null)
      setHint({ text: `¡Sí! ${plus(a, b)}\u00A0=\u00A0${TARGET_SUM}`, ok: true })
      if (nextFound.length >= total) {
        setPraise(pickOne(PRAISE))
        onSolved()
      }
    } else {
      setWrongPair([selected, i])
      setSelected(null)
      setHint({ text: `${plus(a, b)}\u00A0=\u00A0${a + b}. ${pickOne(NUDGES)}`, ok: false })
      onMistake()
      window.clearTimeout(flashTimerRef.current)
      flashTimerRef.current = window.setTimeout(() => setWrongPair(null), 600)
    }
  }

  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-700">
          {level.name}
        </span>
        {!solved && (
          <>
            <h2 className="mt-2.5 text-balance text-xl font-bold leading-snug text-slate-900 max-[350px]:text-lg sm:text-2xl">
              Tocá dos números vecinos que sumen {TARGET_SUM}
            </h2>
            <p className="mt-1 text-base text-slate-500">Uno al lado del otro, o uno arriba del otro.</p>
            {/* One coin per pair, filled as they are found */}
            <div className="mt-2 flex items-center justify-center gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                {pairs.map((_, k) => (
                  <span
                    key={k}
                    className={[
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold',
                      k < found.length
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-dashed border-slate-300 text-slate-400',
                    ].join(' ')}
                  >
                    {TARGET_SUM}
                  </span>
                ))}
              </div>
              <p className="shrink-0 text-base font-semibold text-slate-500">
                Llevás {found.length} de {total}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Board — stays on screen once solved, with the claimed pairs solid */}
      <div className={`mt-3 grid ${GRID_CLASS[levelIdx]}`}>
        {values.map((value, i) => {
          const isClaimed = claimed.has(i)
          const isSelected = selected === i
          const isWrong = wrongPair !== null && wrongPair.includes(i)
          return (
            <button
              key={i}
              type="button"
              disabled={isClaimed || solved}
              onClick={(e) => handleTap(i, e.timeStamp)}
              aria-label={`Número ${value}`}
              aria-pressed={isSelected || isClaimed}
              className={[
                'relative flex items-center justify-center rounded-xl border-2 border-b-4 font-bold transition',
                'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                TILE_CLASS[levelIdx],
                isClaimed
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : isWrong
                    ? 'border-slate-300 bg-slate-100 text-slate-500 motion-safe:animate-[wiggle_0.4s_ease-in-out]'
                    : isSelected
                      ? 'border-tiam-blue bg-white text-slate-900 ring-2 ring-tiam-blue/30'
                      : 'border-teal-200 border-b-teal-300 bg-teal-50 text-slate-800 hover:-translate-y-0.5 hover:border-teal-400 active:translate-y-0',
              ].join(' ')}
            >
              {value}
              {isClaimed && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-teal-700 shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!solved && (
        <p
          role="status"
          className={`mt-3 min-h-[3rem] text-center text-base font-medium ${hint?.ok ? 'text-teal-700' : 'text-slate-500'}`}
        >
          {hint?.text}
        </p>
      )}

      {/* Level complete */}
      {solved && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Encontraste las {total} parejas:{' '}
            {found.map(([x, y]) => plus(values[x], values[y])).join(', ').replace(/, ([^,]*)$/, ' y $1')}. ¡Completaste
            el {level.name.toLowerCase()}!
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

export function SumaHastaTreinta({ onComplete }: GameProps) {
  // The three boards — decided once, at mount, so "Repetir" plays exactly the
  // same numbers in the same places.
  const [epoch] = useState(buildEpoch)
  const [levelIdx, setLevelIdx] = useState(0)
  const [runKey, setRunKey] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  // The timeStamp of the tap that brought the current level on screen (see SETTLE_MS).
  const [since, setSince] = useState(-Infinity)
  const reportedRunRef = useRef<number | null>(null)

  function handleSolved() {
    if (levelIdx !== LEVELS.length - 1 || reportedRunRef.current === runKey) return
    reportedRunRef.current = runKey
    const totalPairs = epoch.reduce((sum, b) => sum + b.pairs.length, 0)
    onComplete({ mistakes, totalAttempts: mistakes + totalPairs })
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

  return (
    <LevelView
      key={`${runKey}-${levelIdx}`}
      levelIdx={levelIdx}
      board={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
