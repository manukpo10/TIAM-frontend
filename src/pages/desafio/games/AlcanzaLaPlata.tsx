import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Lightbulb, RotateCcw, Sparkles } from 'lucide-react'
import type { GameProps } from '@/lib/challengeProgress'

/**
 * "¿Alcanza la plata?" — día 16, cálculo. A budget-estimation game: given a
 * short shopping list (with its total already summed) and a budget, judge
 * whether the money is enough — two big stacked buttons, resolved on the
 * first tap (same shape as VerdaderoOFalso; with exactly two options,
 * eliminating a wrong one would hand the second tap for free).
 *
 * It replaces the old día 16 ("¿Verdadero o falso?"), a general-knowledge
 * trivia quiz mislabeled as razonamiento — declarative recall, not
 * reasoning, and a poor fit for cálculo's neighbours. This is a genuinely
 * different cálculo skill from its two siblings: ElVuelto (día 5) CONSTRUCTS
 * exact change by tapping bills, LaRecetaDoble (día 22) ADJUSTS a quantity
 * with +/- to hit an exact target — this one COMPARES two already-known
 * amounts and judges whether one fits the other, the everyday "do I have
 * enough in my wallet" skill, without ever building or adjusting a sum.
 *
 * The total is shown pre-computed, never left for silent mental addition —
 * ElVuelto's own file header names that as a deliberate house rule ("no
 * numeric keypad... this app never types anywhere else... externalizing the
 * running total instead of demanding silent mental math".) The cognitive
 * task here is magnitude comparison (is $1470 under $1500?), not addition;
 * difficulty ramps by how CLOSE that comparison is, from an obvious gap in
 * nivel 1 to a $20-30 margin in nivel 3 that genuinely needs a careful look.
 *
 * Photos are a dedicated 23-item set copied from lista-mercado/el-vuelto
 * (día 2 and día 5's asset folders) into this game's own folder — reusing
 * proven photoreal groceries, not generating new ones, while keeping this
 * game decoupled from those days' asset lifecycle.
 */

interface Item {
  label: string
  id: string
  price: number
}
interface Scenario {
  venue: string
  items: Item[]
  budget: number
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
      { venue: 'Kiosco', items: [{ label: 'una gaseosa', id: 'gaseosa', price: 600 }], budget: 1000 },
      {
        venue: 'Verdulería',
        items: [
          { label: 'banana', id: 'banana', price: 300 },
          { label: 'manzana', id: 'manzana', price: 400 },
        ],
        budget: 500,
      },
      { venue: 'Almacén', items: [{ label: 'leche', id: 'leche', price: 500 }], budget: 1000 },
      {
        venue: 'Panadería',
        items: [
          { label: 'pan', id: 'pan', price: 400 },
          { label: 'medialunas', id: 'medialunas', price: 500 },
        ],
        budget: 600,
      },
      { venue: 'Kiosco', items: [{ label: 'chicles', id: 'chicles', price: 200 }], budget: 1000 },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    scenarios: [
      {
        venue: 'Almacén',
        items: [
          { label: 'queso', id: 'queso', price: 650 },
          { label: 'jamón', id: 'jamon', price: 580 },
        ],
        budget: 1500,
      },
      {
        venue: 'Verdulería',
        items: [
          { label: 'zanahoria', id: 'zanahoria', price: 280 },
          { label: 'tomate', id: 'tomate', price: 340 },
          { label: 'papas', id: 'papas', price: 310 },
        ],
        budget: 800,
      },
      {
        venue: 'Panadería',
        items: [
          { label: 'facturas', id: 'factura', price: 480 },
          { label: 'pan', id: 'pan', price: 380 },
        ],
        budget: 1000,
      },
      {
        venue: 'Kiosco',
        items: [
          { label: 'una gaseosa', id: 'gaseosa', price: 650 },
          { label: 'un alfajor', id: 'alfajor', price: 380 },
        ],
        budget: 900,
      },
      {
        venue: 'Almacén',
        items: [
          { label: 'huevos', id: 'huevos', price: 520 },
          { label: 'manteca', id: 'manteca', price: 410 },
          { label: 'azúcar', id: 'azucar', price: 290 },
        ],
        budget: 1500,
      },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    scenarios: [
      {
        venue: 'Almacén',
        items: [
          { label: 'fideos', id: 'fideos', price: 340 },
          { label: 'aceite', id: 'aceite', price: 520 },
          { label: 'queso', id: 'queso', price: 610 },
        ],
        budget: 1500,
      },
      {
        venue: 'Verdulería',
        items: [
          { label: 'zanahoria', id: 'zanahoria', price: 290 },
          { label: 'tomate', id: 'tomate', price: 360 },
          { label: 'papas', id: 'papas', price: 330 },
        ],
        budget: 950,
      },
      {
        venue: 'Panadería',
        items: [
          { label: 'pan', id: 'pan', price: 370 },
          { label: 'medialunas', id: 'medialunas', price: 420 },
          { label: 'facturas', id: 'factura', price: 290 },
        ],
        budget: 1100,
      },
      {
        venue: 'Kiosco',
        items: [
          { label: 'una gaseosa', id: 'gaseosa', price: 590 },
          { label: 'un alfajor', id: 'alfajor', price: 310 },
          { label: 'chicles', id: 'chicles', price: 180 },
        ],
        budget: 1050,
      },
      {
        venue: 'Almacén',
        items: [
          { label: 'leche', id: 'leche', price: 480 },
          { label: 'yogur', id: 'yogur', price: 350 },
          { label: 'manteca', id: 'manteca', price: 290 },
        ],
        budget: 1150,
      },
      {
        venue: 'Verdulería',
        items: [
          { label: 'banana', id: 'banana', price: 260 },
          { label: 'manzana', id: 'manzana', price: 340 },
          { label: 'pera', id: 'pera', price: 310 },
        ],
        budget: 880,
      },
      {
        venue: 'Almacén',
        items: [
          { label: 'café', id: 'cafe', price: 610 },
          { label: 'azúcar', id: 'azucar', price: 270 },
          { label: 'galletitas', id: 'galletitas', price: 340 },
        ],
        budget: 1200,
      },
    ],
  },
]

