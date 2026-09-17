import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Suma hasta 10" — mental-arithmetic + visual-scanning. A grid of digits
 * hides pairs of NEIGHBOURING cells that add up to 10; tap the two cells of a
 * pair to claim it.
 *
 * Neighbour-only is what makes this a scanning task rather than a trivial
 * "find any 3, find any 7" — without it the grid stops mattering and the game
 * collapses into arithmetic alone.
 *
 * Grid generation guarantees the target is always reachable, which a naive
 * "fill with random digits, then count the pairs" never could: a cell that
 * pairs with TWO neighbours gets consumed by the first claim, stranding the
 * player one pair short of a count the board itself advertised. So the board
 * is built the other way around — plant N disjoint pairs first, then fill
 * every remaining cell with a digit chosen to sum to 10 with NONE of its
 * already-filled neighbours. Each filler picks from 0-9 minus at most 4
 * forbidden values, so a candidate always exists and the fill can't dead-end.
 */

const TARGET_SUM = 10

interface Level {
  n: number
  name: string
  cols: number
  rows: number
  pairs: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', cols: 4, rows: 4, pairs: 4 },
  { n: 2, name: 'Nivel 2', cols: 5, rows: 5, pairs: 5 },
  { n: 3, name: 'Nivel 3', cols: 6, rows: 6, pairs: 6 },
]

// One grid per level (same as CazadorDeLetras) — a single board already holds
// several calculations, so a second one per level would only add length.

// Full class strings, never interpolated — Tailwind only emits classes it can
// read literally in the source.
const GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-4 gap-3 sm:gap-4',
  2: 'grid-cols-5 gap-2 sm:gap-3',
  3: 'grid-cols-6 gap-1.5 sm:gap-3',
}
const TILE_CLASS: Record<number, string> = {
  1: 'h-16 text-3xl sm:h-20 sm:text-4xl',
  2: 'h-14 text-2xl sm:h-20 sm:text-3xl',
  3: 'h-12 text-xl sm:h-16 sm:text-3xl',
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

interface Board {
  cols: number
  rows: number
  values: number[]
  pairCount: number
}

function buildBoard(cols: number, rows: number, wantedPairs: number): Board {
  const size = cols * rows
  const values: (number | null)[] = Array(size).fill(null)

  const neighbours = (i: number): number[] => {
    const r = Math.floor(i / cols)
    const c = i % cols
    const out: number[] = []
    if (r > 0) out.push(i - cols)
    if (r < rows - 1) out.push(i + cols)
    if (c > 0) out.push(i - 1)
    if (c < cols - 1) out.push(i + 1)
    return out
  }
  // A candidate value is safe at `index` when it sums to TARGET_SUM with none
  // of the cells already filled around it — `exempt` is the cell it is being
  // deliberately paired with, which is supposed to sum to 10.
  const safeAt = (index: number, value: number, exempt?: number) =>
    neighbours(index).every(
      (n) => n === exempt || values[n] === null || values[n]! + value !== TARGET_SUM,
    )

  let planted = 0
  // Bounded: a crowded board can run out of adjacent empty cells, and the
  // round is still perfectly playable with fewer pairs than asked for —
  // `pairCount` below reports what was actually planted, never the wish.
  for (let guard = 0; guard < 400 && planted < wantedPairs; guard++) {
    const empty = values.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0)
    if (empty.length < 2) break
    const a = pickOne(empty)
    const freeNeighbours = neighbours(a).filter((n) => values[n] === null)
    if (freeNeighbours.length === 0) continue
    const b = pickOne(freeNeighbours)
    // 1..9 — a 0 would need a 10 on the other side, which isn't a digit.
    const first = 1 + Math.floor(Math.random() * 9)
    const second = TARGET_SUM - first
    if (!safeAt(a, first, b) || !safeAt(b, second, a)) continue
    values[a] = first
    values[b] = second
    planted++
  }

  for (const i of shuffle(values.map((v, idx) => (v === null ? idx : -1)).filter((idx) => idx >= 0))) {
    const forbidden = new Set(
      neighbours(i)
        .filter((n) => values[n] !== null)
        .map((n) => TARGET_SUM - values[n]!),
    )
    const options = Array.from({ length: 10 }, (_, d) => d).filter((d) => !forbidden.has(d))
    values[i] = pickOne(options)
  }

  return { cols, rows, values: values as number[], pairCount: planted }
}

