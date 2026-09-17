import { useEffect, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles, Check } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El puesto de comida" — día 21, month 4, cálculo. A food-stand price list
 * stays on screen for the whole level; each round is an order of 2-3 items
 * and the player taps how much the whole order costs.
 *
 * Loosely inspired by a paper worksheet's "price list + orders" arithmetic
 * mechanic — the food-stand items, prices and every order below are
 * original to this file, not transcribed from any source.
 *
 * No separate study phase (unlike QuienLoDijo.tsx / QuienEsQuien.tsx): the
 * price board IS the study material and it never goes away, so there is
 * nothing to memorize ahead of time — the eliminate-and-retry test loop (see
 * QuienLoDijo.tsx) is the whole game, one study-free pass per level.
 *
 * Options are built once per order, in the mount-time epoch: the real total,
 * total ∓10 and a ±1 near-miss (see `optionsFor`) — always four distinct,
 * positive amounts, because even the cheapest possible order (pancho +
 * gaseosa = $30) still clears total−10 with room to spare ($20).
 */

interface MenuItem {
  id: string
  name: string
  price: number
}

// Shown in this fixed order — a real price board, never shuffled.
const MENU: MenuItem[] = [
  { id: 'gaseosa', name: 'Gaseosa', price: 10 },
  { id: 'pochoclo', name: 'Pochoclo', price: 30 },
  { id: 'pancho', name: 'Pancho', price: 20 },
  { id: 'papas', name: 'Papas fritas', price: 18 },
  { id: 'helado', name: 'Helado', price: 25 },
  { id: 'empanadas', name: 'Empanadas', price: 36 },
  { id: 'tostado', name: 'Tostado', price: 42 },
  { id: 'hamburguesa', name: 'Hamburguesa', price: 54 },
  { id: 'pizza', name: 'Pizza', price: 67 },
]

function priceOf(id: string): number {
  return MENU.find((m) => m.id === id)?.price ?? 0
}
function nameOf(id: string): string {
  return MENU.find((m) => m.id === id)?.name ?? ''
}

const IMAGES = import.meta.glob('../../../assets/desafio/games/puesto-de-comida/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imageFor(id: string): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))?.[1]
}

