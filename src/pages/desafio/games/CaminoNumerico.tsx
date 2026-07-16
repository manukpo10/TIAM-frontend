import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Camino numérico" — adapted from the Trail Making Test Part A: numbered
 * circles scattered at pre-authored, non-grid positions across an open
 * canvas; tap them in ascending order. The first game in the app to use
 * free/absolute positioning instead of a CSS grid — every other board game
 * here (BuscarLosRojos, CazadorDeLetras, Memotest…) lays tiles out in neat
 * rows and columns, so this is deliberately the odd one out, spatially.
 *
 * Positions are PRE-AUTHORED per level (a couple of hand-placed layout
 * variants), not generated at runtime — collision-avoidance math for up to
 * 16 circles in a ~300px box has no good runtime guarantee, while a fixed,
 * once-verified layout costs nothing and matches how every other game here
 * authors content (curated pools, not procedural generation). Replay
 * variety comes from shuffling WHICH number lands on which fixed slot, not
 * from moving the slots themselves.
 *
 * Deliberate adaptation away from the clinical instrument: no timer, ever
 * (neither a countdown nor elapsed time) — this only measures correct
 * sequencing, never speed. A wrong tap never advances and is never red;
 * it's a muted grey wiggle plus a orienting hint ("buscás el N"), and an
 * already-found circle is a silent no-op on re-tap.
 */

