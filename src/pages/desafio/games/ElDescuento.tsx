import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "El descuento" — día 4 del Mes 2, primer juego de cálculo del mes. Mirás
 * un producto con su precio de lista y un % de descuento, y tocás el precio
 * final correcto entre 3-4 opciones numéricas cercanas.
 *
 * Sin teclado numérico ni entrada libre — mismo principio que ElVuelto/
 * ContadorMasMenos (día 5 y 26 del mes 1): esta app nunca hace escribir un
 * número, siempre tocar. A diferencia de ElVuelto (sumar fichas hasta
 * alcanzar un total) esta es una elección múltiple con eliminación —
 * mecánicamente más parecida a ElReloj: tocás una opción, si está mal se
 * elimina (nunca roja, gris con tachado) y podés seguir intentando; si
 * está bien, resuelve y avanza sola tras una pausa breve (como ElVuelto).
 *
 * Los precios y % están elegidos a mano para que la aritmética cierre
 * siempre exacta (sin decimales): finalPrice()/discountAmount() derivan los
 * números de (original, percent) en vez de tipearlos sueltos, así el precio
 * final y el monto descontado nunca se desincronizan del precio de lista.
 *
 * Reutiliza las fotos de "La lista del mercado" (día 2, memoria) — un
 * catálogo de productos de almacén ya existente y con la temática exacta
 * que este juego necesita, sin generar arte nuevo.
 *
 * VARIAS rondas por nivel (2 por nivel, 6 en total) — mismo patrón
 * "uniformado" que ElVuelto/OrdenarLaFrase/PlanificaLaManana.
 */

interface Scenario {
  id: string
  label: string
  original: number
  percent: number
  decoyPercent: number
}
interface Level {
  n: number
  name: string
  optionsCount: 3 | 4
  scenarios: Scenario[]
}