interface Level {
  n: number
  name: string
  orderCount: number
  /** Orders drawn without repetition from this pool — see buildLevelOrders. */
  pool: string[][]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    orderCount: 3,
    // Only adding tens: every order includes at least one item whose price
    // ends in 0 (gaseosa/pancho/pochoclo), so the units digits never carry.
    pool: [
      ['pancho', 'gaseosa'],
      ['pochoclo', 'gaseosa'],
      ['pochoclo', 'pancho'],
      ['helado', 'gaseosa'],
      ['empanadas', 'pancho'],
      ['hamburguesa', 'gaseosa'],
      ['tostado', 'pancho'],
      ['pizza', 'gaseosa'],
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    orderCount: 4,
    pool: [
      ['helado', 'papas'],
      ['empanadas', 'helado'],
      ['tostado', 'papas'],
      ['hamburguesa', 'papas'],
      ['empanadas', 'papas'],
      ['tostado', 'helado'],
      ['pizza', 'papas'],
      ['hamburguesa', 'helado'],
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    orderCount: 4,
    pool: [
      ['pancho', 'papas', 'gaseosa'],
      ['hamburguesa', 'papas', 'gaseosa'],
      ['tostado', 'helado', 'gaseosa'],
      ['empanadas', 'papas', 'helado'],
      ['pancho', 'pancho', 'gaseosa'],
      ['pochoclo', 'helado', 'papas'],
      ['helado', 'helado', 'gaseosa'],
      ['tostado', 'papas', 'pancho'],
    ],
  },
]

const TOTAL_ORDERS = LEVELS.reduce((sum, l) => sum + l.orderCount, 0)

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

interface Order {
  items: string[]
  total: number
  options: number[]
}

function computeTotal(items: string[]): number {
  return items.reduce((sum, id) => sum + priceOf(id), 0)
}

/** Four distinct, positive amounts: the real total, total∓10, and a ±1
 * near-miss — always safe because the lowest possible total (pancho +
 * gaseosa = $30) still leaves total−10 at $20. */
function optionsFor(total: number): number[] {
  const near = total + pickOne([1, -1])
  return shuffle([total, total - 10, total + 10, near])
}

function buildLevelOrders(level: Level): Order[] {
  return shuffle(level.pool)
    .slice(0, level.orderCount)
    .map((items) => {
      const total = computeTotal(items)
      return { items, total, options: optionsFor(total) }
    })
}

const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!']
const PRAISE_OK = ['¡Bien hecho! Con práctica sale cada vez más fácil.', '¡Buen trabajo! Seguí practicando.']
const HINTS = [
  'Buscá en la lista el precio de cada cosa del pedido y sumalos.',
  'Casi. Revisá de nuevo los precios.',
  'Sumá con calma: primero las decenas y después las unidades.',
]

export function PuestoDeComida({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  // Every level's orders, totals and shuffled options — decided once, at
  // mount, and never re-rolled afterward: not on revisiting a level, and not
  // on "Repetir" either (same content-freezing convention as the rest of the
  // catalog), so "Repetir" always hands back the exact same orders.
  const [epoch] = useState(() => LEVELS.map((lvl) => buildLevelOrders(lvl)))
  const level = LEVELS[levelIdx]
  const orders = epoch[levelIdx]

  const [orderIdx, setOrderIdx] = useState(0)
  const [eliminated, setEliminated] = useState<Set<number>>(new Set())
  const [solved, setSolved] = useState(false)
  // Wrong taps on the CURRENT order only — drives the rotating hint text and
  // the price-board scaffold below, reset every time a new order starts.
  const [wrongCount, setWrongCount] = useState(0)
  const [levelPraise, setLevelPraise] = useState(PRAISE_GOOD[0])
  // Per-level mistake count, reset on nextLevel/replay — decides which
  // praise band the level-complete card shows.
  const [levelMistakes, setLevelMistakes] = useState(0)
  // Accumulates across levels 1→2→3, zeroed only by replay()'s genuine day
  // restart — see the comment there.
  const [mistakes, setMistakes] = useState(0)

  const done = orderIdx >= orders.length
  const order = !done ? orders[orderIdx] : undefined
  const hint = order && !solved && wrongCount > 0 ? HINTS[(wrongCount - 1) % HINTS.length] : null
  // Scaffold: once the player has missed at least once on this order,
  // softly highlight the ordered items' tiles on the price board — a nudge
  // that points at where to look, never the answer itself.
  const highlightIds = order && !solved && wrongCount > 0 ? new Set(order.items) : null

  function guess(value: number) {
    if (!order || solved || eliminated.has(value)) return
    if (value === order.total) {
      setSolved(true)
      // The level ends on this order: compute the praise band synchronously,
      // right here, instead of a `useEffect` watching `done` — avoids
      // react-hooks/set-state-in-effect and the one-render lag that comes
      // with reacting to `done` after the fact.
      if (orderIdx === orders.length - 1) {
        setLevelPraise(pickOne(levelMistakes === 0 ? PRAISE_GOOD : PRAISE_OK))
      }
      window.setTimeout(() => {
        setOrderIdx((i) => i + 1)
        setEliminated(new Set())
        setSolved(false)
        setWrongCount(0)
      }, 900)
    } else {
      setEliminated((prev) => new Set(prev).add(value))
      setMistakes((m) => m + 1)
      setLevelMistakes((m) => m + 1)
      setWrongCount((w) => w + 1)
    }
  }

  // Resets happen HERE, synchronously with the level change, not in an effect
  // keyed on levelIdx — an effect lags one render behind, so `done` (derived
  // straight from orderIdx) would read the previous level's stale-true value
  // on the very render that arrives at the new level and fire the completion
  // card (or onComplete) with garbage. Same discipline as QuienLoDijo.tsx.
  function nextLevel() {
    setLevelIdx((i) => i + 1)
    setOrderIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setWrongCount(0)
    setLevelMistakes(0)
  }

  // Only reachable from the FINAL level's completion card — a genuine day
  // restart. `epoch` itself is never touched, so every level replays the
  // exact same orders, with the exact same totals, it got at mount.
  function replay() {
    setLevelIdx(0)
    setOrderIdx(0)
    setEliminated(new Set())
    setSolved(false)
    setWrongCount(0)
    setLevelMistakes(0)
    setMistakes(0)
    setRoundKey((k) => k + 1)
  }

  // Fires once per roundKey when the last level finishes. A genuine full-day
  // restart (replay's wrap back to level 1) gets a new roundKey so it can
  // report again; re-rendering while already done cannot fire twice.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ORDERS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey, mistakes])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-green/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-green">
          {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">¿Cuánto hay que pagar?</h2>
            <p className="mt-1 text-base text-slate-500">Mirá los precios y sumá el pedido.</p>
            <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
              <p className="shrink-0 text-base font-semibold text-slate-500">
                {orderIdx} de {orders.length}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                  style={{ width: `${(orderIdx / orders.length) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {!done && order && (
        <>
          {/* Price board — always visible, never shuffled */}
          <div className="mt-3 rounded-2xl border-2 border-slate-100 bg-white p-2.5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Precios</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {MENU.map((item) => {
                const highlighted = highlightIds?.has(item.id) ?? false
                return (
                  <div
                    key={item.id}
                    className={[
                      'flex items-center justify-center gap-1.5 rounded-xl border-2 px-1.5 py-1 transition',
                      highlighted
                        ? 'border-tiam-blue/40 bg-tiam-blue/5 ring-2 ring-tiam-blue/40'
                        : 'border-slate-100 bg-slate-50',
                    ].join(' ')}
                  >
                    <img src={imageFor(item.id)} alt={item.name} className="h-10 w-10 shrink-0 object-contain" />
                    <span className="text-base font-bold text-slate-800">${item.price}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order */}
          <div className="mt-3 rounded-2xl border-2 border-tiam-blue/15 bg-tiam-blue/5 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-tiam-blue">Pedido</p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
              {order.items.map((id, i) => (
                <div key={`${id}-${i}`} className="flex items-center gap-2">
                  {i > 0 && <span className="text-lg font-bold text-slate-400">+</span>}
                  <div className="flex flex-col items-center">
                    <img src={imageFor(id)} alt="" className="h-[52px] w-[52px] object-contain" />
                    <span className="text-sm font-semibold text-slate-700 sm:text-base">{nameOf(id)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="mx-auto mt-3 grid max-w-sm grid-cols-2 gap-2.5">
            {order.options.map((value) => {
              const isEliminated = eliminated.has(value)
              const isCorrectShown = solved && value === order.total
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isEliminated || solved}
                  onClick={() => guess(value)}
                  className={[
                    'flex min-h-[56px] items-center justify-center gap-1.5 rounded-2xl border-2 text-xl font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-green/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-green/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  ${value}
                  {isCorrectShown && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {hint && <p className="mt-3 text-center text-base font-medium text-slate-500">{hint}</p>}
        </>
      )}

      {/* Nivel completo */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            Resolviste los {orders.length} pedidos del nivel {level.n}.
          </p>
          {levelIdx < LEVELS.length - 1 ? (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={nextLevel}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-5 font-semibold text-white hover:bg-tiam-blue-dark"
              >
                Siguiente nivel
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={replay}
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