// Same tuning as ElVuelto (2/3/3 = 8 total): a professional called a
// 12-round version of that game "muy cansador" for one of 30 days — this
// game shares the lesson rather than re-learning it.
const ROUNDS_PER_LEVEL = [2, 3, 3]
const TOTAL_ROUNDS = ROUNDS_PER_LEVEL.reduce((a, b) => a + b, 0)

const IMAGES = import.meta.glob('../../../assets/desafio/games/alcanza-la-plata/*.webp', {
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

const ITEM_PRAISE = ['¡Correcto!', '¡Muy bien!', '¡Exacto!', '¡Bien calculado!']
const WRONG_LEADIN = ['¡Buen intento!', 'Casi.', '¡Vamos bien!', 'No exactamente.']
const LEVEL_PRAISE_GOOD = ['¡Muy bien!', '¡Excelente!', '¡Así se hace!', '¡Qué buen ojo para los números!']
const LEVEL_PRAISE_OK = [
  '¡Buen intento! Con cada ronda vas a estimar mejor.',
  '¡Bien ahí! Seguí practicando.',
]

export function AlcanzaLaPlata({ day: _day, onComplete }: GameProps) {
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
  const [userAnswer, setUserAnswer] = useState<boolean | null>(null)
  const [feedbackLine, setFeedbackLine] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [levelPraise, setLevelPraise] = useState(LEVEL_PRAISE_GOOD[0])
  // Wrong-answer count, accumulated across levels 1→2→3 and only zeroed on a
  // true day restart (see nextLevel's wrap branch below).
  const [mistakes, setMistakes] = useState(0)

  const scenario = scenarios[roundIdx]
  const done = roundIdx >= roundsForLevel
  const total = scenario ? scenario.items.reduce((s, i) => s + i.price, 0) : 0
  const fits = scenario ? total <= scenario.budget : true
  const wasWrong = userAnswer !== null && userAnswer !== fits

  function handleAnswer(guessFits: boolean) {
    if (userAnswer !== null || !scenario) return
    setUserAnswer(guessFits)
    if (guessFits === fits) {
      setCorrectCount((c) => c + 1)
      setFeedbackLine(pickOne(ITEM_PRAISE))
    } else {
      setMistakes((m) => m + 1)
      setFeedbackLine(pickOne(WRONG_LEADIN))
    }
  }

  function handleNext() {
    const nextIndex = roundIdx + 1
    setRoundIdx(nextIndex)
    setUserAnswer(null)
    if (nextIndex >= roundsForLevel) {
      const ratio = roundsForLevel ? correctCount / roundsForLevel : 0
      setLevelPraise(pickOne(ratio >= 0.6 ? LEVEL_PRAISE_GOOD : LEVEL_PRAISE_OK))
    }
  }

  // Resets happen HERE, synchronously with the level/round change — see
  // ElVuelto.tsx for why an effect-based reset would lag a render behind.
  function nextLevel() {
    const isWrap = levelIdx === LEVELS.length - 1
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setUserAnswer(null)
    setCorrectCount(0)
    if (isWrap) setMistakes(0)
  }
  function replay() {
    setRoundKey((k) => k + 1)
    setRoundIdx(0)
    setUserAnswer(null)
    setCorrectCount(0)
  }

  // Fires once per roundKey when level 3's last scenario resolves. No retry
  // in this game (single-tap resolve, like VerdaderoOFalso), so
  // totalAttempts is the fixed round count, not mistakes + it.
  const reportedRoundKeyRef = useRef<number | null>(null)
  useEffect(() => {
    if (done && levelIdx === LEVELS.length - 1 && reportedRoundKeyRef.current !== roundKey) {
      reportedRoundKeyRef.current = roundKey
      onComplete({ mistakes, totalAttempts: TOTAL_ROUNDS })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, levelIdx, roundKey])

  function btnClass(thisIsFits: boolean, color: 'green' | 'blue') {
    const base =
      'relative flex min-h-[80px] sm:min-h-[96px] w-full items-center justify-center rounded-3xl text-xl sm:text-2xl font-extrabold text-white transition'
    const fill = color === 'green' ? 'bg-tiam-green' : 'bg-tiam-blue'
    if (userAnswer === null) {
      return `${base} ${fill} hover:brightness-110 active:scale-95`
    }
    const userTappedThis = (color === 'green') === userAnswer
    if (userTappedThis && wasWrong) {
      return `${base} ${fill} opacity-40`
    }
    if (thisIsFits === fits) {
      return `${base} ${fill} scale-[1.02] shadow-lg`
    }
    return `${base} ${fill}`
  }

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
          {/* Scenario — same adaptive photo sizing as ElVuelto: 1 item big
              (96px), 2 medium (64px), 3 in a row above the text (56px). */}
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
                {scenario.items.map((i) => `${i.label} $${i.price}`).join(' + ')} = ${total.toLocaleString('es-AR')}
              </p>
              <p className="mt-0.5 text-base font-bold text-slate-900">
                Tenés ${scenario.budget.toLocaleString('es-AR')}. ¿Te alcanza la plata?
              </p>
            </div>
          </div>

          {/* The two buttons */}
          <div className="mt-6 flex flex-col gap-4">
            <button
              type="button"
              disabled={userAnswer !== null}
              onClick={() => handleAnswer(true)}
              className={btnClass(true, 'green')}
            >
              Sí, alcanza
              {userAnswer !== null && fits && (
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow">
                  <Check className="h-4 w-4 text-tiam-green" strokeWidth={3} />
                </span>
              )}
            </button>
            <button
              type="button"
              disabled={userAnswer !== null}
              onClick={() => handleAnswer(false)}
              className={btnClass(false, 'blue')}
            >
              No, no alcanza
              {userAnswer !== null && !fits && (
                <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow">
                  <Check className="h-4 w-4 text-tiam-blue" strokeWidth={3} />
                </span>
              )}
            </button>
          </div>

          {/* Feedback */}
          {userAnswer !== null && (
            <div
              className={[
                'mt-6 rounded-3xl border p-6 text-center',
                wasWrong ? 'border-tiam-blue/20 bg-tiam-blue/5' : 'border-tiam-green/20 bg-tiam-green/5',
              ].join(' ')}
            >
              <div
                className={[
                  'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
                  wasWrong ? 'bg-tiam-blue/15' : 'bg-tiam-green/15',
                ].join(' ')}
              >
                {wasWrong ? (
                  <Lightbulb className="h-6 w-6 text-tiam-blue" />
                ) : (
                  <Sparkles className="h-6 w-6 text-tiam-green" />
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{feedbackLine}</p>
              <p className="mt-2 text-slate-600">
                {fits
                  ? `Alcanzaba, y sobraban $${(scenario.budget - total).toLocaleString('es-AR')}.`
                  : `No alcanzaba — faltaban $${(total - scenario.budget).toLocaleString('es-AR')}.`}
              </p>
              <button
                type="button"
                onClick={handleNext}
                className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
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
            Estimaste bien en las {roundsForLevel} compras — completaste el {level.name.toLowerCase()}.
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
              Otra ronda
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
