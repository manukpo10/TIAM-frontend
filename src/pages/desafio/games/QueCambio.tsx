import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Eye, RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

/**
 * "¿Qué cambió?" — a change-detection / visual-working-memory game.
 *
 * Study a fixed grid of objects, then the same grid reappears in the SAME
 * positions with a few cells changed (an object replaced, removed, or two
 * swapped) — tap what changed. This is NOT "¿Qué hay en la mesa?": that game
 * reshuffles the board into a flat list and tests WHICH items you saw among
 * distractors; here position is preserved and the task is WHAT CHANGED in a
 * stable arrangement — binding an object to a location, a lower-capacity,
 * distinct skill.
 *
 * Live per-tap feedback (position carries meaning, so a tap resolves a
 * specific spot and the player can redirect immediately). A wrong tap is a
 * neutral grey wiggle, never red. A "no encuentro más" link (available once
 * you've found one change, or after 20s) reveals the rest warmly so nobody
 * gets marooned — the ground truth here is memory-dependent and can't be
 * re-derived by looking.
 */

interface Theme {
  key: string
  folder: string
  studyTitle: string
  items: string[]
}

const THEMES: Theme[] = [
  {
    key: 'mesa',
    folder: 'que-hay-en-la-mesa',
    studyTitle: 'Observá la mesa',
    items: [
      'mate', 'bombilla', 'termo', 'taza', 'vaso', 'anteojos', 'llaves', 'billetera', 'reloj-pulsera', 'celular',
      'lapicera', 'lapiz', 'cuaderno', 'libro', 'diario', 'tijera', 'ovillo-lana', 'agujas-tejer', 'boton', 'dedal',
      'pan', 'factura', 'galleta', 'azucarera', 'servilletero', 'vela', 'florero', 'portarretrato', 'maceta', 'control-remoto',
    ],
  },
  {
    key: 'mercado',
    folder: 'lista-mercado',
    studyTitle: 'Observá el mercado',
    items: [
      'leche', 'queso', 'manteca', 'yogur', 'huevos', 'pan', 'medialunas', 'galletitas', 'tostadas', 'grisines',
      'manzana', 'banana', 'zanahoria', 'uvas', 'pera', 'pollo', 'milanesa', 'jamon', 'chorizo', 'pescado',
      'detergente', 'lavandina', 'papel-higienico', 'esponja', 'jabon', 'cafe', 'azucar', 'yerba', 'fideos', 'aceite',
    ],
  },
  {
    key: 'animales',
    folder: 'animal-por-letra',
    studyTitle: 'Observá los animales',
    items: [
      'abeja', 'burro', 'delfin', 'elefante', 'gato', 'mono', 'oso', 'pato', 'rana', 'tortuga',
      'vaca', 'cangrejo', 'jirafa', 'leon', 'nutria', 'flamenco', 'serpiente', 'zorro',
      'chancho', 'llama', 'hipopotamo', 'cebra', 'yacare', 'nandu',
    ],
  },
]

interface Level {
  n: number
  name: string
  studySeconds: number
  minEarlySeconds: number
  size: number
  replace: number
  remove: number
  swap: number
  instruction: string
}

const LEVELS: Level[] = [
  { n: 1, name: 'Nivel 1', studySeconds: 20, minEarlySeconds: 8, size: 6, replace: 2, remove: 0, swap: 0, instruction: 'Tocá los objetos que cambiaron.' },
  { n: 2, name: 'Nivel 2', studySeconds: 25, minEarlySeconds: 8, size: 9, replace: 2, remove: 1, swap: 0, instruction: 'Tocá los objetos que cambiaron: pueden ser distintos o haber desaparecido.' },
  { n: 3, name: 'Nivel 3', studySeconds: 30, minEarlySeconds: 8, size: 12, replace: 1, remove: 1, swap: 1, instruction: 'Tocá todo lo que cambió: objetos distintos, que desaparecieron, o que cambiaron de lugar. Cada lugar cuenta por separado.' },
]

// One glob across the three theme folders; lookups are namespaced by FOLDER
// (not just id) because filenames collide across folders with different art
// (e.g. pan exists in both mesa and mercado; rana/flamenco exist in all three).
const IMAGES = import.meta.glob(
  [
    '../../../assets/desafio/games/que-hay-en-la-mesa/*.webp',
    '../../../assets/desafio/games/lista-mercado/*.webp',
    '../../../assets/desafio/games/animal-por-letra/*.webp',
  ],
  { eager: true, import: 'default' },
) as Record<string, string>
function imgFor(folder: string, id: string): string | undefined {
  const match = Object.entries(IMAGES).find(([path]) => path.endsWith(`/${folder}/${id}.webp`))
  return match?.[1]
}