interface Slot {
  x: number
  y: number
}
interface Level {
  n: number
  name: string
  count: number
  layouts: Slot[][]
  hint?: string
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    count: 8,
    hint: 'No están en fila: mirá toda la pantalla.',
    layouts: [
      [
        { x: 18, y: 15 }, { x: 52, y: 10 }, { x: 80, y: 22 }, { x: 28, y: 45 },
        { x: 60, y: 38 }, { x: 15, y: 62 }, { x: 48, y: 72 }, { x: 78, y: 85 },
      ],
      [
        { x: 15, y: 20 }, { x: 45, y: 12 }, { x: 75, y: 18 }, { x: 28, y: 45 },
        { x: 60, y: 38 }, { x: 85, y: 55 }, { x: 20, y: 70 }, { x: 55, y: 80 },
      ],
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    count: 16,
    layouts: [
      [
        { x: 29, y: 54 }, { x: 52, y: 40 }, { x: 40, y: 82 }, { x: 54, y: 60 },
        { x: 74, y: 29 }, { x: 20, y: 37 }, { x: 43, y: 12 }, { x: 79, y: 57 },
        { x: 63, y: 13 }, { x: 88, y: 15 }, { x: 90, y: 42 }, { x: 11, y: 82 },
        { x: 12, y: 63 }, { x: 86, y: 74 }, { x: 65, y: 81 }, { x: 13, y: 16 },
      ],
      [
        { x: 73, y: 76 }, { x: 75, y: 57 }, { x: 50, y: 90 }, { x: 40, y: 60 },
        { x: 86, y: 42 }, { x: 50, y: 32 }, { x: 25, y: 82 }, { x: 73, y: 27 },
        { x: 22, y: 58 }, { x: 30, y: 31 }, { x: 57, y: 67 }, { x: 90, y: 90 },
        { x: 89, y: 19 }, { x: 50, y: 11 }, { x: 14, y: 41 }, { x: 13, y: 19 },
      ],
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    count: 20,
    layouts: [
      [
        { x: 87, y: 11 }, { x: 72, y: 36 }, { x: 53, y: 51 }, { x: 63, y: 18 },
        { x: 28, y: 29 }, { x: 85, y: 54 }, { x: 69, y: 83 }, { x: 46, y: 69 },
        { x: 47, y: 29 }, { x: 29, y: 70 }, { x: 89, y: 32 }, { x: 87, y: 83 },
        { x: 29, y: 46 }, { x: 10, y: 18 }, { x: 19, y: 88 }, { x: 70, y: 65 },
        { x: 39, y: 11 }, { x: 15, y: 57 }, { x: 48, y: 89 }, { x: 12, y: 38 },
      ],
      [
        { x: 12, y: 71 }, { x: 18, y: 40 }, { x: 40, y: 36 }, { x: 17, y: 22 },
        { x: 35, y: 14 }, { x: 33, y: 70 }, { x: 57, y: 14 }, { x: 68, y: 48 },
        { x: 32, y: 52 }, { x: 50, y: 52 }, { x: 66, y: 29 }, { x: 89, y: 29 },
        { x: 74, y: 66 }, { x: 54, y: 72 }, { x: 87, y: 49 }, { x: 82, y: 10 },
        { x: 85, y: 84 }, { x: 24, y: 85 }, { x: 44, y: 90 }, { x: 65, y: 88 },
      ],
    ],
  },
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

interface Node extends Slot {
  value: number
}

function buildRound(level: Level): Node[] {
  const layout = pickOne(level.layouts)
  const numbers = shuffle(Array.from({ length: level.count }, (_, i) => i + 1))
  return layout.map((slot, i) => ({ ...slot, value: numbers[i] }))
}

const PRAISE = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!', '¡Qué atención!']

export function CaminoNumerico({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const board = useMemo(
    () => buildRound(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [foundCount, setFoundCount] = useState(0)
  const [wrongValue, setWrongValue] = useState<number | null>(null)
  const [wrongHint, setWrongHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Mistakes + correct finds, accumulated across levels 1→2→3 and only
  // zeroed on a genuine day restart (wrap from level 3 back to level 1) —
  // see nextLevel's isWrap branch below.
  const [mistakes, setMistakes] = useState(0)
  const [foundAcrossLevels, setFoundAcrossLevels] = useState(0)

  const done = foundCount >= level.count

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  const trail = useMemo(
    () =>
      board
        .filter((node) => node.value <= foundCount)
        .sort((a, b) => a.value - b.value),
    [board, foundCount],
  )

  function handleTap(node: Node) {
    if (done) return
    if (node.value <= foundCount) return // already found, silent no-op

    if (node.value === foundCount + 1) {
      setFoundCount((c) => c + 1)
      setWrongValue(null)
      setWrongHint(null)
      return
    }

    setWrongValue(node.value)
    setWrongHint(`Ese es el ${node.value} — buscás el ${foundCount + 1}.`)
    setMistakes((m) => m + 1)
    window.setTimeout(() => {
      setWrongValue((v) => (v === node.value ? null : v))
      setWrongHint(null)
    }, 1500)
  }

  // Resets happen synchronously HERE, in the same handler that changes
  // levelIdx/roundKey — not in a separate effect keyed on them (this game
  // used to have exactly that: a reset useEffect keyed on [levelIdx,
  // roundKey]). An effect only catches up one tick after levelIdx changes,
  // so `done` would read the previous level's stale, still-true foundCount
  // on the very render that just arrived at the new level, firing
  // onComplete instantly with garbage before the player has touched
  // anything.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setFoundAcrossLevels((f) => f + foundCount)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setFoundCount(0)
    setWrongValue(null)
    setWrongHint(null)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the accumulators — replaying a round must NOT, even on level 1.
    if (isWrap) {
      setMistakes(0)
      setFoundAcrossLevels(0)
    }
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setFoundCount(0)
    setWrongValue(null)
    setWrongHint(null)
  }

  // Fires once per roundKey when level 3 is completed. A full day restart
  // (the wrap to level 1) gets a new roundKey via nextLevel above, so a
  // genuine replay of the whole day reports again; re-rendering while still
  // done on level 3 does not fire twice. totalAttempts = accumulated
  // mistakes + every number found across levels 1–3 (foundAcrossLevels
  // covers 1–2, foundCount covers the current/last level).
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + foundAcrossLevels + foundCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          {level.name}
        </span>
        {/* "empezando por el 1" is deliberately absent: the target chip below
            always names the number you actually need, and by the time you're on
            9 the heading would be telling you to start over. */}
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Tocá los números en orden</h2>
      </div>

      {!done && (
        <>
          {/* Target number, the count and the bar share ONE row. Stacked, these
              three said the same thing three times over and cost 176px — on a
              phone whose browser bar is showing, that was the difference between
              seeing the whole board and not knowing it continued below. */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-3xl font-black text-slate-800">
              {foundCount + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Buscá el número</p>
              <p className="text-base font-semibold text-slate-500">
                Encontraste {foundCount} de {level.count}
              </p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(foundCount / level.count) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {level.hint && <p className="mt-3 text-center text-sm font-medium text-tiam-blue">{level.hint}</p>}
        </>
      )}

      {/* Scatter canvas — stays visible (with its finished trail) once done, same as
          BuscarLosRojos keeps its board mounted above the completion card. */}
      <div className="relative mx-auto mt-5 aspect-square w-full max-w-[380px] rounded-3xl border-2 border-slate-100 bg-slate-50/60">
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={trail.map((n) => `${n.x},${n.y}`).join(' ')}
            fill="none"
            stroke="#4CA52E"
            strokeWidth="1.2"
            strokeOpacity="0.6"
            strokeLinecap="round"
          />
        </svg>
        {board.map((node) => {
          const isFound = node.value <= foundCount
          const isWrongFlash = wrongValue === node.value
          return (
            <button
              key={node.value}
              type="button"
              disabled={isFound || done}
              onClick={() => handleTap(node)}
              aria-label={`Número ${node.value}`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              className={[
                'absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center',
                'rounded-full border-2 text-base font-bold transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                isFound
                  ? 'border-tiam-green bg-white text-slate-700 ring-2 ring-tiam-green/30'
                  : isWrongFlash
                    ? 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-400 bg-white text-slate-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-tiam-blue/40 hover:shadow-md active:scale-95',
              ].join(' ')}
            >
              {node.value}
              {isFound && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {wrongHint && !done && <p className="mt-4 text-center text-sm font-medium text-slate-500">{wrongHint}</p>}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            ¡Encontraste los {level.count} números en orden — completaste el {level.name.toLowerCase()}!
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
              Otro camino
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
