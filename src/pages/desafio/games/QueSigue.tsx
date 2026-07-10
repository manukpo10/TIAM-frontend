import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, ArrowRight, Sparkles } from 'lucide-react'

/**
 * "¿Qué sigue?" — an illustrated pattern-completion (logical series) game.
 *
 * A row of illustrated tiles follows a repeating cyclic rule; the last slot is
 * "?", tap which of 4 options continues the pattern. Unlike the sequencing
 * games (Ordená la frase / Planificá la mañana / La charla desordenada), which
 * hand you a bank of KNOWN items to reconstruct a familiar order, here the rule
 * is HIDDEN and has to be induced from repetition, then projected one step
 * forward — a single tap-and-verify per round, closer to CadaCosaEnSuGrupo's
 * per-item loop than to any ordering game.
 *
 * Difficulty scales on two axes without ever growing the row past 6 slots
 * (mobile-safe): more distinct elements in the repeating unit (period 2→3→4),
 * and less confirming redundancy shown before the "?". A wrong tap eliminates
 * that option (muted grey, never red — reasoning task, one can re-examine),
 * exactly AnimalPorLetra's forgiving pattern.
 */

interface Round {
  sequence: string[]
  answer: string
  decoys: string[]
}
interface Level {
  n: number
  name: string
  pool: 'animal' | 'fruit' | 'object'
  hint?: string
  rounds: Round[]
}

const LEVELS: Level[] = [
  {
    n: 1,
    name: 'Nivel 1',
    pool: 'animal',
    hint: 'Las imágenes se repiten en un orden. Mirá la fila y elegí cuál va después.',
    rounds: [
      { sequence: ['gato', 'pato', 'gato', 'pato'], answer: 'gato', decoys: ['pato', 'vaca', 'elefante'] },
      { sequence: ['oso', 'rana', 'oso', 'rana'], answer: 'oso', decoys: ['rana', 'mono', 'tortuga'] },
      { sequence: ['vaca', 'mono', 'vaca', 'mono'], answer: 'vaca', decoys: ['mono', 'burro', 'cangrejo'] },
      { sequence: ['elefante', 'jirafa', 'elefante', 'jirafa'], answer: 'elefante', decoys: ['jirafa', 'zorro', 'delfin'] },
      { sequence: ['tortuga', 'burro', 'tortuga', 'burro'], answer: 'tortuga', decoys: ['burro', 'cebra', 'leon'] },
    ],
  },
  {
    n: 2,
    name: 'Nivel 2',
    pool: 'fruit',
    rounds: [
      { sequence: ['manzana-roja', 'banana', 'uva', 'manzana-roja', 'banana'], answer: 'uva', decoys: ['manzana-roja', 'banana', 'zanahoria'] },
      { sequence: ['pera', 'sandia', 'limon', 'pera', 'sandia'], answer: 'limon', decoys: ['pera', 'sandia', 'frutilla'] },
      { sequence: ['tomate', 'zanahoria', 'berenjena', 'tomate', 'zanahoria'], answer: 'berenjena', decoys: ['tomate', 'zanahoria', 'brocoli'] },
      { sequence: ['mandarina', 'pina', 'arandanos', 'mandarina', 'pina'], answer: 'arandanos', decoys: ['mandarina', 'pina', 'ciruela'] },
      { sequence: ['frambuesa', 'pimiento', 'ciruela', 'frambuesa', 'pimiento'], answer: 'ciruela', decoys: ['frambuesa', 'pimiento', 'granada'] },
    ],
  },
  {
    n: 3,
    name: 'Nivel 3',
    pool: 'object',
    hint: 'El patrón puede ser más largo que antes. Repasá bien toda la fila antes de responder.',
    rounds: [
      { sequence: ['anteojos', 'paraguas', 'llaves', 'tijera', 'anteojos'], answer: 'paraguas', decoys: ['anteojos', 'llaves', 'tijera'] },
      { sequence: ['mate', 'reloj-pulsera', 'libro', 'lapiz', 'mate'], answer: 'reloj-pulsera', decoys: ['mate', 'libro', 'lapiz'] },
      { sequence: ['taza', 'vela', 'florero', 'sol', 'taza'], answer: 'vela', decoys: ['taza', 'florero', 'sol'] },
      { sequence: ['termo', 'mate', 'bombilla', 'azucarera', 'termo'], answer: 'mate', decoys: ['termo', 'bombilla', 'azucarera'] },
      { sequence: ['cuaderno', 'lapicera', 'billetera', 'celular', 'cuaderno'], answer: 'lapicera', decoys: ['cuaderno', 'billetera', 'celular'] },
    ],
  },
]

