import { useEffect, useMemo, useState } from 'react'
import { Check, Eye, Minus, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

/**
 * "¿Qué se esconde?" — a figure-ground discrimination mini-game grounded in
 * the Poppelreuter overlapping-figures test (a classic visual-gnosis task:
 * several object drawings superimposed in one space, name every object present).
 *
 * The fused image needs zero new art: the Flux illustrations are flat-color
 * shapes on solid-white canvases, and stacking them with CSS
 * `mix-blend-mode: multiply` makes every white background vanish (white × X = X)
 * while the dark outlines stay crisp through the overlap (black × X = black) —
 * unusually faithful to the real Poppelreuter plates.
 *
 * Selection is hidden-until-submit (à la "¿Qué hay en la mesa?"), NOT live
 * per-tap feedback (à la "Buscá los rojos"): with only 4–8 options and a single
 * static image to parse, live right/wrong per tap would let a player brute-force
 * the answer by tapping each option in turn instead of actually segregating the
 * overlapping contours. Never red — this is recognition territory (gnosias),
 * same rule as "¿Qué será?".
 */

interface CompositionItem {
  objectId: string
  xPct: number
  yPct: number
  scale: number
  rotationDeg?: number
}
interface Composition {
  items: CompositionItem[]
  decoyIds: string[]
}
interface Level {
  n: number
  name: string
  compositions: Composition[]
}

const LABELS: Record<string, string> = {
  paraguas: 'paraguas',
  banana: 'banana',
  guitarra: 'guitarra',
  tijera: 'tijera',
  'manzana-roja': 'manzana',
  tortuga: 'tortuga',
  'reloj-pulsera': 'reloj',
  oso: 'oso',
  corazon: 'corazón',
  zanahoria: 'zanahoria',
  anteojos: 'anteojos',
  mate: 'mate',
  pato: 'pato',
  rana: 'rana',
  sol: 'sol',
  mariposa: 'mariposa',
  llaves: 'llaves',
  'camion-bomberos': 'camión de bomberos',
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    compositions: [
      { items: [{ objectId: 'paraguas', xPct: 42, yPct: 40, scale: 0.95, rotationDeg: -8 }, { objectId: 'banana', xPct: 58, yPct: 62, scale: 0.9, rotationDeg: 18 }], decoyIds: ['tortuga', 'sol'] },
      { items: [{ objectId: 'guitarra', xPct: 46, yPct: 46, scale: 1, rotationDeg: -10 }, { objectId: 'tijera', xPct: 57, yPct: 56, scale: 0.85, rotationDeg: 32 }], decoyIds: ['oso', 'corazon'] },
      { items: [{ objectId: 'manzana-roja', xPct: 43, yPct: 42, scale: 0.9 }, { objectId: 'tortuga', xPct: 58, yPct: 58, scale: 0.95, rotationDeg: -12 }], decoyIds: ['reloj-pulsera', 'sol'] },
      { items: [{ objectId: 'zanahoria', xPct: 48, yPct: 38, scale: 0.95, rotationDeg: 8 }, { objectId: 'anteojos', xPct: 52, yPct: 62, scale: 1, rotationDeg: -6 }], decoyIds: ['mariposa', 'corazon'] },
      { items: [{ objectId: 'mate', xPct: 44, yPct: 46, scale: 1, rotationDeg: -5 }, { objectId: 'corazon', xPct: 59, yPct: 56, scale: 0.8, rotationDeg: 15 }], decoyIds: ['banana', 'rana'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    compositions: [
      { items: [{ objectId: 'guitarra', xPct: 46, yPct: 42, scale: 0.95, rotationDeg: -10 }, { objectId: 'tijera', xPct: 60, yPct: 54, scale: 0.8, rotationDeg: 30 }, { objectId: 'manzana-roja', xPct: 38, yPct: 60, scale: 0.78 }], decoyIds: ['banana', 'sol', 'tortuga'] },
      { items: [{ objectId: 'mate', xPct: 42, yPct: 44, scale: 0.88, rotationDeg: -8 }, { objectId: 'tortuga', xPct: 60, yPct: 46, scale: 0.85, rotationDeg: 12 }, { objectId: 'reloj-pulsera', xPct: 50, yPct: 64, scale: 0.78, rotationDeg: -15 }], decoyIds: ['rana', 'zanahoria', 'corazon'] },
      { items: [{ objectId: 'banana', xPct: 42, yPct: 40, scale: 0.88, rotationDeg: 22 }, { objectId: 'pato', xPct: 59, yPct: 48, scale: 0.82, rotationDeg: -10 }, { objectId: 'corazon', xPct: 48, yPct: 66, scale: 0.72 }], decoyIds: ['manzana-roja', 'llaves', 'paraguas'] },
      { items: [{ objectId: 'anteojos', xPct: 50, yPct: 36, scale: 0.92, rotationDeg: -5 }, { objectId: 'zanahoria', xPct: 40, yPct: 58, scale: 0.88, rotationDeg: 15 }, { objectId: 'oso', xPct: 62, yPct: 56, scale: 0.8 }], decoyIds: ['llaves', 'banana', 'mariposa'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    compositions: [
      { items: [{ objectId: 'tortuga', xPct: 50, yPct: 52, scale: 0.72 }, { objectId: 'manzana-roja', xPct: 38, yPct: 42, scale: 0.61 }, { objectId: 'banana', xPct: 60, yPct: 40, scale: 0.66, rotationDeg: 25 }, { objectId: 'tijera', xPct: 52, yPct: 62, scale: 0.61, rotationDeg: -30 }, { objectId: 'pato', xPct: 68, yPct: 63, scale: 0.6, rotationDeg: -12 }], decoyIds: ['reloj-pulsera', 'zanahoria', 'rana', 'oso'] },
      { items: [{ objectId: 'mate', xPct: 42, yPct: 46, scale: 0.82, rotationDeg: -8 }, { objectId: 'pato', xPct: 60, yPct: 42, scale: 0.72, rotationDeg: 10 }, { objectId: 'corazon', xPct: 40, yPct: 66, scale: 0.66 }, { objectId: 'zanahoria', xPct: 62, yPct: 64, scale: 0.76, rotationDeg: 18 }], decoyIds: ['reloj-pulsera', 'oso', 'sol', 'banana'] },
      { items: [{ objectId: 'tortuga', xPct: 50, yPct: 54, scale: 0.7 }, { objectId: 'guitarra', xPct: 40, yPct: 40, scale: 0.7, rotationDeg: -15 }, { objectId: 'anteojos', xPct: 60, yPct: 38, scale: 0.66, rotationDeg: 8 }, { objectId: 'reloj-pulsera', xPct: 58, yPct: 64, scale: 0.58, rotationDeg: -10 }, { objectId: 'pato', xPct: 68, yPct: 56, scale: 0.6, rotationDeg: -12 }], decoyIds: ['llaves', 'paraguas', 'rana', 'manzana-roja'] },
      { items: [{ objectId: 'oso', xPct: 50, yPct: 50, scale: 0.7 }, { objectId: 'banana', xPct: 38, yPct: 38, scale: 0.65, rotationDeg: 25 }, { objectId: 'rana', xPct: 62, yPct: 40, scale: 0.61 }, { objectId: 'camion-bomberos', xPct: 52, yPct: 66, scale: 0.7, rotationDeg: -8 }, { objectId: 'pato', xPct: 68, yPct: 62, scale: 0.6, rotationDeg: -12 }], decoyIds: ['zanahoria', 'corazon', 'mariposa', 'reloj-pulsera'] },
    ],
  },
]

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-se-esconde/*.webp', {
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

const PRAISE_GOOD = ['¡Excelente ojo!', '¡Muy bien descubierto!', '¡Así se hace!', '¡Qué buena percepción!']
const PRAISE_OK = [
  '¡Buen intento! Algunos estaban bien escondidos.',
  'Con la práctica, cada vez vas a distinguir más rápido las formas escondidas.',
]

type Phase = 'play' | 'results'

export function QueSeEsconde() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const composition = useMemo(
    () => pickOne(level.compositions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const trueIds = useMemo(() => new Set(composition.items.map((i) => i.objectId)), [composition])
  const options = useMemo(
    () => shuffle([...composition.items.map((i) => i.objectId), ...composition.decoyIds]),
    [composition],
  )

  const [phase, setPhase] = useState<Phase>('play')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [praise, setPraise] = useState(PRAISE_GOOD[0])

  useEffect(() => {
    setPhase('play')
    setSelected(new Set())
  }, [levelIdx, roundKey])

  function toggle(id: string) {
    if (phase !== 'play') return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const correctFound = useMemo(() => [...selected].filter((id) => trueIds.has(id)).length, [selected, trueIds])

  function submit() {
    const ratio = trueIds.size ? correctFound / trueIds.size : 0
    setPraise(pickOne(ratio >= 0.6 ? PRAISE_GOOD : PRAISE_OK))
    setPhase('results')
  }

  function nextLevel() {
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setRoundKey((k) => k + 1)
  }

  const optionCols = level.n === 1 ? 'grid-cols-2' : level.n === 2 ? 'grid-cols-3' : 'grid-cols-4'

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          Praxias · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué se esconde?</h2>
        {phase === 'play' ? (
          <p className="mt-2 text-base text-slate-500">
            Mirá el dibujo. Tocá todos los objetos que reconozcas escondidos ahí.
          </p>
        ) : (
          <p className="mt-2 text-base font-semibold text-slate-500">
            Encontraste {correctFound} de {trueIds.size} — {praise}
          </p>
        )}
      </div>

      {/* Fused canvas */}
      <div className="relative isolate mx-auto mt-6 aspect-square w-56 overflow-hidden rounded-3xl border-2 border-slate-100 bg-white sm:w-64">
        {composition.items.map((it) => {
          const img = imgFor(it.objectId)
          return (
            img && (
              <img
                key={it.objectId}
                src={img}
                alt=""
                draggable={false}
                className="pointer-events-none absolute mix-blend-multiply"
                style={{
                  left: `${it.xPct}%`,
                  top: `${it.yPct}%`,
                  width: `${it.scale * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${it.rotationDeg ?? 0}deg)`,
                }}
              />
            )
          )
        })}
      </div>

      {/* Options */}
      <div className={`mt-6 grid gap-3 ${optionCols}`}>
        {options.map((id) => {
          const img = imgFor(id)
          const isSelected = selected.has(id)
          const isTrue = trueIds.has(id)

          // Results-phase three-way language (never red): green=found, blue=missed, grey=false positive.
          let stateClass = 'border-slate-200 bg-white'
          let badge: 'hit' | 'missed' | 'false' | null = null
          if (phase === 'play') {
            stateClass = isSelected
              ? 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
              : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
          } else if (isTrue && isSelected) {
            stateClass = 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
            badge = 'hit'
          } else if (isTrue && !isSelected) {
            stateClass = 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
            badge = 'missed'
          } else if (!isTrue && isSelected) {
            stateClass = 'border-slate-200 bg-white opacity-40'
            badge = 'false'
          } else {
            stateClass = 'border-slate-200 bg-white opacity-40'
          }

          return (
            <button
              key={id}
              type="button"
              disabled={phase !== 'play'}
              onClick={() => toggle(id)}
              aria-label={LABELS[id] ?? id}
              className={[
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 p-2 transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                stateClass,
              ].join(' ')}
            >
              {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
              {badge === 'hit' && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
              {badge === 'missed' && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-blue text-white shadow">
                  <Eye className="h-3.5 w-3.5" />
                </span>
              )}
              {badge === 'false' && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-white shadow">
                  <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Results legend */}
      {phase === 'results' && (
        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-tiam-green" /> Lo encontraste</span>
          <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5 text-tiam-blue" /> También estaba</span>
          <span className="inline-flex items-center gap-1"><Minus className="h-3.5 w-3.5 text-slate-400" /> No estaba</span>
        </div>
      )}

      {/* Actions */}
      {phase === 'play' ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={submit}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark"
          >
            Listo
          </button>
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{praise}</p>
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
              Otra imagen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
