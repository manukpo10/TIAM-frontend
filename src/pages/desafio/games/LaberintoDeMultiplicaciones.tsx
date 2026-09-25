import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, ArrowRight, Sparkles, Pencil } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "Laberinto de multiplicaciones" — área cálculo, día 20. Every cell of a
 * square grid shows a multiplication (`4 × 5`, `7 × 3`…), never its result.
 * Starting at the top-left cell, the player walks to the bottom-right one by
 * tapping only a RIGHT or DOWN neighbour whose PRODUCT is GREATER than the
 * current cell's — each step is a small mental-math comparison, and the grid
 * as a whole plays like a maze where "walls" simply mean "not a bigger
 * number."
 *
 * Different from día 11's "Telaraña matemática" (a LINEAR chain: apply one
 * operation at a time to a single running total) precisely because this one
 * stays a visible 2-D GRID with a WALKED PATH — at every cell the player
 * chooses a direction (right or down), not just the next link in a chain.
 *
 * SOLVABILITY BY CONSTRUCTION (same discipline as SumaHastaDiez.tsx): filling
 * a grid with random products first and hoping an increasing right/down
 * route exists would routinely produce unwinnable rounds. So the grid is
 * built backwards — plant the solution, then decorate around it:
 *   1. Walk a random monotone route (right/down only) from the top-left to
 *      the bottom-right cell.
 *   2. Draw as many DISTINCT products as the route is long from the full
 *      2-9 × 2-9 multiplication table (31 distinct values — comfortably more
 *      than the 25 cells the biggest, 5×5 grid needs in total), sort them,
 *      and hand them to the route in visiting order — since every step of
 *      the route moves to an adjacent right/down cell AND every next value
 *      is strictly larger, the whole route is a valid solution by
 *      definition.
 *   3. Only THEN fill every remaining cell with whatever distinct products
 *      are left over, in random cells — the filler pass never touches a
 *      planted cell, so the solution from step 2 survives no matter what
 *      the filler values turn out to be.
 *
 * A filler cell can still accidentally offer a legal-but-dead-end detour
 * (e.g. a bigger neighbour that itself has no bigger neighbour ahead) — that
 * is a normal maze property, not a solvability bug, because it is always
 * recoverable: tapping the cell the player just came from undoes that last
 * step (see `tap()`). A wrong-but-legal detour only costs a couple of extra
 * taps, never the round — only an actually illegal tap (wrong direction, or
 * not a bigger result) counts as a mistake.
 *
 * HOW-TO SCREEN FIRST. The rule sounds simple in one line ("un resultado más
 * grande") but hides two things a player has to notice on their own: every
 * cell shows an EXPRESSION, never the number itself, and "más grande" means
 * the CELL'S OWN PRODUCT, not the digits printed on it — someone who doesn't
 * catch both gets stuck comparing "4 × 5" to "2 × 9" as if they were meant to
 * be read literally. So the day opens on a worked example (mirrors
 * TelaranaMatematica.tsx's HowToPlay: numbered steps, then a small mock grid
 * that reuses the exact cell markup the real board uses) before the first
 * real cell is ever shown — same `phase: 'ready' | 'playing'` pattern,
 * "Repetir" never sets it back.
 */

interface Level {
  n: number
  name: string
  size: number
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', size: 3 },
  { n: 2, name: 'Nivel 2', size: 4 },
  { n: 3, name: 'Nivel 3', size: 5 },
]

// Every right/down monotone route from corner to corner of a `size × size`
// grid takes exactly this many moves, regardless of which route is taken —
// so it doubles as the FIXED "correct steps required" for totalAttempts,
// independent of how many legal-but-off-path detours (and undos) a player
// makes along the way.
const TOTAL_STEPS = LEVELS.reduce((sum, lvl) => sum + (lvl.size * 2 - 2), 0)

// Full class strings, never interpolated — Tailwind only emits classes it
// can read literally in the source. Columns/gaps/text shrink together so a
// 5×5 grid of "7 × 8"-sized labels still fits 375px wide.
const GRID_CLASS: Record<number, string> = {
  1: 'grid-cols-3 gap-2.5 sm:gap-3',
  2: 'grid-cols-4 gap-2 sm:gap-3',
  3: 'grid-cols-5 gap-1.5 sm:gap-2.5',
}
const CELL_CLASS: Record<number, string> = {
  1: 'h-16 text-lg sm:h-20 sm:text-2xl',
  2: 'h-14 text-base sm:h-20 sm:text-xl',
  3: 'h-12 text-sm sm:h-16 sm:text-lg',
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

// Every distinct product reachable with two single-digit (2-9) factors,
// mapped to every (a, b) pair that produces it (both orderings included, so
// picking one at random also varies which factor is shown first). 31 values
// — see file header for why that comfortably covers a 5×5 grid.
const PAIRS_BY_PRODUCT = new Map<number, [number, number][]>()
for (let a = 2; a <= 9; a++) {
  for (let b = 2; b <= 9; b++) {
    const p = a * b
    const pairs = PAIRS_BY_PRODUCT.get(p) ?? []
    pairs.push([a, b])
    PAIRS_BY_PRODUCT.set(p, pairs)
  }
}
const ALL_PRODUCTS = Array.from(PAIRS_BY_PRODUCT.keys()).sort((x, y) => x - y)

interface MazeCell {
  a: number
  b: number
  product: number
}
interface MazeGrid {
  size: number
  cells: MazeCell[] // flat, row-major: index = row * size + col
}

function cellForProduct(product: number): MazeCell {
  // Safe: `product` is always drawn from ALL_PRODUCTS, which is built from
  // this exact map's keys, so a lookup miss can't happen.
  const pairs = PAIRS_BY_PRODUCT.get(product)!
  const [a, b] = pickOne(pairs)
  return { a, b, product }
}

// A random monotone (right/down only) route from the top-left to the
// bottom-right cell — the planted solution the rest of the grid is built
// around. Named "route" (not "path") to keep it distinct from the player's
// own walked trail, which is runtime component state further down.
function buildMonotoneRoute(size: number): number[] {
  const route = [0]
  let r = 0
  let c = 0
  while (r < size - 1 || c < size - 1) {
    if (r === size - 1) c++
    else if (c === size - 1) r++
    else if (Math.random() < 0.5) r++
    else c++
    route.push(r * size + c)
  }
  return route
}

function buildMaze(size: number): MazeGrid {
  const route = buildMonotoneRoute(size)
  const total = size * size
  // total ≤ 25 ≤ ALL_PRODUCTS.length (31), so this slice always has enough
  // distinct values for every cell in the grid, route and filler alike.
  const drawn = shuffle(ALL_PRODUCTS).slice(0, total)
  const routeProducts = drawn.slice(0, route.length).sort((x, y) => x - y)
  const fillerProducts = drawn.slice(route.length)

  const cells: (MazeCell | null)[] = Array(total).fill(null)
  route.forEach((idx, i) => {
    cells[idx] = cellForProduct(routeProducts[i])
  })
  const emptyIdxs = shuffle(cells.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0))
  emptyIdxs.forEach((idx, i) => {
    cells[idx] = cellForProduct(fillerProducts[i])
  })

  return { size, cells: cells as MazeCell[] }
}

function coordsOf(index: number, size: number): [number, number] {
  return [Math.floor(index / size), index % size]
}
function isRightOrDownNeighbor(from: number, to: number, size: number): boolean {
  const [r1, c1] = coordsOf(from, size)
  const [r2, c2] = coordsOf(to, size)
  return (r2 === r1 && c2 === c1 + 1) || (r2 === r1 + 1 && c2 === c1)
}
function hasForwardMove(index: number, grid: MazeGrid): boolean {
  const [r, c] = coordsOf(index, grid.size)
  const current = grid.cells[index].product
  const right = c < grid.size - 1 ? grid.cells[index + 1].product : -Infinity
  const down = r < grid.size - 1 ? grid.cells[index + grid.size].product : -Infinity
  return right > current || down > current
}

const NOT_ADJACENT_HINT = 'Desde acá sólo podés avanzar a la celda de la derecha o a la de abajo.'
const NOT_GREATER_HINTS = [
  'Ese resultado no es mayor al de tu celda — probá con otro camino.',
  'Casi. Te hace falta un resultado más grande que el actual.',
  'Todavía no — fijate cuál de las dos da un número más alto.',
]
const STUCK_HINT = 'No te queda ningún paso válido desde acá. Tocá la celda anterior para volver.'
const PRAISE = ['¡Muy bien!', '¡Excelente camino!', '¡Así se hace!', '¡Perfecto recorrido!']

/** One cell of the worked example, drawn with the SAME markup as the real
 * board (rounded card, `N × M`, the same current/visited/plain states) so
 * recognizing a cell in the actual game means recognizing this screen. */
function ExampleCell({ a, b, state }: { a: number; b: number; state: 'current' | 'valid' | 'invalid' }) {
  return (
    <div
      className={[
        'relative flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl border-2 text-base font-extrabold',
        state === 'current'
          ? 'border-tiam-blue bg-tiam-blue/5 text-slate-700 ring-2 ring-tiam-blue/30'
          : state === 'valid'
            ? 'border-tiam-green bg-tiam-green/10 text-slate-700 ring-2 ring-tiam-green/30'
            : 'border-slate-200 bg-slate-50 text-slate-400',
      ].join(' ')}
    >
      {a} × {b}
      {state === 'valid' && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </div>
  )
}

function HowToPlay({ onStart }: { onStart: () => void }) {
  const steps = [
    'Empezás en la celda de arriba a la izquierda y tenés que llegar hasta la de abajo a la derecha.',
    'En cada celda hay una multiplicación, no el resultado — la cuenta la hacés vos.',
    'Desde tu celda sólo podés avanzar a la de la derecha o a la de abajo, y tiene que dar un resultado más grande que el de tu celda.',
  ]
  return (
    <div className="mt-4 rounded-3xl border border-tiam-blue/20 bg-tiam-blue/5 p-5 sm:p-6">
      <p className="text-center text-xl font-bold text-slate-900">¿Cómo se juega?</p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-snug text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tiam-blue text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-2xl bg-white p-3">
        <p className="text-center text-sm font-semibold text-slate-500">Por ejemplo, parado acá (3 × 2 da 6):</p>
        {/* Same right/down layout as the real board: the current cell top-left,
            its right neighbour beside it, its down neighbour below it — so
            "a la derecha" / "de abajo" in the steps above map onto an actual
            position here, not just isolated example cells. */}
        <div className="mt-3 grid grid-cols-2 items-start justify-items-center gap-x-4 gap-y-2">
          <ExampleCell a={3} b={2} state="current" />
          <ExampleCell a={4} b={3} state="valid" />
          <p className="max-w-[6.5rem] text-center text-xs leading-snug text-slate-500">Empezás acá</p>
          <p className="max-w-[6.5rem] text-center text-xs leading-snug text-slate-500">
            A la derecha: 4 × 3 da 12 — más grande, se puede avanzar ahí
          </p>
          <ExampleCell a={2} b={2} state="invalid" />
          <span />
          <p className="max-w-[6.5rem] text-center text-xs leading-snug text-slate-500">
            Abajo: 2 × 2 da 4 — no es más grande, no sirve
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-tiam-blue/15 bg-white p-3">
        <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-tiam-blue" aria-hidden="true" />
        <p className="text-base leading-snug text-slate-700">Tené a mano lápiz y papel: podés anotar las cuentas si te ayuda.</p>
      </div>

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
        >
          Empezar
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function LaberintoDeMultiplicaciones({ day: _day, onComplete }: GameProps) {
  // How-to screen, once per opening of the day — "Repetir" never sets it
  // back, same convention as TelaranaMatematica.tsx.
  const [phase, setPhase] = useState<'ready' | 'playing'>('ready')
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Built once at mount ("epoch" pattern, same as CalculoEnCuadro) so
  // "Repetir" always replays these exact three mazes instead of a different
  // one under the same label.
  const [epochGrids] = useState(() => LEVELS.map((lvl) => buildMaze(lvl.size)))
  const level = LEVELS[levelIdx]
  const grid = epochGrids[levelIdx]
  const lastIndex = grid.size * grid.size - 1

  const [path, setPath] = useState<number[]>([0])
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  // Accumulates across levels 1→2→3, zeroed only on a genuine day restart —
  // the wrap back to level 1 inside nextLevel below.
  const [mistakes, setMistakes] = useState(0)

  const currentIndex = path[path.length - 1]
  const done = currentIndex === lastIndex
  const visited = new Set(path)
  const stuck = !done && !hasForwardMove(currentIndex, grid)
  const stepsNeeded = grid.size * 2 - 2
  const stepsTaken = path.length - 1

  useEffect(() => {
    if (done) setPraise(pickOne(PRAISE))
  }, [done])

  function tap(index: number) {
    if (done || index === currentIndex) return

    // Undo: tapping the cell just before the current one steps back — never
    // a mistake, this is what makes a legal-but-dead-end detour recoverable
    // instead of a soft-lock (see file header).
    if (path.length >= 2 && index === path[path.length - 2]) {
      setPath((p) => p.slice(0, -1))
      setHint(null)
      return
    }

    if (!isRightOrDownNeighbor(currentIndex, index, grid.size)) {
      setMistakes((m) => m + 1)
      setHint(NOT_ADJACENT_HINT)
      return
    }
    if (grid.cells[index].product <= grid.cells[currentIndex].product) {
      setMistakes((m) => m + 1)
      setHint(pickOne(NOT_GREATER_HINTS))
      return
    }
    setPath((p) => [...p, index])
    setHint(null)
  }

  // Resets happen HERE, synchronously with the level change, not in an
  // effect keyed on levelIdx — an effect lags one render behind, so `done`
  // (derived straight from `path`) would read the previous level's
  // stale-true completion state on the very render that arrives at the new
  // level and fire onComplete with garbage. Same reasoning as
  // SumaHastaDiez.tsx / CazadorDeLetras.tsx.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setPath([0])
    setHint(null)
    if (isWrap) setMistakes(0)
  }

  // Fires once per roundKey when the last level finishes. A genuine day
  // restart (the wrap back to level 1, above) gets a new roundKey so it can
  // report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_STEPS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  if (phase === 'ready') {
    return (
      <div className="px-5 pb-5 pt-4 sm:p-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
            {level.name}
          </span>
        </div>
        <HowToPlay onStart={() => setPhase('playing')} />
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          Armá el camino hasta la esquina de abajo a la derecha
        </h2>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Tocá la celda de la derecha o de abajo, siempre con un resultado más grande que el tuyo.
        </p>
        {!done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Llevás {stepsTaken} de {stepsNeeded} pasos
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-blue transition-[width] duration-300"
                style={{ width: `${(stepsTaken / stepsNeeded) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className={`mx-auto mt-5 grid w-full max-w-[360px] ${GRID_CLASS[level.n]}`}>
        {grid.cells.map((cell, i) => {
          const isVisited = visited.has(i)
          const isCurrent = !done && i === currentIndex
          return (
            <button
              key={i}
              type="button"
              disabled={done}
              onClick={() => tap(i)}
              aria-label={`${cell.a} por ${cell.b}`}
              aria-pressed={isVisited}
              className={[
                'relative flex items-center justify-center rounded-2xl border-2 bg-white transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                CELL_CLASS[level.n],
                isCurrent
                  ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
                  : isVisited
                    ? 'border-tiam-green bg-tiam-green/10 ring-2 ring-tiam-green/30'
                    : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0',
              ].join(' ')}
            >
              <span className="font-extrabold leading-none text-slate-700">
                {cell.a} × {cell.b}
              </span>
              {isVisited && !isCurrent && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!done && (hint || stuck) && (
        <p className="mt-4 text-center text-base font-medium text-slate-500">{hint ?? STUCK_HINT}</p>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Llegaste hasta el final — ¡completaste el {level.name.toLowerCase()}!
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