// Three separate, folder-scoped globs — NOT one merged map. Filenames collide
// across folders with genuinely different art (e.g. oso/rana exist in several),
// so a bare-id lookup against a merged map could resolve to the wrong folder.
const ANIMAL_IMAGES = import.meta.glob('../../../assets/desafio/games/animal-por-letra/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const FRUIT_IMAGES = import.meta.glob('../../../assets/desafio/games/buscar-rojos/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const OBJECT_IMAGES = import.meta.glob('../../../assets/desafio/games/que-hay-en-la-mesa/*.webp', { eager: true, import: 'default' }) as Record<string, string>

function imgFrom(map: Record<string, string>, id: string): string | undefined {
  const match = Object.entries(map).find(([path]) => path.endsWith(`/${id}.webp`))
  return match?.[1]
}
function imagesFor(pool: Level['pool']): Record<string, string> {
  return pool === 'animal' ? ANIMAL_IMAGES : pool === 'fruit' ? FRUIT_IMAGES : OBJECT_IMAGES
}

const LABELS: Record<string, string> = {
  'manzana-roja': 'manzana', 'reloj-pulsera': 'reloj', 'control-remoto': 'control remoto',
}
const labelFor = (id: string) => LABELS[id] ?? id

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

const PRAISE = ['¡Exacto, así sigue!', '¡Muy bien, encontraste el patrón!', '¡Perfecto!', '¡Así se hace!', '¡Qué buen ojo para los patrones!']

export function QueSigue() {
  const [levelIdx, setLevelIdx] = useState(0)
  const [roundKey, setRoundKey] = useState(0)
  const level = LEVELS[levelIdx]
  const images = imagesFor(level.pool)

  const order = useMemo(
    () => shuffle(level.rounds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [levelIdx, roundKey],
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [eliminated, setEliminated] = useState<Set<string>>(new Set())
  const [revealed, setRevealed] = useState<string | null>(null)
  const [praise, setPraise] = useState(PRAISE[0])
  const [levelPraise, setLevelPraise] = useState(PRAISE[0])

  useEffect(() => {
    setCurrentIndex(0)
    setEliminated(new Set())
    setRevealed(null)
  }, [levelIdx, roundKey])

  const round = order[currentIndex]
  const done = currentIndex >= order.length

  useEffect(() => {
    if (done) setLevelPraise(pickOne(PRAISE))
  }, [done])

  const options = useMemo(
    () => (round ? shuffle([round.answer, ...round.decoys]) : []),
    [round],
  )

  function handleTap(id: string) {
    if (!round || revealed !== null || eliminated.has(id)) return
    if (id === round.answer) {
      setPraise(pickOne(PRAISE))
      setRevealed(id)
      window.setTimeout(() => {
        setCurrentIndex((i) => i + 1)
        setEliminated(new Set())
        setRevealed(null)
      }, 800)
    } else {
      setEliminated((prev) => new Set(prev).add(id))
    }
  }

  function nextLevel() {
    setLevelIdx((i) => (i < LEVELS.length - 1 ? i + 1 : 0))
    setRoundKey((k) => k + 1)
  }
  function replay() {
    setRoundKey((k) => k + 1)
  }

  return (
    <div className="p-5 sm:p-7">
      {/* Header */}
      <div className="text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(79, 70, 229, 0.1)', color: '#4F46E5' }}
        >
          Razonamiento · {level.name}
        </span>
        {!done && (
          <>
            <h2 className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">¿Qué sigue?</h2>
            <p className="mt-2 text-base text-slate-500">Mirá la secuencia y tocá la imagen que sigue.</p>
            {level.hint && <p className="mt-2 text-sm font-medium text-tiam-blue">{level.hint}</p>}
            <p className="mt-2 text-base font-semibold text-slate-500">
              Llevás {currentIndex} de {order.length}
            </p>
            <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-tiam-green transition-[width] duration-300"
                style={{ width: `${(currentIndex / order.length) * 100}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!done && round && (
        <>
          {/* Sequence row */}
          <div className="mt-6 flex items-center justify-center gap-1.5 overflow-x-auto">
            {round.sequence.map((id, i) => {
              const img = imgFrom(images, id)
              return (
                <div
                  key={i}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-1"
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                </div>
              )
            })}
            {/* The "?" slot */}
            <div
              className={[
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 p-1 text-lg font-black',
                revealed
                  ? 'border-tiam-green bg-tiam-green/10'
                  : 'border-dashed border-tiam-blue/40 bg-tiam-blue/5 text-tiam-blue',
              ].join(' ')}
            >
              {revealed ? (
                <img
                  src={imgFrom(images, revealed)}
                  alt=""
                  className="h-full w-full object-contain motion-safe:animate-[pop_0.3s_ease-out]"
                  draggable={false}
                />
              ) : (
                '?'
              )}
            </div>
          </div>

          {/* Praise flash (fixed height so nothing jumps) */}
          <p className="mt-3 h-5 text-center text-sm font-semibold text-tiam-green">
            {revealed ? praise : ''}
          </p>

          {/* Options */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            {options.map((id) => {
              const img = imgFrom(images, id)
              const isEliminated = eliminated.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isEliminated || revealed !== null}
                  onClick={() => handleTap(id)}
                  aria-label={labelFor(id)}
                  className={[
                    'relative flex aspect-square items-center justify-center rounded-2xl border-2 bg-white p-4 transition',
                    'focus:outline-none focus:ring-2 focus:ring-tiam-blue/40',
                    isEliminated
                      ? 'border-slate-200 opacity-40 grayscale'
                      : 'border-slate-200 hover:-translate-y-0.5 hover:border-tiam-blue/40 hover:shadow-md active:translate-y-0',
                  ].join(' ')}
                >
                  {img && <img src={img} alt="" className="h-full w-full object-contain" draggable={false} />}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Completion */}
      {done && (
        <div className="mt-6 rounded-3xl border border-tiam-green/20 bg-tiam-green/5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-tiam-green/15">
            <Sparkles className="h-6 w-6 text-tiam-green" />
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900">{levelPraise}</p>
          <p className="mt-1 text-slate-600">
            ¡Descubriste los {order.length} patrones — completaste el {level.name.toLowerCase()}!
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
              Otra serie
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
