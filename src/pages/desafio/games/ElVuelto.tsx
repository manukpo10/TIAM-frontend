import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

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
 *
 * VARIAS rondas por nivel (mismo patrón de LaCancionDeTuJuventud/LosOpuestos):
 * cada nivel resuelve `ROUNDS_PER_LEVEL[levelIdx]` compras distintas, elegidas
 * al azar del pool de escenarios de ese nivel (sin repetir dentro del nivel).
 * 8 vueltos en total (2+3+3).
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
      {
        venue: 'Kiosco',
        items: [
          { label: 'un alfajor', id: 'alfajor', price: 430 },
          { label: 'otro alfajor', id: 'alfajor', price: 430 },
        ],
        paidWith: 1000,
      },
      {
        venue: 'Kiosco',
        items: [
          { label: 'gaseosa', id: 'gaseosa', price: 280 },
          { label: 'un alfajor', id: 'alfajor', price: 220 },
          { label: 'chicles', id: 'chicles', price: 160 },
        ],
        paidWith: 1000, // change = 340, minimum 4 chips (200+100+20+20)
      },
      {
        venue: 'Panadería',
        items: [
          { label: 'facturas', id: 'factura', price: 240 },
          { label: 'pan', id: 'pan', price: 270 },
          { label: 'un alfajor', id: 'alfajor', price: 300 },
        ],
        paidWith: 1000, // change = 190, minimum 4 chips (100+50+20+20)
      },
    ],
  },
]

// Rounds resolved per level before the level is complete — difficulty ramps
// via round COUNT (there are no "options" to scale here, unlike LosOpuestos).
// Comfortably within each level's existing scenario pool (5/5/7), so every
// round is a genuinely random, non-repeating subset — no new content needed.
//
// Tuned to 8 total after the reviewing professional played the 12-round version
// and called it "muy cansador" — each round here is read-scenario + compute +
// tap-out-the-bills, so 12 of them ate the whole 10-15 min/day the product
// promises, for ONE of 30 days. 8 still gives a real workout without the slog.
const ROUNDS_PER_LEVEL = [2, 3, 3]
// Every round resolves with a single correct "Listo" tap (no "me rindo"),
// so totalAttempts = mistakes + this.
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

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

const PRAISE_GOOD = ['¡Perfecto, justo!', '¡Muy bien calculado!', '¡Así se hace!', '¡Exacto!']

interface PlacedBill {
  key: number
  value: number
}