const PRAISE = ['¡Muy bien!', '¡Excelente cálculo!', '¡Así se hace!', '¡Perfecto!']
const HINTS = [
  'Esos dos no llegan a 10 — probá con otra pareja.',
  'Casi. Acordate que tienen que sumar exactamente 10.',
  'No es esa pareja. Fijate bien los dos números juntos.',
]
const NOT_NEIGHBOUR = 'Tienen que ser dos números pegados, uno al lado del otro o uno arriba del otro.'

export function SumaHastaDiez({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const board = useMemo(
    () => buildBoard(level.cols, level.rows, level.pairs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [claimed, setClaimed] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Both accumulate across levels 1→2→3 and only zero on a genuine day
  // restart (see nextLevel's wrap branch).
  const [mistakes, setMistakes] = useState(0)
  const [pairsAcrossLevels, setPairsAcrossLevels] = useState(0)

  const foundPairs = claimed.size / 2
  const done = board.pairCount > 0 && foundPairs === board.pairCount

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function areNeighbours(a: number, b: number): boolean {
    const ra = Math.floor(a / board.cols)
    const ca = a % board.cols
    const rb = Math.floor(b / board.cols)
    const cb = b % board.cols
    return Math.abs(ra - rb) + Math.abs(ca - cb) === 1
  }

  function tap(index: number) {
    if (claimed.has(index) || done) return
    if (selected === null) {
      setSelected(index)
      setHint(null)
      return
    }
    if (selected === index) {
      setSelected(null)
      return
    }
    if (!areNeighbours(selected, index)) {
      setMistakes((m) => m + 1)
      setHint(NOT_NEIGHBOUR)
      setSelected(index)
      return
    }
    if (board.values[selected] + board.values[index] === TARGET_SUM) {
      setClaimed((prev) => new Set(prev).add(selected).add(index))
      setSelected(null)
      setHint(null)
      return
    }
    setMistakes((m) => m + 1)
    setHint(pickOne(HINTS))
    setSelected(null)
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render behind, so `done` (derived
  // straight from `claimed`) would read the previous level's stale-true value
  // on the very render that arrives at the new level and fire onComplete with
  // garbage. Same reasoning as ElVuelto.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setPairsAcrossLevels((p) => p + foundPairs)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setClaimed(new Set())
    setSelected(null)
    setHint(null)
    if (isWrap) {
      setMistakes(0)
      setPairsAcrossLevels(0)
    }
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (the wrap back to level 1) gets a new roundKey, so it can report
  // again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + pairsAcrossLevels + foundPairs })
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
          Tocá dos números pegados que sumen 10
        </h2>
        <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
          <p className="shrink-0 text-base font-semibold text-slate-500">
            Llevás {foundPairs} de {board.pairCount}
          </p>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
              style={{ width: `${board.pairCount ? (foundPairs / board.pairCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Board */}
      <div className={`mt-5 grid ${GRID_CLASS[level.n]}`}>
        {board.values.map((value, i) => {
          const isClaimed = claimed.has(i)
          const isSelected = selected === i
          return (
            <button
              key={i}
              type="button"
              disabled={isClaimed}
              onClick={() => tap(i)}
              aria-label={`número ${value}`}
              aria-pressed={isSelected || isClaimed}
              className={[
                'relative flex items-center justify-center rounded-2xl border-2 bg-white transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                TILE_CLASS[level.n],
                isClaimed ? 'border-tiam-green bg-tiam-green/10 ring-2 ring-tiam-green/30' : '',
                isSelected ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30' : '',
                !isClaimed && !isSelected
                  ? 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
                  : '',
              ].join(' ')}
            >
              <span className="font-extrabold leading-none text-slate-700">{value}</span>
              {isClaimed && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
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
            Encontraste las {board.pairCount} parejas — ¡completaste el {level.name.toLowerCase()}!
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