function finalPrice(original: number, percent: number): number {
  return Math.round(original * (1 - percent / 100))
}
function discountAmount(original: number, percent: number): number {
  return Math.round(original * (percent / 100))
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    optionsCount: 3,
    scenarios: [
      { id: 'yerba', label: 'la yerba', original: 2000, percent: 10, decoyPercent: 20 },
      { id: 'aceite', label: 'el aceite', original: 1500, percent: 20, decoyPercent: 10 },
      { id: 'fideos', label: 'los fideos', original: 800, percent: 50, decoyPercent: 25 },
      { id: 'cafe', label: 'el café', original: 1000, percent: 10, decoyPercent: 20 },
      { id: 'pan', label: 'el pan', original: 600, percent: 50, decoyPercent: 20 },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    optionsCount: 4,
    scenarios: [
      { id: 'queso', label: 'el queso', original: 1200, percent: 25, decoyPercent: 10 },
      { id: 'detergente', label: 'el detergente', original: 2400, percent: 25, decoyPercent: 20 },
      { id: 'manteca', label: 'la manteca', original: 1600, percent: 25, decoyPercent: 10 },
      { id: 'jamon', label: 'el jamón', original: 3200, percent: 25, decoyPercent: 10 },
      { id: 'yerba', label: 'la yerba', original: 2800, percent: 25, decoyPercent: 10 },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    optionsCount: 4,
    scenarios: [
      { id: 'pollo', label: 'el pollo', original: 2000, percent: 15, decoyPercent: 30 },
      { id: 'pescado', label: 'el pescado', original: 2400, percent: 30, decoyPercent: 40 },
      { id: 'milanesa', label: 'la milanesa', original: 1800, percent: 40, decoyPercent: 15 },
      { id: 'queso', label: 'el queso', original: 2200, percent: 15, decoyPercent: 30 },
      { id: 'huevos', label: 'los huevos', original: 1600, percent: 30, decoyPercent: 40 },
    ],
  },
]

// 2 rondas por nivel (6 en total) — mismo recorte "uniformado" que ElVuelto/
// OrdenarLaFrase/PlanificaLaManana tras el feedback de que 3 rondas por
// nivel resultaba cansador para el ratio de 10-15 min/día del producto.
const ROUNDS_PER_LEVEL = [2, 2, 2]
// Cada ronda se resuelve con un único acierto (no hay "me rindo"), así que
// totalAttempts = mistakes + esto.
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

const IMAGES = import.meta.glob('../../../assets/desafio/games/lista-mercado/*.webp', {
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
const peso = (n: number) => `$${n.toLocaleString('es-AR')}`

const PRAISE_GOOD = ['¡Exacto, ese es el precio!', '¡Muy bien calculado!', '¡Perfecto!', '¡Así se hace!']
const WRONG_HINTS = [
  'Ese no es — volvé a calcular con calma.',
  'Casi. Fijate bien cuánto es el descuento.',
  'No es ese precio. Probá con otra opción.',
]

interface Option {
  id: string
  value: number
}
function optionsFor(s: Scenario, count: number): Option[] {
  const target = finalPrice(s.original, s.percent)
  const amount = discountAmount(s.original, s.percent)
  const decoyFinal = finalPrice(s.original, s.decoyPercent)
  const values = count === 3 ? [target, s.original, decoyFinal] : [target, s.original, amount, decoyFinal]
  return shuffle(values.map((value) => ({ id: `${value}`, value })))
}

export function ElDescuento({ day: _day, onComplete }: GameProps) {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const roundsForLevel = ROUNDS_PER_LEVEL[levelIdx]

  const scenarios = useMemo(
    () => shuffle(level.scenarios).slice(0, roundsForLevel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const [roundIdx, setRoundIdx] = useState(0)
  const scenario = scenarios[roundIdx]
  const done = roundIdx >= roundsForLevel

  const target = scenario ? finalPrice(scenario.original, scenario.percent) : 0
  const options = useMemo(
    () => (scenario ? optionsFor(scenario, level.optionsCount) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenario],
  )

  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])
  // Toques equivocados, acumulados a través de niveles 1→2→3 y sólo puestos
  // en cero en un reinicio real del día (ver la rama isWrap de nextLevel).
  const [mistakes, setMistakes] = useState(0)

  function guess(id: string) {
    if (resolved || !scenario) return
    if (Number(id) === target) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
      window.setTimeout(() => {
        setRoundIdx((i) => i + 1)
        setEliminated(new Set())
        setResolved(false)
      }, 900)
    } else {
      setMistakes((m) => m + 1)
      setEliminated((prev) => new Set(prev).add(id))
      setHint(pickOne(WRONG_HINTS))
    }
  }

  // Los resets pasan ACÁ, sincrónicos con el cambio de nivel/ronda, no en un
  // useEffect separado sobre [levelIdx, roundKey] — mismo motivo que
  // ElVuelto.tsx: un efecto llega un render tarde y "done" podría leerse
  // stale-true justo cuando levelIdx cambia, disparando onComplete de más.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setEliminated(new Set())
    setHint(null)
    setResolved(false)
  }

  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: mistakes + TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  const img = scenario ? imgFor(scenario.id) : undefined

  return (
    <div className="px-5 pb-5 pt-4 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          {level.name}
        </span>
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
          {/* Producto */}
          <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3">
            {img && (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5">
                <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700">
                Precio de lista de {scenario.label}: <span className="font-semibold">{peso(scenario.original)}</span>
              </p>
              <p className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-cyan-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  −{scenario.percent}%
                </span>
                <span className="text-base font-bold text-slate-900">¿Cuál es el precio final?</span>
              </p>
            </div>
          </div>

          {/* Opciones */}
          <div className={`mt-5 grid gap-3 ${options.length === 3 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {options.map((opt) => {
              const isEliminated = eliminated.has(opt.id)
              const isCorrectShown = resolved && opt.value === target
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={resolved || isEliminated}
                  onClick={() => guess(opt.id)}
                  className={[
                    'relative min-h-[56px] rounded-2xl border-2 px-4 py-3 text-lg font-bold transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isCorrectShown
                      ? 'border-tiam-green bg-tiam-green/10 text-slate-900'
                      : isEliminated
                        ? 'border-slate-200 bg-slate-50 text-slate-300 line-through'
                        : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {peso(opt.value)}
                </button>
              )
            })}
          </div>

          {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}
          {resolved && (
            <p className="mt-4 text-center text-sm font-semibold text-tiam-green">
              {praise} {peso(scenario.original)} menos {scenario.percent}% son {peso(target)}.
            </p>
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
            Calculaste bien los {roundsForLevel} descuentos — completaste el nivel {levelIdx + 1}.
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
              Otro producto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
