import { useMemo, useState } from 'react'
import { Eye, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

/**
 * "¿Qué será?" — a progressive-reveal object-guessing game (visual
 * closure), grounded in the Gollin Incomplete Figures Test: a familiar
 * object shown fragmented, revealing more only if not recognized.
 *
 * The "reveal" is done at RENDER time with a CSS clip-path circle grown
 * from the image's center — the same finished illustration used by the
 * other games, no separate partial-art needed per object. A wrong guess
 * and the voluntary "Dame una pista" button both advance the same single
 * reveal stage pointer, so there's one mental model for "more picture."
 *
 * No red anywhere in this one specifically: recognition failure is close
 * to the actual clinical deficit this game exercises (agnosia), so a
 * wrong guess reads as muted/neutral, never alarm-colored — and running
 * out of stages always resolves warmly, the object is simply revealed.
 */

interface RevealObject {
  id: string
  label: string
  category: 'animales' | 'objetos' | 'formas'
}

const OBJECTS: RevealObject[] = [
  { id: 'flamenco', label: 'flamenco', category: 'animales' },
  { id: 'oso', label: 'oso', category: 'animales' },
  { id: 'rana', label: 'rana', category: 'animales' },
  { id: 'gato', label: 'gato', category: 'animales' },
  { id: 'pato', label: 'pato', category: 'animales' },
  { id: 'tortuga', label: 'tortuga', category: 'animales' },
  { id: 'mariposa', label: 'mariposa', category: 'animales' },
  { id: 'pez', label: 'pez', category: 'animales' },
  { id: 'anteojos', label: 'anteojos', category: 'objetos' },
  { id: 'paraguas', label: 'paraguas', category: 'objetos' },
  { id: 'llaves', label: 'llaves', category: 'objetos' },
  { id: 'tijera', label: 'tijera', category: 'objetos' },
  { id: 'reloj-pulsera', label: 'reloj de pulsera', category: 'objetos' },
  { id: 'mate', label: 'mate', category: 'objetos' },
  { id: 'guitarra', label: 'guitarra', category: 'objetos' },
  { id: 'sol', label: 'sol', category: 'formas' },
  { id: 'corazon', label: 'corazón', category: 'formas' },
  { id: 'banana', label: 'banana', category: 'formas' },
  { id: 'zanahoria', label: 'zanahoria', category: 'formas' },
  { id: 'casa', label: 'casa', category: 'formas' },
]

const byCategory = (cat: RevealObject['category']) => OBJECTS.filter((o) => o.category === cat)

const IMAGES = import.meta.glob('../../../assets/desafio/games/que-sera/*.webp', {
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
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)

interface Level {
  n: number
  name: string
  stages: number[] // clip-path circle radius %, ascending — last entry is full reveal
  decoyStrategy: (target: RevealObject) => RevealObject[]
}

// Reveal % is a clip-path circle() radius, which does NOT scale linearly
// with "how much of the image is visible" (its percentage basis is the
// box's diagonal-derived reference, not width) — calibrated empirically
// against the actual art (sol, guitarra) rather than computed from theory:
// ~20% already shows most of a compact object, ~6% is a bare sliver.
const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    stages: [18, 32, 100],
    decoyStrategy: (target) => pick(OBJECTS.filter((o) => o.category !== target.category), 3),
  },
  {
    n: 2,
    name: 'Nivel 2',
    stages: [11, 20, 32, 100],
    decoyStrategy: (target) => [
      ...pick(OBJECTS.filter((o) => o.category !== target.category), 1),
      ...pick(byCategory(target.category).filter((o) => o.id !== target.id), 2),
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    stages: [6, 11, 18, 28, 100],
    decoyStrategy: (target) => pick(byCategory(target.category).filter((o) => o.id !== target.id), 3),
  },
]

const PRAISE_GOOD = ['¡Muy bien!', '¡Excelente ojo!', '¡Así se hace!', '¡Perfecto!']
const PRAISE_OK = [
  'Era {obj}. A veces cuesta con tan pocas pistas — la próxima seguro la reconocés más rápido.',
  '¡Buen intento! Era {obj}. Con la práctica, cada vez vas a necesitar menos pistas.',
]

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function QueSera() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const target = useMemo(
    () => pickOne(OBJECTS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const options = useMemo(
    () => shuffle([target, ...level.decoyStrategy(target)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, levelIdx],
  )

  const [stageIdx, setStageIdx] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [praise, setPraise] = useState('')

  const img = imgFor(target.id)
  const revealPercent = resolved ? 100 : level.stages[stageIdx]
  const canHint = !resolved && stageIdx < level.stages.length - 1

  function guess(optionId: string) {
    if (resolved) return
    if (optionId === target.id) {
      setPraise(pickOne(PRAISE_GOOD))
      setCorrect(true)
      setResolved(true)
      return
    }
    setEliminated((prev) => new Set(prev).add(optionId))
    if (stageIdx < level.stages.length - 1) {
      setStageIdx((i) => i + 1)
    } else {
      setPraise(pickOne(PRAISE_OK).replace('{obj}', target.label))
      setCorrect(false)
      setResolved(true)
    }
  }
  function hint() {
    if (canHint) setStageIdx((i) => i + 1)
  }
  function nextLevel() {
    setStageIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setCorrect(false)
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setStageIdx(0)
    setEliminated(new Set())
    setResolved(false)
    setCorrect(false)
    setRoundKey((k) => k + 1)
  }

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-orange/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-orange">
          Praxias · {level.name}
        </span>
        <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué será?</h2>
        <p className="mt-2 text-base text-slate-500">Mirá la imagen y elegí qué objeto es.</p>
      </div>

      {/* Revealed image */}
      <div className="relative mx-auto mt-6 aspect-square w-48 overflow-hidden rounded-3xl bg-slate-50 sm:w-56">
        {img && (
          <img
            src={img}
            alt=""
            className="h-full w-full object-contain p-6 transition-[clip-path] duration-500 ease-out"
            style={{ clipPath: `circle(${revealPercent}% at 50% 50%)` }}
          />
        )}
      </div>

      {!resolved && (
        <div className="mt-3 text-center">
          <button
            type="button"
            disabled={!canHint}
            onClick={hint}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-tiam-blue transition hover:bg-tiam-blue/5 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <Eye className="h-4 w-4" />
            Dame una pista
          </button>
        </div>
      )}

      {/* Options */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isEliminated = eliminated.has(opt.id)
          const isTheAnswer = resolved && opt.id === target.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={resolved || isEliminated}
              onClick={() => guess(opt.id)}
              className={[
                'min-h-[56px] rounded-2xl border-2 px-4 py-3 text-base font-bold capitalize transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                isTheAnswer ? 'border-tiam-green bg-tiam-green/10 text-slate-900' : '',
                isEliminated ? 'border-slate-200 bg-slate-50 text-slate-300 line-through' : '',
                !isTheAnswer && !isEliminated
                  ? 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
                  : '',
              ].join(' ')}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Result — green celebration on a real guess, calmer blue when we just reveal it */}
      {resolved && (
        <div
          className={[
            'mt-6 rounded-3xl border p-6 text-center',
            correct ? 'border-tiam-green/20 bg-tiam-green/5' : 'border-tiam-blue/20 bg-tiam-blue/5',
          ].join(' ')}
        >
          <div
            className={[
              'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
              correct ? 'bg-tiam-green/15' : 'bg-tiam-blue/15',
            ].join(' ')}
          >
            {correct ? <Sparkles className="h-6 w-6 text-tiam-green" /> : <Eye className="h-6 w-6 text-tiam-blue" />}
          </div>
          <p className="mt-3 text-lg font-bold text-slate-900">{praise}</p>
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
