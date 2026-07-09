import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

/**
 * "El vuelto" — a change-making arithmetic mini-game, the first in the
 * cálculo area. Tap denomination chips into a tray until they sum to the
 * correct change (any valid combination works, not just one "correct"
 * answer) — mirrors how people actually count out change in real life,
 * externalizing the running total instead of demanding silent mental math.
 * No numeric keypad: typing is more error-prone for this audience than
 * tapping, and this app never types anywhere else.
 *
 * Bills are rendered as flat colored chips (real AR banknotes are
 * color-coded per denomination), not Flux art — a plain, correctly-labeled
 * rectangle is both cheaper and more reliable than risking an illegible
 * generated number. "Making change" is a real financial-capacity skill,
 * not an arbitrary puzzle — so this never scores or fails a round: a wrong
 * sum gets a directional nudge ("te pasaste" / "todavía te falta") and
 * stays adjustable, no red anywhere, no hard fail, ever.
 */

interface Item {
  label: string
  id: string
  price: number
}
interface Scenario {
  venue: string
  items: Item[]
  paidWith: number
}
interface Level {
  n: number
  name: string
  scenarios: Scenario[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    scenarios: [
      { venue: 'Kiosco', items: [{ label: 'chicles', id: 'chicles', price: 150 }], paidWith: 200 },
      { venue: 'Kiosco', items: [{ label: 'un alfajor', id: 'alfajor', price: 300 }], paidWith: 500 },
      { venue: 'Panadería', items: [{ label: '4 facturas', id: 'factura', price: 600 }], paidWith: 1000 },
      { venue: 'Verdulería', items: [{ label: 'banana (1kg)', id: 'banana', price: 250 }], paidWith: 500 },
      { venue: 'Farmacia', items: [{ label: 'venda elástica', id: 'venda', price: 700 }], paidWith: 1000 },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    scenarios: [
      { venue: 'Kiosco', items: [{ label: 'gaseosa', id: 'gaseosa', price: 650 }], paidWith: 1000 },
      { venue: 'Panadería', items: [{ label: 'kilo de pan', id: 'pan', price: 480 }], paidWith: 500 },
      { venue: 'Verdulería', items: [{ label: 'kilo de tomate', id: 'tomate', price: 900 }], paidWith: 1000 },
      { venue: 'Farmacia', items: [{ label: 'alcohol en gel', id: 'alcohol-en-gel', price: 730 }], paidWith: 1000 },
      { venue: 'Verdulería', items: [{ label: 'kilo de papas', id: 'papas', price: 780 }], paidWith: 1000 },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    scenarios: [
      {
        venue: 'Kiosco',
        items: [
          { label: 'gaseosa', id: 'gaseosa', price: 550 },
          { label: 'un alfajor', id: 'alfajor', price: 300 },
        ],
        paidWith: 1000,
      },
      {
        venue: 'Panadería',
        items: [
          { label: 'facturas', id: 'factura', price: 480 },
          { label: 'pan', id: 'pan', price: 270 },
        ],
        paidWith: 1000,
      },
      {
        venue: 'Verdulería',
        items: [
          { label: 'papas', id: 'papas', price: 370 },
          { label: 'zanahoria', id: 'zanahoria', price: 260 },
        ],
        paidWith: 1000,
      },
      {
        venue: 'Farmacia',
        items: [
          { label: 'venda', id: 'venda', price: 440 },
          { label: 'alcohol en gel', id: 'alcohol-en-gel', price: 390 },
        ],
        paidWith: 1000,
      },
      { venue: 'Kiosco', items: [{ label: '2 alfajores', id: 'alfajor', price: 860 }], paidWith: 1000 },
    ],
  },
]

const DENOMINATIONS: { value: number; color: string }[] = [
  { value: 1000, color: '#6B4C9A' },
  { value: 500, color: '#5C6BC0' },
  { value: 200, color: '#C2185B' },
  { value: 100, color: '#00897B' },
  { value: 50, color: '#D32F2F' },
  { value: 20, color: '#F57C00' },
]
const colorFor = (value: number) => DENOMINATIONS.find((d) => d.value === value)?.color ?? '#5A6B82'

const IMAGES = import.meta.glob('../../../assets/desafio/games/el-vuelto/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const PRAISE_GOOD = ['¡Perfecto, justo!', '¡Muy bien calculado!', '¡Así se hace!', '¡Exacto!']

interface PlacedBill {
  key: number
  value: number
}

export function ElVuelto() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const scenario = useMemo(
    () => pickOne(level.scenarios),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const totalPrice = scenario.items.reduce((s, i) => s + i.price, 0)
  const change = scenario.paidWith - totalPrice

  const [placed, setPlaced] = useState<PlacedBill[]>([])
  const [nextKey, setNextKey] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])

  useEffect(() => {
    setPlaced([])
    setHint(null)
    setResolved(false)
  }, [levelIdx, roundKey])

  const sum = placed.reduce((s, b) => s + b.value, 0)

  function addBill(value: number) {
    if (resolved) return
    setPlaced((prev) => [...prev, { key: nextKey, value }])
    setNextKey((k) => k + 1)
    setHint(null)
  }
  function removeBill(key: number) {
    if (resolved) return
    setPlaced((prev) => prev.filter((b) => b.key !== key))
    setHint(null)
  }
  function check() {
    if (sum === change) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else if (sum > change) {
      setHint('Te pasaste un poco — sacá alguna ficha.')
    } else {
      setHint('Todavía te falta un poco.')
    }
  }

  function nextLevel() {
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setRoundKey((k) => k + 1)
  }

  const itemsLabel = scenario.items.map((i) => i.label).join(' + ')

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          Cálculo · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Armá el vuelto justo</h2>
      </div>

      {/* Scenario */}
      <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center justify-center gap-3">
          {scenario.items.map((item, i) => {
            const img = imgFor(item.id)
            return (
              <div key={`${item.id}-${i}`} className="flex h-12 w-12 items-center justify-center">
                {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-center text-base text-slate-700">
          <span className="font-semibold">{scenario.venue}:</span> {itemsLabel} — {totalPrice.toLocaleString('es-AR')}
        </p>
        <p className="mt-1 text-center text-lg font-bold text-slate-900">
          Pagás con ${scenario.paidWith.toLocaleString('es-AR')}. ¿Cuánto te dan de vuelto?
        </p>
      </div>

      {/* Tray of placed bills */}
      <div className="mt-5 min-h-[64px] rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3">
        {placed.length === 0 ? (
          <p className="text-center text-sm text-slate-400">Tocá los billetes de abajo</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            {placed.map((b) => (
              <button
                key={b.key}
                type="button"
                disabled={resolved}
                onClick={() => removeBill(b.key)}
                aria-label={`quitar $${b.value}`}
                className="min-h-[44px] rounded-xl px-4 py-2 text-base font-bold text-white shadow transition hover:brightness-110 active:scale-95"
                style={{ backgroundColor: colorFor(b.value) }}
              >
                ${b.value}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-sm font-semibold text-slate-500">
        Llevás ${sum.toLocaleString('es-AR')}
      </p>

      {/* Denomination palette */}
      {!resolved && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {DENOMINATIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => addBill(d.value)}
              aria-label={`agregar $${d.value}`}
              className="min-h-[48px] rounded-xl px-4 py-2.5 text-base font-bold text-white shadow transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
              style={{ backgroundColor: d.color }}
            >
              ${d.value}
            </button>
          ))}
        </div>
      )}

      {hint && !resolved && <p className="mt-3 text-center text-sm font-medium text-slate-500">{hint}</p>}

      {!resolved && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={check}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Listo
          </button>
        </div>
      )}

      {/* Completion */}
      {resolved && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">El vuelto era ${change.toLocaleString('es-AR')}.</p>
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
              Otra compra
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