const LABELS: Record<string, string> = {
  'reloj-pulsera': 'reloj', 'ovillo-lana': 'ovillo de lana', 'agujas-tejer': 'agujas de tejer',
  'control-remoto': 'control remoto', 'papel-higienico': 'papel higiénico', lapiz: 'lápiz',
  jamon: 'jamón', jabon: 'jabón', cafe: 'café', azucar: 'azúcar', leon: 'león', delfin: 'delfín',
  hipopotamo: 'hipopótamo', yacare: 'yacaré', nandu: 'ñandú',
}
const labelFor = (id: string) => LABELS[id] ?? id.replace(/-/g, ' ')

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pick = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n)
function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

interface RoundData {
  theme: Theme
  studied: string[]
  current: (string | null)[]
  targets: Set<number>
}

function buildRound(level: Level): RoundData {
  const theme = pickOne(THEMES)
  const studied = pick(theme.items, level.size)
  const current: (string | null)[] = [...studied]
  const usedIdx = new Set<number>()
  const targets = new Set<number>()
  const usedIds = new Set(studied)

  const freeIndex = () => {
    let i = Math.floor(Math.random() * level.size)
    let guard = 0
    while (usedIdx.has(i) && guard < 100) {
      i = Math.floor(Math.random() * level.size)
      guard++
    }
    return i
  }

  for (let s = 0; s < level.swap; s++) {
    const i = freeIndex()
    usedIdx.add(i)
    const j = freeIndex()
    usedIdx.add(j)
    ;[current[i], current[j]] = [current[j], current[i]]
    targets.add(i)
    targets.add(j)
  }
  for (let r = 0; r < level.replace; r++) {
    const i = freeIndex()
    usedIdx.add(i)
    const pool = theme.items.filter((id) => !usedIds.has(id))
    const newId = pickOne(pool)
    current[i] = newId
    usedIds.add(newId)
    targets.add(i)
  }
  for (let r = 0; r < level.remove; r++) {
    const i = freeIndex()
    usedIdx.add(i)
    current[i] = null
    targets.add(i)
  }
  return { theme, studied, current, targets }
}

const PRAISE_GOOD = ['¡Excelente ojo!', '¡Qué buena memoria visual!', '¡Así se hace!', '¡Perfecto, no se te escapa nada!']
const PRAISE_OK = [
  '¡Buen intento! Con la práctica, cada vez se te van a escapar menos.',
  '¡Bien ahí! Mirar de a poco ayuda a encontrar los cambios.',
]

type Phase = 'study' | 'change'