export function ElVuelto({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  // Subset of `roundsForLevel` compras picked at random from the level's
  // scenario pool, recalculated once per level/roundKey — not per round.
  const scenarios = useMemo(
    () => shuffle(level.scenarios).slice(0, roundsForLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [roundIdx, setRoundIdx] = useState(0)
  const scenario = scenarios[roundIdx]
  const done = roundIdx >= roundsForLevel

  const totalPrice = scenario ? scenario.items.reduce((s, i) => s + i.price, 0) : 0
  const change = scenario ? scenario.paidWith - totalPrice : 0

  const [placed, setPlaced] = useState<PlacedBill[]>([])
  const [nextKey, setNextKey] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Wrong-sum count, accumulated across levels 1→2→3 and only zeroed on a true
  // day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

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
    if (!scenario) return
    if (sum === change) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
      // Brief feedback, then move to the next round within the level. Once
      // roundIdx reaches roundsForLevel, `done` flips true and the
      // level-complete screen takes over below.
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setPlaced([])
        setResolved(false)
      }, 900)
    } else if (sum > change) {
      setHint('Te pasaste un poco — sacá alguna ficha.')
      setMistakes((m) => m + 1)
    } else {
      setHint('Todavía te falta un poco.')
      setMistakes((m) => m + 1)
    }
  }

  // Resets happen HERE, synchronously with the level/round change, not in a
  // separate useEffect keyed on [levelIdx, roundKey]: an effect only catches
  // up on the render AFTER levelIdx changes, so a sibling effect watching
  // `done` would still see the previous level's stale `true` on the very
  // render that just arrived at the new level — firing onComplete instantly,
  // before the player has done anything. Setting `roundIdx` in the same
  // handler that sets `levelIdx`/`roundKey` means React batches them into one
  // render, so they're never observably out of sync.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setPlaced([])
    setHint(null)
    setResolved(false)
    // Only a genuine day restart (wrapping from level 3 back to level 1)
    // zeroes the mistake count — "Otra compra" must NOT, even on level 1.
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setPlaced([])
    setHint(null)
    setResolved(false)
  }

  // Fires once per roundKey when level 3's last compra resolves. A full day
  // restart (the wrap to level 1) gets a new roundKey, so a genuine replay
  // reports again; re-rendering while already done on level 3 does not fire
  // twice. totalAttempts = this attempt's mistakes + TOTAL_ROUNDS successful
  // checks — there's no separate "attempts" counter, so it's derived here
  // rather than adding a second piece of state.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
        {/* No "Armá el vuelto justo" heading: the modal's own header already
            names the day and the game, and the scenario below asks the question
            with the actual numbers in it. Three lines saying "vuelto" cost more
            than the bills they pushed off the bottom of the screen. */}
        {!done && (
          <div className="mx-auto mt-2 flex w-full max-w-xs items-center gap-3">
            <p className="shrink-0 text-base font-semibold text-slate-500">
              Llevás {roundIdx} de {roundsForLevel}
            </p>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-600 transition-[width] duration-300"
                style={{ width: `${(roundIdx / roundsForLevel) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {!done && scenario && (
        <>
          {/* Scenario — photos big enough to actually READ as photos (a 40px photo
              was a postage stamp for this audience), without pushing the bill
              palette below the fold: 1 item sits beside the text at 96px (those
              rounds have vertical slack); 2 items sit beside it at 64px (free —
              the text column is taller anyway); 3 items switch to a single row
              ABOVE the text at 56px, which measures the same as the old wrapped
              block. Each photo sits on a white tile so it pops off the slate card. */}
          <div
            className={[
              'mt-4 flex gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3',
              scenario.items.length === 3 ? 'flex-col items-center' : 'items-center',
            ].join(' ')}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-1.5">
              {scenario.items.map((item, i) => {
                const img = imgFor(item.id)
                const size =
                  scenario.items.length === 1 ? 'h-24 w-24' : scenario.items.length === 2 ? 'h-16 w-16' : 'h-14 w-14'
                return (
                  <div
                    key={`${item.id}-${i}`}
                    className={`flex ${size} items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1`}
                  >
                    {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                  </div>
                )
              })}
            </div>
            <div className={scenario.items.length === 3 ? 'min-w-0 text-center' : 'min-w-0 flex-1'}>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{scenario.venue}:</span>{' '}
                {scenario.items.map((i) => i.label).join(' + ')} — ${totalPrice.toLocaleString('es-AR')}
              </p>
              <p className="mt-0.5 text-base font-bold text-slate-900">
                Pagás con ${scenario.paidWith.toLocaleString('es-AR')}. ¿Cuánto te dan de vuelto?
              </p>
            </div>
          </div>

          {/* Tray of placed bills. The running total sits INSIDE the tray, on the
              right, instead of on its own line underneath — it's a property of
              what's in the tray, so it reads better here and costs nothing. */}
          <div className="mt-4 flex min-h-[64px] items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3">
            <div className="min-w-0 flex-1">
              {placed.length === 0 ? (
                <p className="text-sm text-slate-400">Tocá los billetes de abajo</p>
              ) : (
                <div className="flex flex-wrap gap-2">
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
            <p className="shrink-0 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
              Llevás
              <span className="block text-base font-bold text-slate-900">${sum.toLocaleString('es-AR')}</span>
            </p>
          </div>

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
          {resolved && (
            <p className="mt-3 text-center text-sm font-semibold text-tiam-green">
              {praise} Era ${change.toLocaleString('es-AR')}.
            </p>
          )}

          {!resolved && (
            // mt-4, not mt-6: those 8px are what lets the 3-item card's photo
            // row fit without pushing this button under the fold.
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={check}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Listo
              </button>
            </div>
          )}
        </>
      )}

      {/* Level complete */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
          <p className="mt-1 text-slate-600">
            Armaste bien el vuelto en las {roundsForLevel} compras — completaste el nivel {levelIdx + 1}.
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
              Otra compra
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
