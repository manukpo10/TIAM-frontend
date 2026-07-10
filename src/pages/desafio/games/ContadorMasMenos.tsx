import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'

/**
 * "La receta doble" — a proportional-scaling estimation game, second in the
 * cálculo area. A single running counter (0 to start) adjusted with +/-
 * buttons toward the quantity a word problem implies — mechanically
 * distinct from ElVuelto's multi-denomination tray-sum: one number, two
 * buttons, no chips to pick between.
 *
 * Step is always exactly ±1 at every level (no secondary "+10" button, no
 * press-and-hold) — this app has no hold/drag gesture anywhere, and a coarse
 * jump would invite binary-search guessing instead of computing the answer.
 * Content is capped so the worst case (~16 taps of the same always-in-the-
 * same-spot button) stays comfortable.
 *
 * Same never-hard-fail philosophy as ElVuelto: a wrong "Listo" tap gives a
 * warm directional nudge and stays adjustable indefinitely, never red.
 */

interface Scenario {
  id: string
  icon: string
  prompt: string
  target: number
  explanation: string
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
      { id: 'huevos', icon: 'huevos', prompt: 'Para una torta casera de 4 personas se usan 3 huevos. Al final vienen 8 personas, el doble. ¿Cuántos huevos hay que poner?', target: 6, explanation: 'Eran 6: se duplicó la cantidad de personas (4→8), así que también se duplican los huevos (3→6).' },
      { id: 'manzana', icon: 'manzana', prompt: 'Para una ensalada de fruta de 3 personas se cortan 2 manzanas. Al final vienen 6, el doble. ¿Cuántas manzanas hay que cortar?', target: 4, explanation: 'Eran 4: el doble de personas pide el doble de manzanas (2→4).' },
      { id: 'medialunas', icon: 'medialunas', prompt: 'Para el desayuno de 2 personas se ponen 3 medialunas en la mesa. Al final vienen 4, el doble. ¿Cuántas medialunas hay que poner?', target: 6, explanation: 'Eran 6: si se duplican los invitados, se duplican las medialunas (3→6).' },
      { id: 'naranja', icon: 'naranja', prompt: 'Para una jarra de jugo de 6 personas se exprimen 8 naranjas. Hoy van a ser 3, la mitad. ¿Cuántas naranjas hay que exprimir?', target: 4, explanation: 'Eran 4: la mitad de invitados necesita la mitad de naranjas (8→4).' },
      { id: 'queso', icon: 'queso', prompt: 'Para una picada de 8 personas se cortan 10 tajadas de queso. Hoy van a ser 4, la mitad. ¿Cuántas tajadas de queso hay que cortar?', target: 5, explanation: 'Eran 5: la mitad de personas, la mitad de tajadas (10→5).' },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    scenarios: [
      { id: 'empanadas', icon: 'empanada', prompt: 'Para 4 personas se hacen 8 empanadas. Al final van a venir 6. ¿Cuántas empanadas hay que hacer?', target: 12, explanation: 'Eran 12: 2 empanadas por persona × 6 personas.' },
      { id: 'limon', icon: 'limon', prompt: 'Para 2 personas se necesitan 4 limones. Al final van a ser 5. ¿Cuántos limones hay que exprimir?', target: 10, explanation: 'Eran 10: 2 limones por persona × 5 personas.' },
      { id: 'zanahoria', icon: 'zanahoria', prompt: 'Para una tarta de 10 personas se rallan 15 zanahorias. Al final van a venir 6. ¿Cuántas zanahorias hay que rallar?', target: 9, explanation: 'Eran 9: son 1 zanahoria y media por persona, y para 6 personas son 9.' },
      { id: 'manzana2', icon: 'manzana', prompt: 'Para una torta de manzana de 4 personas se usan 6 manzanas. Al final van a venir 10. ¿Cuántas manzanas hay que usar?', target: 15, explanation: 'Eran 15: manzana y media por persona × 10 personas.' },
      { id: 'galletitas', icon: 'galletitas', prompt: 'Para 3 personas se ponen 6 galletitas en el plato de la leche. Van a venir 8. ¿Cuántas galletitas hay que poner?', target: 16, explanation: 'Eran 16: 2 galletitas por persona × 8 personas.' },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    scenarios: [
      { id: 'empanadas2', icon: 'empanada', prompt: 'Para 6 personas se hacen 12 empanadas (2 por persona). Al final van a venir 9, pero ya tenés 4 empanadas hechas de ayer. ¿Cuántas empanadas más hay que hacer?', target: 14, explanation: 'Para 9 personas hacían falta 18 (2 por persona). Como ya tenías 4 hechas, quedaban 14 por hacer.' },
      { id: 'zanahoria2', icon: 'zanahoria', prompt: 'Para una tarta de 4 personas se rallan 8 zanahorias. Van a venir 6, pero uno es alérgico y no va a comer, así que cociná para 5. ¿Cuántas zanahorias hay que rallar?', target: 10, explanation: 'Son 2 zanahorias por persona. Como en realidad comen 5 (6 menos el alérgico), son 10.' },
      { id: 'naranja2', icon: 'naranja', prompt: 'Para 3 personas se exprimen 6 naranjas. Van a venir 9, pero ya tenés 5 naranjas exprimidas en la heladera. ¿Cuántas naranjas más hay que exprimir?', target: 13, explanation: 'Para 9 personas hacían falta 18 naranjas (2 por persona). Como ya tenías 5, quedaban 13 por exprimir.' },
      { id: 'medialunas2', icon: 'medialunas', prompt: 'Para el desayuno de 6 personas se compran 12 medialunas (2 por persona). Vienen 10, pero 2 de ellas están a dieta y no van a comer medialunas. ¿Cuántas medialunas hay que comprar?', target: 16, explanation: 'En realidad comen 8 (10 menos las 2 a dieta). A 2 medialunas por persona, son 16.' },
      { id: 'tomate', icon: 'tomate', prompt: 'Para una ensalada de 5 personas se cortan 10 tomates (2 por persona). Al final van a venir 8, pero ya tenés 1 tomate cortado de antes. ¿Cuántos tomates más hay que cortar?', target: 15, explanation: 'Para 8 personas hacían falta 16 tomates (2 por persona). Como ya tenías 1 cortado, quedaban 15 por cortar.' },
      { id: 'chorizo', icon: 'chorizo', prompt: 'Para un asado de 5 personas se cortan 15 rodajas de chorizo (3 por persona). Al final van a venir 8, pero ya tenés 9 rodajas cortadas de antes. ¿Cuántas rodajas más hay que cortar?', target: 15, explanation: 'Son 3 rodajas por persona. Para 8 personas hacían falta 24. Como ya tenías 9 cortadas, quedaban 15 por cortar.' },
      { id: 'tostadas', icon: 'tostadas', prompt: 'Para la merienda de 3 personas se tuestan 12 tostadas (4 por persona). Van a venir 5, pero ya dejaste 8 tostadas listas de antes. ¿Cuántas tostadas más hay que tostar?', target: 12, explanation: 'Son 4 tostadas por persona. Para 5 personas hacían falta 20. Como ya tenías 8 listas, quedaban 12 por tostar.' },
    ],
  },
]

