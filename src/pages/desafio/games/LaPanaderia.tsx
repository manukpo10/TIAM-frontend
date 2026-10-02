import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "La panadería" — día 20, mes 5, cálculo. A bakery: the price board of the day
 * stays on screen for the whole level, and customers come in one at a time with
 * an order ("Doña Marta pide: 3 medialunas, 1 pan y 2 alfajores"). The player
 * works out what the customer has to pay and taps the right total among four.
 * Same idea as month 4's El puesto de comida, in a bakery, with quantities and
 * Argentine decimal prices.
 *
 * No study phase: the board IS the material and never goes away, so there is
 * nothing to memorize — the game never depends on knowing what anything costs.
 * Prices and orders are all invented for this file. The pictures are the ones the
 * shopping games already ship (lista-mercado: medialunas, pan, tostadas, galletitas,
 * grisines; el-vuelto: alfajor), picked one by one in the glob so no other file is pulled in.
 *
 * Ramp: level 1, whole prices and two items; level 2, the SAME board but three
 * items with quantities (2 panes, 3 medialunas…), so the new thing is only the
 * multiplying; level 3, a new board where every price ends in ",50" (the
 * Argentine decimal comma: $12,50) — so totals can be whole or end in ",50".
 *
 * The four options are the right total and three near misses that are the
 * slips people really make: a "tens" slip (±$10) and small ones (±$5, ±$1,
 * ±$0,50 — "forgetting the fifty cents"). Where the right total ranks among
 * the four varies from order to order (smallest, second, third or largest:
 * 4, 5, 4 and 5 of the 18 orders), so "it is never the biggest" or "never the
 * smallest" is no way to rule options out; the options are then shown in a
 * shuffled order, ONCE at mount. A wrong option greys out (never red), costs
 * one mistake and turns on a scaffold: the products of the order light up on
 * the board and the hint says how to tackle it.
 *
 * Money is kept in CENTS (integers), so $12,50 + $37,50 is exact; a throwaway
 * Node script (not committed) recomputes every total independently, checks the
 * four options (distinct, positive, the total among them, every wrong one a
 * realistic near miss) and the ramp (whole / ",50" prices, item and quantity
 * rules).
 *
 * ONE set of orders per level: each level has two authored sets of three orders
 * and one is picked ONCE at mount (`epoch`, together with each order's option
 * order), so "Repetir" replays exactly the same customers and options. The 18
 * customers have 18 different names, so no name comes back within a run.
 * Per-level state lives in <LevelView>, keyed by run + level.
 *
 * Double taps: every tap within SETTLE_MS of the tap that brought the level (judged
 * by the click's own timeStamp) is ignored, so the second tap of a double tap on
 * "Siguiente nivel" or "Repetir" never answers the first order; and while the
 * right total shows its check every option is off, which swallows a double tap on
 * the RIGHT one before the next customer replaces it. The solved card is scrolled
 * into view on a short phone.
 *
 * totalAttempts = mistakes + every order of the day (TOTAL_ORDERS, derived).
 */

// ── data:start ──
type ItemId = 'medialuna' | 'pan' | 'alfajor' | 'galletitas' | 'grisines' | 'tostadas'

interface ItemDef {
  /** Name on the price board. */
  name: string
  /** "1 medialuna" … */
  one: string
  /** "3 medialunas" … */
  many: string
}

const ITEMS: Record<ItemId, ItemDef> = {
  medialuna: { name: 'Medialuna', one: 'medialuna', many: 'medialunas' },
  pan: { name: 'Pan', one: 'pan', many: 'panes' },
  alfajor: { name: 'Alfajor', one: 'alfajor', many: 'alfajores' },
  galletitas: { name: 'Galletitas', one: 'paquete de galletitas', many: 'paquetes de galletitas' },
  grisines: { name: 'Grisines', one: 'paquete de grisines', many: 'paquetes de grisines' },
  tostadas: { name: 'Tostadas', one: 'paquete de tostadas', many: 'paquetes de tostadas' },
}
/** The order the items appear on every price board. */
const BOARD_ORDER: ItemId[] = ['medialuna', 'pan', 'alfajor', 'galletitas', 'grisines', 'tostadas']

/** Prices in CENTS, per unit (or per package). */
type Prices = Record<ItemId, number>

interface Line {
  item: ItemId
  qty: number
}
interface OrderDef {
  customer: string
  lines: Line[]
  /** The three wrong options, as differences from the right total, in cents written pesos_cents (10_00 = $10, 50 = $0,50). */
  wrong: [number, number, number]
}
interface LevelDef {
  name: string
  prices: Prices
  /** Two authored sets of orders; one is picked at mount. */
  sets: OrderDef[][]
  /** What the hint says after a miss. */
  tip: string
}

// Level 1 and 2 share the board; level 3 has its own, all ending in ",50".
const WHOLE_PRICES: Prices = { medialuna: 1500, pan: 4000, alfajor: 2500, galletitas: 3000, grisines: 2000, tostadas: 3500 }
const HALF_PRICES: Prices = { medialuna: 1250, pan: 3750, alfajor: 2250, galletitas: 1750, grisines: 1450, tostadas: 2750 }

const LEVELS: LevelDef[] = [
  {
    name: 'Nivel 1',
    prices: WHOLE_PRICES,
    tip: 'Buscá el precio de cada cosa en la lista y sumá los dos.',
    sets: [
      [
        { customer: 'Doña Marta', lines: [{ item: 'medialuna', qty: 1 }, { item: 'alfajor', qty: 1 }], wrong: [-10_00, 5_00, 10_00] },
        { customer: 'Don Ramón', lines: [{ item: 'pan', qty: 1 }, { item: 'galletitas', qty: 1 }], wrong: [-5_00, -10_00, -15_00] },
        { customer: 'Susana', lines: [{ item: 'grisines', qty: 1 }, { item: 'tostadas', qty: 1 }], wrong: [5_00, 10_00, 15_00] },
      ],
      [
        { customer: 'Elvira', lines: [{ item: 'alfajor', qty: 1 }, { item: 'tostadas', qty: 1 }], wrong: [-5_00, -10_00, 5_00] },
        { customer: 'Don Mario', lines: [{ item: 'medialuna', qty: 1 }, { item: 'pan', qty: 1 }], wrong: [-5_00, -10_00, -15_00] },
        { customer: 'Graciela', lines: [{ item: 'galletitas', qty: 1 }, { item: 'grisines', qty: 1 }], wrong: [-5_00, 5_00, 10_00] },
      ],
    ],
  },
  {
    name: 'Nivel 2',
    prices: WHOLE_PRICES,
    tip: 'Primero multiplicá cada cantidad por su precio, y después sumá todo.',
    sets: [
      [
        {
          customer: 'Doña Ofelia',
          lines: [{ item: 'medialuna', qty: 3 }, { item: 'alfajor', qty: 2 }, { item: 'pan', qty: 1 }],
          wrong: [-10_00, 5_00, 10_00],
        },
        {
          customer: 'Don Tito',
          lines: [{ item: 'pan', qty: 2 }, { item: 'grisines', qty: 1 }, { item: 'galletitas', qty: 2 }],
          wrong: [-5_00, -10_00, -20_00],
        },
        {
          customer: 'Cristina',
          lines: [{ item: 'medialuna', qty: 4 }, { item: 'tostadas', qty: 2 }, { item: 'grisines', qty: 1 }],
          wrong: [10_00, 5_00, 20_00],
        },
      ],
      [
        {
          customer: 'Beba',
          lines: [{ item: 'medialuna', qty: 2 }, { item: 'alfajor', qty: 3 }, { item: 'tostadas', qty: 1 }],
          wrong: [-10_00, -5_00, 10_00],
        },
        {
          customer: 'Don Aurelio',
          lines: [{ item: 'grisines', qty: 3 }, { item: 'pan', qty: 1 }, { item: 'tostadas', qty: 2 }],
          wrong: [5_00, 10_00, 20_00],
        },
        {
          customer: 'Nora',
          lines: [{ item: 'galletitas', qty: 2 }, { item: 'medialuna', qty: 3 }, { item: 'pan', qty: 1 }],
          wrong: [-5_00, 5_00, 10_00],
        },
      ],
    ],
  },
  {
    name: 'Nivel 3',
    prices: HALF_PRICES,
    tip: 'Los precios tienen cincuenta centavos: sumá primero los pesos y después los centavos.',
    sets: [
      [
        { customer: 'Doña Lidia', lines: [{ item: 'medialuna', qty: 2 }, { item: 'pan', qty: 1 }], wrong: [-50, -1_00, -10_00] },
        { customer: 'Don Hugo', lines: [{ item: 'alfajor', qty: 3 }, { item: 'galletitas', qty: 1 }], wrong: [-50, 50, -10_00] },
        { customer: 'Rosa', lines: [{ item: 'tostadas', qty: 1 }, { item: 'pan', qty: 1 }, { item: 'medialuna', qty: 1 }], wrong: [-50, 10_00, 1_00] },
      ],
      [
        { customer: 'Don Ernesto', lines: [{ item: 'alfajor', qty: 2 }, { item: 'grisines', qty: 1 }], wrong: [-50, 50, -10_00] },
        { customer: 'Mabel', lines: [{ item: 'medialuna', qty: 3 }, { item: 'pan', qty: 1 }], wrong: [50, 1_00, 10_00] },
        { customer: 'Don Julio', lines: [{ item: 'galletitas', qty: 1 }, { item: 'tostadas', qty: 1 }, { item: 'alfajor', qty: 1 }], wrong: [-50, -1_00, -10_00] },
      ],
    ],
  },
]

const TOTAL_ORDERS = LEVELS.reduce((sum, lvl) => sum + lvl.sets[0].length, 0)

/** What an order comes to, in cents. */
function totalOf(prices: Prices, lines: Line[]): number {
  return lines.reduce((sum, l) => sum + l.qty * prices[l.item], 0)
}

/** The four options of an order, in cents: the right total and its three near misses (unsorted). */
function optionsOf(total: number, wrong: [number, number, number]): number[] {
  return [total, ...wrong.map((d) => total + d)]
}

/** "$12,50", "$45": the Argentine way, a comma before the cents and no cents when there are none. */
function formatPeso(cents: number): string {
  const pesos = Math.floor(cents / 100)
  const rest = cents % 100
  const whole = pesos.toLocaleString('es-AR')
  return rest === 0 ? `$${whole}` : `$${whole},${String(rest).padStart(2, '0')}`
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

const IMAGES = import.meta.glob(
  [
    '../../../assets/desafio/games/lista-mercado/{medialunas,pan,tostadas,galletitas,grisines}.webp',
    '../../../assets/desafio/games/el-vuelto/alfajor.webp',
  ],
  { eager: true, import: 'default' },
) as Record<string, string>
const IMAGE_FILE: Record<ItemId, string> = {
  medialuna: 'medialunas',
  pan: 'pan',
  alfajor: 'alfajor',
  galletitas: 'galletitas',
  grisines: 'grisines',
  tostadas: 'tostadas',
}
function imageFor(item: ItemId): string | undefined {
  return Object.entries(IMAGES).find(([path]) => path.endsWith(`/${IMAGE_FILE[item]}.webp`))?.[1]
}

interface PreparedOrder {
  customer: string
  lines: Line[]
  total: number
  /** The four options in their (frozen) display order. */
  options: number[]
}
interface PreparedLevel {
  orders: PreparedOrder[]
}

function buildEpoch(): PreparedLevel[] {
  return LEVELS.map((lvl) => ({
    orders: pickOne(lvl.sets).map((o) => {
      const total = totalOf(lvl.prices, o.lines)
      return { customer: o.customer, lines: o.lines, total, options: shuffle(optionsOf(total, o.wrong)) }
    }),
  }))
}

const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!']
const PRAISE_OK = ['¡Bien hecho! Con práctica sale cada vez más fácil.', '¡Buen trabajo! Seguí practicando.']
const HINTS = ['Casi. Revisá de nuevo los precios.', 'Todavía no. Sumá con calma, de a una cosa por vez.']

/** "2 medialunas, 1 pan y 3 alfajores". */
function describeOrder(lines: Line[]): string {
  const parts = lines.map((l) => `${l.qty} ${l.qty === 1 ? ITEMS[l.item].one : ITEMS[l.item].many}`)
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

/** A tap this soon after the tap that brought the level here ("Siguiente nivel", "Repetir") is the
 * second tap of a double tap, and it must not answer the first order (the options sit right where
 * that button was). Long enough to swallow a double tap, short enough that nobody who means it
 * notices. */
const SETTLE_MS = 400

interface LevelViewProps {
  levelIdx: number
  content: PreparedLevel
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
  const { orders } = content

  const [orderIdx, setOrderIdx] = useState(0)
  const [wrongOptions, setWrongOptions] = useState<number[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [done, setDone] = useState(false)
  const [levelMistakes, setLevelMistakes] = useState(0)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Options already tapped for this order: a double tap on the same option is ONE tap.
  const tappedRef = useRef<Set<number>>(new Set())
  const advanceTimerRef = useRef<number | undefined>(undefined)
  const resultRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => () => window.clearTimeout(advanceTimerRef.current), [])

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

  const order = orders[orderIdx]
  const missed = wrongOptions.length > 0
  // The scaffold: once the order has been missed, its products light up on the board.
  const lit = missed && !advancing ? new Set(order.lines.map((l) => l.item)) : null
  const hint = missed && !advancing ? (wrongOptions.length === 1 ? level.tip : HINTS[(wrongOptions.length - 2) % HINTS.length]) : null

  function handleTap(value: number, at: number) {
    // While the right total shows its check (`advancing`) every option is off, which is what swallows
    // a double tap on the RIGHT one; this swallows the one that follows the button that brought the level.
    if (advancing || done || tappedRef.current.has(value) || at - since < SETTLE_MS) return
    tappedRef.current.add(value)
    if (value === order.total) {
      setAdvancing(true)
      if (orderIdx === orders.length - 1) setPraise(pickOne(levelMistakes === 0 ? PRAISE_GOOD : PRAISE_OK))
      // The only timer in the game: a short pause so the checkmark registers.
      advanceTimerRef.current = window.setTimeout(() => {
        if (orderIdx < orders.length - 1) {
          setOrderIdx((i) => i + 1)
          setWrongOptions([])
          setAdvancing(false)
          tappedRef.current = new Set()
        } else {
          setDone(true)
          onSolved()
        }
      }, 1000)
    } else {
      setWrongOptions((w) => [...w, value])
      setLevelMistakes((m) => m + 1)
      onMistake()
    }
  }

  // On a short phone (the modal leaves 100dvh - 95px) the board's pictures, the spacing and the options give way
  // so that the order, the question and ALL four totals are on screen when a level opens: a player who does not
  // see that the options go on below the fold simply cannot answer. Every target stays 52px or more, the text
  // 16px or more. Taller phones keep the roomy layout.
  return (
    <div ref={topRef} className="px-5 pb-5 pt-4 sm:p-7 [@media(max-height:700px)]:pb-3 [@media(max-height:700px)]:pt-3">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {!done && (
          <span className="ml-3 align-middle text-base font-semibold text-slate-500">
            Pedido {orderIdx + 1} de {orders.length}
          </span>
        )}
      </div>

      {!done && (
        <>
          {/* The price board: always on screen, always in the same order */}
          <div className="mt-3 rounded-2xl border-2 border-slate-100 bg-slate-50 p-2 max-[350px]:-mx-2 [@media(max-height:700px)]:mt-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Precios de hoy · cada uno</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5 [@media(max-height:700px)]:mt-1 [@media(max-height:700px)]:gap-1">
              {BOARD_ORDER.map((item) => (
                <div
                  key={item}
                  className={[
                    'flex flex-col items-center rounded-xl border-2 px-0.5 py-1 text-center transition [@media(max-height:700px)]:py-0.5',
                    lit?.has(item) ? 'border-tiam-blue/50 bg-tiam-blue/10 ring-2 ring-tiam-blue/30' : 'border-slate-100 bg-white',
                  ].join(' ')}
                >
                  <img src={imageFor(item)} alt="" className="h-8 w-8 rounded-lg object-cover [@media(max-height:700px)]:hidden" />
                  <span className="mt-0.5 text-sm font-bold leading-tight text-slate-700 max-[350px]:text-xs [@media(max-height:700px)]:mt-0">
                    {ITEMS[item].name}
                  </span>
                  <span className="text-base font-bold leading-tight text-slate-900">{formatPeso(level.prices[item])}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The customer's order */}
          <div className="mt-2.5 rounded-2xl border-2 border-cyan-600/15 bg-cyan-600/5 p-3 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:p-2.5">
            <p className="text-sm font-bold text-cyan-800">Pedido de {order.customer}</p>
            <ul className="mt-1.5 space-y-1 [@media(max-height:700px)]:mt-1 [@media(max-height:700px)]:space-y-0.5">
              {order.lines.map((l) => (
                <li key={l.item} className="flex items-center gap-2.5 [@media(max-height:700px)]:gap-2">
                  <img
                    src={imageFor(l.item)}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-lg object-cover [@media(max-height:700px)]:h-6 [@media(max-height:700px)]:w-6"
                  />
                  <span className="text-lg font-bold leading-snug text-slate-800">
                    {l.qty} {l.qty === 1 ? ITEMS[l.item].one : ITEMS[l.item].many}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* 18px on a 320px phone keeps the question on one line (at 20px it wraps and costs 28px). */}
          <h2 className="mt-3 text-center text-xl font-bold text-slate-900 max-[350px]:text-lg [@media(max-height:700px)]:mt-2">
            ¿Cuánto tiene que pagar?
          </h2>

          {/* The options */}
          <div className="mx-auto mt-2 grid max-w-sm grid-cols-2 gap-2.5 [@media(max-height:700px)]:gap-2">
            {order.options.map((value) => {
              const isWrong = wrongOptions.includes(value)
              const isCorrectShown = advancing && value === order.total
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isWrong || advancing}
                  onClick={(e) => handleTap(value, e.timeStamp)}
                  className={[
                    'flex min-h-[56px] items-center justify-center gap-1.5 rounded-2xl border-2 text-xl font-bold transition [@media(max-height:700px)]:min-h-[52px]',
                    'focus:outline-hidden focus:ring-2 focus:ring-tiam-blue/40 focus:ring-offset-1',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900 ring-2 ring-tiam-green/30'
                      : isWrong
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                        : 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {formatPeso(value)}
                  {isCorrectShown && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tiam-green text-white motion-safe:animate-[pop_0.3s_ease-out]">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p role="status" className="mt-2 min-h-[3rem] text-center text-base font-medium text-slate-500">
            {hint}
          </p>
        </>
      )}

      {/* Level complete */}
      {done && (
        <div ref={resultRef} className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Atendiste a los {orders.length} clientes de la panadería. ¡Completaste el {level.name.toLowerCase()}!
          </p>
          <ul className="mt-3 space-y-1 text-left text-base text-slate-700">
            {orders.map((o) => (
              <li key={o.customer} className="rounded-xl bg-white px-3 py-2">
                <span className="font-bold text-slate-900">{o.customer}</span>: {describeOrder(o.lines)} →{' '}
                <span className="font-bold text-slate-900">{formatPeso(o.total)}</span>
              </li>
            ))}
          </ul>
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

export function LaPanaderia({ onComplete }: GameProps) {
  // Which orders each level serves, and the order of each order's options —
  // decided once, at mount, so "Repetir" replays exactly the same content.
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
    onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ORDERS })
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
      content={epoch[levelIdx]}
      since={since}
      onMistake={() => setMistakes((m) => m + 1)}
      onSolved={handleSolved}
      onNext={handleNext}
      onRepeat={handleRepeat}
    />
  )
}