export function QueCambio() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]

  const round = useMemo(
    () => buildRound(level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )
  const k = round.targets.size

  const [phase, setPhase] = useState<Phase>('study')
  const [canContinueEarly, setCanContinueEarly] = useState(false)
  const [found, setFound] = useState<Set<number>>(new Set())
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [wrongHint, setWrongHint] = useState(false)
  const [helpUsed, setHelpUsed] = useState(false)
  const [helpAvailable, setHelpAvailable] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [praise, setPraise] = useState(PRAISE_GOOD[0])

  // Fresh study phase per level/round.
  useEffect(() => {
    setPhase('study')
    setCanContinueEarly(false)
    setFound(new Set())
    setWrongIdx(null)
    setWrongHint(false)
    setHelpUsed(false)
    setHelpAvailable(false)
    setRevealed(false)
    const floorTimer = window.setTimeout(() => setCanContinueEarly(true), level.minEarlySeconds * 1000)
    const autoTimer = window.setTimeout(() => setPhase('change'), level.studySeconds * 1000)
    return () => {
      window.clearTimeout(floorTimer)
      window.clearTimeout(autoTimer)
    }
  }, [levelIdx, roundKey, level.minEarlySeconds, level.studySeconds])

  // In the change phase, unlock the "no encuentro más" link after 20s.
  useEffect(() => {
    if (phase !== 'change') return
    const t = window.setTimeout(() => setHelpAvailable(true), 20000)
    return () => window.clearTimeout(t)
  }, [phase])

  const done = phase === 'change' && (found.size >= k || revealed)

  const handleTap = useCallback(
    (i: number) => {
      if (phase !== 'change' || revealed || found.has(i)) return
      if (round.targets.has(i)) {
        setFound((prev) => new Set(prev).add(i))
        setHelpAvailable(true) // finding one unlocks the safety net
      } else {
        setWrongIdx(i)
        setWrongHint(true)
        window.setTimeout(() => {
          setWrongIdx((w) => (w === i ? null : w))
          setWrongHint(false)
        }, 500)
      }
    },
    [phase, revealed, found, round.targets],
  )

  useEffect(() => {
    if (done) setPraise(pickOne(helpUsed ? PRAISE_OK : PRAISE_GOOD))
  }, [done, helpUsed])

  function revealRest() {
    setHelpUsed(true)
    setRevealed(true)
  }
  function nextLevel() {
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((kk) => kk + 1)
  }
  function replay() {
    setRoundKey((kk) => kk + 1)
  }

  const cells = phase === 'study' ? round.studied : round.current

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tiam-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-tiam-blue">
          Memoria · {level.name}
        </span>

        {phase === 'study' && !done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">{round.theme.studyTitle}</h2>
            <p className="mt-2 text-base text-slate-500">Dentro de un rato va a volver a aparecer con algunos cambios.</p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                key={`${levelIdx}-${roundKey}`}
                className="study-progress-fill h-full rounded-full bg-tiam-blue"
                style={{ animationDuration: `${level.studySeconds}s` }}
              />
            </div>
          </>
        )}

        {phase === 'change' && !done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué cambió?</h2>
            <p className="mt-2 text-base text-slate-500">{level.instruction}</p>
            <p className="mt-2 text-base font-semibold text-slate-500">
              Encontraste {found.size} de {k}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(found.size / k) * 100}%` }}
              />
            </div>
          </>
        )}

        {done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
              Encontraste {found.size} de {k}
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">{praise}</p>
          </>
        )}
      </div>

      {/* Grid — fixed 3 columns so positions mean the same thing across phases. */}
      <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 sm:gap-4">
        {cells.map((id, i) => {
          const isTarget = round.targets.has(i)
          const isFound = found.has(i)
          const isWrong = wrongIdx === i
          const showMissed = (done || revealed) && isTarget && !isFound
          const folder = round.theme.folder
          const img = id ? imgFor(folder, id) : undefined

          let stateClass = 'border-slate-200 bg-white'
          if (phase === 'study') {
            stateClass = id ? 'border-slate-200 bg-white' : 'border-dashed border-slate-300 bg-slate-50/50'
          } else if (isFound) {
            stateClass = 'border-tiam-green bg-tiam-green/5 ring-2 ring-tiam-green/30'
          } else if (showMissed) {
            stateClass = 'border-tiam-blue bg-tiam-blue/5 ring-2 ring-tiam-blue/30'
          } else if (isWrong) {
            stateClass = 'motion-safe:animate-[wiggle_0.4s_ease-in-out] border-slate-400 bg-white'
          } else if (!id) {
            stateClass = 'border-dashed border-slate-300 bg-slate-50/50'
          } else {
            stateClass = 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0'
          }

          return (
            <button
              key={i}
              type="button"
              disabled={phase !== 'change' || isFound || done}
              onClick={() => handleTap(i)}
              aria-label={id ? labelFor(id) : 'lugar vacío'}
              className={[
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 p-2 transition',
                'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                stateClass,
              ].join(' ')}
            >
              {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
              {isFound && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-green text-white shadow motion-safe:animate-[pop_0.3s_ease-out]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
              {showMissed && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tiam-blue text-white shadow">
                  <Eye className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Early-continue during study */}
      {phase === 'study' && !done && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled={!canContinueEarly}
            onClick={() => setPhase('change')}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-tiam-blue px-6 font-semibold text-white transition hover:bg-tiam-blue-dark disabled:opacity-40"
          >
            Ya estoy list@, continuar
          </button>
        </div>
      )}

      {/* Wrong-tap hint */}
      {phase === 'change' && wrongHint && !done && (
        <p className="mt-4 text-center text-sm font-medium text-slate-500">Ese no cambió, ¡seguí mirando!</p>
      )}

      {/* "No encuentro más" safety net */}
      {phase === 'change' && !done && helpAvailable && (
        <div className="mt-4 text-center">
          <button type="button" onClick={revealRest} className="text-sm text-slate-400 underline hover:text-slate-500">
            No encuentro más
          </button>
        </div>
      )}

      {/* Completion */}
      {done && (
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
              Jugar esta ronda otra vez
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