const IMAGES = import.meta.glob(
  [
    '../../../assets/desafio/games/lista-mercado/*.webp',
    '../../../assets/desafio/games/buscar-rojos/*.webp',
    '../../../assets/desafio/games/el-vuelto/*.webp',
  ],
  { eager: true, import: 'default' },
) as Record<string, string>
function imgFor(id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const PRAISE_GOOD = [
  '¡Exacto, esa es la cantidad justa!',
  '¡Muy bien calculado!',
  '¡Perfecto, llegaste al número justo!',
  '¡Así se hace!',
]

export function ContadorMasMenos() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const scenario = useMemo(
    () => pickOne(level.scenarios),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [counter, setCounter] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])

  useEffect(() => {
    setCounter(0)
    setHint(null)
    setResolved(false)
  }, [levelIdx, roundKey])

  function increment() {
    if (resolved) return
    setCounter((c) => Math.min(99, c + 1))
    setHint(null)
  }
  function decrement() {
    if (resolved) return
    setCounter((c) => Math.max(0, c - 1))
    setHint(null)
  }
  function check() {
    if (counter === scenario.target) {
      setPraise(pickOne(PRAISE_GOOD))
      setResolved(true)
      setHint(null)
    } else if (counter > scenario.target) {
      setHint('Te pasaste un poco. Probá bajar con el −.')
    } else {
      setHint('Todavía te falta. Sumá un poco más con el +.')
    }
  }

  function nextLevel() {
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setRoundKey((k) => k + 1)
  }

  const img = imgFor(scenario.icon)

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-600/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
          Cálculo · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">Encontrá la cantidad justa</h2>
      </div>

      {/* Scenario */}
      <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
        {img && (
          <div className="flex items-center justify-center">
            <img src={img} alt="" className="h-12 w-12 object-contain" draggable={false} />
          </div>
        )}
        <p className="mt-2 text-center text-base text-slate-700">{scenario.prompt}</p>
      </div>

      {/* Stepper */}
      <div className="mt-6 flex items-center justify-center gap-6">
        <button
          type="button"
          disabled={resolved || counter === 0}
          onClick={decrement}
          aria-label="Restar uno"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-tiam-blue text-white shadow transition hover:brightness-110 active:scale-95 disabled:opacity-30 sm:h-20 sm:w-20"
        >
          <Minus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={3} />
        </button>
        <span className="min-w-[4ch] text-center text-6xl font-extrabold leading-none tracking-tight text-tiam-blue sm:text-7xl">
          {counter}
        </span>
        <button
          type="button"
          disabled={resolved}
          onClick={increment}
          aria-label="Sumar uno"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-tiam-blue text-white shadow transition hover:brightness-110 active:scale-95 disabled:opacity-30 sm:h-20 sm:w-20"
        >
          <Plus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={3} />
        </button>
      </div>

      {hint && !resolved && <p className="mt-4 text-center text-sm font-medium text-slate-500">{hint}</p>}

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
          <p className="mt-1 text-slate-600">{scenario.explanation}</p>
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
              Otra receta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
